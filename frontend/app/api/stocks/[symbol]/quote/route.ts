import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote: any = await yahooFinance.quote(upperSymbol);

    if (!quote) {
      return NextResponse.json(
        { error: "Symbol not found" },
        { status: 404 }
      );
    }

    const response = {
      symbol: quote.symbol as string,
      name: quote.shortName || quote.longName || null,
      logo_url: null,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      change_percent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      market_cap: quote.marketCap || null,
      high_52w: quote.fiftyTwoWeekHigh || null,
      low_52w: quote.fiftyTwoWeekLow || null,
      change_percent_week: null,
      change_percent_month: null,
      change_percent_year: null,
      pre_market_price: quote.preMarketPrice || null,
      pre_market_change: quote.preMarketChange || null,
      pre_market_change_percent: quote.preMarketChangePercent || null,
      post_market_price: quote.postMarketPrice || null,
      post_market_change: quote.postMarketChange || null,
      post_market_change_percent: quote.postMarketChangePercent || null,
      market_state: quote.marketState || null,
      futures_symbol: null,
      earnings_date: quote.earningsTimestamp
        ? new Date(quote.earningsTimestamp * 1000).toISOString()
        : quote.earningsTimestampStart
          ? new Date(quote.earningsTimestampStart * 1000).toISOString()
          : null,
      source: "yahoo-finance",
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Stock quote error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock quote" },
      { status: 500 }
    );
  }
}
