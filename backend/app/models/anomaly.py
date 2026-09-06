from datetime import datetime
from enum import Enum

from pydantic import BaseModel

from app.models.common import Location


class AnomalySeverity(str, Enum):
    """
    Outcome of the deterministic statistical check — nothing here is an
    LLM/agent judgment, just a classification of how far a value sits from
    its historical baseline.
    """

    NORMAL = "normal"
    MODERATE = "moderate"
    SEVERE = "severe"
    # Not enough historical data to compute a meaningful baseline. This is
    # deliberately a first-class outcome, not an error — the system should
    # be able to say "insufficient evidence" instead of forcing a guess.
    INSUFFICIENT_DATA = "insufficient_data"


class InvestigationStatus(str, Enum):
    """
    Human-review workflow state. The full workflow/UI for this arrives in a
    later phase — the field exists now so the shape of AnomalyResult doesn't
    need to change when that phase lands.
    """

    NEW = "new"
    UNDER_REVIEW = "under_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NEEDS_INVESTIGATION = "needs_investigation"


class ConfidenceBreakdown(BaseModel):
    """
    Transparent inputs behind the confidence score — so "confidence: 0.82"
    is never just a number someone has to trust.

    This is intentionally a PRELIMINARY confidence model: it only reflects
    statistical strength (how much history we have, how extreme the
    deviation is). Once multi-agent cross-verification exists, agent
    agreement and evidence quality will be added as further factors here —
    this isn't the full confidence system from the project doc yet, just its
    statistical foundation.
    """

    sample_size_factor: float
    deviation_strength_factor: float


class HistoricalPoint(BaseModel):
    timestamp: datetime
    value: float


class Evidence(BaseModel):
    """What backs up an anomaly result — enough for a person (or later, an
    agent) to see WHY a value was flagged, not just that it was."""

    baseline_sample_size: int
    historical_points: list[HistoricalPoint]
    data_source: str


class AnomalyResult(BaseModel):
    """
    The output of evaluating one Observation against its historical
    baseline. Created for every observation submitted — including ones that
    turn out NORMAL — so there's a complete, auditable record, not just a
    log of the alerts.
    """

    id: str
    observation_id: str
    parameter: str
    value: float
    unit: str
    location: Location
    timestamp: datetime

    baseline_mean: float | None = None
    baseline_std: float | None = None
    baseline_sample_size: int
    z_score: float | None = None
    deviation: float | None = None

    severity: AnomalySeverity
    confidence: float
    confidence_breakdown: ConfidenceBreakdown
    evidence: Evidence

    investigation_status: InvestigationStatus | None = None
    evaluated_at: datetime
