/**
 * Market data TypeScript types
 */

export interface StockQuote {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;

  // Multi-period changes
  changePercentWeek: number | null;
  changePercentMonth: number | null;
  changePercentYear: number | null;

  // Pre-market data
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;

  // Post-market (after-hours) data
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;

  // Market state
  marketState: string | null;

  // Futures correlation
  futuresSymbol: string | null;

  // Earnings data
  earningsDate: string | null;

  source: string;
  updatedAt: string;
}

export interface CryptoQuote {
  symbol: string;
  name: string;
  logoUrl: string | null;
  price: number;
  change24h: number;
  changePercent1h: number | null;  // 1-hour change (crypto only)
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  rank: number | null;

  // Multi-period changes
  changePercent7d: number | null;
  changePercent30d: number | null;
  changePercent1y: number | null;

  // All-time high
  ath: number | null;
  athChangePercent: number | null;

  source: string;
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

export interface CryptoPriceHistory {
  timestamp: string;
  price: number;
}

export type Quote = StockQuote | CryptoQuote;

export function isStockQuote(quote: Quote): quote is StockQuote {
  return "volume" in quote && !("volume24h" in quote);
}

export function isCryptoQuote(quote: Quote): quote is CryptoQuote {
  return "volume24h" in quote;
}
