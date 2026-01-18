"use client";

import { useMemo, memo } from "react";
import { useQuickOverviewGrid } from "@/hooks/useQuickOverviewGrid";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AllocationItem {
  symbol: string;
  percent: number;
}

export const AllocationBreakdownWidget = memo(function AllocationBreakdownWidget() {
  // Use memoized hook for grid data
  const { gridData } = useQuickOverviewGrid();
  const { symbols, symbolTypes, totals } = gridData;

  // Separate symbols into stocks and crypto using symbolTypes from grid data
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocks: string[] = [];
    const crypto: string[] = [];

    symbols.forEach((key) => {
      // Extract plain symbol from composite key (e.g., "BRK-B" from "BRK-B-stock")
      const lastDashIndex = key.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? key.substring(0, lastDashIndex) : key;
      const assetType = symbolTypes[key];

      if (assetType === "crypto") {
        crypto.push(plainSymbol);
      } else {
        stocks.push(plainSymbol);
      }
    });

    return { stockSymbols: stocks, cryptoSymbols: crypto };
  }, [symbols, symbolTypes]);

  const stocksQuery = useBatchStockQuotes(stockSymbols, stockSymbols.length > 0);
  const cryptoQuery = useBatchCryptoQuotes(cryptoSymbols, cryptoSymbols.length > 0);

  const isLoading = stocksQuery.isLoading || cryptoQuery.isLoading;

  // Build price map from API data
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};

    if (stocksQuery.data) {
      stocksQuery.data.forEach((quote) => {
        map[quote.symbol] = quote.price;
      });
    }

    if (cryptoQuery.data) {
      cryptoQuery.data.forEach((quote) => {
        map[quote.symbol] = quote.price;
      });
    }

    return map;
  }, [stocksQuery.data, cryptoQuery.data]);

  // Calculate allocations sorted by percentage (descending)
  const allocations = useMemo(() => {
    let total = 0;
    const items: { symbol: string; displaySymbol: string; value: number }[] = [];

    symbols.forEach((symbolKey) => {
      // Extract plain symbol from composite key for price lookup
      const lastDashIndex = symbolKey.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;

      const shares = totals[symbolKey] || 0;
      const price = priceMap[plainSymbol] || 0;
      const value = shares * price;
      total += value;
      items.push({ symbol: symbolKey, displaySymbol: plainSymbol, value });
    });

    // Calculate percentages and sort descending
    const allocs: AllocationItem[] = items
      .map((item) => ({
        symbol: item.displaySymbol, // Show plain symbol in UI
        percent: total > 0 ? (item.value / total) * 100 : 0,
      }))
      .filter((item) => item.percent > 0)
      .sort((a, b) => b.percent - a.percent);

    return allocs;
  }, [symbols, totals, priceMap]);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3 bg-muted/30">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-muted/30">
        <h3 className="text-sm font-semibold">Allocation Breakdown</h3>
      </div>

      {/* Allocation List */}
      <div className="p-4">
        {allocations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No holdings to display
          </p>
        ) : (
          <div className="space-y-1">
            {allocations.map((item, index) => (
              <div
                key={item.symbol}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 rounded text-sm",
                  index % 2 === 0 ? "bg-muted/30" : "bg-transparent"
                )}
              >
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                  {item.percent.toFixed(2)}%
                </span>
                <span className="font-medium">{item.symbol}</span>
              </div>
            ))}

            {/* Total Row */}
            <div className="flex items-center justify-between px-3 py-2 mt-2 border-t border-border/50 font-semibold">
              <span className="font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                100.00%
              </span>
              <span className="text-muted-foreground text-xs">TOTAL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
