"""Crypto data service with cascading fallback (CoinGecko → Binance → CoinMarketCap)."""

import asyncio
import logging
from datetime import datetime

import httpx
import orjson
import redis.asyncio as redis

from app.config import settings
from app.schemas.crypto import CryptoPriceHistory, CryptoQuote

logger = logging.getLogger(__name__)


class CryptoServiceError(Exception):
    """Base exception for crypto service errors."""

    pass


class SymbolNotFoundError(CryptoServiceError):
    """Raised when symbol is not found."""

    pass


class AllSourcesExhaustedError(CryptoServiceError):
    """Raised when all data sources fail."""

    pass


# Symbol mapping for different APIs
SYMBOL_MAP: dict[str, dict[str, str]] = {
    "BTC": {"coingecko": "bitcoin", "binance": "BTCUSDT", "name": "Bitcoin"},
    "ETH": {"coingecko": "ethereum", "binance": "ETHUSDT", "name": "Ethereum"},
    "SOL": {"coingecko": "solana", "binance": "SOLUSDT", "name": "Solana"},
    "XRP": {"coingecko": "ripple", "binance": "XRPUSDT", "name": "XRP"},
    "DOGE": {"coingecko": "dogecoin", "binance": "DOGEUSDT", "name": "Dogecoin"},
    "ADA": {"coingecko": "cardano", "binance": "ADAUSDT", "name": "Cardano"},
    "AVAX": {"coingecko": "avalanche-2", "binance": "AVAXUSDT", "name": "Avalanche"},
    "DOT": {"coingecko": "polkadot", "binance": "DOTUSDT", "name": "Polkadot"},
    "MATIC": {"coingecko": "matic-network", "binance": "MATICUSDT", "name": "Polygon"},
    "LINK": {"coingecko": "chainlink", "binance": "LINKUSDT", "name": "Chainlink"},
    "UNI": {"coingecko": "uniswap", "binance": "UNIUSDT", "name": "Uniswap"},
    "ATOM": {"coingecko": "cosmos", "binance": "ATOMUSDT", "name": "Cosmos"},
    "LTC": {"coingecko": "litecoin", "binance": "LTCUSDT", "name": "Litecoin"},
    "BCH": {"coingecko": "bitcoin-cash", "binance": "BCHUSDT", "name": "Bitcoin Cash"},
    "SHIB": {"coingecko": "shiba-inu", "binance": "SHIBUSDT", "name": "Shiba Inu"},
    # Stablecoins - USD-pegged
    "USDT": {"coingecko": "tether", "binance": "USDTDAI", "name": "Tether"},
    "USDC": {"coingecko": "usd-coin", "binance": "USDCTUSD", "name": "USD Coin"},
    "USDS": {"coingecko": "usds", "binance": "USDSUSDC", "name": "USDS"},
    "USDE": {"coingecko": "ethena-usde", "binance": "USDEUSDT", "name": "Ethena USDe"},
    "DAI": {"coingecko": "dai", "binance": "DAIUSDT", "name": "Dai"},
    "FDUSD": {"coingecko": "first-digital-usd", "binance": "FDUSDUSDC", "name": "First Digital USD"},
    "PYUSD": {"coingecko": "paypal-usd", "binance": "PYUSDUSDT", "name": "PayPal USD"},
    "FRAX": {"coingecko": "frax", "binance": "FRAXUSDT", "name": "Frax"},
    "TUSD": {"coingecko": "true-usd", "binance": "TUSDUSDT", "name": "TrueUSD"},
    "USDP": {"coingecko": "pax-dollar", "binance": "USDPUSDT", "name": "Pax Dollar"},
    "GUSD": {"coingecko": "gemini-dollar", "binance": "GUSDUSDT", "name": "Gemini Dollar"},
    "LUSD": {"coingecko": "liquity-usd", "binance": "LUSDUSDT", "name": "Liquity USD"},
    "CRVUSD": {"coingecko": "crvusd", "binance": "CRVUSDUSDT", "name": "Curve USD"},
    "SUSD": {"coingecko": "susd", "binance": "SUSDUSDT", "name": "sUSD"},
    "BUSD": {"coingecko": "binance-usd", "binance": "BUSDUSDT", "name": "Binance USD"},
    # Stablecoins - Euro-pegged
    "EURC": {"coingecko": "eurc", "binance": "EURCUSDT", "name": "EURC"},
    # xStocks - Tokenized Stocks (BackedFi) - Tech Giants
    "TSLAX": {"coingecko": "tesla-xstock", "binance": None, "name": "Tesla xStock"},
    "NVDAX": {"coingecko": "nvidia-xstock", "binance": None, "name": "NVIDIA xStock"},
    "GOOGLX": {"coingecko": "alphabet-xstock", "binance": None, "name": "Alphabet xStock"},
    "AAPLX": {"coingecko": "apple-xstock", "binance": None, "name": "Apple xStock"},
    "AMZNX": {"coingecko": "amazon-xstock", "binance": None, "name": "Amazon xStock"},
    "MSFTX": {"coingecko": "microsoft-xstock", "binance": None, "name": "Microsoft xStock"},
    "METAX": {"coingecko": "meta-xstock", "binance": None, "name": "Meta xStock"},
    "NFLXX": {"coingecko": "netflix-xstock", "binance": None, "name": "Netflix xStock"},
    "COINX": {"coingecko": "coinbase-xstock", "binance": None, "name": "Coinbase xStock"},
    "MSTRX": {"coingecko": "microstrategy-xstock", "binance": None, "name": "MicroStrategy xStock"},
    "INTCX": {"coingecko": "intel-xstock", "binance": None, "name": "Intel xStock"},
    "AMDX": {"coingecko": "amd-xstock", "binance": None, "name": "AMD xStock"},
    "ORCLX": {"coingecko": "oracle-xstock", "binance": None, "name": "Oracle xStock"},
    "PLTRX": {"coingecko": "palantir-xstock", "binance": None, "name": "Palantir xStock"},
    "CRWDX": {"coingecko": "crowdstrike-xstock", "binance": None, "name": "CrowdStrike xStock"},
    "CRMX": {"coingecko": "salesforce-xstock", "binance": None, "name": "Salesforce xStock"},
    "PANWX": {"coingecko": "palo-alto-networks-xstock", "binance": None, "name": "Palo Alto Networks xStock"},
    "ASMLX": {"coingecko": "asml-xstock", "binance": None, "name": "ASML xStock"},
    "MUX": {"coingecko": "micron-technology-xstock", "binance": None, "name": "Micron Technology xStock"},
    "AVGOX": {"coingecko": "broadcom-xstock", "binance": None, "name": "Broadcom xStock"},
    # xStocks - ETFs & Indices
    "SPYX": {"coingecko": "sp500-xstock", "binance": None, "name": "S&P 500 xStock"},
    "QQQX": {"coingecko": "nasdaq-xstock", "binance": None, "name": "Nasdaq xStock"},
    "TQQQX": {"coingecko": "tqqq-xstock", "binance": None, "name": "TQQQ xStock"},
    "VTIX": {"coingecko": "vanguard-xstock", "binance": None, "name": "Vanguard xStock"},
    "IWMX": {"coingecko": "russell-2000-xstock", "binance": None, "name": "Russell 2000 xStock"},
    "GLDX": {"coingecko": "gold-xstock", "binance": None, "name": "Gold xStock"},
    # xStocks - Finance & Banking
    "JPMX": {"coingecko": "jpmorgan-chase-xstock", "binance": None, "name": "JPMorgan Chase xStock"},
    "GSX": {"coingecko": "goldman-sachs-xstock", "binance": None, "name": "Goldman Sachs xStock"},
    "BACX": {"coingecko": "bank-of-america-xstock", "binance": None, "name": "Bank of America xStock"},
    "VX": {"coingecko": "visa-xstock", "binance": None, "name": "Visa xStock"},
    "MAX": {"coingecko": "mastercard-xstock", "binance": None, "name": "Mastercard xStock"},
    "AXPX": {"coingecko": "american-express-xstock", "binance": None, "name": "American Express xStock"},
    "PYPLX": {"coingecko": "paypal-xstock", "binance": None, "name": "PayPal xStock"},
    "HOODX": {"coingecko": "robinhood-xstock", "binance": None, "name": "Robinhood xStock"},
    "BLKX": {"coingecko": "blackrock-xstock", "binance": None, "name": "BlackRock xStock"},
    # xStocks - Healthcare & Pharma
    "PFEX": {"coingecko": "pfizer-xstock", "binance": None, "name": "Pfizer xStock"},
    "UNHX": {"coingecko": "unitedhealth-xstock", "binance": None, "name": "UnitedHealth xStock"},
    "JNJX": {"coingecko": "johnson-johnson-xstock", "binance": None, "name": "Johnson & Johnson xStock"},
    "ABBVX": {"coingecko": "abbvie-xstock", "binance": None, "name": "AbbVie xStock"},
    "MRKX": {"coingecko": "merck-xstock", "binance": None, "name": "Merck xStock"},
    "LLYX": {"coingecko": "eli-lilly-xstock", "binance": None, "name": "Eli Lilly xStock"},
    "NVOX": {"coingecko": "novo-nordisk-xstock", "binance": None, "name": "Novo Nordisk xStock"},
    "AZNX": {"coingecko": "astrazeneca-xstock", "binance": None, "name": "AstraZeneca xStock"},
    "ABTX": {"coingecko": "abbott-xstock", "binance": None, "name": "Abbott xStock"},
    "TMOX": {"coingecko": "thermo-fisher-xstock", "binance": None, "name": "Thermo Fisher xStock"},
    "DHRX": {"coingecko": "danaher-xstock", "binance": None, "name": "Danaher xStock"},
    "MDTX": {"coingecko": "medtronic-xstock", "binance": None, "name": "Medtronic xStock"},
    # xStocks - Consumer & Retail
    "COSTX": {"coingecko": "costco-xstock", "binance": None, "name": "Costco xStock"},
    "MCDX": {"coingecko": "mcdonald-s-xstock", "binance": None, "name": "McDonald's xStock"},
    "KOX": {"coingecko": "coca-cola-xstock", "binance": None, "name": "Coca-Cola xStock"},
    "PEPX": {"coingecko": "pepsico-xstock", "binance": None, "name": "PepsiCo xStock"},
    "PGX": {"coingecko": "procter-gamble-xstock", "binance": None, "name": "Procter & Gamble xStock"},
    "HDX": {"coingecko": "home-depot-xstock", "binance": None, "name": "Home Depot xStock"},
    "LULUX": {"coingecko": "lululemon-xstock", "binance": None, "name": "lululemon xStock"},
    "WENX": {"coingecko": "wendy-s-xstock", "binance": None, "name": "Wendy's xStock"},
    "BKNGX": {"coingecko": "booking-xstock", "binance": None, "name": "Booking xStock"},
    "EBAYX": {"coingecko": "ebay-xstock", "binance": None, "name": "eBay xStock"},
    # xStocks - Energy & Industrial
    "XOMX": {"coingecko": "exxon-mobil-xstock", "binance": None, "name": "Exxon Mobil xStock"},
    "CVXX": {"coingecko": "chevron-xstock", "binance": None, "name": "Chevron xStock"},
    "HONX": {"coingecko": "honeywell-xstock", "binance": None, "name": "Honeywell xStock"},
    "LINX": {"coingecko": "linde-xstock", "binance": None, "name": "Linde xStock"},
    # xStocks - Other Notable
    "BRK.BX": {"coingecko": "berkshire-hathaway-xstock", "binance": None, "name": "Berkshire Hathaway xStock"},
    "IBMX": {"coingecko": "international-business-machines-xstock", "binance": None, "name": "IBM xStock"},
    "CSCOX": {"coingecko": "cisco-xstock", "binance": None, "name": "Cisco xStock"},
    "ACNX": {"coingecko": "accenture-xstock", "binance": None, "name": "Accenture xStock"},
    "TX": {"coingecko": "at-t-xstock", "binance": None, "name": "AT&T xStock"},
    "PMX": {"coingecko": "philip-morris-xstock", "binance": None, "name": "Philip Morris xStock"},
    "CMCSAX": {"coingecko": "comcast-xstock", "binance": None, "name": "Comcast xStock"},
    "SPGIX": {"coingecko": "s-p-global-xstock", "binance": None, "name": "S&P Global xStock"},
    "GMEX": {"coingecko": "gamestop-xstock", "binance": None, "name": "GameStop xStock"},
    "APPX": {"coingecko": "applovin-xstock", "binance": None, "name": "AppLovin xStock"},
    "RBLXX": {"coingecko": "roblox-xstock", "binance": None, "name": "Roblox xStock"},
    "ADBEX": {"coingecko": "adobe-xstock", "binance": None, "name": "Adobe xStock"},
    "DUOLX": {"coingecko": "duolingo-xstock", "binance": None, "name": "Duolingo xStock"},
    "EXPEX": {"coingecko": "expedia-xstock", "binance": None, "name": "Expedia xStock"},
    "MRVLX": {"coingecko": "marvell-xstock", "binance": None, "name": "Marvell xStock"},
    # xStocks - Crypto-related Companies
    "CRCLX": {"coingecko": "circle-xstock", "binance": None, "name": "Circle xStock"},
    "DFDVX": {"coingecko": "dfdv-xstock", "binance": None, "name": "DeFi Development Corp xStock"},
    "GLXYX": {"coingecko": "galaxy-digital-xstock", "binance": None, "name": "Galaxy Digital xStock"},
    "RIOTX": {"coingecko": "riot-platforms-xstock", "binance": None, "name": "Riot Platforms xStock"},
    "CLSKX": {"coingecko": "cleanspark-xstock", "binance": None, "name": "CleanSpark xStock"},
    "CORZX": {"coingecko": "core-scientific-xstock", "binance": None, "name": "Core Scientific xStock"},
    "HUTX": {"coingecko": "hut-8-xstock", "binance": None, "name": "Hut 8 xStock"},
    "BTBTX": {"coingecko": "bit-digital-xstock", "binance": None, "name": "Bit Digital xStock"},
    "FUFUX": {"coingecko": "bitfufu-xstock", "binance": None, "name": "BitFuFu xStock"},
    "BMNRX": {"coingecko": "bitmine-xstock", "binance": None, "name": "Bitmine xStock"},
    # xStocks - Space & Clean Energy
    "RKLBX": {"coingecko": "rocket-lab-xstock", "binance": None, "name": "Rocket Lab xStock"},
    "OKLOX": {"coingecko": "oklo-xstock", "binance": None, "name": "Oklo xStock"},
    "ASTSX": {"coingecko": "ast-spacemobile-xstock", "binance": None, "name": "AST SpaceMobile xStock"},
}


