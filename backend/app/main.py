"""FastAPI application entry point."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import crypto, health, stocks
from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifespan - startup and shutdown."""
    # Startup: Initialize Redis connection
    if settings.use_fake_redis:
        import fakeredis.aioredis

        logger.info("Using fakeredis for development")
        app.state.redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    else:
        app.state.redis = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )

    yield

    # Shutdown: Close Redis connection
    await app.state.redis.close()


app = FastAPI(
    title="Investment Tracker API",
    description="Backend API for tracking stocks and cryptocurrency portfolios",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(stocks.router, prefix="/api", tags=["stocks"])
app.include_router(crypto.router, prefix="/api", tags=["crypto"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Investment Tracker API", "docs": "/docs"}
