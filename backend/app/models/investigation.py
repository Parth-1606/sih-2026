"""
Investigation models for ORCA multi-agent collaboration.

An Investigation captures the full collaborative lifecycle of reviewing an
AnomalyResult: orchestrating domain agents, detecting agreement/disagreement,
and producing a synthesized final conclusion.
"""

from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

from app.models.agent import AgentResult
from app.models.anomaly import AnomalyResult, InvestigationStatus


class AgreementStatus(str, Enum):
    """Level of consensus across evaluating agents."""

    UNANIMOUS_AGREEMENT = "unanimous_agreement"
    MAJORITY_AGREEMENT = "majority_agreement"
    DISAGREEMENT = "disagreement"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class SynthesisStatus(str, Enum):
    """Final decision reached by the synthesis agent."""

    CONFIRMED_ANOMALY = "confirmed_anomaly"
    SUSPECTED_SENSOR_GLITCH = "suspected_sensor_glitch"
    REQUIRES_FURTHER_DATA = "requires_further_data"
    BENIGN_DEVIATION = "benign_deviation"


class SynthesisResult(BaseModel):
    """Structured conclusion produced by the Synthesis Agent."""

    synthesis_status: SynthesisStatus = Field(..., description="High-level category of the synthesized outcome")
    agreement_status: AgreementStatus = Field(..., description="Consensus status among participating agents")
    overall_conclusion: str = Field(..., description="Comprehensive synthesis explaining the verdict")
    recommended_action: str = Field(..., description="Actionable advisory or operational next steps")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall synthesized confidence score")
    confidence_breakdown: dict[str, float] = Field(default_factory=dict, description="Component weights contributing to synthesis confidence")
    primary_driver: str = Field(..., description="Primary oceanographic or operational factor identified")
    key_findings: list[str] = Field(default_factory=list, description="Bullet-point summary of key findings across agents")


class Investigation(BaseModel):
    """
    Complete record of a collaborative agent investigation against an AnomalyResult.
    """

    id: str = Field(..., description="Unique investigation identifier")
    anomaly_id: str = Field(..., description="ID of the investigated AnomalyResult")
    anomaly: AnomalyResult = Field(..., description="Full snapshot of the evaluated AnomalyResult")
    status: InvestigationStatus = Field(..., description="Current review status of the investigation")
    agreement_status: AgreementStatus = Field(..., description="Agreement level across agents")
    agent_results: list[AgentResult] = Field(default_factory=list, description="Structured outputs from all contributing agents")
    synthesis: SynthesisResult = Field(..., description="Final output of the Synthesis Agent")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Synthesized confidence score")
    created_at: datetime = Field(..., description="When the investigation was initiated")
    completed_at: datetime = Field(..., description="When the synthesis completed")


class InvestigationCreate(BaseModel):
    """Request payload for POST /api/investigations."""

    anomaly_id: str = Field(..., description="ID of the existing AnomalyResult to investigate")
