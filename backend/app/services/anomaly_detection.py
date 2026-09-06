"""
Deterministic anomaly detection.

This module NEVER asks an LLM whether a number looks anomalous. Severity is
decided purely by z-score thresholds from app.core.config; confidence is
decided purely by how much history exists and how extreme the deviation is.

The separation this project cares about:

    DATA  →  CALCULATION  →  ANOMALY RESULT  →  (later) AGENT INTERPRETATION

Everything in this file lives in the first three steps. An LLM/agent may
later read an AnomalyResult and explain it in natural language (Phase 4) —
but it never gets to decide the severity or confidence number itself.
"""

import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.models.anomaly import (
    AnomalyResult,
    AnomalySeverity,
    ConfidenceBreakdown,
    Evidence,
    HistoricalPoint,
    InvestigationStatus,
)
from app.models.observation import Observation
from app.services.statistics import compute_baseline, z_score

# Anomalies at or above this severity get an investigation record opened.
ALERT_SEVERITIES = (AnomalySeverity.MODERATE, AnomalySeverity.SEVERE)

# How many historical readings would make us fully confident in the sample
# size alone — an arbitrary but documented target, not a magic number.
_SAMPLE_SIZE_CONFIDENCE_TARGET = 20
# |z-score| at or above this is treated as maximally strong evidence of
# deviation for confidence purposes (severity classification is separate).
_MAX_MEANINGFUL_Z = 5.0


def classify_severity(z: float | None) -> AnomalySeverity:
    """Turn a z-score into a severity label using the configured cutoffs."""
    if z is None:
        return AnomalySeverity.INSUFFICIENT_DATA
    magnitude = abs(z)
    if magnitude >= settings.anomaly_z_severe:
        return AnomalySeverity.SEVERE
    if magnitude >= settings.anomaly_z_moderate:
        return AnomalySeverity.MODERATE
    return AnomalySeverity.NORMAL


def compute_confidence(z: float | None, sample_size: int) -> tuple[float, ConfidenceBreakdown]:
    """
    Confidence = average of two transparent, computed factors:
      - sample_size_factor: how much history we had (more = more confident)
      - deviation_strength_factor: how extreme the deviation is

    This is a PRELIMINARY confidence score — see the docstring on
    ConfidenceBreakdown for what's still missing (agent agreement, evidence
    quality) and which phase adds it.
    """
    if z is None or sample_size < settings.anomaly_min_baseline_samples:
        return 0.0, ConfidenceBreakdown(sample_size_factor=0.0, deviation_strength_factor=0.0)

    sample_size_factor = min(sample_size / _SAMPLE_SIZE_CONFIDENCE_TARGET, 1.0)
    deviation_strength_factor = min(abs(z) / _MAX_MEANINGFUL_Z, 1.0)
    confidence = round(0.5 * sample_size_factor + 0.5 * deviation_strength_factor, 2)

    return confidence, ConfidenceBreakdown(
        sample_size_factor=round(sample_size_factor, 2),
        deviation_strength_factor=round(deviation_strength_factor, 2),
    )


def evaluate_observation(observation: Observation, historical: list[Observation]) -> AnomalyResult:
    """
    Evaluate one new observation against prior observations of the same
    parameter at the same location.

    `historical` must already be filtered to matching parameter + location
    and must NOT include `observation` itself — this function doesn't do
    that filtering (see app/services/store.py, which does).
    """
    values = [h.value for h in historical]
    sample_size = len(values)

    baseline_mean: float | None = None
    baseline_std: float | None = None
    z: float | None = None

    if sample_size >= settings.anomaly_min_baseline_samples:
        baseline_mean, baseline_std = compute_baseline(values)
        z = z_score(observation.value, baseline_mean, baseline_std)

    severity = classify_severity(z)
    confidence, confidence_breakdown = compute_confidence(z, sample_size)

    recent_history = historical[-5:]
    evidence = Evidence(
        baseline_sample_size=sample_size,
        historical_points=[HistoricalPoint(timestamp=h.timestamp, value=h.value) for h in recent_history],
        data_source=observation.source,
    )

    return AnomalyResult(
        id=str(uuid.uuid4()),
        observation_id=observation.id,
        parameter=observation.parameter,
        value=observation.value,
        unit=observation.unit,
        location=observation.location,
        timestamp=observation.timestamp,
        baseline_mean=baseline_mean,
        baseline_std=baseline_std,
        baseline_sample_size=sample_size,
        z_score=z,
        deviation=(observation.value - baseline_mean) if baseline_mean is not None else None,
        severity=severity,
        confidence=confidence,
        confidence_breakdown=confidence_breakdown,
        evidence=evidence,
        investigation_status=InvestigationStatus.NEW if severity in ALERT_SEVERITIES else None,
        evaluated_at=datetime.now(timezone.utc),
    )
