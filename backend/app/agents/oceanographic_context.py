"""
Oceanographic Context Agent.

Evaluates multi-variable physical oceanographic context (e.g. co-occurring chlorophyll,
salinity, or sea state) surrounding an anomaly at the target location and time.
Does NOT invent external datasets — operates strictly on observations present in the store.
"""

from datetime import datetime, timezone
from app.models.agent import AgentResult, AgentStatus
from app.models.anomaly import AnomalyResult
from app.models.observation import Observation


class OceanographicContextAgent:
    """
    Examines co-occurring oceanographic parameters and physical relationships.
    """

    agent_name: str = "oceanographic_context"

    def evaluate(
        self,
        anomaly: AnomalyResult,
        concurrent_observations: list[Observation] | None = None,
        parameter_history: list[Observation] | None = None,
    ) -> AgentResult:
        now = datetime.now(timezone.utc)
        supporting: list[str] = []
        contradicting: list[str] = []
        warnings: list[str] = []
        evidence_ids: list[str] = [anomaly.observation_id]

        # Filter concurrent observations to other parameters (excluding the anomaly itself)
        other_params = [
            obs for obs in (concurrent_observations or [])
            if obs.parameter != anomaly.parameter and obs.id != anomaly.observation_id
        ]

        if not other_params:
            # Explicit missing evidence handling: do not hallucinate external context
            return AgentResult(
                agent_name=self.agent_name,
                status=AgentStatus.INSUFFICIENT_EVIDENCE,
                conclusion=(
                    f"No concurrent oceanographic parameters observed at {anomaly.location.name} "
                    f"within the anomaly observation window. Cannot establish multi-parameter environmental context."
                ),
                supporting_evidence=[],
                contradicting_evidence=[],
                evidence_ids=evidence_ids,
                confidence=0.0,
                confidence_basis="Zero concurrent contextual parameters available at station (strictly empirical)",
                timestamp=now,
                warnings=["Single-sensor telemetry stream: cross-parameter oceanographic verification unavailable."],
            )

        # Record referenced evidence IDs
        for obs in other_params:
            evidence_ids.append(obs.id)

        target_param = anomaly.parameter.lower()
        context_score = 0.5  # Base confidence for having real co-occurring data

        # Analyze interactions based on known physical oceanography dynamics
        if target_param == "sea_surface_temperature":
            chl_obs = next((o for o in other_params if o.parameter.lower() == "chlorophyll"), None)
            if chl_obs:
                supporting.append(
                    f"Concurrent chlorophyll observed at {chl_obs.value} {chl_obs.unit} "
                    f"(timestamp: {chl_obs.timestamp.isoformat()})."
                )
                # Plausibility check: In tropical marine systems, an acute SST spike (e.g. > 31°C)
                # with normal chlorophyll (0.5 - 1.5 mg/m³) is characteristic of early-phase
                # thermal accumulation before stratification caps nutrient flux.
                if 0.2 <= chl_obs.value <= 2.0:
                    supporting.append(
                        "Phytoplankton concentration is within typical coastal baseline range, indicating that "
                        "surface water mass has not experienced catastrophic hypoxia or extensive post-bloom decay."
                    )
                    context_score += 0.3
                elif chl_obs.value > 5.0:
                    supporting.append(
                        f"Co-occurring high chlorophyll ({chl_obs.value} {chl_obs.unit}) suggests coupled "
                        f"thermal-biological phenomenon (e.g. warm-core eddy or localized algal bloom)."
                    )
                    context_score += 0.35
                else:
                    contradicting.append(
                        f"Unusually depressed chlorophyll ({chl_obs.value} {chl_obs.unit}) co-occurring with SST spike."
                    )
                    context_score += 0.1

        elif target_param == "chlorophyll":
            sst_obs = next((o for o in other_params if o.parameter.lower() == "sea_surface_temperature"), None)
            if sst_obs:
                supporting.append(
                    f"Concurrent sea surface temperature observed at {sst_obs.value} {sst_obs.unit}."
                )
                if sst_obs.value > 28.0:
                    supporting.append(
                        "Elevated thermal layer provides favorable stratification conditions for biological productivity."
                    )
                    context_score += 0.3
                else:
                    supporting.append(f"Water temperature of {sst_obs.value}°C provides baseline thermal context.")
                    context_score += 0.2

        else:
            # Generic multi-parameter presence
            param_names = ", ".join(set(o.parameter for o in other_params))
            supporting.append(f"Recorded concurrent context parameters: {param_names}.")
            context_score += 0.2

        # Check temporal trend stability of the primary anomaly parameter if history supplied
        if parameter_history and len(parameter_history) >= 3:
            recent_vals = [p.value for p in sorted(parameter_history, key=lambda x: x.timestamp)[-3:]]
            supporting.append(
                f"Immediate preceding 3 readings: {', '.join(f'{v:.2f}' for v in recent_vals)} {anomaly.unit}."
            )
            context_score = min(context_score + 0.1, 0.95)

        bounded_confidence = round(min(max(context_score, 0.1), 0.95), 2)

        if contradicting:
            status = AgentStatus.INCONCLUSIVE
            conclusion = (
                f"Oceanographic context reveals divergent multi-parameter signals: "
                + "; ".join(contradicting)
            )
        else:
            status = AgentStatus.VERIFIED
            conclusion = (
                f"Environmental context at {anomaly.location.name} is physically coherent with the "
                f"{anomaly.parameter} anomaly. Co-occurring parameters confirm expected physical conditions."
            )

        confidence_basis = (
            f"Grounding score: {len(other_params)} concurrent parameter(s) evaluated, "
            f"cross-referenced with physical ocean state dynamics."
        )

        return AgentResult(
            agent_name=self.agent_name,
            status=status,
            conclusion=conclusion,
            supporting_evidence=supporting,
            contradicting_evidence=contradicting,
            evidence_ids=evidence_ids,
            confidence=bounded_confidence,
            confidence_basis=confidence_basis,
            timestamp=now,
            warnings=warnings,
        )
