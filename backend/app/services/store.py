"""
Temporary in-memory data store.

Phase 2: observations & anomalies in-memory storage.
Phase 3: adds multi-agent investigation records and concurrent observation queries.
MongoDB arrives in Phase 15.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from app.models.anomaly import AnomalyResult, AnomalySeverity, InvestigationStatus
from app.models.observation import Observation

if TYPE_CHECKING:
    from app.models.investigation import Investigation


class InMemoryStore:
    def __init__(self) -> None:
        self._observations: list[Observation] = []
        self._anomalies: list[AnomalyResult] = []
        self._investigations: list["Investigation"] = []

    def add_observation(self, observation: Observation) -> None:
        self._observations.append(observation)

    def history_for(self, parameter: str, location_name: str, before: datetime) -> list[Observation]:
        """All prior observations of this parameter at this location, oldest first."""
        matching = [
            o
            for o in self._observations
            if o.parameter == parameter and o.location.name == location_name and o.timestamp < before
        ]
        return sorted(matching, key=lambda o: o.timestamp)

    def concurrent_observations(self, location_name: str, target_time: datetime, window_hours: float = 24.0) -> list[Observation]:
        """Observations at this location within +/- window_hours of target_time."""
        window = timedelta(hours=window_hours)
        matching = [
            o
            for o in self._observations
            if o.location.name == location_name and abs(o.timestamp - target_time) <= window
        ]
        return sorted(matching, key=lambda o: o.timestamp)

    def list_observations(self, parameter: str | None = None) -> list[Observation]:
        obs = self._observations if parameter is None else [o for o in self._observations if o.parameter == parameter]
        return sorted(obs, key=lambda o: o.timestamp)

    def add_anomaly(self, anomaly: AnomalyResult) -> None:
        self._anomalies.append(anomaly)

    def list_anomalies(self, include_normal: bool = False) -> list[AnomalyResult]:
        """Most recent first. By default, NORMAL evaluations are hidden."""
        anomalies = self._anomalies
        if not include_normal:
            anomalies = [a for a in anomalies if a.severity != AnomalySeverity.NORMAL]
        return sorted(anomalies, key=lambda a: a.evaluated_at, reverse=True)

    def get_anomaly(self, anomaly_id: str) -> AnomalyResult | None:
        return next((a for a in self._anomalies if a.id == anomaly_id), None)

    def update_anomaly_investigation_status(self, anomaly_id: str, status: InvestigationStatus) -> AnomalyResult | None:
        anomaly = self.get_anomaly(anomaly_id)
        if anomaly:
            anomaly.investigation_status = status
        return anomaly

    def add_investigation(self, investigation: "Investigation") -> None:
        self._investigations.append(investigation)

    def list_investigations(self, anomaly_id: str | None = None) -> list["Investigation"]:
        invs = self._investigations
        if anomaly_id is not None:
            invs = [i for i in invs if i.anomaly_id == anomaly_id]
        return sorted(invs, key=lambda i: i.completed_at, reverse=True)

    def get_investigation(self, investigation_id: str) -> "Investigation" | None:
        return next((i for i in self._investigations if i.id == investigation_id), None)

    def get_investigation_for_anomaly(self, anomaly_id: str) -> "Investigation" | None:
        return next((i for i in self._investigations if i.anomaly_id == anomaly_id), None)


# A single shared instance for the process lifetime
store = InMemoryStore()
