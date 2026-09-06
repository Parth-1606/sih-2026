"""
Synthetic historical seed data.

Real ocean data (INCOIS, NASA Ocean Color, ISRO Bhuvan) is Phase 9. Until
then, the anomaly engine needs SOME history to compare against, so this
generates 30 days of plausible daily readings for one buoy, ending in one
deliberate sea-surface-temperature spike — enough to exercise the whole
pipeline (baseline → z-score → severity → confidence → evidence) end to
end. Every seeded reading is tagged source="seed_data" so it's never
mistaken for a live or real measurement.

random.seed(42) makes this deterministic: the same "anomaly" appears every
time the server restarts, which is exactly what you want for a repeatable
demo and for writing tests against.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone

from app.models.common import Location
from app.models.observation import Observation

ARABIAN_SEA_BUOY = Location(name="Arabian Sea Buoy 12", lat=18.70, lon=72.40)


def _make_observation(parameter: str, value: float, unit: str, timestamp: datetime) -> Observation:
    return Observation(
        id=str(uuid.uuid4()),
        parameter=parameter,
        value=round(value, 3),
        unit=unit,
        location=ARABIAN_SEA_BUOY,
        timestamp=timestamp,
        source="seed_data",
    )


def generate_seed_observations() -> list[Observation]:
    """30 days of daily SST + chlorophyll history, then one SST spike 'today'."""
    rng = random.Random(42)
    now = datetime.now(timezone.utc)
    observations: list[Observation] = []

    for day_offset in range(30, 0, -1):
        ts = now - timedelta(days=day_offset)
        sst = 27.5 + rng.uniform(-0.4, 0.4)
        chlorophyll = 0.70 + rng.uniform(-0.08, 0.08)
        observations.append(_make_observation("sea_surface_temperature", sst, "°C", ts))
        observations.append(_make_observation("chlorophyll", chlorophyll, "mg/m³", ts))

    # Deliberate anomaly: a sharp, unexplained SST spike "today". Chlorophyll
    # stays normal, so an evidence panel can later show one parameter
    # deviating while another doesn't.
    observations.append(_make_observation("sea_surface_temperature", 31.8, "°C", now))
    observations.append(_make_observation("chlorophyll", 0.71, "mg/m³", now))

    return observations
