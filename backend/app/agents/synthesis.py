"""
Synthesis Agent.

Combines the structured evaluations of Anomaly Verification, Oceanographic Context,
and Ecological Reasoning agents to detect consensus, resolve contradictions, and
produce a final actionable investigation verdict.
"""

from app.models.agent import AgentResult, AgentStatus
from app.models.anomaly import AnomalyResult, AnomalySeverity
from app.models.investigation import AgreementStatus, SynthesisResult, SynthesisStatus


class SynthesisAgent:
    """
    Cross-verifies individual agent reports and produces a consolidated, explainable synthesis.
    """

    agent_name: str = "synthesis"

    def synthesize(self, anomaly: AnomalyResult, agent_results: list[AgentResult]) -> SynthesisResult:
        statuses = {res.agent_name: res.status for res in agent_results}
        verif_res = next((r for r in agent_results if r.agent_name == "anomaly_verification"), None)

        # 1. Consensus detection
        verified_count = sum(1 for r in agent_results if r.status == AgentStatus.VERIFIED)
        contradicted_count = sum(1 for r in agent_results if r.status == AgentStatus.CONTRADICTED)
        insufficient_count = sum(1 for r in agent_results if r.status == AgentStatus.INSUFFICIENT_EVIDENCE)
        total_agents = len(agent_results)

        if contradicted_count > 0:
            agreement_status = AgreementStatus.DISAGREEMENT
            consensus_weight = 0.35
        elif insufficient_count >= 2 or (verif_res and verif_res.status == AgentStatus.INSUFFICIENT_EVIDENCE):
            agreement_status = AgreementStatus.INSUFFICIENT_EVIDENCE
            consensus_weight = 0.10
        elif verified_count == total_agents:
            agreement_status = AgreementStatus.UNANIMOUS_AGREEMENT
            consensus_weight = 1.0
        elif verified_count >= 2:
            agreement_status = AgreementStatus.MAJORITY_AGREEMENT
            consensus_weight = 0.80
        else:
            agreement_status = AgreementStatus.DISAGREEMENT
            consensus_weight = 0.40

        # 2. Key findings aggregation
        key_findings: list[str] = []
        for r in agent_results:
            key_findings.append(f"[{r.agent_name}]: {r.conclusion}")

        # 3. Verdict determination
        if verif_res and verif_res.status == AgentStatus.CONTRADICTED:
            synthesis_status = SynthesisStatus.SUSPECTED_SENSOR_GLITCH
            primary_driver = "Sensor telemetry violation / hardware artifact"
            overall_conclusion = (
                f"Investigation concludes anomaly on {anomaly.parameter} at {anomaly.location.name} is a "
                f"SUSPECTED SENSOR GLITCH. The anomaly verification agent identified physical or rate-of-change "
                f"violations that invalidate the reading as an environmental event."
            )
            recommended_action = (
                f"Flag buoy sensor at {anomaly.location.name} for technical recalibration. "
                f"Exclude measurement ({anomaly.value}{anomaly.unit}) from historical baseline training."
            )
        elif agreement_status == AgreementStatus.INSUFFICIENT_EVIDENCE:
            synthesis_status = SynthesisStatus.REQUIRES_FURTHER_DATA
            primary_driver = "Inadequate statistical or environmental context"
            overall_conclusion = (
                f"Investigation is INCONCLUSIVE due to insufficient data. Required baseline or contextual "
                f"observations are missing at {anomaly.location.name}."
            )
            recommended_action = (
                f"Continue baseline observation ingestion at {anomaly.location.name} until minimum "
                f"sample threshold is fulfilled."
            )
        elif anomaly.severity == AnomalySeverity.NORMAL:
            synthesis_status = SynthesisStatus.BENIGN_DEVIATION
            primary_driver = "Normal background ocean variance"
            overall_conclusion = (
                f"Investigation confirms reading of {anomaly.value}{anomaly.unit} sits within ordinary "
                f"statistical variance boundaries. No actionable marine anomaly detected."
            )
            recommended_action = "No intervention required. Standard monitoring continues."
        else:
            synthesis_status = SynthesisStatus.CONFIRMED_ANOMALY
            primary_driver = (
                f"Acute {anomaly.parameter.replace('_', ' ').title()} deviation ({anomaly.severity.value.upper()})"
            )
            overall_conclusion = (
                f"Investigation CONFIRMS marine anomaly: {anomaly.parameter} at {anomaly.location.name} "
                f"is a confirmed {anomaly.severity.value} environmental event (z={anomaly.z_score:+.2f}). "
                f"Collaborative agents established consensus ({agreement_status.value.replace('_', ' ')})."
            )
            if anomaly.parameter == "sea_surface_temperature":
                recommended_action = (
                    f"Issue Marine Heatwave Advisory (Watch level) for sector near {anomaly.location.lat:.2f}°N, "
                    f"{anomaly.location.lon:.2f}°E. Cross-verify with satellite radiometer passes (INSAT-3D / MODIS) "
                    f"and monitor benthic temperature trends."
                )
            elif anomaly.parameter == "chlorophyll":
                recommended_action = (
                    f"Initiate water sampling protocol at {anomaly.location.name} to screen for potential "
                    f"harmful algal bloom taxa (e.g. Noctiluca scintillans / Dinophysis)."
                )
            else:
                recommended_action = f"Initiate secondary sensor cross-check for {anomaly.parameter} in sector."

        # 4. Multi-factor synthesized confidence
        stat_conf = anomaly.confidence
        agent_conf_avg = (
            sum(r.confidence for r in agent_results) / len(agent_results)
            if agent_results
            else 0.0
        )
        synthesized_confidence = round(
            0.4 * stat_conf + 0.3 * consensus_weight + 0.3 * agent_conf_avg,
            2,
        )
        synthesized_confidence = max(0.0, min(synthesized_confidence, 1.0))

        confidence_breakdown = {
            "statistical_anomaly_confidence": stat_conf,
            "agent_consensus_weight": consensus_weight,
            "agent_confidence_average": round(agent_conf_avg, 2),
            "synthesized_final_confidence": synthesized_confidence,
        }

        return SynthesisResult(
            synthesis_status=synthesis_status,
            agreement_status=agreement_status,
            overall_conclusion=overall_conclusion,
            recommended_action=recommended_action,
            confidence=synthesized_confidence,
            confidence_breakdown=confidence_breakdown,
            primary_driver=primary_driver,
            key_findings=key_findings,
        )
