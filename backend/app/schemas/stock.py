"""Stock-related Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class StockQuote(BaseModel):
    """Current stock quote data with extended market information."""

    symbol: str
    name: str | None = None
    logo_url: str | None = None
    price: float = Field(ge=0)
    change: float
    change_percent: float
    volume: int = Field(ge=0)
    market_cap: float | None = None
    high_52w: float | None = None
    low_52w: float | None = None

    # Multi-period changes
    change_percent_week: float | None = None
    change_percent_month: float | None = None
    change_percent_year: float | None = None

    # Pre-market data
    pre_market_price: float | None = None
    pre_market_change: float | None = None
    pre_market_change_percent: float | None = None

    # After-hours (post-market) data
    post_market_price: float | None = None
    post_market_change: float | None = None
    post_market_change_percent: float | None = None

    # Market state
    market_state: str | None = None  # PRE, REGULAR, POST, CLOSED

    # Futures correlation hint (for major indices)
    futures_symbol: str | None = None  # e.g., ES for S&P 500, NQ for Nasdaq

    source: str
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True

    def model_dump(self, **kwargs):
        """Override to exclude None values by default for smaller payloads."""
        kwargs.setdefault("exclude_none", True)
        return super().model_dump(**kwargs)


class PriceHistory(BaseModel):
    """Historical price point."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class BatchQuoteRequest(BaseModel):
    """Request for batch quotes."""

    symbols: list[str] = Field(min_length=1, max_length=50)
