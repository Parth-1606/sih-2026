import uuid
from datetime import datetime, timedelta, timezone

from app.models.anomaly import AnomalySeverity, InvestigationStatus
from app.models.common import Location
from app.models.observation import Observation
from app.services.anomaly_detection import evaluate_observation

LOCATION = Location(name="Test Buoy", lat=0.0, lon=0.0)


def _obs(value: float, days_ago: int, parameter: str = "sea_surface_temperature") -> Observation:
    return Observation(
        id=str(uuid.uuid4()),
        parameter=parameter,
        value=value,
        unit="°C",
        location=LOCATION,
        timestamp=datetime.now(timezone.utc) - timedelta(days=days_ago),
        source="test",
    )


def test_value_within_normal_range_is_not_flagged():
    historical = [_obs(27.5 + (i % 3) * 0.1, days_ago=30 - i) for i in range(20)]
    new_obs = _obs(27.6, days_ago=0)

    result = evaluate_observation(new_obs, historical)

    assert result.severity == AnomalySeverity.NORMAL
    assert result.investigation_status is None


def test_extreme_spike_is_flagged_severe_with_high_confidence():
    # Small, non-zero variance in the baseline so a z-score is computable.
    historical = [_obs(27.5 + (i % 4) * 0.05, days_ago=30 - i) for i in range(20)]
    new_obs = _obs(35.0, days_ago=0)

    result = evaluate_observation(new_obs, historical)

    assert result.severity == AnomalySeverity.SEVERE
    assert result.z_score is not None and abs(result.z_score) >= 3.0
    assert result.confidence > 0.5
    assert result.investigation_status == InvestigationStatus.NEW


def test_moderate_deviation_is_flagged_moderate_not_severe():
    historical = [_obs(27.5 + (i % 4) * 0.05, days_ago=30 - i) for i in range(20)]
    # Picked to land between the moderate (2.0) and severe (3.0) z cutoffs.
    new_obs = _obs(27.70, days_ago=0)

    result = evaluate_observation(new_obs, historical)

    assert result.severity == AnomalySeverity.MODERATE


def test_insufficient_history_is_not_guessed_at():
    historical = [_obs(27.5, days_ago=2)]  # below anomaly_min_baseline_samples (5)
    new_obs = _obs(27.6, days_ago=0)

    result = evaluate_observation(new_obs, historical)

    assert result.severity == AnomalySeverity.INSUFFICIENT_DATA
    assert result.confidence == 0.0
    assert result.z_score is None
    assert result.investigation_status is None


def test_evidence_includes_recent_history_and_source():
    historical = [_obs(27.5, days_ago=30 - i, parameter="chlorophyll") for i in range(10)]
    new_obs = _obs(0.7, days_ago=0, parameter="chlorophyll")

    result = evaluate_observation(new_obs, historical)

    assert result.evidence.baseline_sample_size == 10
    assert len(result.evidence.historical_points) == 5  # last 5 only
    assert result.evidence.data_source == "test"
