"""
ORCA Collaborative Agents.

Each agent has a strictly delineated role:
- AnomalyVerificationAgent: Statistical and physical data integrity audit.
- OceanographicContextAgent: Multi-variable physical oceanography evaluation.
- EcologicalReasoningAgent: Marine ecological impacts and risk assessment.
- SynthesisAgent: Cross-verification, consensus detection, and final advisory synthesis.
"""

from app.agents.anomaly_verification import AnomalyVerificationAgent
from app.agents.oceanographic_context import OceanographicContextAgent
from app.agents.ecological_reasoning import EcologicalReasoningAgent
from app.agents.synthesis import SynthesisAgent

__all__ = [
    "AnomalyVerificationAgent",
    "OceanographicContextAgent",
    "EcologicalReasoningAgent",
    "SynthesisAgent",
]
