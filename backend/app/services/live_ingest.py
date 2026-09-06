"""
Live ocean ingestion (Open-Meteo, no key required).

Pulls recent hourly SST + wave height for the buoy location and replays
each reading through the EXACT same evaluate_observation() path as
POST /api/observations and the seed loader — so live anomalies are
computed, not asserted. Every live reading is tagged
source="open-meteo-live" to distinguish it from source="seed_data".

Stdlib only (urllib): no new dependencies.
"""

import json
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

from app.data.seed import ARABIAN_SEA_BUOY
from app.models.anomaly import AnomalySeverity
from app.models.observation import Observation
from app.services.anomaly_detection import evaluate_observation

BUOY_LAT = 18.70
BUOY_LON = 72.40
SOURCE = "open-meteo-live"
_TIMEOUT_S = 20


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "ORCA-SIHDemo/1.0"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT_S) as resp:
        if resp.status != 200:
            raise RuntimeError(f"Open-Meteo HTTP {resp.status}")
        return json.load(resp)


def _parse_time(s: str) -> datetime:
    # "2026-09-06T10:00" (IST wall time) -> aware UTC
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        # Open-Meteo returns wall time in the requested timezone.
        from datetime import timedelta
        dt = (dt - timedelta(hours=5, minutes=30)).replace(tzinfo=timezone.utc)
    return dt


def fetch_live_readings() -> list[Observation]:
    """Recent hourly SST + wave readings, oldest first. Raises on failure."""
    params = urllib.parse.urlencode({
        "latitude": BUOY_LAT,
        "longitude": BUOY_LON,
        "hourly": "sea_surface_temperature,wave_height",
        "timezone": "Asia/Kolkata",
        "past_days": 5,
        "forecast_days": 1,
    })
    try:
        data = _get_json(f"https://marine-api.open-meteo.com/v1/marine?{params}")
    except Exception:
        # Older API surface without past_days: fall back to recent hours.
        params = urllib.parse.urlencode({
            "latitude": BUOY_LAT,
            "longitude": BUOY_LON,
            "hourly": "sea_surface_temperature,wave_height",
            "timezone": "Asia/Kolkata",
            "forecast_days": 2,
        })
        data = _get_json(f"https://marine-api.open-meteo.com/v1/marine?{params}")

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    ssts = hourly.get("sea_surface_temperature", [])
    waves = hourly.get("wave_height", [])

    now = datetime.now(timezone.utc)
    observations: list[Observation] = []
    for i, t in enumerate(times):
        ts = _parse_time(t)
        if ts > now:
            continue  # history only; the current hour goes through POST
        if i < len(ssts) and ssts[i] is not None:
            observations.append(Observation(
                id=str(uuid.uuid4()),
                parameter="sea_surface_temperature",
                value=round(float(ssts[i]), 3),
                unit="°C",
                location=ARABIAN_SEA_BUOY,
                timestamp=ts,
                source=SOURCE,
            ))
        if i < len(waves) and waves[i] is not None:
            observations.append(Observation(
                id=str(uuid.uuid4()),
                parameter="wave_height",
                value=round(float(waves[i]), 3),
                unit="m",
                location=ARABIAN_SEA_BUOY,
                timestamp=ts,
                source=SOURCE,
            ))
    observations.sort(key=lambda o: o.timestamp)
    if not observations:
        raise RuntimeError("Open-Meteo returned no usable readings")
    return observations


def ingest_live_readings(store) -> dict:
    """
    Replay live readings through the standard evaluate path.
    Returns a summary; raises on fetch failure (caller decides fallback).
    """
    observations = fetch_live_readings()
    flagged = 0
    for observation in observations:
        historical = store.history_for(
            observation.parameter, observation.location.name, before=observation.timestamp
        )
        result = evaluate_observation(observation, historical)
        store.add_observation(observation)
        store.add_anomaly(result)
        if result.severity in (AnomalySeverity.MODERATE, AnomalySeverity.SEVERE):
            flagged += 1
    return {
        "ingested": len(observations),
        "flagged": flagged,
        "source": SOURCE,
        "oldest": observations[0].timestamp.isoformat(),
        "newest": observations[-1].timestamp.isoformat(),
    }
