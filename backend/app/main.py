"""
ORCA backend — FastAPI application entrypoint.

Phase 1: app setup, CORS, health check.
Phase 2 (this update): wires in the observations/anomalies API and seeds a
synthetic historical dataset on startup so the anomaly engine has a
baseline to compare against immediately. Agents and the real database are
still later phases.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings
from app.data.seed import generate_seed_observations
from app.services.anomaly_detection import evaluate_observation
from app.services.store import store


def _seed_demo_data() -> None:
    """
    Replays the synthetic seed observations through the exact same
    evaluate_observation() path a real POST /api/observations would use, in
    timestamp order, so the resulting anomaly history is built up the same
    way it would be from real traffic — not a shortcut that could drift
    from actual API behavior.
    """
    for observation in generate_seed_observations():
        historical = store.history_for(observation.parameter, observation.location.name, before=observation.timestamp)
        result = evaluate_observation(observation, historical)
        store.add_observation(observation)
        store.add_anomaly(result)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_demo_data()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend API for ORCA: Marine Ecosystem Reasoning with Collaborative Agents.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: by default, a browser blocks JavaScript on http://localhost:3000
# from calling http://localhost:8000 because they're different origins
# (different port). This middleware tells the browser "requests from these
# origins are allowed", which is required for the Next.js frontend to call
# this API directly from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    """Simple landing response so hitting the bare URL isn't a 404."""
    return {"message": "ORCA backend is running. See /health or /docs."}


@app.get("/health")
def health():
    """
    Health-check endpoint.

    The frontend calls this to confirm the backend is up and to see which
    environment it's talking to. No auth, no side effects — safe to poll.
    """
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "time": datetime.now(timezone.utc).isoformat(),
    }
