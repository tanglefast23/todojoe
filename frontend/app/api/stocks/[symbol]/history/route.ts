import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// Map time ranges to Yahoo Finance parameters
function getRangeParams(range: string): { period1: Date; interval: "1d" | "1wk" | "1mo" | "1h" } {
  const now = new Date();

  switch (range) {
    case "1D": {
      const period1 = new Date(now);
      period1.setDate(period1.getDate() - 1);
      return { period1, interval: "1h" };
    }
    case "1W": {
      const period1 = new Date(now);
      period1.setDate(period1.getDate() - 7);
      return { period1, interval: "1h" };
    }
    case "1M": {
      const period1 = new Date(now);
      period1.setMonth(period1.getMonth() - 1);
      return { period1, interval: "1d" };
    }
    case "3M": {
      const period1 = new Date(now);
      period1.setMonth(period1.getMonth() - 3);
      return { period1, interval: "1d" };
    }
    case "6M": {
      const period1 = new Date(now);
      period1.setMonth(period1.getMonth() - 6);
      return { period1, interval: "1d" };
    }
    case "1Y": {
      const period1 = new Date(now);
      period1.setFullYear(period1.getFullYear() - 1);
      return { period1, interval: "1d" };
    }
    case "5Y": {
      const period1 = new Date(now);
      period1.setFullYear(period1.getFullYear() - 5);
      return { period1, interval: "1wk" };
    }
    default: {
      const period1 = new Date(now);
      period1.setMonth(period1.getMonth() - 1);
      return { period1, interval: "1d" };
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "1M";

    const upperSymbol = symbol.toUpperCase();
    const { period1, interval } = getRangeParams(range);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yahooFinance.chart(upperSymbol, {
      period1,
      interval,
    });

    if (!result || !result.quotes || result.quotes.length === 0) {
      return NextResponse.json(
        { error: "No history data found" },
        { status: 404 }
      );
    }

    // Transform Yahoo Finance format to our format
    // Yahoo returns: { quotes: [{ date, open, high, low, close, volume }, ...] }
    const history = result.quotes
      .filter((q: { close: number | null }) => q.close !== null)
      .map((q: { date: Date; open: number; high: number; low: number; close: number; volume: number }) => ({
        timestamp: q.date.toISOString(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
      }));

    return NextResponse.json(history);
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock history" },
      { status: 500 }
    );
  }
}
