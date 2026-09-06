"""
Ecological Reasoning Agent.

Translates verified physical observations into marine ecosystem impacts, trophic consequences,
and biodiversity risk assessments.
Strictly distinguishes empirical observed facts from ecological inferences.
"""

from datetime import datetime, timezone
from app.models.agent import AgentResult, AgentStatus
from app.models.anomaly import AnomalyResult
from app.models.observation import Observation


# Regional ecological thresholds for Indian Ocean / Arabian Sea waters
ECOLOGICAL_THRESHOLDS = {
    "sea_surface_temperature": {
        "coral_bleaching_alert": 30.5,    # °C: Thermal stress accumulation threshold (MMM + 1°C)
        "coral_bleaching_severe": 31.5,   # °C: Acute mortality risk if sustained
        "fish_habitat_optimal_max": 29.5, # °C: Optimum pelagic foraging range (sardines/mackerel)
    },
    "chlorophyll": {
        "oligotrophic_threshold": 0.15,   # mg/m³: Low productivity threshold
        "mesotrophic_optimal": 0.50,      # mg/m³: Balanced marine food web
        "eutrophic_bloom_warning": 5.0,   # mg/m³: Potential harmful algal bloom trigger
    },
}


class EcologicalReasoningAgent:
    """
    Evaluates ecological consequences of ocean anomalies, rigorously distinguishing
    observed empirical readings from ecological risk deductions.
    """

    agent_name: str = "ecological_reasoning"

    def evaluate(
        self,
        anomaly: AnomalyResult,
        concurrent_observations: list[Observation] | None = None,
    ) -> AgentResult:
        now = datetime.now(timezone.utc)
        supporting: list[str] = []
        contradicting: list[str] = []
        warnings: list[str] = []
        evidence_ids: list[str] = [anomaly.observation_id]

        param = anomaly.parameter.lower()
        if param not in ECOLOGICAL_THRESHOLDS:
            return AgentResult(
                agent_name=self.agent_name,
                status=AgentStatus.INSUFFICIENT_EVIDENCE,
                conclusion=(
                    f"Parameter '{anomaly.parameter}' does not have defined ecological impact models "
                    f"in the marine biological domain taxonomy. Ecological assessment deferred."
                ),
                supporting_evidence=[],
                contradicting_evidence=[],
                evidence_ids=evidence_ids,
                confidence=0.0,
                confidence_basis="Zero domain-specific biological thresholds defined for this parameter",
                timestamp=now,
                warnings=["Unmodeled ecological parameter: specialized marine biology rules required."],
            )

        thresholds = ECOLOGICAL_THRESHOLDS[param]
        confidence_factors: list[float] = []

        if param == "sea_surface_temperature":
            val = anomaly.value
            # Explicit distinction: Observed vs Inferred
            supporting.append(
                f"[OBSERVED] Water temperature measured at {val:.2f}°C (deviation: {anomaly.deviation:+.2f}°C "
                f"from {anomaly.baseline_mean:.2f}°C baseline)."
            )

            # Check co-occurring chlorophyll to ground ecological state
            chl_obs = next(
                (o for o in (concurrent_observations or []) if o.parameter.lower() == "chlorophyll"),
                None
            )
            if chl_obs:
                evidence_ids.append(chl_obs.id)
                supporting.append(
                    f"[OBSERVED] Co-occurring chlorophyll concentration is {chl_obs.value:.2f} {chl_obs.unit}."
                )

            # Ecological inferences
            if val >= thresholds["coral_bleaching_severe"]:
                warnings.append(
                    f"[INFERENCE] Severe thermal stress: SST ({val:.1f}°C) surpasses the acute coral bleaching "
                    f"and mortality threshold ({thresholds['coral_bleaching_severe']}°C). High risk of benthic bleaching."
                )
                warnings.append(
                    f"[INFERENCE] Pelagic habitat displacement: Temperature exceeds fish optimum ({thresholds['fish_habitat_optimal_max']}°C). "
                    f"Anticipate downward vertical migration or offshore movement away from surface layers."
                )
                confidence_factors.append(0.90)
            elif val >= thresholds["coral_bleaching_alert"]:
                warnings.append(
                    f"[INFERENCE] Thermal stress warning: SST ({val:.1f}°C) exceeds bleaching watch threshold "
                    f"({thresholds['coral_bleaching_alert']}°C). Degree Heating Weeks (DHW) monitoring required."
                )
                confidence_factors.append(0.80)
            else:
                supporting.append(
                    f"[INFERENCE] SST ({val:.1f}°C) remains below critical marine biological stress thresholds."
                )
                confidence_factors.append(0.70)

            if chl_obs and chl_obs.value < 0.3:
                warnings.append(
                    "[INFERENCE] Trophic warning: Low chlorophyll coupled with elevated SST suggests intense thermal "
                    "stratification limiting primary productivity in the photic zone."
                )

        elif param == "chlorophyll":
            val = anomaly.value
            supporting.append(
                f"[OBSERVED] Chlorophyll-a concentration measured at {val:.2f} {anomaly.unit} "
                f"(baseline mean: {anomaly.baseline_mean:.2f})."
            )

            if val >= thresholds["eutrophic_bloom_warning"]:
                warnings.append(
                    f"[INFERENCE] Harmful Algal Bloom (HAB) risk: Concentration ({val:.2f} mg/m³) exceeds "
                    f"eutrophic threshold ({thresholds['eutrophic_bloom_warning']} mg/m³). Potential localized nocturnal hypoxia."
                )
                confidence_factors.append(0.85)
            elif val < thresholds["oligotrophic_threshold"]:
                warnings.append(
                    f"[INFERENCE] Oligotrophic depletion: Low primary biomass ({val:.2f} mg/m³) indicates depleted "
                    f"grazing foundation for local larval fish populations."
                )
                confidence_factors.append(0.80)
            else:
                supporting.append(
                    f"[INFERENCE] Chlorophyll ({val:.2f} mg/m³) reflects productive mesotrophic marine ecosystem conditions."
                )
                confidence_factors.append(0.75)

        avg_confidence = round(sum(confidence_factors) / len(confidence_factors), 2) if confidence_factors else 0.5
        status = AgentStatus.VERIFIED if warnings else AgentStatus.INCONCLUSIVE
        conclusion = (
            f"Ecological evaluation complete for {anomaly.location.name}: "
            + ("Significant ecological stress identified; " if warnings else "No severe ecological stress detected; ")
            + f"{len(supporting)} observed facts evaluated against regional marine biological thresholds."
        )

        confidence_basis = (
            f"Biological risk evaluated against regional Arabian Sea thresholds: "
            f"observed parameter level is {anomaly.value:.2f}{anomaly.unit}."
        )

        return AgentResult(
            agent_name=self.agent_name,
            status=status,
            conclusion=conclusion,
            supporting_evidence=supporting,
            contradicting_evidence=contradicting,
            evidence_ids=evidence_ids,
            confidence=avg_confidence,
            confidence_basis=confidence_basis,
            timestamp=now,
            warnings=warnings,
        )
