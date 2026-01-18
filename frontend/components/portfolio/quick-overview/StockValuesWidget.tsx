"use client";

import { useMemo, memo } from "react";
import { useQuickOverviewGrid } from "@/hooks/useQuickOverviewGrid";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { useFormatters } from "@/hooks/useFormatters";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StockValue {
  symbol: string;
  price: number;
  shares: number;
  value: number;
  percent: number;
}

export const StockValuesWidget = memo(function StockValuesWidget() {
  // Use memoized hook for grid data
  const { gridData } = useQuickOverviewGrid();
  const { symbols, symbolTypes, accounts, totals } = gridData;

  // Currency-aware formatters
  const { formatCurrency, currency } = useFormatters();

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

  // Calculate values and percentages
  const { stockValues, totalValue } = useMemo(() => {
    const values: StockValue[] = [];
    let total = 0;

    symbols.forEach((symbolKey) => {
      // Extract plain symbol from composite key for price lookup
      const lastDashIndex = symbolKey.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;

      const shares = totals[symbolKey] || 0;
      const price = priceMap[plainSymbol] || 0;
      const value = shares * price;
      total += value;

      values.push({
        symbol: symbolKey, // Keep composite key for display
        price,
        shares,
        value,
        percent: 0, // Calculate after total is known
      });
    });

    // Calculate percentages
    values.forEach((v) => {
      v.percent = total > 0 ? (v.value / total) * 100 : 0;
    });

    return { stockValues: values, totalValue: total };
  }, [symbols, totals, priceMap]);

  // Calculate per-account values for each symbol (only include accounts with holdings)
  const accountValues = useMemo(() => {
    return accounts
      .map((account) => {
        const values: Record<string, number> = {};
        let hasAnyHoldings = false;
        symbols.forEach((symbolKey) => {
          // Extract plain symbol from composite key for price lookup
          const lastDashIndex = symbolKey.lastIndexOf("-");
          const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;

          const quantity = account.holdings[symbolKey] || 0;
          const price = priceMap[plainSymbol] || 0;
          values[symbolKey] = quantity * price;
          if (quantity > 0) hasAnyHoldings = true;
        });
        return {
          id: account.id,
          name: account.name,
          values,
          hasAnyHoldings,
        };
      })
      .filter((account) => account.hasAnyHoldings);
  }, [accounts, symbols, priceMap]);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3 bg-muted/30">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3 bg-muted/30">
          <h3 className="text-sm font-semibold">Stock Values</h3>
        </div>
        <div className="p-8 text-center text-sm text-muted-foreground">
          No holdings to display. Add transactions in the Portfolio page.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-muted/30">
        <h3 className="text-sm font-semibold">Stock Values</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-xs bg-muted/50 w-[140px]"></th>
              {stockValues.map((sv) => {
                // Parse composite key to get display symbol and asset type
                const lastDashIndex = sv.symbol.lastIndexOf("-");
                const displaySymbol = lastDashIndex > 0 ? sv.symbol.substring(0, lastDashIndex) : sv.symbol;
                const assetType = symbolTypes[sv.symbol] || "stock";

                return (
                  <th
                    key={sv.symbol}
                    className="px-2 py-2 text-center font-semibold text-xs bg-emerald-600 dark:bg-emerald-700 text-white min-w-[90px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{displaySymbol}</span>
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[9px] font-medium",
                          assetType === "stock"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                        )}
                      >
                        {assetType === "stock" ? "S" : "C"}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Price Row */}
            <tr className="border-b border-border/50 bg-emerald-50 dark:bg-emerald-950/30">
              <td className="px-3 py-2 font-semibold text-xs text-emerald-700 dark:text-emerald-300 w-[140px]">
                PRICE
              </td>
              {stockValues.map((sv) => (
                <td
                  key={sv.symbol}
                  className="px-2 py-2 text-right text-xs tabular-nums border-l border-border/30"
                >
                  {sv.price > 0 ? formatCurrency(sv.price) : "—"}
                </td>
              ))}
            </tr>

            {/* Shares Row */}
            <tr className="border-b border-border/50">
              <td className="px-3 py-2 font-semibold text-xs bg-muted/50 w-[140px]">
                SHARES
              </td>
              {stockValues.map((sv) => (
                <td
                  key={sv.symbol}
                  className="px-2 py-2 text-right text-xs tabular-nums border-l border-border/30"
                >
                  {sv.shares > 0 ? sv.shares.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                </td>
              ))}
            </tr>

            {/* Per-Account Value Rows */}
            {accountValues.map((account) => (
              <tr key={account.id} className="border-b border-border/50">
                <td className="px-3 py-2 font-semibold text-xs bg-muted/50 w-[140px]">
                  {account.name.toUpperCase()} VALUE
                </td>
                {stockValues.map((sv) => {
                  const value = account.values[sv.symbol] || 0;
                  return (
                    <td
                      key={sv.symbol}
                      className="px-2 py-2 text-right text-xs tabular-nums border-l border-border/30"
                    >
                      {value > 0 ? formatCurrency(value) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Total Value Row */}
            <tr className="border-b border-border/50 bg-emerald-100/50 dark:bg-emerald-900/20">
              <td className="px-3 py-2 font-semibold text-xs text-emerald-700 dark:text-emerald-300 w-[140px]">
                TOTAL VALUE
              </td>
              {stockValues.map((sv) => (
                <td
                  key={sv.symbol}
                  className="px-2 py-2 text-right text-xs tabular-nums border-l border-border/30"
                >
                  {sv.value > 0 ? formatCurrency(sv.value) : "—"}
                </td>
              ))}
            </tr>

            {/* Percent Row */}
            <tr className="bg-emerald-50 dark:bg-emerald-950/30">
              <td className="px-3 py-2 font-semibold text-xs text-emerald-700 dark:text-emerald-300 w-[140px]">
                % OF PORTFOLIO
              </td>
              {stockValues.map((sv) => (
                <td
                  key={sv.symbol}
                  className="px-2 py-2 text-right text-xs tabular-nums border-l border-border/30"
                >
                  {sv.percent > 0 ? `${sv.percent.toFixed(2)}%` : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Total Value Footer */}
      <div className="border-t px-4 py-2 bg-muted/30 flex justify-between items-center">
        <span className="text-xs font-medium text-muted-foreground">
          Total Portfolio Value ({currency})
        </span>
        <span className="text-sm font-bold tabular-nums">
          {formatCurrency(totalValue)}
        </span>
      </div>
    </div>
  );
});
