"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time, LineSeries } from "lightweight-charts";
import { useTheme } from "next-themes";
import { useStockHistory } from "@/hooks/useStockData";
import { useCryptoHistory } from "@/hooks/useCryptoData";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ErrorDisplay } from "@/components/ui/error-display";
import { isCryptoSymbol } from "@/lib/assetUtils";
import type { PriceHistory, CryptoPriceHistory } from "@/types/market";

interface ChartWidgetProps {
  symbol: string;
  assetType?: "stock" | "crypto";
  timeRange?: string;
}

const TIME_RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;

export function ChartWidget({
  symbol,
  assetType: initialAssetType,
  timeRange: initialTimeRange = "1M",
}: ChartWidgetProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const { resolvedTheme } = useTheme();
  const [selectedRange, setSelectedRange] = useState(initialTimeRange);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before creating chart (for SSR compatibility)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-detect asset type if not provided
  const assetType = initialAssetType || (isCryptoSymbol(symbol) ? "crypto" : "stock");

  const stockHistory = useStockHistory(symbol, selectedRange, assetType === "stock");
  const cryptoHistory = useCryptoHistory(symbol, selectedRange, assetType === "crypto");

  const historyQuery = assetType === "stock" ? stockHistory : cryptoHistory;
  const { data: history, isLoading, error } = historyQuery;

  // Calculate price change
  const priceChange = history && history.length >= 2
    ? (() => {
        const firstPrice = assetType === "stock"
          ? (history[0] as PriceHistory).close
          : (history[0] as CryptoPriceHistory).price;
        const lastPrice = assetType === "stock"
          ? (history[history.length - 1] as PriceHistory).close
          : (history[history.length - 1] as CryptoPriceHistory).price;
        const change = lastPrice - firstPrice;
        return {
          value: change,
          percent: (change / firstPrice) * 100,
        };
      })()
    : null;

  const isPositive = priceChange ? priceChange.value >= 0 : true;
  const lineColor = isPositive ? "#22c55e" : "#ef4444";

  // Create and update chart
  useEffect(() => {
    if (!mounted || !chartContainerRef.current) return;

    const isDark = resolvedTheme === "dark";

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
      },
      grid: {
        vertLines: { color: isDark ? "#27272a" : "#e4e4e7" },
        horzLines: { color: isDark ? "#27272a" : "#e4e4e7" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      crosshair: {
        vertLine: {
          labelVisible: false,
        },
      },
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    chartRef.current = chart;
    seriesRef.current = lineSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [mounted, resolvedTheme, lineColor]);

  // Update data when history changes
  useEffect(() => {
    if (!seriesRef.current || !history || history.length === 0) return;

    const chartData: LineData<Time>[] = history.map((item) => {
      const timestamp = new Date(item.timestamp).getTime() / 1000;
      const value = assetType === "stock"
        ? (item as PriceHistory).close
        : (item as CryptoPriceHistory).price;

      return {
        time: timestamp as Time,
        value,
      };
    });

    seriesRef.current.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [history, assetType]);

  // Update line color when price direction changes
  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.applyOptions({ color: lineColor });
    }
  }, [lineColor]);

  const currentPrice = history && history.length > 0
    ? assetType === "stock"
      ? (history[history.length - 1] as PriceHistory).close
      : (history[history.length - 1] as CryptoPriceHistory).price
    : null;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold">{symbol}</span>
          {currentPrice && (
            <span className="text-lg font-semibold">
              {formatCurrency(currentPrice)}
            </span>
          )}
          {priceChange && (
            <span
              className={cn(
                "text-sm font-medium",
                isPositive ? "text-green-500" : "text-red-500"
              )}
            >
              {isPositive ? "+" : ""}
              {formatPercent(priceChange.percent)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <Badge
              key={range}
              variant={selectedRange === range ? "default" : "outline"}
              className="cursor-pointer text-xs px-2 py-0.5"
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </Badge>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[200px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ErrorDisplay
              error={error}
              message={`Unable to load chart for ${symbol}`}
              onRetry={() => historyQuery.refetch()}
              compact
            />
          </div>
        )}
        <div ref={chartContainerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