class CryptoService:
    """Service for fetching cryptocurrency data with cascading fallback."""

    def __init__(self, redis_client: redis.Redis) -> None:
        """Initialize crypto service.

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

    async def get_quote(self, symbol: str) -> CryptoQuote:
        """Fetch current quote with parallel fallback for faster response times.

        Races all available data sources in parallel and returns the first
        successful response, cancelling remaining requests.

        Args:
            symbol: Crypto symbol (e.g., BTC, ETH)

        Returns:
            CryptoQuote with current price data

        Raises:
            SymbolNotFoundError: If symbol not found
            AllSourcesExhaustedError: If all sources fail
        """
        symbol = symbol.upper().strip()
        cache_key = f"crypto:quote:{symbol}"

        # Check cache first
        cached = await self._redis.get(cache_key)
        if cached:
            data = orjson.loads(cached)
            return CryptoQuote(**data)

        # Build list of available data sources to race
        tasks: list[asyncio.Task] = []
        task_sources: list[str] = []

        # CoinGecko (free, no API key needed)
        tasks.append(asyncio.create_task(self._fetch_coingecko(symbol)))
        task_sources.append("CoinGecko")

        # Binance (free, no API key needed)
        tasks.append(asyncio.create_task(self._fetch_binance(symbol)))
        task_sources.append("Binance")

        if settings.coinmarketcap_api_key:
            tasks.append(asyncio.create_task(self._fetch_coinmarketcap(symbol)))
            task_sources.append("CoinMarketCap")

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
                for i, t in enumerate(tasks):
                    if t == task and i < len(task_sources):
                        remaining_sources.append(task_sources[i])
                        break
            task_sources = remaining_sources if remaining_sources else task_sources[:len(tasks)]

        # All sources failed
        if symbol_not_found:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in any source")
        raise AllSourcesExhaustedError(f"All data sources failed for {symbol}: {'; '.join(errors)}")

    async def _fetch_coingecko(self, symbol: str) -> CryptoQuote:
        """Fetch quote from CoinGecko with extended market data.

        Args:
            symbol: Crypto symbol

        Returns:
            CryptoQuote from CoinGecko with multi-period changes
        """
        client = await self._get_http_client()

        # Get CoinGecko ID
        coin_id = SYMBOL_MAP.get(symbol, {}).get("coingecko", symbol.lower())
        coin_name = SYMBOL_MAP.get(symbol, {}).get("name", symbol)

        url = "https://api.coingecko.com/api/v3/coins/markets"
        params = {
            "vs_currency": "usd",
            "ids": coin_id,
            "order": "market_cap_desc",
            "sparkline": "false",
            "price_change_percentage": "24h,7d,30d,1y",
        }

        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        if not data:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in CoinGecko")

        coin = data[0]
        return CryptoQuote(
            symbol=symbol,
            name=coin.get("name", coin_name),
            logo_url=coin.get("image"),
            price=coin.get("current_price", 0),
            change_24h=coin.get("price_change_24h", 0),
            change_percent_24h=coin.get("price_change_percentage_24h", 0),
            volume_24h=coin.get("total_volume", 0),
            market_cap=coin.get("market_cap", 0),
            rank=coin.get("market_cap_rank"),
            change_percent_7d=coin.get("price_change_percentage_7d_in_currency"),
            change_percent_30d=coin.get("price_change_percentage_30d_in_currency"),
            change_percent_1y=coin.get("price_change_percentage_1y_in_currency"),
            ath=coin.get("ath"),
            ath_change_percent=coin.get("ath_change_percentage"),
            source="coingecko",
            updated_at=datetime.now(),
        )

    async def _fetch_binance(self, symbol: str) -> CryptoQuote:
        """Fetch quote from Binance.

        Args:
            symbol: Crypto symbol

        Returns:
            CryptoQuote from Binance
        """
        client = await self._get_http_client()

        # Get Binance pair
        pair = SYMBOL_MAP.get(symbol, {}).get("binance", f"{symbol}USDT")
        coin_name = SYMBOL_MAP.get(symbol, {}).get("name", symbol)

        url = "https://api.binance.com/api/v3/ticker/24hr"
        params = {"symbol": pair}

        response = await client.get(url, params=params)

        if response.status_code == 400:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in Binance")

        response.raise_for_status()
        data = response.json()

        price = float(data.get("lastPrice", 0))
        prev_price = float(data.get("prevClosePrice", price))
        change = price - prev_price
        change_pct = float(data.get("priceChangePercent", 0))

        return CryptoQuote(
            symbol=symbol,
            name=coin_name,
            price=price,
            change_24h=change,
            change_percent_24h=change_pct,
            volume_24h=float(data.get("quoteVolume", 0)),
            market_cap=0,  # Binance doesn't provide market cap
            rank=None,
            source="binance",
            updated_at=datetime.now(),
        )

    async def _fetch_coinmarketcap(self, symbol: str) -> CryptoQuote:
        """Fetch quote from CoinMarketCap.

        Args:
            symbol: Crypto symbol

        Returns:
            CryptoQuote from CoinMarketCap
        """
        client = await self._get_http_client()
        coin_name = SYMBOL_MAP.get(symbol, {}).get("name", symbol)

        url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest"
        headers = {"X-CMC_PRO_API_KEY": settings.coinmarketcap_api_key}
        params = {"symbol": symbol, "convert": "USD"}

        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

        if "data" not in data or symbol not in data["data"]:
            raise SymbolNotFoundError(f"Symbol {symbol} not found in CoinMarketCap")

        coin = data["data"][symbol]
        quote = coin.get("quote", {}).get("USD", {})

        return CryptoQuote(
            symbol=symbol,
            name=coin.get("name", coin_name),
            price=quote.get("price", 0),
            change_24h=quote.get("price", 0) * (quote.get("percent_change_24h", 0) / 100),
            change_percent_24h=quote.get("percent_change_24h", 0),
            volume_24h=quote.get("volume_24h", 0),
            market_cap=quote.get("market_cap", 0),
            rank=coin.get("cmc_rank"),
            source="coinmarketcap",
            updated_at=datetime.now(),
        )

    async def get_history(
        self, symbol: str, time_range: str = "1M"
    ) -> list[CryptoPriceHistory]:
        """Fetch historical price data from CoinGecko.

        Args:
            symbol: Crypto symbol
            time_range: Time range (1D, 1W, 1M, 3M, 6M, 1Y)

        Returns:
            List of CryptoPriceHistory objects
        """
        symbol = symbol.upper().strip()
        cache_key = f"crypto:history:{symbol}:{time_range}"

        # Check cache
        cached = await self._redis.get(cache_key)
        if cached:
            data = orjson.loads(cached)
            return [CryptoPriceHistory(**item) for item in data]

        # Map time range to CoinGecko days
        range_days: dict[str, int] = {
            "1D": 1,
            "1W": 7,
            "1M": 30,
            "3M": 90,
            "6M": 180,
            "1Y": 365,
        }

        days = range_days.get(time_range, 30)
        coin_id = SYMBOL_MAP.get(symbol, {}).get("coingecko", symbol.lower())

        try:
            client = await self._get_http_client()
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
            params = {"vs_currency": "usd", "days": days}

            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            prices = data.get("prices", [])
            history = [
                CryptoPriceHistory(
                    timestamp=datetime.fromtimestamp(point[0] / 1000),
                    price=point[1],
                )
                for point in prices
            ]

            # Cache for configurable TTL (default 15 min)
            await self._redis.setex(
                cache_key,
                settings.cache_history_ttl_seconds,
                orjson.dumps([h.model_dump(mode="json") for h in history]),
            )

            return history
        except Exception as e:
            logger.error(f"Failed to fetch crypto history for {symbol}: {e}")
            return []

    async def get_batch_quotes(self, symbols: list[str]) -> list[CryptoQuote]:
        """Fetch quotes for multiple symbols using CoinGecko batch API.

        Uses single API call to fetch all symbols at once, falling back to
        parallel individual fetches if batch fails.

        Args:
            symbols: List of crypto symbols

        Returns:
            List of CryptoQuote objects (excludes failed fetches)
        """
        if not symbols:
            return []

        # Try batch fetch from CoinGecko first (single API call for all symbols)
        try:
            return await self._fetch_coingecko_batch(symbols)
        except Exception as e:
            logger.warning(f"CoinGecko batch fetch failed, falling back to parallel: {e}")

        # Fallback: parallel individual fetches
        tasks = [self.get_quote(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        quotes = []
        for symbol, result in zip(symbols, results):
            if isinstance(result, Exception):
                logger.warning(f"Failed to fetch quote for {symbol}: {result}")
            else:
                quotes.append(result)
        return quotes

    async def _fetch_coingecko_batch(self, symbols: list[str]) -> list[CryptoQuote]:
        """Fetch multiple quotes from CoinGecko in a single API call.

        CoinGecko's /coins/markets endpoint accepts comma-separated IDs,
        reducing N API calls to 1.

        Args:
            symbols: List of crypto symbols

        Returns:
            List of CryptoQuote objects
        """
        client = await self._get_http_client()

        # Build comma-separated list of CoinGecko IDs
        symbol_to_id = {}
        coin_ids = []
        for symbol in symbols:
            symbol_upper = symbol.upper().strip()
            coin_id = SYMBOL_MAP.get(symbol_upper, {}).get("coingecko", symbol.lower())
            symbol_to_id[coin_id] = symbol_upper
            coin_ids.append(coin_id)

        url = "https://api.coingecko.com/api/v3/coins/markets"
        params = {
            "vs_currency": "usd",
            "ids": ",".join(coin_ids),
            "order": "market_cap_desc",
            "sparkline": "false",
            "price_change_percentage": "24h,7d,30d,1y",
        }

        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        # Build quotes from response, mapping back to original symbols
        quotes = []
        id_to_coin = {coin.get("id"): coin for coin in data}

        for coin_id, symbol in symbol_to_id.items():
            coin = id_to_coin.get(coin_id)
            if not coin:
                logger.warning(f"Symbol {symbol} (id={coin_id}) not found in CoinGecko batch response")
                continue

            coin_name = SYMBOL_MAP.get(symbol, {}).get("name", coin.get("name", symbol))
            quote = CryptoQuote(
                symbol=symbol,
                name=coin.get("name", coin_name),
                logo_url=coin.get("image"),
                price=coin.get("current_price", 0),
                change_24h=coin.get("price_change_24h", 0),
                change_percent_24h=coin.get("price_change_percentage_24h", 0),
                volume_24h=coin.get("total_volume", 0),
                market_cap=coin.get("market_cap", 0),
                rank=coin.get("market_cap_rank"),
                change_percent_7d=coin.get("price_change_percentage_7d_in_currency"),
                change_percent_30d=coin.get("price_change_percentage_30d_in_currency"),
                change_percent_1y=coin.get("price_change_percentage_1y_in_currency"),
                ath=coin.get("ath"),
                ath_change_percent=coin.get("ath_change_percentage"),
                source="coingecko",
                updated_at=datetime.now(),
            )
            quotes.append(quote)

            # Cache individual quote for subsequent single-symbol requests
            cache_key = f"crypto:quote:{symbol}"
            await self._cache_quote(cache_key, quote)

        return quotes

    async def _cache_quote(self, key: str, quote: CryptoQuote) -> None:
        """Cache a quote with TTL.

        Args:
            key: Cache key
            quote: CryptoQuote to cache
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
