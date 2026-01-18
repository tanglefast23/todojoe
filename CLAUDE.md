# Financial Dashboard - Web Development Stack

## Project Overview
A web-based dashboard for tracking stocks and cryptocurrency portfolios with real-time data visualization.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Charts:** Lightweight Charts (TradingView) + Recharts
- **State Management:** Zustand (client state) + TanStack Query (server state)
- **UI Components:** shadcn/ui (Radix primitives)
- **Package Manager:** pnpm

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Package Manager:** uv
- **Database:** PostgreSQL + Redis (caching)
- **ORM:** SQLAlchemy 2.0 (async)
- **Data Processing:** Polars (not pandas)
- **Task Queue:** Celery or ARQ (for background price fetching)

### APIs (Free Tiers Available)
- **Stocks:** Alpha Vantage, Polygon.io, or Yahoo Finance (yfinance)
- **Crypto:** CoinGecko, Binance API, or CoinMarketCap
- **News:** Finnhub or Alpha Vantage news sentiment

---

## Project Structure

```
project-root/
├── frontend/                   # Next.js application
│   ├── app/                    # App Router pages
│   │   ├── (dashboard)/        # Dashboard route group
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── stocks/
│   │   │   │   └── page.tsx    # Stock watchlist
│   │   │   ├── crypto/
│   │   │   │   └── page.tsx    # Crypto watchlist
│   │   │   ├── portfolio/
│   │   │   │   └── page.tsx    # Portfolio tracker
│   │   │   └── layout.tsx      # Dashboard layout with sidebar
│   │   ├── api/                # API routes (if needed)
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── charts/             # Chart components
│   │   │   ├── PriceChart.tsx
│   │   │   ├── PortfolioPie.tsx
│   │   │   └── SparkLine.tsx
│   │   ├── dashboard/          # Dashboard-specific components
│   │   │   ├── StockCard.tsx
│   │   │   ├── CryptoCard.tsx
│   │   │   ├── WatchList.tsx
│   │   │   ├── PortfolioSummary.tsx
│   │   │   └── PriceAlert.tsx
│   │   └── layout/             # Layout components
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── ThemeToggle.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useStockData.ts
│   │   ├── useCryptoData.ts
│   │   ├── usePortfolio.ts
│   │   └── useWebSocket.ts
│   ├── stores/                 # Zustand stores
│   │   ├── portfolioStore.ts
│   │   ├── watchlistStore.ts
│   │   └── settingsStore.ts
│   ├── lib/                    # Utilities and configs
│   │   ├── api.ts              # API client setup
│   │   ├── utils.ts            # Helper functions
│   │   ├── formatters.ts       # Price/number formatters
│   │   └── constants.ts        # App constants
│   ├── types/                  # TypeScript types
│   │   ├── stock.ts
│   │   ├── crypto.ts
│   │   └── portfolio.ts
│   └── package.json
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI entry point
│   │   ├── config.py           # Settings/environment
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── stocks.py
│   │   │   │   ├── crypto.py
│   │   │   │   ├── portfolio.py
│   │   │   │   └── alerts.py
│   │   │   └── deps.py         # Dependencies
│   │   ├── core/
│   │   │   ├── security.py     # Auth utilities
│   │   │   └── exceptions.py   # Custom exceptions
│   │   ├── models/             # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── portfolio.py
│   │   │   └── watchlist.py
│   │   ├── schemas/            # Pydantic schemas
│   │   │   ├── stock.py
│   │   │   ├── crypto.py
│   │   │   └── portfolio.py
│   │   ├── services/           # Business logic
│   │   │   ├── stock_service.py
│   │   │   ├── crypto_service.py
│   │   │   ├── portfolio_service.py
│   │   │   └── price_fetcher.py
│   │   └── db/
│   │       ├── session.py      # Database session
│   │       └── migrations/     # Alembic migrations
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_stocks.py
│   │   └── test_portfolio.py
│   ├── pyproject.toml
│   └── .env.example
│
├── docker-compose.yml          # PostgreSQL, Redis, etc.
├── .env.example
└── README.md
```

---

## Frontend Conventions

### Components
- Functional components with TypeScript
- One component per file, named exports
- Props interface defined above component
- Extract complex logic into custom hooks

```tsx
// components/dashboard/StockCard.tsx
interface StockCardProps {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function StockCard({ symbol, price, change, changePercent }: StockCardProps) {
  const isPositive = change >= 0;
  
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{symbol}</h3>
      <p className="text-2xl font-bold">{formatCurrency(price)}</p>
      <p className={isPositive ? "text-green-500" : "text-red-500"}>
        {isPositive ? "+" : ""}{formatPercent(changePercent)}
      </p>
    </div>
  );
}
```

