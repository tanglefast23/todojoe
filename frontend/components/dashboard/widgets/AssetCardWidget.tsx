"use client";

import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown, GripVertical, X } from "lucide-react";
import { useStockQuote, useStockHistory } from "@/hooks/useStockData";
import { useCryptoQuote, useCryptoHistory } from "@/hooks/useCryptoData";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Sparkline } from "@/components/charts/Sparkline";
import { Button } from "@/components/ui/button";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle

interface AssetCardWidgetProps {
  symbol: string;
  assetType?: "stock" | "crypto";
  onRemove?: () => void;
  showHeader?: boolean;
}

/** Memoized asset card - only re-renders when props change */
export const AssetCardWidget = memo(function AssetCardWidget({
  symbol,
  assetType = "stock",
  onRemove,
  showHeader = false,
}: AssetCardWidgetProps) {
  const stockQuery = useStockQuote(symbol, assetType === "stock");
  const cryptoQuery = useCryptoQuote(symbol, assetType === "crypto");
  const stockHistoryQuery = useStockHistory(symbol, "1W", assetType === "stock");
  const cryptoHistoryQuery = useCryptoHistory(symbol, "1W", assetType === "crypto");

  const query = assetType === "stock" ? stockQuery : cryptoQuery;
  const historyQuery = assetType === "stock" ? stockHistoryQuery : cryptoHistoryQuery;
  const { data, isLoading, error } = query;

  // Memoize sparkline data extraction to prevent unnecessary recalculations
  const sparklineData = useMemo(() =>
    historyQuery.data?.map((d) => "close" in d ? d.close : d.price) ?? [],
    [historyQuery.data]
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorDisplay
        error={error}
        message={`Unable to load ${symbol}`}
        onRetry={() => query.refetch()}
        className="h-full"
        compact
      />
    );
  }

  // Handle different property names for stock vs crypto
  const changePercent = assetType === "stock"
    ? (data as { changePercent: number }).changePercent
    : (data as { changePercent24h: number }).changePercent24h;
  const isPositive = changePercent >= 0;

  const content = (
    <>
      {/* Price, Sparkline, and Change */}
      <div className="flex-1 flex flex-col justify-end space-y-2">
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-bold tabular-nums transition-all duration-300">{formatCurrency(data.price)}</p>
          {sparklineData.length > 1 && (
            <Sparkline
              data={sparklineData}
              width={64}
              height={28}
              strokeWidth={1.5}
              positive={isPositive}
              className="opacity-80 transition-opacity duration-200 hover:opacity-100"
            />
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium transition-all duration-200",
            isPositive
              ? "text-gain glow-gain-lg"
              : "text-loss glow-loss-lg"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4 animate-pulse" style={{ animationDuration: '3s' }} />
          ) : (
            <TrendingDown className="h-4 w-4 animate-pulse" style={{ animationDuration: '3s' }} />
          )}
          <span>{formatPercent(changePercent)}</span>
        </div>
      </div>
    </>
  );

  // If showHeader is true, render complete card with header
  if (showHeader && onRemove) {
    return (
      <div className="flex h-full flex-col rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          {/* Header with symbol, company name, badge, and close */}
          <div className="widget-handle flex cursor-move items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium">{symbol}</span>
              <span className="text-sm text-muted-foreground truncate">{data.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  assetType === "stock"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                )}
              >
                {assetType === "stock" ? "Stock" : "Crypto"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="widget-close-btn h-8 w-8 touch-target text-muted-foreground hover:text-destructive focus-ring"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Remove ${symbol} widget`}
              title="Remove widget"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            {content}
          </div>
        </div>
    );
  }

  // Default: just render content (for use inside WidgetWrapper)
  return <div className="flex h-full flex-col">{content}</div>;
});
