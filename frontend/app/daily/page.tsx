"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sun,
  Cloud,
  CloudRain,
  Newspaper,
  Globe,
  Sparkles,
  Bitcoin,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface DailyData {
  crypto: CryptoItem[];
  stocks: {
    gainers: StockItem[];
    losers: StockItem[];
  };
  weather: {
    temp: string;
    condition: string;
    forecast: string;
  };
  news: {
    vietnam: string[];
    global: string[];
    popCulture: string[];
  };
  generatedAt: string;
}

export default function DailyPage() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/daily");
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to fetch daily summary");
      }

      setData(result);
      setLastUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const getWeatherIcon = (condition: string) => {
    const lower = condition.toLowerCase();
    if (lower.includes("rain") || lower.includes("storm")) {
      return <CloudRain className="h-8 w-8 text-blue-400" />;
    }
    if (lower.includes("cloud") || lower.includes("overcast")) {
      return <Cloud className="h-8 w-8 text-gray-400" />;
    }
    return <Sun className="h-8 w-8 text-yellow-400" />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-background/95">
      <Header />

      <main className="flex-1 p-4 pb-24">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Daily Briefing</h1>
              {lastUpdated && (
                <p className="text-sm text-muted-foreground">
                  Updated {lastUpdated}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchDaily}
              disabled={loading}
              className="rounded-full"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

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
              <Button onClick={fetchDaily} variant="outline">
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

              {/* Weather Section */}
              <section className="bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-border rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Ho Chi Minh City
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{data.weather.temp}</span>
                      <span className="text-lg text-muted-foreground">
                        {data.weather.condition}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data.weather.forecast}
                    </p>
                  </div>
                  {getWeatherIcon(data.weather.condition)}
                </div>
              </section>

              {/* Vietnam News */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-amber-500" />
                  <h2 className="font-semibold">Vietnam News</h2>
                </div>
                <div className="space-y-2">
                  {data.news.vietnam.map((headline, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed pl-3 border-l-2 border-amber-500/50"
                    >
                      {headline}
                    </p>
                  ))}
                </div>
              </section>

              {/* Global News */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h2 className="font-semibold">World News</h2>
                </div>
                <div className="space-y-2">
                  {data.news.global.map((headline, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed pl-3 border-l-2 border-blue-500/50"
                    >
                      {headline}
                    </p>
                  ))}
                </div>
              </section>

              {/* Pop Culture */}
              <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-pink-500" />
                  <h2 className="font-semibold">Pop Culture</h2>
                </div>
                <div className="space-y-2">
                  {data.news.popCulture.map((headline, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed pl-3 border-l-2 border-pink-500/50"
                    >
                      {headline}
                    </p>
                  ))}
                </div>
              </section>

              {/* Disclaimer */}
              <p className="text-xs text-center text-muted-foreground pt-2">
                Data generated by AI and may not reflect real-time prices
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
