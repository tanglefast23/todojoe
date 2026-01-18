"""Stock data service with cascading fallback (Yahoo → Alpha Vantage → Polygon)."""

import asyncio
import logging
from datetime import datetime

import httpx
import orjson
import redis.asyncio as redis
import yfinance as yf

from app.config import settings
from app.schemas.stock import PriceHistory, StockQuote

logger = logging.getLogger(__name__)


class StockServiceError(Exception):
    """Base exception for stock service errors."""

    pass


class RateLimitError(StockServiceError):
    """Raised when rate limit is exceeded."""

    pass


class SymbolNotFoundError(StockServiceError):
    """Raised when symbol is not found."""

    pass


class StockService:
    """Service for fetching stock market data with cascading fallback."""

    def __init__(self, redis_client: redis.Redis) -> None:
        """Initialize stock service.

        Args:
            redis_client: Redis client for caching
        """
        self._redis = redis_client
        self._http_client: httpx.AsyncClient | None = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def get_quote(self, symbol: str) -> StockQuote:
        """Fetch current quote with parallel fallback for faster response times.

        Races all available data sources in parallel and returns the first
        successful response, cancelling remaining requests.

        Args:
            symbol: Stock ticker symbol (e.g., AAPL)

        Returns:
            StockQuote with current price data

        Raises:
            SymbolNotFoundError: If symbol not found in any source
            StockServiceError: If all sources fail
        """
        symbol = symbol.upper().strip()
        cache_key = f"stock:quote:{symbol}"

        # Check cache first
        cached = await self._redis.get(cache_key)
        if cached:
            data = orjson.loads(cached)
            return StockQuote(**data)

        # Build list of available data sources to race
        tasks: list[asyncio.Task] = []
        task_sources: list[str] = []

        # Always include Yahoo (primary, no API key needed)
        tasks.append(asyncio.create_task(self._fetch_yahoo(symbol)))
        task_sources.append("Yahoo")

        if settings.alpha_vantage_api_key:
            tasks.append(asyncio.create_task(self._fetch_alpha_vantage(symbol)))
            task_sources.append("Alpha Vantage")

        if settings.polygon_api_key:
            tasks.append(asyncio.create_task(self._fetch_polygon(symbol)))
            task_sources.append("Polygon")

        # Race all sources - return first success, cancel the rest
        symbol_not_found = False
        errors: list[str] = []

        while tasks:
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

            for completed_task in done:
                task_idx = tasks.index(completed_task) if completed_task in tasks else -1
                source = task_sources[task_idx] if task_idx >= 0 else "Unknown"

                try:
                    quote = completed_task.result()
                    # Success! Cancel remaining tasks and return
                    for task in pending:
                        task.cancel()
                    await self._cache_quote(cache_key, quote)
                    return quote
                except SymbolNotFoundError:
                    symbol_not_found = True
                    errors.append(f"{source}: symbol not found")
                except Exception as e:
                    errors.append(f"{source}: {e}")
                    logger.warning(f"{source} failed for {symbol}: {e}")

            # Update tasks list to only pending ones
            tasks = list(pending)
            # Update sources to match remaining tasks
            remaining_sources = []
            for task in tasks:
                # Find source for this pending task
                for i, t in enumerate(tasks):
                    if t == task and i < len(task_sources):
                        remaining_sources.append(task_sources[i])
                        break
            task_sources = remaining_sources if remaining_sources else task_sources[:len(tasks)]

        # All sources failed
        if symbol_not_found:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in any source")
        raise StockServiceError(f"All data sources failed for {symbol}: {'; '.join(errors)}")

    async def _fetch_yahoo(self, symbol: str) -> StockQuote:
        """Fetch quote from Yahoo Finance with extended market data.

        Args:
            symbol: Stock ticker symbol

        Returns:
            StockQuote from Yahoo Finance with pre/post market and period changes
        """
        try:
            # Run blocking yfinance calls in thread pool to avoid blocking event loop
            ticker = await asyncio.to_thread(yf.Ticker, symbol)
            info = await asyncio.to_thread(lambda: ticker.info)

            if not info or info.get("regularMarketPrice") is None:
                raise SymbolNotFoundError(f"Symbol {symbol} not found")

            price = info.get("regularMarketPrice", 0)
            prev_close = info.get("regularMarketPreviousClose", price)
            change = price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0

            # Pre-market data - calculate change percent manually for consistency
            pre_price = info.get("preMarketPrice")
            pre_change = None
            pre_change_pct = None
            if pre_price and price:
                pre_change = pre_price - price
                pre_change_pct = (pre_change / price) * 100

            # Post-market (after-hours) data - calculate change percent manually
            post_price = info.get("postMarketPrice")
            post_change = None
            post_change_pct = None
            if post_price and price:
                post_change = post_price - price
                post_change_pct = (post_change / price) * 100

            # Market state
            market_state = info.get("marketState")  # PRE, REGULAR, POST, CLOSED

            # Multi-period changes - fetch from history if not in info
            change_week = None
            change_month = None
            change_year = None

            try:
                hist = await asyncio.to_thread(ticker.history, period="1y")
                if not hist.empty and len(hist) > 0:
                    current = hist["Close"].iloc[-1]

                    # Weekly change (5 trading days)
                    if len(hist) >= 5:
                        week_ago = hist["Close"].iloc[-5]
                        change_week = ((current - week_ago) / week_ago) * 100

                    # Monthly change (~21 trading days)
                    if len(hist) >= 21:
                        month_ago = hist["Close"].iloc[-21]
                        change_month = ((current - month_ago) / month_ago) * 100

                    # Yearly change
                    if len(hist) >= 252:
                        year_ago = hist["Close"].iloc[-252]
                        change_year = ((current - year_ago) / year_ago) * 100
                    elif len(hist) >= 200:
                        # Use oldest available if less than a year
                        year_ago = hist["Close"].iloc[0]
                        change_year = ((current - year_ago) / year_ago) * 100
            except Exception as hist_err:
                logger.debug(f"Could not fetch history for {symbol}: {hist_err}")

            # Futures symbol mapping for major stocks/ETFs
            futures_map = {
                "SPY": "ES",
                "QQQ": "NQ",
                "IWM": "RTY",
                "DIA": "YM",
                "AAPL": "NQ",  # Tech correlates with Nasdaq futures
                "MSFT": "NQ",
                "GOOGL": "NQ",
                "AMZN": "NQ",
                "META": "NQ",
                "NVDA": "NQ",
                "TSLA": "NQ",
            }

            # Get logo URL - Yahoo provides it or use Clearbit fallback
            logo_url = info.get("logo_url")
            if not logo_url:
                # Clearbit Logo API (free, no auth required)
                logo_url = f"https://logo.clearbit.com/{info.get('website', '').replace('https://', '').replace('http://', '').split('/')[0]}" if info.get("website") else None
                # Fallback to a generic finance icon service
                if not logo_url or "clearbit" not in logo_url:
                    logo_url = f"https://s.yimg.com/aq/autoc/img/{symbol.lower()}_logo.png"

            return StockQuote(
                symbol=symbol,
                name=info.get("shortName") or info.get("longName"),
                logo_url=logo_url,
                price=price,
                change=change,
                change_percent=change_pct,
                volume=info.get("regularMarketVolume", 0),
                market_cap=info.get("marketCap"),
                high_52w=info.get("fiftyTwoWeekHigh"),
                low_52w=info.get("fiftyTwoWeekLow"),
                change_percent_week=change_week,
                change_percent_month=change_month,
                change_percent_year=change_year,
                pre_market_price=pre_price,
                pre_market_change=pre_change,
                pre_market_change_percent=pre_change_pct,
                post_market_price=post_price,
                post_market_change=post_change,
                post_market_change_percent=post_change_pct,
                market_state=market_state,
                futures_symbol=futures_map.get(symbol),
                source="yahoo",
                updated_at=datetime.now(),
            )
        except SymbolNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Yahoo Finance error for {symbol}: {e}")
            raise StockServiceError(f"Yahoo Finance error: {e}")

    async def _fetch_alpha_vantage(self, symbol: str) -> StockQuote:
        """Fetch quote from Alpha Vantage.

        Args:
            symbol: Stock ticker symbol

        Returns:
            StockQuote from Alpha Vantage
        """
        client = await self._get_http_client()
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": symbol,
            "apikey": settings.alpha_vantage_api_key,
        }

        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        if "Global Quote" not in data or not data["Global Quote"]:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in Alpha Vantage")

        quote_data = data["Global Quote"]
        price = float(quote_data.get("05. price", 0))
        change = float(quote_data.get("09. change", 0))
        change_pct = float(quote_data.get("10. change percent", "0%").rstrip("%"))

        return StockQuote(
            symbol=symbol,
            name=None,
            price=price,
            change=change,
            change_percent=change_pct,
            volume=int(quote_data.get("06. volume", 0)),
            market_cap=None,
            high_52w=None,
            low_52w=None,
            source="alpha_vantage",
            updated_at=datetime.now(),
        )

    async def _fetch_polygon(self, symbol: str) -> StockQuote:
        """Fetch quote from Polygon.io.

        Args:
            symbol: Stock ticker symbol

        Returns:
            StockQuote from Polygon
        """
        client = await self._get_http_client()
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/prev"
        params = {"apiKey": settings.polygon_api_key}

        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        if not data.get("results"):
            raise SymbolNotFoundError(f"Symbol {symbol} not found in Polygon")

        result = data["results"][0]
        price = result.get("c", 0)
        open_price = result.get("o", price)
        change = price - open_price
        change_pct = (change / open_price * 100) if open_price else 0

        return StockQuote(
            symbol=symbol,
            name=None,
            price=price,
            change=change,
            change_percent=change_pct,
            volume=int(result.get("v", 0)),
            market_cap=None,
            high_52w=None,
            low_52w=None,
            source="polygon",
            updated_at=datetime.now(),
        )

    async def get_history(
        self, symbol: str, time_range: str = "1M"
    ) -> list[PriceHistory]:
        """Fetch historical price data.

        Args:
            symbol: Stock ticker symbol
            time_range: Time range (1D, 1W, 1M, 3M, 6M, 1Y, 5Y)

        Returns:
            List of PriceHistory objects
        """
        symbol = symbol.upper().strip()
        cache_key = f"stock:history:{symbol}:{time_range}"

        # Check cache
        cached = await self._redis.get(cache_key)
        if cached:
            data = orjson.loads(cached)
            return [PriceHistory(**item) for item in data]

        # Map time range to yfinance period and interval
        range_config: dict[str, tuple[str, str]] = {
            "1D": ("1d", "5m"),
            "1W": ("5d", "30m"),
            "1M": ("1mo", "1d"),
            "3M": ("3mo", "1d"),
            "6M": ("6mo", "1d"),
            "1Y": ("1y", "1d"),
            "5Y": ("5y", "1wk"),
        }

        period, interval = range_config.get(time_range, ("1mo", "1d"))

        try:
            # Run blocking yfinance calls in thread pool to avoid blocking event loop
            ticker = await asyncio.to_thread(yf.Ticker, symbol)
            hist = await asyncio.to_thread(ticker.history, period=period, interval=interval)

            if hist.empty:
                return []

            # Use itertuples for 50-100x faster iteration than iterrows
            history = [
                PriceHistory(
                    timestamp=row.Index.to_pydatetime(),
                    open=row.Open,
                    high=row.High,
                    low=row.Low,
                    close=row.Close,
                    volume=int(row.Volume),
                )
                for row in hist.itertuples()
            ]

            # Cache for configurable TTL (default 15 min)
            await self._redis.setex(
                cache_key,
                settings.cache_history_ttl_seconds,
                orjson.dumps([h.model_dump(mode="json") for h in history]),
            )

            return history
        except Exception as e:
            logger.error(f"Failed to fetch history for {symbol}: {e}")
            return []

    async def get_batch_quotes(self, symbols: list[str]) -> list[StockQuote]:
        """Fetch quotes for multiple symbols in parallel.

        Args:
            symbols: List of stock ticker symbols

        Returns:
            List of StockQuote objects (excludes failed fetches)
        """
        tasks = [self.get_quote(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        quotes = []
        for symbol, result in zip(symbols, results):
            if isinstance(result, Exception):
                logger.warning(f"Failed to fetch quote for {symbol}: {result}")
            else:
                quotes.append(result)
        return quotes

    async def _cache_quote(self, key: str, quote: StockQuote) -> None:
        """Cache a quote with TTL.

        Args:
            key: Cache key
            quote: StockQuote to cache
        """
        await self._redis.setex(
            key,
            settings.cache_ttl_seconds,
            orjson.dumps(quote.model_dump(mode="json")),
        )

    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
