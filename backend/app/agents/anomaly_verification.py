"""
Anomaly Verification Agent.

Audits statistical validity, calculation integrity, and sensor sanity of an AnomalyResult.
Does NOT re-decide z-scores or replace statistical thresholds.
"""

from datetime import datetime, timezone
from app.core.config import settings
from app.models.agent import AgentResult, AgentStatus
from app.models.anomaly import AnomalyResult, AnomalySeverity
from app.models.observation import Observation


# Physical bounds for marine parameters (sanity boundaries for sensor check)
PHYSICAL_BOUNDS: dict[str, tuple[float, float]] = {
    "sea_surface_temperature": (-2.0, 45.0),  # °C: Seawater freezes at ~ -1.9°C, global open ocean max ~ 38°C (Persian Gulf)
    "chlorophyll": (0.0, 100.0),             # mg/m³: Open ocean typical 0.01 - 10, intense blooms rarely exceed 80-100
    "salinity": (0.0, 50.0),                 # PSU / ppt
    "dissolved_oxygen": (0.0, 20.0),         # mg/L
    "wave_height": (0.0, 35.0),              # meters: Extreme hurricane/storm ceiling
}

# Maximum plausible 24-hour rate of change in open ocean surface waters
MAX_24H_DELTA: dict[str, float] = {
    "sea_surface_temperature": 8.0,          # °C: Jumps > 8°C in 24h strongly indicate sensor glitch or water-to-air exposure
    "chlorophyll": 25.0,
}


