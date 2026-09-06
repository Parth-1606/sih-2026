from pydantic import BaseModel, Field


class Location(BaseModel):
    """A named point we take readings at, e.g. a buoy or monitoring station."""

    name: str = Field(..., description="Human-readable label, e.g. 'Arabian Sea Buoy 12'")
    lat: float
    lon: float