### Data Fetching with TanStack Query
```tsx
// hooks/useStockData.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useStockQuote(symbol: string) {
  return useQuery({
    queryKey: ["stock", "quote", symbol],
    queryFn: () => api.get<StockQuote>(`/stocks/${symbol}/quote`),
    refetchInterval: 30_000, // Refresh every 30 seconds
    staleTime: 10_000,
  });
}

export function useStockHistory(symbol: string, range: string = "1M") {
  return useQuery({
    queryKey: ["stock", "history", symbol, range],
    queryFn: () => api.get<PriceHistory[]>(`/stocks/${symbol}/history?range=${range}`),
    staleTime: 60_000,
  });
}
```

### Zustand Store Pattern
```tsx
// stores/portfolioStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Holding {
  symbol: string;
  type: "stock" | "crypto";
  quantity: number;
  avgCost: number;
}

interface PortfolioState {
  holdings: Holding[];
  addHolding: (holding: Holding) => void;
  removeHolding: (symbol: string) => void;
  updateHolding: (symbol: string, updates: Partial<Holding>) => void;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      holdings: [],
      addHolding: (holding) =>
        set((state) => ({ holdings: [...state.holdings, holding] })),
      removeHolding: (symbol) =>
        set((state) => ({
          holdings: state.holdings.filter((h) => h.symbol !== symbol),
        })),
      updateHolding: (symbol, updates) =>
        set((state) => ({
          holdings: state.holdings.map((h) =>
            h.symbol === symbol ? { ...h, ...updates } : h
          ),
        })),
    }),
    { name: "portfolio-storage" }
  )
);
```

### Chart Component Pattern
```tsx
// components/charts/PriceChart.tsx
"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi } from "lightweight-charts";

interface PriceChartProps {
  data: { time: string; value: number }[];
  height?: number;
}

export function PriceChart({ data, height = 300 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
    });

    const lineSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
    });
    lineSeries.setData(data);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    return () => chart.remove();
  }, [data, height]);

  return <div ref={containerRef} className="w-full" />;
}
```

### Formatting Utilities
```tsx
// lib/formatters.ts
export function formatCurrency(
  value: number,
  currency: string = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value / 100);
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

export function formatCryptoPrice(value: number): string {
  if (value < 0.01) {
    return `$${value.toFixed(6)}`;
  }
  if (value < 1) {
    return `$${value.toFixed(4)}`;
  }
  return formatCurrency(value);
}
```

---

## Backend Conventions

### FastAPI Route Pattern
```python
# app/api/routes/stocks.py
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.stock import StockQuote, PriceHistory
from app.services.stock_service import StockService
from app.api.deps import get_stock_service

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/{symbol}/quote", response_model=StockQuote)
async def get_stock_quote(
    symbol: str,
    service: StockService = Depends(get_stock_service),
) -> StockQuote:
    """Fetch current quote for a stock symbol."""
    quote = await service.get_quote(symbol.upper())
    if not quote:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    return quote


@router.get("/{symbol}/history", response_model=list[PriceHistory])
async def get_price_history(
    symbol: str,
    range: str = Query(default="1M", regex="^(1D|1W|1M|3M|6M|1Y|5Y)$"),
    service: StockService = Depends(get_stock_service),
) -> list[PriceHistory]:
    """Fetch historical price data for a stock symbol."""
    return await service.get_history(symbol.upper(), range)
```

### Pydantic Schemas
```python
# app/schemas/stock.py
from datetime import datetime
from pydantic import BaseModel, Field


class StockQuote(BaseModel):
    """Current stock quote data."""
    
    symbol: str
    price: float = Field(ge=0)
    change: float
    change_percent: float
    volume: int = Field(ge=0)
    market_cap: float | None = None
    high_52w: float | None = None
    low_52w: float | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


class PriceHistory(BaseModel):
    """Historical price point."""
    
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
```

### Service Layer Pattern
```python
# app/services/stock_service.py
import httpx
from datetime import datetime, timedelta
from app.config import settings
from app.schemas.stock import StockQuote, PriceHistory
from app.core.exceptions import ExternalAPIError
import orjson


class StockService:
    """Service for fetching stock market data."""

    def __init__(self, redis_client, http_client: httpx.AsyncClient) -> None:
        self._redis = redis_client
        self._http = http_client
        self._base_url = "https://api.polygon.io"

    async def get_quote(self, symbol: str) -> StockQuote | None:
        """Fetch current quote, using cache when available."""
        cache_key = f"stock:quote:{symbol}"
        
        # Check cache first
        cached = await self._redis.get(cache_key)
        if cached:
            return StockQuote.model_validate(orjson.loads(cached))
        
        # Fetch from API
        try:
            response = await self._http.get(
                f"{self._base_url}/v2/aggs/ticker/{symbol}/prev",
                params={"apiKey": settings.polygon_api_key},
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            raise ExternalAPIError(f"Failed to fetch quote: {e}") from e
        
        if not data.get("results"):
            return None
        
        result = data["results"][0]
        quote = StockQuote(
            symbol=symbol,
            price=result["c"],
            change=result["c"] - result["o"],
            change_percent=((result["c"] - result["o"]) / result["o"]) * 100,
            volume=result["v"],
            updated_at=datetime.now(),
        )
        
        # Cache for 30 seconds
        await self._redis.setex(
            cache_key,
            30,
            orjson.dumps(quote.model_dump(mode="json")),
        )
        
        return quote

    async def get_history(
        self, symbol: str, range: str
    ) -> list[PriceHistory]:
        """Fetch historical price data."""
        range_config = {
            "1D": ("minute", 1),
            "1W": ("hour", 7),
            "1M": ("day", 30),
            "3M": ("day", 90),
            "6M": ("day", 180),
            "1Y": ("day", 365),
            "5Y": ("week", 365 * 5),
        }
        
        timespan, days = range_config[range]
        end = datetime.now()
        start = end - timedelta(days=days)
        
        response = await self._http.get(
            f"{self._base_url}/v2/aggs/ticker/{symbol}/range/1/{timespan}/{start:%Y-%m-%d}/{end:%Y-%m-%d}",
            params={"apiKey": settings.polygon_api_key, "limit": 5000},
        )
        response.raise_for_status()
        data = response.json()
        
        return [
            PriceHistory(
                timestamp=datetime.fromtimestamp(r["t"] / 1000),
                open=r["o"],
                high=r["h"],
                low=r["l"],
                close=r["c"],
                volume=r["v"],
            )
            for r in data.get("results", [])
        ]
```

