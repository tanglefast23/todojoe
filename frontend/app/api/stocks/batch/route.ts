import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * Calculate percentage change between two prices
 */
function calcPercentChange(currentPrice: number, historicalPrice: number | null): number | null {
  if (!historicalPrice || historicalPrice === 0) return null;
  return ((currentPrice - historicalPrice) / historicalPrice) * 100;
}

/**
 * Get historical close price from chart data for a target date
 * Finds the closest trading day on or before the target date
 */
function getHistoricalPrice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotes: any[],
  targetDate: Date
): number | null {
  if (!quotes || quotes.length === 0) return null;

  const targetTime = targetDate.getTime();

  // Find the quote closest to (but not after) the target date
  for (let i = quotes.length - 1; i >= 0; i--) {
    const quoteDate = new Date(quotes[i].date).getTime();
    if (quoteDate <= targetTime) {
      return quotes[i].close;
    }
  }

  // If all quotes are after target, return the oldest one
  return quotes[0]?.close || null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbolsParam = searchParams.get("symbols");

    if (!symbolsParam) {
      return NextResponse.json(
        { error: "symbols parameter is required" },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());

    // Calculate target dates for week and month ago
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    // Fetch all quotes in parallel - both quote and chart data
    const quotes = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Fetch quote and chart data in parallel for efficiency
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [quote, chartData]: [any, any] = await Promise.all([
            yahooFinance.quote(symbol),
            yahooFinance.chart(symbol, {
              period1: monthAgo,
              period2: now,
              interval: "1d",
            }).catch(() => null), // Don't fail if chart data unavailable
          ]);

          if (!quote) return null;

          const currentPrice = quote.regularMarketPrice || 0;

          // Calculate week and month changes from historical data
          let changePercentWeek: number | null = null;
          let changePercentMonth: number | null = null;

          if (chartData?.quotes && chartData.quotes.length > 0) {
            const weekAgoPrice = getHistoricalPrice(chartData.quotes, weekAgo);
            const monthAgoPrice = getHistoricalPrice(chartData.quotes, monthAgo);

            changePercentWeek = calcPercentChange(currentPrice, weekAgoPrice);
            changePercentMonth = calcPercentChange(currentPrice, monthAgoPrice);
          }

          return {
            symbol: quote.symbol as string,
            name: quote.shortName || quote.longName || null,
            logo_url: null,
            price: currentPrice,
            change: quote.regularMarketChange || 0,
            change_percent: quote.regularMarketChangePercent || 0,
            volume: quote.regularMarketVolume || 0,
            market_cap: quote.marketCap || null,
            high_52w: quote.fiftyTwoWeekHigh || null,
            low_52w: quote.fiftyTwoWeekLow || null,
            change_percent_week: changePercentWeek,
            change_percent_month: changePercentMonth,
            change_percent_year: quote.fiftyTwoWeekChangePercent ?? null,
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
        } catch {
          console.error(`Failed to fetch quote for ${symbol}`);
          return null;
        }
      })
    );

    // Filter out failed quotes
    const validQuotes = quotes.filter((q) => q !== null);

    return NextResponse.json(validQuotes);
  } catch (error) {
    console.error("Batch stock quotes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock quotes" },
      { status: 500 }
    );
  }
}
