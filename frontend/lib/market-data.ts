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
 * Batches symbols into chunks to reduce API calls
 */
const BATCH_SIZE = 10;

export async function fetchStockPrices(
  symbols: string[]
): Promise<StockPrice[]> {
  const results: StockPrice[] = [];

  // Process in batches to limit concurrent requests
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const quote = await yahooFinance.quote(symbol.toUpperCase());

          if (!quote) return null;

          return {
            symbol: String(quote.symbol ?? symbol),
            price: Number(quote.regularMarketPrice ?? 0),
            change: Number(quote.regularMarketChange ?? 0),
            changePercent: Number(quote.regularMarketChangePercent ?? 0),
          };
        } catch (error) {
          console.error(`[Market Data] Failed to fetch quote for ${symbol}:`, error);
          return null;
        }
      })
    );
    results.push(...batchResults.filter((q): q is StockPrice => q !== null));
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

// Re-export formatCryptoPrice from formatters to avoid duplication
export { formatCryptoPrice } from "@/lib/formatters";
