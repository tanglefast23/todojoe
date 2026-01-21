"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Newspaper,
  Globe,
  Sparkles,
  Bitcoin,
  Loader2,
  AlertCircle,
  ExternalLink,
  Gem,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CACHE_KEY = "daily-briefing-cache";
const REFRESH_HOUR = 8; // 8 AM local time

interface CryptoItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

interface StockItem {
  symbol: string;
  change: string;
}

interface NewsItem {
  headline: string;
  url: string;
  source?: string;
}

interface CommodityItem {
  symbol: string;
  name: string;
  change: string;
  isPositive: boolean;
}

interface DailyData {
  crypto: CryptoItem[];
  stocks: {
    gainers: StockItem[];
    losers: StockItem[];
  };
  commodities: CommodityItem[];
  news: {
    vietnam: NewsItem[];
    global: NewsItem[];
    popCulture: NewsItem[];
  };
  generatedAt: string;
}

interface CachedData {
  data: DailyData;
  cachedAt: string;
}

/**
 * Check if we should fetch fresh data
 * Returns true if:
 * - No cache exists
 * - Cache is from before today's refresh hour (e.g., 8 AM)
 */
function shouldRefreshData(cached: CachedData | null): boolean {
  if (!cached) return true;

  const now = new Date();
  const cachedTime = new Date(cached.cachedAt);

  // Get today's refresh time (8 AM)
  const todayRefreshTime = new Date(now);
  todayRefreshTime.setHours(REFRESH_HOUR, 0, 0, 0);

  // If it's before today's refresh time, use yesterday's refresh time as cutoff
  const cutoffTime = now < todayRefreshTime
    ? new Date(todayRefreshTime.getTime() - 24 * 60 * 60 * 1000)
    : todayRefreshTime;

  // Refresh if cache is older than the cutoff
  return cachedTime < cutoffTime;
}

function getCache(): CachedData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCache(data: DailyData): void {
  if (typeof window === "undefined") return;
  try {
    const cacheData: CachedData = {
      data,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Normalize news data to handle both old string format and new NewsItem format
 */
function normalizeNewsItems(items: (string | NewsItem)[]): NewsItem[] {
  return items.map((item) => {
    if (typeof item === "string") {
      return { headline: item, url: "" };
    }
    return item;
  });
}

export default function DailyPage() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchDaily = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCache();
      if (cached && !shouldRefreshData(cached)) {
        setData(cached.data);
        setLastUpdated(
          new Date(cached.cachedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        );
        setFromCache(true);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const res = await fetch("/api/daily");
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to fetch daily summary");
      }

      setData(result);
      setCache(result);
      setLastUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    } catch (err) {
      // If fetch fails but we have cache, use it
      const cached = getCache();
      if (cached) {
        setData(cached.data);
        setLastUpdated(
          new Date(cached.cachedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        );
        setFromCache(true);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const handleNewsClick = (url: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const renderNewsSection = (
    items: (string | NewsItem)[],
    borderColor: string
  ) => {
    const normalizedItems = normalizeNewsItems(items);
    return (
      <div className="space-y-3">
        {normalizedItems.map((item, i) => (
          <button
            key={i}
            onClick={() => handleNewsClick(item.url)}
            disabled={!item.url}
            className={cn(
              "w-full text-left transition-colors",
              item.url && "hover:bg-muted/50 cursor-pointer active:bg-muted",
              !item.url && "cursor-default"
            )}
          >
            <div className={cn("pl-3 border-l-2", borderColor)}>
              <p className="text-sm leading-relaxed">{item.headline}</p>
              {item.source && item.url && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {item.source}
                  <ExternalLink className="h-3 w-3" />
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-background/95">
      <Header />

      <main className="flex-1 p-4 pb-24">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Loading State */}
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-muted-foreground">Fetching your daily briefing...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-red-400 text-center">{error}</p>
              <Button onClick={() => fetchDaily()} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {/* Data Display */}
          {data && (
            <div className="space-y-4">
              {/* Crypto Section */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-5 w-5 text-orange-500" />
                  <h2 className="font-semibold">Crypto</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {data.crypto.map((coin) => (
                    <div
                      key={coin.symbol}
                      className="bg-muted/50 rounded-xl p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{coin.symbol}</span>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            coin.isPositive
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          )}
                        >
                          {coin.change}
                        </span>
                      </div>
                      <p className="text-lg font-bold">{coin.price}</p>
                      <p className="text-xs text-muted-foreground">{coin.name}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Stocks Section */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  <h2 className="font-semibold">Stock Movers</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Gainers */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-green-400 uppercase tracking-wider">
                      Top Gainers
                    </p>
                    {data.stocks.gainers.map((stock, i) => (
                      <div
                        key={stock.symbol}
                        className="flex items-center justify-between bg-green-500/10 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="font-medium text-sm">
                            {stock.symbol}
                          </span>
                        </div>
                        <span className="text-green-400 font-semibold text-sm">
                          {stock.change}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Losers */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-red-400 uppercase tracking-wider">
                      Top Losers
                    </p>
                    {data.stocks.losers.map((stock, i) => (
                      <div
                        key={stock.symbol}
                        className="flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="font-medium text-sm">
                            {stock.symbol}
                          </span>
                        </div>
                        <span className="text-red-400 font-semibold text-sm">
                          {stock.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Commodities Section */}
              {data.commodities && data.commodities.length > 0 && (
                <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Gem className="h-5 w-5 text-cyan-500" />
                    <h2 className="font-semibold">Commodities</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {data.commodities.map((item) => (
                      <div
                        key={item.symbol}
                        className="bg-muted/50 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-sm">{item.symbol}</span>
                          <p className="text-xs text-muted-foreground">{item.name}</p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            item.isPositive ? "text-green-400" : "text-red-400"
                          )}
                        >
                          {item.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Vietnam News */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-amber-500" />
                  <h2 className="font-semibold">Vietnam News</h2>
                </div>
                {renderNewsSection(data.news.vietnam, "border-amber-500/50")}
              </section>

              {/* Global News */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h2 className="font-semibold">World News</h2>
                </div>
                {renderNewsSection(data.news.global, "border-blue-500/50")}
              </section>

              {/* Pop Culture */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-pink-500" />
                  <h2 className="font-semibold">Pop Culture</h2>
                </div>
                {renderNewsSection(data.news.popCulture, "border-pink-500/50")}
              </section>

              {/* Disclaimer */}
              <p className="text-xs text-center text-muted-foreground pt-2">
                Market data from CoinGecko & Yahoo Finance • News via Gemini Search • Refreshes daily at 8 AM
                {lastUpdated && (
                  <span> • {fromCache ? "Cached from" : "Updated"} {lastUpdated}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
