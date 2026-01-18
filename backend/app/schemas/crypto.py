"""Crypto-related Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class CryptoQuote(BaseModel):
    """Current cryptocurrency quote data with multi-period changes."""

    symbol: str
    name: str
    logo_url: str | None = None
    price: float = Field(ge=0)
    change_24h: float
    change_percent_24h: float
    volume_24h: float = Field(ge=0)
    market_cap: float = Field(ge=0)
    rank: int | None = None

    # Multi-period changes
    change_percent_7d: float | None = None
    change_percent_30d: float | None = None
    change_percent_1y: float | None = None

    # All-time high data
    ath: float | None = None
    ath_change_percent: float | None = None

    source: str
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True

    def model_dump(self, **kwargs):
        """Override to exclude None values by default for smaller payloads."""
        kwargs.setdefault("exclude_none", True)
        return super().model_dump(**kwargs)


class CryptoPriceHistory(BaseModel):
    """Historical crypto price point."""

    timestamp: datetime
    price: float


class BatchCryptoRequest(BaseModel):
    """Request for batch crypto quotes."""

    symbols: list[str] = Field(min_length=1, max_length=50)
