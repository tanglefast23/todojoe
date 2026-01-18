/**
 * API client for backend communication
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";
import type { StockQuote, CryptoQuote, PriceHistory, CryptoPriceHistory } from "@/types/market";

// Use local API routes (Vercel serverless functions)
const API_BASE_URL = "/api";

/**
 * Custom API error with user-friendly message
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Convert Axios error to user-friendly ApiError
 */
function createApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const serverMessage = (error.response?.data as { detail?: string })?.detail;

  // Network errors
  if (error.code === "ECONNABORTED") {
    return new ApiError("Request timed out. Please try again.", 0, "timeout");
  }
  if (error.code === "ERR_NETWORK" || !error.response) {
    return new ApiError(
      "Unable to connect to server. Please check if the backend is running.",
      0,
      "network"
    );
  }

  // HTTP status-based errors
  switch (status) {
    case 404:
      return new ApiError(
        serverMessage || "Symbol not found. Please check the ticker symbol.",
        404,
        "not_found"
      );
    case 429:
      return new ApiError(
        "Rate limit exceeded. Please wait a moment before trying again.",
        429,
        "rate_limit"
      );
    case 500:
    case 502:
    case 503:
      return new ApiError(
        "Server error. Our data providers may be temporarily unavailable.",
        status,
        "server"
      );
    default:
      return new ApiError(
        serverMessage || `Request failed (${status})`,
        status,
        "unknown"
      );
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError = createApiError(error);
        // Don't log expected errors (history endpoints, rate limits, etc.)
        // The UI handles these gracefully
        return Promise.reject(apiError);
      }
    );
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    redis: string;
    timestamp: string;
  }> {
    const response = await this.client.get("/health");
    return response.data;
  }

  // Stock endpoints
  async getStockQuote(symbol: string): Promise<StockQuote> {
    const response = await this.client.get(`/stocks/${symbol}/quote`);
    return this.transformStockQuote(response.data);
  }

  async getStockHistory(symbol: string, range: string = "1M"): Promise<PriceHistory[]> {
    try {
      const response = await this.client.get(`/stocks/${symbol}/history`, {
        params: { range },
      });
      return response.data;
    } catch {
      // Silently return empty array for history endpoints - data may be temporarily unavailable
      return [];
    }
  }

  async getBatchStockQuotes(symbols: string[]): Promise<StockQuote[]> {
    const response = await this.client.get("/stocks/batch", {
      params: { symbols: symbols.join(",") },
    });
    return response.data.map(this.transformStockQuote);
  }

  // Crypto endpoints
  async getCryptoQuote(symbol: string): Promise<CryptoQuote> {
    const response = await this.client.get(`/crypto/${symbol}/quote`);
    return this.transformCryptoQuote(response.data);
  }

  async getCryptoHistory(symbol: string, range: string = "1M"): Promise<CryptoPriceHistory[]> {
    try {
      const response = await this.client.get(`/crypto/${symbol}/history`, {
        params: { range },
      });
      return response.data;
    } catch {
      // Silently return empty array for history endpoints - not all cryptos have history
      return [];
    }
  }

  async getBatchCryptoQuotes(symbols: string[]): Promise<CryptoQuote[]> {
    const response = await this.client.get("/crypto/batch", {
      params: { symbols: symbols.join(",") },
    });
    return response.data.map(this.transformCryptoQuote);
  }

  // Transform snake_case to camelCase for stock quotes
  private transformStockQuote(data: Record<string, unknown>): StockQuote {
    return {
      symbol: data.symbol as string,
      name: data.name as string | null,
      logoUrl: data.logo_url as string | null,
      price: data.price as number,
      change: data.change as number,
      changePercent: data.change_percent as number,
      volume: data.volume as number,
      marketCap: data.market_cap as number | null,
      high52w: data.high_52w as number | null,
      low52w: data.low_52w as number | null,
      changePercentWeek: data.change_percent_week as number | null,
      changePercentMonth: data.change_percent_month as number | null,
      changePercentYear: data.change_percent_year as number | null,
      preMarketPrice: data.pre_market_price as number | null,
      preMarketChange: data.pre_market_change as number | null,
      preMarketChangePercent: data.pre_market_change_percent as number | null,
      postMarketPrice: data.post_market_price as number | null,
      postMarketChange: data.post_market_change as number | null,
      postMarketChangePercent: data.post_market_change_percent as number | null,
      marketState: data.market_state as string | null,
      futuresSymbol: data.futures_symbol as string | null,
      earningsDate: data.earnings_date as string | null,
      source: data.source as string,
      updatedAt: data.updated_at as string,
    };
  }

  // Transform snake_case to camelCase for crypto quotes
  private transformCryptoQuote(data: Record<string, unknown>): CryptoQuote {
    return {
      symbol: data.symbol as string,
      name: data.name as string,
      logoUrl: data.logo_url as string | null,
      price: data.price as number,
      change24h: data.change_24h as number,
      changePercent1h: data.change_percent_1h as number | null,
      changePercent24h: data.change_percent_24h as number,
      volume24h: data.volume_24h as number,
      marketCap: data.market_cap as number,
      rank: data.rank as number | null,
      changePercent7d: data.change_percent_7d as number | null,
      changePercent30d: data.change_percent_30d as number | null,
      changePercent1y: data.change_percent_1y as number | null,
      ath: data.ath as number | null,
      athChangePercent: data.ath_change_percent as number | null,
      source: data.source as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export const api = new ApiClient();
