"""
Unit tests for individual ORCA collaborative agents and synthesis logic.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.agents.anomaly_verification import AnomalyVerificationAgent
from app.agents.ecological_reasoning import EcologicalReasoningAgent
from app.agents.oceanographic_context import OceanographicContextAgent
from app.agents.synthesis import SynthesisAgent
from app.models.agent import AgentResult, AgentStatus
from app.models.anomaly import (
    AnomalyResult,
    AnomalySeverity,
    ConfidenceBreakdown,
    Evidence,
    HistoricalPoint,
)
from app.models.common import Location
from app.models.investigation import AgreementStatus, SynthesisStatus
from app.models.observation import Observation

TEST_LOCATION = Location(name="Arabian Sea Buoy 12", lat=18.70, lon=72.40)


def _make_anomaly(
    parameter: str = "sea_surface_temperature",
    value: float = 31.8,
    baseline_mean: float = 27.5,
    baseline_std: float = 1.0,
    sample_size: int = 20,
    severity: AnomalySeverity = AnomalySeverity.SEVERE,
) -> AnomalyResult:
    now = datetime.now(timezone.utc)
    z = (value - baseline_mean) / baseline_std if baseline_std > 0 else 0.0
    return AnomalyResult(
        id=str(uuid.uuid4()),
        observation_id=str(uuid.uuid4()),
        parameter=parameter,
        value=value,
        unit="°C" if "temperature" in parameter else "mg/m³",
        location=TEST_LOCATION,
        timestamp=now,
        baseline_mean=baseline_mean,
        baseline_std=baseline_std,
        baseline_sample_size=sample_size,
        z_score=z,
        deviation=value - baseline_mean,
        severity=severity,
        confidence=0.85,
        confidence_breakdown=ConfidenceBreakdown(sample_size_factor=1.0, deviation_strength_factor=0.7),
        evidence=Evidence(
            baseline_sample_size=sample_size,
            historical_points=[HistoricalPoint(timestamp=now - timedelta(days=i), value=baseline_mean) for i in range(5)],
            data_source="test",
        ),
        evaluated_at=now,
    )


def test_anomaly_verification_valid_severe():
    agent = AnomalyVerificationAgent()
    anomaly = _make_anomaly(value=31.8, baseline_mean=27.5, baseline_std=1.0, sample_size=20)
    result = agent.evaluate(anomaly)

    assert result.agent_name == "anomaly_verification"
    assert result.status == AgentStatus.VERIFIED
    assert result.confidence > 0.5
    assert len(result.supporting_evidence) >= 2
    assert len(result.contradicting_evidence) == 0
    assert "verified" in result.conclusion.lower()


def test_anomaly_verification_insufficient_history():
    agent = AnomalyVerificationAgent()
    anomaly = _make_anomaly(sample_size=3, severity=AnomalySeverity.INSUFFICIENT_DATA)
    result = agent.evaluate(anomaly)

    assert result.status == AgentStatus.INSUFFICIENT_EVIDENCE
    assert result.confidence == 0.0
    assert len(result.warnings) > 0


def test_anomaly_verification_unphysical_reading():
    agent = AnomalyVerificationAgent()
    # 65°C is physically impossible for open seawater
    anomaly = _make_anomaly(value=65.0, baseline_mean=27.5, baseline_std=1.0)
    result = agent.evaluate(anomaly)

    assert result.status == AgentStatus.CONTRADICTED
    assert len(result.contradicting_evidence) > 0
    assert "violates physical marine boundary limits" in result.conclusion


def test_anomaly_verification_rapid_step_discontinuity():
    agent = AnomalyVerificationAgent()
    anomaly = _make_anomaly(value=39.0, baseline_mean=27.5, baseline_std=1.0)
    # History shows a 12°C jump in 2 hours
    prior_obs = Observation(
        id=str(uuid.uuid4()),
        parameter="sea_surface_temperature",
        value=27.0,
        unit="°C",
        location=TEST_LOCATION,
        timestamp=anomaly.timestamp - timedelta(hours=2),
        source="test",
    )
    result = agent.evaluate(anomaly, history=[prior_obs])

    assert len(result.contradicting_evidence) > 0
    assert any("ocean thermal inertia" in c for c in result.contradicting_evidence)


def test_oceanographic_context_with_concurrent_data():
    agent = OceanographicContextAgent()
    anomaly = _make_anomaly(parameter="sea_surface_temperature", value=31.8)
    chl_obs = Observation(
        id=str(uuid.uuid4()),
        parameter="chlorophyll",
        value=0.71,
        unit="mg/m³",
        location=TEST_LOCATION,
        timestamp=anomaly.timestamp,
        source="test",
    )
    result = agent.evaluate(anomaly, concurrent_observations=[chl_obs])

    assert result.agent_name == "oceanographic_context"
    assert result.status == AgentStatus.VERIFIED
    assert result.confidence > 0.5
    assert any("chlorophyll" in s.lower() for s in result.supporting_evidence)


def test_oceanographic_context_missing_secondary_data():
    agent = OceanographicContextAgent()
    anomaly = _make_anomaly(parameter="sea_surface_temperature", value=31.8)
    # Zero concurrent other observations
    result = agent.evaluate(anomaly, concurrent_observations=[])

    assert result.status == AgentStatus.INSUFFICIENT_EVIDENCE
    assert result.confidence == 0.0
    assert "No concurrent oceanographic parameters" in result.conclusion


def test_ecological_reasoning_sst_above_bleaching_threshold():
    agent = EcologicalReasoningAgent()
    anomaly = _make_anomaly(parameter="sea_surface_temperature", value=31.8)
    result = agent.evaluate(anomaly)

    assert result.agent_name == "ecological_reasoning"
    assert result.status == AgentStatus.VERIFIED
    # Verifies strict separation between empirical observation and inference
    assert any("[OBSERVED]" in s for s in result.supporting_evidence)
    assert any("[INFERENCE]" in w for w in result.warnings)
    assert any("coral bleaching" in w.lower() for w in result.warnings)


def test_ecological_reasoning_unmodeled_parameter():
    agent = EcologicalReasoningAgent()
    anomaly = _make_anomaly(parameter="unmodeled_chemical", value=100.0)
    result = agent.evaluate(anomaly)

    assert result.status == AgentStatus.INSUFFICIENT_EVIDENCE
    assert result.confidence == 0.0


def test_synthesis_unanimous_agreement():
    agent = SynthesisAgent()
    anomaly = _make_anomaly()
    now = datetime.now(timezone.utc)

    agent_results = [
        AgentResult(
            agent_name="anomaly_verification",
            status=AgentStatus.VERIFIED,
            conclusion="Verified statistical spike.",
            confidence=0.85,
            confidence_basis="Math verified",
            timestamp=now,
        ),
        AgentResult(
            agent_name="oceanographic_context",
            status=AgentStatus.VERIFIED,
            conclusion="Context is physically coherent.",
            confidence=0.80,
            confidence_basis="Concurrent params aligned",
            timestamp=now,
        ),
        AgentResult(
            agent_name="ecological_reasoning",
            status=AgentStatus.VERIFIED,
            conclusion="Significant bleaching risk identified.",
            confidence=0.88,
            confidence_basis="Bleaching thresholds crossed",
            timestamp=now,
        ),
    ]

    synthesis = agent.synthesize(anomaly, agent_results)

    assert synthesis.agreement_status == AgreementStatus.UNANIMOUS_AGREEMENT
    assert synthesis.synthesis_status == SynthesisStatus.CONFIRMED_ANOMALY
    assert synthesis.confidence > 0.8
    assert "CONFIRMS" in synthesis.overall_conclusion


def test_synthesis_disagreement_on_sensor_glitch():
    agent = SynthesisAgent()
    anomaly = _make_anomaly()
    now = datetime.now(timezone.utc)

    agent_results = [
        AgentResult(
            agent_name="anomaly_verification",
            status=AgentStatus.CONTRADICTED,
            conclusion="Violates physical temperature boundaries.",
            contradicting_evidence=["Value > 45°C limit"],
            confidence=0.95,
            confidence_basis="Physical boundary",
            timestamp=now,
        ),
        AgentResult(
            agent_name="oceanographic_context",
            status=AgentStatus.VERIFIED,
            conclusion="Context observed.",
            confidence=0.6,
            confidence_basis="Contextual",
            timestamp=now,
        ),
    ]

    synthesis = agent.synthesize(anomaly, agent_results)

    assert synthesis.agreement_status == AgreementStatus.DISAGREEMENT
    assert synthesis.synthesis_status == SynthesisStatus.SUSPECTED_SENSOR_GLITCH
    assert "recalibration" in synthesis.recommended_action.lower()


def test_synthesis_insufficient_evidence():
    agent = SynthesisAgent()
    anomaly = _make_anomaly()
    now = datetime.now(timezone.utc)

    agent_results = [
        AgentResult(
            agent_name="anomaly_verification",
            status=AgentStatus.INSUFFICIENT_EVIDENCE,
            conclusion="Sample size too small.",
            confidence=0.0,
            confidence_basis="Insufficient",
            timestamp=now,
        ),
        AgentResult(
            agent_name="oceanographic_context",
            status=AgentStatus.INSUFFICIENT_EVIDENCE,
            conclusion="No concurrent parameters.",
            confidence=0.0,
            confidence_basis="Insufficient",
            timestamp=now,
        ),
    ]

    synthesis = agent.synthesize(anomaly, agent_results)

    assert synthesis.agreement_status == AgreementStatus.INSUFFICIENT_EVIDENCE
    assert synthesis.synthesis_status == SynthesisStatus.REQUIRES_FURTHER_DATA
