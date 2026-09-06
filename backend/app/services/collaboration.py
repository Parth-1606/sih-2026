"""
Collaboration Orchestrator.

Orchestrates multi-agent collaborative investigation of AnomalyResult entities:
1. Ingests AnomalyResult
2. Gathers contextual history and concurrent parameters from the store
3. Runs domain agents:
   - AnomalyVerificationAgent (statistical & sensor sanity)
   - OceanographicContextAgent (physical environmental coupling)
   - EcologicalReasoningAgent (ecological impact deductions)
4. Runs SynthesisAgent (cross-verification, consensus, and final verdict)
5. Updates anomaly review status and records the full investigation trace
"""

import uuid
from datetime import datetime, timezone

from app.agents.anomaly_verification import AnomalyVerificationAgent
from app.agents.ecological_reasoning import EcologicalReasoningAgent
from app.agents.oceanographic_context import OceanographicContextAgent
from app.agents.synthesis import SynthesisAgent
from app.models.anomaly import InvestigationStatus
from app.models.investigation import Investigation, SynthesisStatus
from app.services.store import store


class CollaborationOrchestrator:
    """
    Coordinates multi-agent execution and synthesizes a verified investigation outcome.
    """

    def __init__(self) -> None:
        self.verif_agent = AnomalyVerificationAgent()
        self.context_agent = OceanographicContextAgent()
        self.eco_agent = EcologicalReasoningAgent()
        self.synthesis_agent = SynthesisAgent()

    def investigate(self, anomaly_id: str) -> Investigation | None:
        anomaly = store.get_anomaly(anomaly_id)
        if anomaly is None:
            return None

        now = datetime.now(timezone.utc)

        # Retrieve relevant empirical context
        parameter_history = store.history_for(
            parameter=anomaly.parameter,
            location_name=anomaly.location.name,
            before=anomaly.timestamp,
        )
        concurrent_obs = store.concurrent_observations(
            location_name=anomaly.location.name,
            target_time=anomaly.timestamp,
            window_hours=24.0,
        )

        # Step 1: Anomaly Verification
        verif_res = self.verif_agent.evaluate(anomaly, history=parameter_history)

        # Step 2: Oceanographic Context
        context_res = self.context_agent.evaluate(
            anomaly,
            concurrent_observations=concurrent_obs,
            parameter_history=parameter_history,
        )

        # Step 3: Ecological Reasoning
        eco_res = self.eco_agent.evaluate(
            anomaly,
            concurrent_observations=concurrent_obs,
        )

        agent_results = [verif_res, context_res, eco_res]

        # Step 4: Cross-verification & Synthesis
        synthesis_res = self.synthesis_agent.synthesize(anomaly, agent_results)

        # Step 5: Map verdict to workflow status
        if synthesis_res.synthesis_status == SynthesisStatus.CONFIRMED_ANOMALY:
            investigation_status = InvestigationStatus.CONFIRMED
        elif synthesis_res.synthesis_status == SynthesisStatus.SUSPECTED_SENSOR_GLITCH:
            investigation_status = InvestigationStatus.REJECTED
        elif synthesis_res.synthesis_status == SynthesisStatus.REQUIRES_FURTHER_DATA:
            investigation_status = InvestigationStatus.NEEDS_INVESTIGATION
        else:
            investigation_status = InvestigationStatus.UNDER_REVIEW

        # Update anomaly state in store
        store.update_anomaly_investigation_status(anomaly_id, investigation_status)

        investigation = Investigation(
            id=str(uuid.uuid4()),
            anomaly_id=anomaly.id,
            anomaly=anomaly,
            status=investigation_status,
            agreement_status=synthesis_res.agreement_status,
            agent_results=agent_results,
            synthesis=synthesis_res,
            confidence=synthesis_res.confidence,
            created_at=now,
            completed_at=datetime.now(timezone.utc),
        )

        store.add_investigation(investigation)
        return investigation


orchestrator = CollaborationOrchestrator()


def investigate_anomaly(anomaly_id: str) -> Investigation | None:
    """Convenience entry point for conducting a collaborative investigation."""
    return orchestrator.investigate(anomaly_id)
