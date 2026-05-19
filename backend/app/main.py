import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .deps import get_data_source
from .routers import (
    alerts,
    blast_radius,
    compliance,
    endpoints,
    incidents,
    network,
    orphans,
    recommendations,
    resources,
    risky_users,
    scenario,
    secure_score,
    signins,
    summary,
    triage,
    virtual_machines,
    vulnerabilities,
)

logger = logging.getLogger(__name__)


async def _cache_refresh_loop(interval_seconds: int) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        ds = get_data_source()
        if hasattr(ds, "reload"):
            ds.reload()
            logger.info("Mock data cache reloaded")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    get_data_source()  # warm the singleton on startup
    task = None
    if settings.cache_refresh_seconds > 0:
        task = asyncio.create_task(_cache_refresh_loop(settings.cache_refresh_seconds))
        logger.info("Cache refresh task started (every %ss)", settings.cache_refresh_seconds)
    yield
    if task:
        task.cancel()


app = FastAPI(title="Azure Security Dashboard API", lifespan=lifespan)
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    secure_score.router,
    recommendations.router,
    alerts.router,
    vulnerabilities.router,
    compliance.router,
    resources.router,
    signins.router,
    endpoints.router,
    virtual_machines.router,
    incidents.router,
    risky_users.router,
    summary.router,
    scenario.router,
    blast_radius.router,
    triage.router,
    orphans.router,
    network.router,
):
    app.include_router(router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