class AnomalyVerificationAgent:
    """
    Audits an AnomalyResult for mathematical integrity, sample size adequacy,
    and physical sensor plausibility.
    """

    agent_name: str = "anomaly_verification"

    def evaluate(self, anomaly: AnomalyResult, history: list[Observation] | None = None) -> AgentResult:
        now = datetime.now(timezone.utc)
        supporting: list[str] = []
        contradicting: list[str] = []
        warnings: list[str] = []
        evidence_ids: list[str] = [anomaly.observation_id]

        # 1. Baseline sample size check
        sample_size = anomaly.baseline_sample_size
        if sample_size < settings.anomaly_min_baseline_samples or anomaly.severity == AnomalySeverity.INSUFFICIENT_DATA:
            return AgentResult(
                agent_name=self.agent_name,
                status=AgentStatus.INSUFFICIENT_EVIDENCE,
                conclusion=(
                    f"Insufficient historical data ({sample_size} readings, minimum required: "
                    f"{settings.anomaly_min_baseline_samples}). Statistical anomaly cannot be reliably verified."
                ),
                supporting_evidence=[],
                contradicting_evidence=[
                    f"Baseline sample size {sample_size} is below statistical requirement {settings.anomaly_min_baseline_samples}"
                ],
                evidence_ids=evidence_ids,
                confidence=0.0,
                confidence_basis="Sample size below minimum baseline requirement (zero confidence assigned)",
                timestamp=now,
                warnings=["Historical baseline contains too few observations for statistically sound inference."],
            )

        supporting.append(f"Historical baseline sample size of {sample_size} readings meets minimum threshold ({settings.anomaly_min_baseline_samples}).")

        # 2. Physical boundary plausibility
        param = anomaly.parameter.lower()
        if param in PHYSICAL_BOUNDS:
            min_val, max_val = PHYSICAL_BOUNDS[param]
            if anomaly.value < min_val or anomaly.value > max_val:
                contradicting.append(
                    f"Measured value {anomaly.value}{anomaly.unit} is outside physically possible marine boundaries "
                    f"[{min_val}, {max_val}] for {anomaly.parameter}."
                )
                warnings.append("Critical sensor telemetry failure: impossible environmental measurement.")
                return AgentResult(
                    agent_name=self.agent_name,
                    status=AgentStatus.CONTRADICTED,
                    conclusion=(
                        f"Anomaly rejected: value {anomaly.value}{anomaly.unit} violates physical marine boundary limits "
                        f"[{min_val}, {max_val}] and represents instrument error rather than an environmental event."
                    ),
                    supporting_evidence=supporting,
                    contradicting_evidence=contradicting,
                    evidence_ids=evidence_ids,
                    confidence=0.95,
                    confidence_basis="Exceeds absolute thermodynamic/physical limits for marine waters",
                    timestamp=now,
                    warnings=warnings,
                )
            else:
                supporting.append(f"Measured value {anomaly.value}{anomaly.unit} is within physical oceanographic limits [{min_val}, {max_val}].")

        # 3. Mathematical verification
        z = anomaly.z_score
        mean = anomaly.baseline_mean
        std = anomaly.baseline_std

        if z is None or mean is None or std is None or std == 0:
            return AgentResult(
                agent_name=self.agent_name,
                status=AgentStatus.INCONCLUSIVE,
                conclusion="Unable to verify anomaly: baseline standard deviation is zero or z-score is undefined.",
                supporting_evidence=supporting,
                contradicting_evidence=["Undefined z-score or zero baseline variance."],
                evidence_ids=evidence_ids,
                confidence=0.0,
                confidence_basis="Zero variance in baseline prevents statistical verification",
                timestamp=now,
                warnings=["Baseline has zero variance; identical prior measurements."],
            )

        # Confirm z-score arithmetic
        expected_z = (anomaly.value - mean) / std
        if abs(z - expected_z) > 0.05:
            contradicting.append(f"Reported z-score ({z:.2f}) does not match recalculated baseline z-score ({expected_z:.2f}).")
            warnings.append("Internal calculation mismatch detected in anomaly payload.")
        else:
            supporting.append(
                f"Statistical calculation verified: value {anomaly.value:.2f} is {z:+.2f} standard deviations "
                f"from baseline mean {mean:.2f} (std={std:.2f})."
            )

        # 4. Check temporal rate of change against immediate predecessor if history available
        if history and len(history) > 0:
            # Sort history by timestamp
            sorted_history = sorted(history, key=lambda o: o.timestamp)
            last_obs = sorted_history[-1]
            delta_val = abs(anomaly.value - last_obs.value)
            time_delta_h = max((anomaly.timestamp - last_obs.timestamp).total_seconds() / 3600.0, 0.1)

            if param in MAX_24H_DELTA and time_delta_h <= 24.0:
                max_delta = MAX_24H_DELTA[param]
                if delta_val > max_delta:
                    contradicting.append(
                        f"Instantaneous step change of {delta_val:.2f}{anomaly.unit} in {time_delta_h:.1f}h "
                        f"exceeds typical ocean thermal inertia limit ({max_delta:.1f}{anomaly.unit}/24h)."
                    )
                    warnings.append("Rapid step change observed without gradual ramp; potential sensor artifact.")

        # 5. Determine verification status and explainable confidence
        # Basis: statistical sample size factor (weight 0.5) + deviation strength factor (weight 0.5)
        sample_factor = min(sample_size / 20.0, 1.0)
        deviation_factor = min(abs(z) / 5.0, 1.0)
        computed_confidence = round(0.5 * sample_factor + 0.5 * deviation_factor, 2)

        if contradicting:
            status = AgentStatus.INCONCLUSIVE if len(contradicting) == 1 and not warnings else AgentStatus.CONTRADICTED
            computed_confidence = max(round(computed_confidence * 0.5, 2), 0.2)
            conclusion = (
                f"Statistical anomaly flagged at z={z:+.2f} ({anomaly.severity.value}), but verification caveats exist: "
                + "; ".join(contradicting)
            )
        else:
            if anomaly.severity == AnomalySeverity.NORMAL:
                status = AgentStatus.VERIFIED
                conclusion = f"Verified as statistically normal: z={z:+.2f} is within acceptable variance range."
            else:
                status = AgentStatus.VERIFIED
                conclusion = (
                    f"Statistical anomaly verified: {anomaly.parameter} reading of {anomaly.value}{anomaly.unit} "
                    f"demonstrates a confirmed {anomaly.severity.value} deviation (z={z:+.2f}) from the {mean:.2f} baseline."
                )

        confidence_basis = (
            f"Formula: 0.5 * sample_factor({sample_factor:.2f}) + 0.5 * deviation_factor({deviation_factor:.2f})"
            + (" (penalized for temporal discontinuity)" if contradicting else "")
        )

        return AgentResult(
            agent_name=self.agent_name,
            status=status,
            conclusion=conclusion,
            supporting_evidence=supporting,
            contradicting_evidence=contradicting,
            evidence_ids=evidence_ids,
            confidence=computed_confidence,
            confidence_basis=confidence_basis,
            timestamp=now,
            warnings=warnings,
        )
