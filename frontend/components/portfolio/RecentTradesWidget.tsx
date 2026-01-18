"use client";

import { useMemo, memo, useRef } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useShallow } from "zustand/react/shallow";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { usePrivacyBlur } from "@/hooks/usePrivacyMode";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isCryptoSymbol } from "@/lib/assetUtils";
import type { Transaction } from "@/types/portfolio";

const MAX_TRADES = 20;

interface TradeWithMetrics extends Transaction {
  daysSinceTrade: number;
  currentPrice: number;
  gainLossDollars: number;
  gainLossPercent: number;
}

// Cache for days since calculation to avoid recalculating for same dates
const daysSinceCache = new Map<string, { days: number; cachedAt: number }>();
const CACHE_DURATION = 60000; // 1 minute cache

function calculateDaysSince(dateString: string): number {
  const now = Date.now();
  const cached = daysSinceCache.get(dateString);

  // Return cached value if fresh
  if (cached && now - cached.cachedAt < CACHE_DURATION) {
    return cached.days;
  }

  const tradeDate = new Date(dateString);
  const diffTime = now - tradeDate.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  daysSinceCache.set(dateString, { days, cachedAt: now });
  return days;
}

export const RecentTradesWidget = memo(function RecentTradesWidget() {
  // Privacy mode blur
  const blurClass = usePrivacyBlur();

  // Combine store subscriptions into single selector to reduce re-renders
  const { activePortfolioId, transactions: _allTransactions, getActiveTransactions } = usePortfolioStore(
    useShallow((state) => ({
      activePortfolioId: state.activePortfolioId,
      transactions: state.transactions,
      getActiveTransactions: state.getActiveTransactions,
    }))
  );

  // Re-compute when activePortfolioId changes (dependency used for reactivity)
  const transactions = useMemo(
    () => getActiveTransactions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getActiveTransactions, activePortfolioId, _allTransactions]
  );

  // Get 20 most recent transactions, sorted by date descending
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_TRADES);
  }, [transactions]);

  // Get unique symbols from recent transactions
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const symbols = new Set(recentTransactions.map((t) => t.symbol));
    const stocks: string[] = [];
    const crypto: string[] = [];

    symbols.forEach((s) => {
      if (isCryptoSymbol(s)) {
        crypto.push(s);
      } else {
        stocks.push(s);
      }
    });

    return { stockSymbols: stocks, cryptoSymbols: crypto };
  }, [recentTransactions]);

  const stocksQuery = useBatchStockQuotes(stockSymbols, stockSymbols.length > 0);
  const cryptoQuery = useBatchCryptoQuotes(cryptoSymbols, cryptoSymbols.length > 0);

  const isLoading = stocksQuery.isLoading || cryptoQuery.isLoading;
  const hasError = stocksQuery.isError || cryptoQuery.isError;

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

  // Calculate metrics for each trade
  const tradesWithMetrics: TradeWithMetrics[] = useMemo(() => {
    return recentTransactions.map((tx) => {
      const currentPrice = priceMap[tx.symbol] || 0;
      const purchaseValue = tx.price * tx.quantity;
      const currentValue = currentPrice * tx.quantity;

      // For buy orders: gain = current - purchase
      // For sell orders: we show the gain/loss at time of sale (locked in)
      let gainLossDollars: number;
      let gainLossPercent: number;

      if (tx.type === "buy") {
        gainLossDollars = currentValue - purchaseValue;
        gainLossPercent = tx.price > 0 ? ((currentPrice - tx.price) / tx.price) * 100 : 0;
      } else {
        // For sells, the gain/loss is locked in at time of sale
        // We compare sale price to current price (what they would have now)
        gainLossDollars = purchaseValue - currentValue; // Positive if sold higher than current
        gainLossPercent = currentPrice > 0 ? ((tx.price - currentPrice) / currentPrice) * 100 : 0;
      }

      return {
        ...tx,
        daysSinceTrade: calculateDaysSince(tx.date),
        currentPrice,
        gainLossDollars,
        gainLossPercent,
      };
    });
  }, [recentTransactions, priceMap]);

  if (transactions.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="heading-display text-xl">Most Recent Trades</h2>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Show warning if prices couldn't be loaded
  const pricesLoaded = Object.keys(priceMap).length > 0;

  return (
    <section className="space-y-4">
      <h2 className="heading-display text-xl">Most Recent Trades</h2>
      {hasError && (
        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
          Unable to fetch current prices. Gain/loss calculations may be inaccurate.
        </div>
      )}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tablet-compact-table">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Symbol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Days
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Current
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Gain/Loss $
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Gain/Loss %
                </th>
              </tr>
            </thead>
            <tbody>
              {tradesWithMetrics.map((trade) => {
                const isPositive = trade.gainLossDollars >= 0;
                const isBuy = trade.type === "buy";

                return (
                  <tr
                    key={trade.id}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30 hover:shadow-sm transition-all duration-200 group"
                  >
                    <td className="px-4 py-3 font-medium">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          isBuy
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}
                      >
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", blurClass)}>
                      {trade.quantity.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", blurClass)}>
                      {formatCurrency(trade.price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {trade.daysSinceTrade}d
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", blurClass)}>
                      {trade.currentPrice > 0 ? formatCurrency(trade.currentPrice) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums font-medium transition-all duration-200",
                        trade.currentPrice === 0
                          ? "text-muted-foreground"
                          : isPositive
                            ? "text-gain glow-gain"
                            : "text-loss glow-loss",
                        blurClass
                      )}
                    >
                      {trade.currentPrice === 0 ? (
                        <span title="Price data unavailable">—</span>
                      ) : (
                        <>
                          {isPositive ? "+" : ""}
                          {formatCurrency(trade.gainLossDollars)}
                        </>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums font-medium transition-all duration-200",
                        trade.currentPrice === 0
                          ? "text-muted-foreground"
                          : isPositive
                            ? "text-gain glow-gain"
                            : "text-loss glow-loss",
                        blurClass
                      )}
                    >
                      {trade.currentPrice === 0 ? (
                        <span title="Price data unavailable">—</span>
                      ) : (
                        <>
                          {isPositive ? "+" : ""}
                          {trade.gainLossPercent.toFixed(2)}%
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
});
