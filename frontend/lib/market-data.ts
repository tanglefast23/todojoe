/**
 * Market Data Service
 *
 * Fetches real-time market data from:
 * - CoinGecko API (crypto prices)
 * - Yahoo Finance API (stock prices)
 */

import YahooFinance from "yahoo-finance2";

// Initialize Yahoo Finance client (required in v3)
const yahooFinance = new YahooFinance();

// Crypto symbol to CoinGecko ID mapping
const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  HYPE: "hyperliquid",
  ZEC: "zcash",
};

export interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface TopMovers {
  gainers: { symbol: string; change: string }[];
  losers: { symbol: string; change: string }[];
}

/**
 * Fetch crypto prices from CoinGecko API (free, no API key required)
 */
export async function fetchCryptoPrices(
  symbols: string[]
): Promise<CryptoPrice[]> {
  const ids = symbols
    .map((s) => CRYPTO_IDS[s])
    .filter(Boolean)
    .join(",");

  if (!ids) {
    console.warn("[Market Data] No valid crypto symbols provided");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // Map response back to symbols
    return symbols
      .map((symbol) => {
        const id = CRYPTO_IDS[symbol];
        const coinData = data[id];

        if (!coinData) return null;

        // Get full name from ID
        const nameMap: Record<string, string> = {
          bitcoin: "Bitcoin",
          ethereum: "Ethereum",
          hyperliquid: "Hyperliquid",
          zcash: "Zcash",
        };

        return {
          symbol,
          name: nameMap[id] || symbol,
          price: coinData.usd,
          change24h: coinData.usd * (coinData.usd_24h_change / 100),
          changePercent24h: coinData.usd_24h_change,
        };
      })
      .filter((item): item is CryptoPrice => item !== null);
  } catch (error) {
    console.error("[Market Data] CoinGecko fetch error:", error);
    throw error;
  }
}

/**
 * Fetch stock prices from Yahoo Finance
 */
export async function fetchStockPrices(
  symbols: string[]
): Promise<StockPrice[]> {
  const results: StockPrice[] = [];

  // Fetch quotes in parallel (Yahoo Finance handles batching internally)
  try {
    const quotes = await yahooFinance.quote(symbols);

    // Handle both single quote and array of quotes
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    for (const quote of quotesArray) {
      // Type guard to check if quote has the properties we need
      if (
        quote &&
        typeof quote === "object" &&
        "regularMarketPrice" in quote &&
        "symbol" in quote
      ) {
        const q = quote as {
          symbol: string;
          regularMarketPrice?: number;
          regularMarketChange?: number;
          regularMarketChangePercent?: number;
        };

        if (q.regularMarketPrice !== undefined) {
          results.push({
            symbol: q.symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
          });
        }
      }
    }
  } catch (error) {
    console.error("[Market Data] Yahoo Finance fetch error:", error);
    throw error;
  }

  return results;
}

/**
 * Calculate top 3 gainers and losers from stock data
 */
export function getTopMovers(stocks: StockPrice[]): TopMovers {
  // Sort by change percent
  const sorted = [...stocks].sort(
    (a, b) => b.changePercent - a.changePercent
  );

  // Top 3 gainers (highest positive change)
  const gainers = sorted
    .filter((s) => s.changePercent > 0)
    .slice(0, 3)
    .map((s) => ({
      symbol: s.symbol,
      change: `+${s.changePercent.toFixed(2)}%`,
    }));

  // Top 3 losers (most negative change)
  const losers = sorted
    .filter((s) => s.changePercent < 0)
    .slice(-3)
    .reverse()
    .map((s) => ({
      symbol: s.symbol,
      change: `${s.changePercent.toFixed(2)}%`,
    }));

  return { gainers, losers };
}

/**
 * Format crypto price for display
 */
export function formatCryptoPrice(price: number): string {
  if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  }
  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${price.toFixed(2)}`;
}
