"""Health check endpoints."""

from datetime import datetime

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health_check(request: Request) -> dict:
    """Check API health status including Redis connection."""
    redis_status = "unknown"

    try:
        redis_client = request.app.state.redis
        await redis_client.ping()
        redis_status = "connected"
    except Exception:
        redis_status = "disconnected"

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "redis": redis_status,
        "version": "0.1.0",
    }