### Configuration with Pydantic Settings
```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # Database
    database_url: str
    redis_url: str = "redis://localhost:6379"
    
    # API Keys (loaded from .env)
    polygon_api_key: str
    coingecko_api_key: str | None = None
    
    # App Config
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

---

## TypeScript Types

```typescript
// types/stock.ts
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  updatedAt: string;
}

export interface PriceHistory {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// types/crypto.ts
export interface CryptoQuote {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  rank: number;
  updatedAt: string;
}

// types/portfolio.ts
export interface Holding {
  id: string;
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  quantity: number;
  avgCost: number;
  currentPrice?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  holdings: HoldingWithValue[];
}

export interface HoldingWithValue extends Holding {
  currentValue: number;
  gain: number;
  gainPercent: number;
  allocation: number;
}
```

---

## Commands

### Frontend (Next.js)
```bash
# Development
pnpm dev                      # Start dev server (localhost:3000)
pnpm build                    # Production build
pnpm lint                     # Run ESLint
pnpm type-check               # Run TypeScript compiler check

# Dependencies
pnpm add <package>            # Add dependency
pnpm dlx shadcn@latest add <component>  # Add shadcn component
```

### Backend (FastAPI)
```bash
# Setup
uv venv                       # Create virtual environment
source .venv/bin/activate     # Activate venv (Unix)
uv pip install -e ".[dev]"    # Install with dev dependencies

# Development
uv run fastapi dev app/main.py    # Start dev server with reload
uv run pytest                     # Run tests
uv run pytest --cov=app           # Run tests with coverage
uv run ruff check .               # Lint
uv run ruff format .              # Format
uv run mypy app                   # Type check

# Database
uv run alembic upgrade head       # Run migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
```

### Docker
```bash
docker-compose up -d          # Start PostgreSQL + Redis
docker-compose down           # Stop services
docker-compose logs -f        # View logs
```

---

## Environment Variables

```bash
# .env.example

# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dashboard
REDIS_URL=redis://localhost:6379
POLYGON_API_KEY=your_polygon_key
COINGECKO_API_KEY=your_coingecko_key  # Optional, has free tier
DEBUG=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Security Checklist

- [ ] **NEVER** commit `.env` files (ensure in `.gitignore`)
- [ ] **NEVER** expose API keys in frontend code
- [ ] **NEVER** log API keys or sensitive data
- [ ] Use environment variables for all secrets
- [ ] Implement rate limiting on API routes
- [ ] Validate and sanitize all user inputs
- [ ] Use HTTPS in production
- [ ] Implement proper CORS configuration

---

## Performance Tips

### Frontend
- Use `React.memo()` for expensive chart components
- Debounce search inputs (300ms delay)
- Use `useMemo` for calculated portfolio values
- Implement virtual scrolling for large watchlists
- Lazy load chart libraries with `next/dynamic`

### Backend
- Cache API responses in Redis (30s for quotes, 5min for history)
- Use connection pooling for database
- Batch API requests where possible
- Use background tasks for price alerts
- Index database columns used in queries

---

## Feature Roadmap

### MVP (Phase 1)
- [ ] Stock quote display
- [ ] Crypto quote display
- [ ] Basic price charts
- [ ] Watchlist (local storage)
- [ ] Portfolio tracker (local storage)

### Phase 2
- [ ] User authentication
- [ ] Cloud-synced portfolios
- [ ] Price alerts
- [ ] Multiple watchlists
- [ ] News feed integration

### Phase 3
- [ ] Real-time WebSocket prices
- [ ] Advanced charting (indicators)
- [ ] Portfolio analytics
- [ ] Export to CSV
- [ ] Mobile responsive improvements

---

**Remember:** Start simple, ship fast, iterate based on usage.
