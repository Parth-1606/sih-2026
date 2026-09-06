"""
API surface for ORCA:
Phase 2: submit readings, query observations and evaluated anomalies.
Phase 3: trigger and query multi-agent collaborative investigations.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.models.anomaly import AnomalyResult
from app.models.investigation import Investigation, InvestigationCreate
from app.models.observation import Observation, ObservationCreate
from app.services.anomaly_detection import evaluate_observation
from app.services.collaboration import investigate_anomaly
from app.services.live_ingest import ingest_live_readings
from app.services.store import store

router = APIRouter()


@router.get("/observations", response_model=list[Observation])
def list_observations(parameter: str | None = Query(default=None, description="Filter to one parameter, e.g. 'sea_surface_temperature'")):
    """Every stored observation, oldest first."""
    return store.list_observations(parameter=parameter)


@router.post("/observations", response_model=AnomalyResult, status_code=201)
def create_observation(payload: ObservationCreate) -> AnomalyResult:
    """
    Submit a new reading.

    This does two things in one call: stores the observation, AND runs it
    through the deterministic anomaly engine against everything stored
    previously for the same parameter + location. The response is the
    evaluation — which may be NORMAL, not just an acknowledgement.
    """
    timestamp = payload.timestamp or datetime.now(timezone.utc)
    observation = Observation(
        id=str(uuid.uuid4()),
        parameter=payload.parameter,
        value=payload.value,
        unit=payload.unit,
        location=payload.location,
        timestamp=timestamp,
        source=payload.source,
    )

    historical = store.history_for(payload.parameter, payload.location.name, before=timestamp)
    result = evaluate_observation(observation, historical)

    store.add_observation(observation)
    store.add_anomaly(result)

    return result


@router.get("/anomalies", response_model=list[AnomalyResult])
def list_anomalies(include_normal: bool = Query(default=False, description="Include NORMAL evaluations, not just flagged ones")):
    """Flagged anomalies, most recent first (NORMAL evaluations hidden by default)."""
    return store.list_anomalies(include_normal=include_normal)


@router.get("/anomalies/{anomaly_id}", response_model=AnomalyResult)
def get_anomaly(anomaly_id: str) -> AnomalyResult:
    """One anomaly result with its full evidence — 404 if the id doesn't exist."""
    result = store.get_anomaly(anomaly_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return result


@router.post("/observations/ingest-live")
def ingest_live() -> dict:
    """
    Pull recent hourly SST + wave readings from Open-Meteo (no key) for the
    buoy location and replay them through the standard anomaly-evaluation
    path. Tagged source="open-meteo-live" to distinguish from seed data.
    502 if the upstream feed is unreachable — seed baseline still stands.
    """
    try:
        return ingest_live_readings(store)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Live feed unreachable: {exc}")


# --- Phase 3: Collaborative Agent Investigations ---


@router.post("/investigations", response_model=Investigation, status_code=201)
def create_investigation(payload: InvestigationCreate) -> Investigation:
    """
    Trigger a collaborative multi-agent investigation against an existing anomaly.

    Orchestrates Anomaly Verification, Oceanographic Context, and Ecological
    Reasoning agents, followed by synthesis and consensus detection.
    """
    investigation = investigate_anomaly(payload.anomaly_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail=f"Anomaly '{payload.anomaly_id}' not found")
    return investigation


@router.get("/investigations", response_model=list[Investigation])
def list_investigations(anomaly_id: str | None = Query(default=None, description="Filter investigations by anomaly ID")):
    """List completed agent investigations, newest first."""
    return store.list_investigations(anomaly_id=anomaly_id)


@router.get("/investigations/{investigation_id}", response_model=Investigation)
def get_investigation(investigation_id: str) -> Investigation:
    """Retrieve full details and agent traces of a single investigation."""
    inv = store.get_investigation(investigation_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv
