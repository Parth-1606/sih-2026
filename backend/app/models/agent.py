"""
Pydantic schemas for ORCA collaborative agents.

Every agent produces a structured, transparent output that explains:
- Its domain-specific status (verified, contradicted, inconclusive, etc.)
- A human-readable conclusion
- Supporting evidence (strictly grounded in data)
- Contradicting evidence (conflicts or discrepancies)
- Referenced observation IDs
- Transparent confidence with an explainable calculation basis
- Explicit warnings (e.g. missing data, instrument limits)

No agent is permitted to return arbitrary or ungrounded confidence numbers.
"""

from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    """Execution status of an individual agent."""

    VERIFIED = "verified"
    CONTRADICTED = "contradicted"
    INCONCLUSIVE = "inconclusive"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class AgentResult(BaseModel):
    """
    Standardized result contract for all collaborative agents in ORCA.

    Agents communicate through this uniform structure to enable deterministic
    cross-verification and synthesis without hidden reasoning chains.
    """

    agent_name: str = Field(..., description="Name of the evaluating agent")
    status: AgentStatus = Field(..., description="Evaluation outcome status")
    conclusion: str = Field(..., description="Plain-language summary of findings")
    supporting_evidence: list[str] = Field(default_factory=list, description="Ground-truth facts supporting the conclusion")
    contradicting_evidence: list[str] = Field(default_factory=list, description="Ground-truth facts contradicting the conclusion")
    evidence_ids: list[str] = Field(default_factory=list, description="IDs of observations or anomalies evaluated")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score bounded [0.0, 1.0]")
    confidence_basis: str = Field(..., description="Transparent mathematical or logical justification for the confidence score")
    timestamp: datetime = Field(..., description="When the agent completed its evaluation")
    warnings: list[str] = Field(default_factory=list, description="Data caveats, missing variables, or reliability warnings")
