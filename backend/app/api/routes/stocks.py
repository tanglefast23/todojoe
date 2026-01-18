"""Stock API routes."""

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.stock import PriceHistory, StockQuote
from app.services.stock_service import (
    StockService,
    StockServiceError,
    SymbolNotFoundError,
)

router = APIRouter(prefix="/stocks")


def get_stock_service(request: Request) -> StockService:
    """Get stock service instance with Redis client.

    Args:
        request: FastAPI request object

    Returns:
        StockService instance
    """
    return StockService(request.app.state.redis)


@router.get("/{symbol}/quote", response_model=StockQuote)
async def get_stock_quote(symbol: str, request: Request) -> StockQuote:
    """Fetch current quote for a stock symbol.

    Args:
        symbol: Stock ticker symbol (e.g., AAPL, GOOGL)
        request: FastAPI request object

    Returns:
        StockQuote with current price data

    Raises:
        HTTPException: 404 if symbol not found, 503 if service unavailable
    """
    service = get_stock_service(request)

    try:
        return await service.get_quote(symbol)
    except SymbolNotFoundError:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    except StockServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    finally:
        await service.close()


@router.get("/{symbol}/history", response_model=list[PriceHistory])
async def get_stock_history(
    symbol: str,
    request: Request,
    range: str = Query(
        default="1M",
        pattern="^(1D|1W|1M|3M|6M|1Y|5Y)$",
        description="Time range for historical data",
    ),
) -> list[PriceHistory]:
    """Fetch historical price data for a stock symbol.

    Args:
        symbol: Stock ticker symbol
        request: FastAPI request object
        range: Time range (1D, 1W, 1M, 3M, 6M, 1Y, 5Y)

    Returns:
        List of PriceHistory objects
    """
    service = get_stock_service(request)

    try:
        return await service.get_history(symbol, range)
    finally:
        await service.close()


@router.get("/batch", response_model=list[StockQuote])
async def get_batch_quotes(
    request: Request,
    symbols: str = Query(
        description="Comma-separated list of symbols (e.g., AAPL,GOOGL,MSFT)"
    ),
) -> list[StockQuote]:
    """Fetch quotes for multiple stock symbols.

    Args:
        request: FastAPI request object
        symbols: Comma-separated list of symbols

    Returns:
        List of StockQuote objects for valid symbols
    """
    service = get_stock_service(request)
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    if not symbol_list:
        raise HTTPException(status_code=400, detail="No valid symbols provided")

    if len(symbol_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 symbols allowed")

    try:
        return await service.get_batch_quotes(symbol_list)
    finally:
        await service.close()
