"""
Integration tests for the Collaboration Orchestrator.
"""

import uuid
from datetime import datetime, timezone

from app.data.seed import generate_seed_observations
from app.models.anomaly import AnomalyResult, AnomalySeverity, InvestigationStatus
from app.models.common import Location
from app.models.investigation import AgreementStatus, SynthesisStatus
from app.models.observation import Observation
from app.services.anomaly_detection import evaluate_observation
from app.services.collaboration import orchestrator, investigate_anomaly
from app.services.store import store

TEST_LOCATION = Location(name="Arabian Sea Buoy 12", lat=18.70, lon=72.40)


def setup_function():
    """Reset and re-seed the in-memory store before each test."""
    store._observations.clear()
    store._anomalies.clear()
    store._investigations.clear()

    # Replay standard seed dataset
    for obs in generate_seed_observations():
        hist = store.history_for(obs.parameter, obs.location.name, before=obs.timestamp)
        result = evaluate_observation(obs, hist)
        store.add_observation(obs)
        store.add_anomaly(result)


def test_investigate_seeded_anomaly_end_to_end():
    # Retrieve the seeded severe SST anomaly (the deliberate spike)
    flagged = store.list_anomalies()
    assert len(flagged) > 0

    target_anomaly = flagged[0]  # Deliberate SST spike
    assert target_anomaly.parameter == "sea_surface_temperature"
    assert target_anomaly.severity in (AnomalySeverity.SEVERE, AnomalySeverity.MODERATE)

    # Initial state is NEW
    assert target_anomaly.investigation_status == InvestigationStatus.NEW

    # Run collaborative investigation
    investigation = investigate_anomaly(target_anomaly.id)

    assert investigation is not None
    assert investigation.anomaly_id == target_anomaly.id
    assert investigation.status == InvestigationStatus.CONFIRMED
    assert investigation.synthesis.synthesis_status == SynthesisStatus.CONFIRMED_ANOMALY
    assert investigation.agreement_status in (AgreementStatus.UNANIMOUS_AGREEMENT, AgreementStatus.MAJORITY_AGREEMENT)
    assert len(investigation.agent_results) == 3

    # Check that individual agents executed and gave valid results
    agent_names = [r.agent_name for r in investigation.agent_results]
    assert "anomaly_verification" in agent_names
    assert "oceanographic_context" in agent_names
    assert "ecological_reasoning" in agent_names

    # Check store persistence
    stored_inv = store.get_investigation(investigation.id)
    assert stored_inv is not None
    assert stored_inv.id == investigation.id

    # Check that the anomaly in the store had its investigation_status updated
    updated_anomaly = store.get_anomaly(target_anomaly.id)
    assert updated_anomaly.investigation_status == InvestigationStatus.CONFIRMED


def test_investigate_nonexistent_anomaly_returns_none():
    res = investigate_anomaly("non-existent-id-123")
    assert res is None


def test_investigate_sensor_glitch_triggers_disagreement_and_rejection():
    # Insert an unphysical reading (75°C) to simulate hardware telemetry failure
    now = datetime.now(timezone.utc)
    glitch_obs = Observation(
        id=str(uuid.uuid4()),
        parameter="sea_surface_temperature",
        value=75.0,
        unit="°C",
        location=TEST_LOCATION,
        timestamp=now,
        source="sensor_fault",
    )
    hist = store.history_for(glitch_obs.parameter, glitch_obs.location.name, before=now)
    result = evaluate_observation(glitch_obs, hist)
    store.add_observation(glitch_obs)
    store.add_anomaly(result)

    investigation = investigate_anomaly(result.id)

    assert investigation is not None
    # Must identify sensor glitch and reject anomaly
    assert investigation.status == InvestigationStatus.REJECTED
    assert investigation.agreement_status == AgreementStatus.DISAGREEMENT
    assert investigation.synthesis.synthesis_status == SynthesisStatus.SUSPECTED_SENSOR_GLITCH
    assert "recalibration" in investigation.synthesis.recommended_action.lower()


def test_investigate_normal_observation():
    # Find a normal anomaly record from seed
    normals = store.list_anomalies(include_normal=True)
    normal_eval = next((a for a in normals if a.severity == AnomalySeverity.NORMAL), None)
    assert normal_eval is not None

    inv = investigate_anomaly(normal_eval.id)
    assert inv is not None
    assert inv.status == InvestigationStatus.UNDER_REVIEW
    assert inv.synthesis.synthesis_status == SynthesisStatus.BENIGN_DEVIATION
