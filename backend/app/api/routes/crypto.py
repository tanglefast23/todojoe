"""Crypto API routes."""

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.crypto import CryptoPriceHistory, CryptoQuote
from app.services.crypto_service import (
    AllSourcesExhaustedError,
    CryptoService,
    SymbolNotFoundError,
)

router = APIRouter(prefix="/crypto")


def get_crypto_service(request: Request) -> CryptoService:
    """Get crypto service instance with Redis client.

    Args:
        request: FastAPI request object

    Returns:
        CryptoService instance
    """
    return CryptoService(request.app.state.redis)


@router.get("/{symbol}/quote", response_model=CryptoQuote)
async def get_crypto_quote(symbol: str, request: Request) -> CryptoQuote:
    """Fetch current quote for a cryptocurrency.

    Args:
        symbol: Crypto symbol (e.g., BTC, ETH)
        request: FastAPI request object

    Returns:
        CryptoQuote with current price data

    Raises:
        HTTPException: 404 if symbol not found, 503 if service unavailable
    """
    service = get_crypto_service(request)

    try:
        return await service.get_quote(symbol)
    except SymbolNotFoundError:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    except AllSourcesExhaustedError as e:
        raise HTTPException(status_code=503, detail=str(e))
    finally:
        await service.close()


@router.get("/{symbol}/history", response_model=list[CryptoPriceHistory])
async def get_crypto_history(
    symbol: str,
    request: Request,
    range: str = Query(
        default="1M",
        pattern="^(1D|1W|1M|3M|6M|1Y)$",
        description="Time range for historical data",
    ),
) -> list[CryptoPriceHistory]:
    """Fetch historical price data for a cryptocurrency.

    Args:
        symbol: Crypto symbol
        request: FastAPI request object
        range: Time range (1D, 1W, 1M, 3M, 6M, 1Y)

    Returns:
        List of CryptoPriceHistory objects
    """
    service = get_crypto_service(request)

    try:
        return await service.get_history(symbol, range)
    finally:
        await service.close()


@router.get("/batch", response_model=list[CryptoQuote])
async def get_batch_quotes(
    request: Request,
    symbols: str = Query(
        description="Comma-separated list of symbols (e.g., BTC,ETH,SOL)"
    ),
) -> list[CryptoQuote]:
    """Fetch quotes for multiple cryptocurrencies.

    Args:
        request: FastAPI request object
        symbols: Comma-separated list of symbols

    Returns:
        List of CryptoQuote objects for valid symbols
    """
    service = get_crypto_service(request)
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    if not symbol_list:
        raise HTTPException(status_code=400, detail="No valid symbols provided")

    if len(symbol_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 symbols allowed")

    try:
        return await service.get_batch_quotes(symbol_list)
    finally:
        await service.close()
