from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import Location


class Observation(BaseModel):
    """
    A single measured reading. This is the atomic unit everything else
    (anomaly detection, evidence, agents later) is built from.

    `parameter` is a free-form string on purpose — "sea_surface_temperature",
    "chlorophyll", etc. — rather than a fixed enum, so new measurement types
    don't require a model change. What DOES matter is that the same
    `parameter` name is used consistently for a given kind of reading, since
    the anomaly engine groups history by exact `parameter` + `location.name`.
    """

    id: str
    parameter: str = Field(..., description="What was measured, e.g. 'sea_surface_temperature', 'chlorophyll'")
    value: float
    unit: str
    location: Location
    timestamp: datetime
    source: str = Field(default="unknown", description="Where this reading came from, e.g. 'seed_data', 'incois', 'manual'")


class ObservationCreate(BaseModel):
    """Request payload for POST /api/observations — no `id`, the server assigns one."""

    parameter: str
    value: float
    unit: str
    location: Location
    timestamp: datetime | None = Field(default=None, description="Defaults to now (UTC) if omitted")
    source: str = "manual"
