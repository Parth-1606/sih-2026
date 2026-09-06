"""
Central configuration for the ORCA backend.

We read every configurable value from environment variables (via a `.env`
file in local development) instead of hardcoding it in source. This means:
  - No secrets or environment-specific URLs live in git.
  - The same code can run in dev/staging/prod by swapping the `.env`.

`Settings` is a pydantic-settings model: each field is automatically
populated from an environment variable of the same name (case-insensitive),
falling back to the default given here if the variable isn't set.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ORCA Backend"
    environment: str = "development"

    # Comma-separated list of origins allowed to call this API, e.g.
    # "http://localhost:3000,https://orca.example.com"
    cors_origins: str = "http://localhost:3000"

    # Anomaly detection thresholds (see app/services/anomaly_detection.py).
    # |z-score| at or above these cutoffs is classified moderate/severe.
    anomaly_z_moderate: float = 2.0
    anomaly_z_severe: float = 3.0
    # Minimum historical readings required before we'll compute a baseline
    # at all — below this we report INSUFFICIENT_DATA rather than guess.
    anomaly_min_baseline_samples: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """CORS_ORIGINS as a clean list, e.g. ['http://localhost:3000']."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# A single shared instance, imported wherever settings are needed.
settings = Settings()
