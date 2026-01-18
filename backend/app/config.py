"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Server
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # Redis
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 90  # Quote cache TTL (was 30, increased for fewer API calls)
    cache_history_ttl_seconds: int = 900  # History cache TTL (15 min, was 5 min)
    use_fake_redis: bool = True  # Use fakeredis when Redis server not available

    # API Keys (optional - for fallback sources)
    alpha_vantage_api_key: str | None = None
    polygon_api_key: str | None = None
    coinmarketcap_api_key: str | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Rate limiting
    yahoo_rate_limit_per_minute: int = 100
    coingecko_rate_limit_per_minute: int = 30
    alpha_vantage_daily_limit: int = 25
    polygon_rate_limit_per_minute: int = 5

    class Config:
        """Pydantic config."""

        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
