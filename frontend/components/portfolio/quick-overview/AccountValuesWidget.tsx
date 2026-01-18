"use client";

import { useMemo, memo } from "react";
import { useQuickOverviewGrid } from "@/hooks/useQuickOverviewGrid";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { useFormatters } from "@/hooks/useFormatters";

export const AccountValuesWidget = memo(function AccountValuesWidget() {
  // Use memoized hook for grid data
  const { gridData } = useQuickOverviewGrid();
  const { symbols, symbolTypes, accounts } = gridData;

  // Currency-aware formatters
  const { formatCurrency, currency } = useFormatters();

  // Separate stocks and crypto for price fetching using symbolTypes
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

  // Build price map
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

  // Calculate account totals and portfolio total
  const { accountTotals, portfolioTotal } = useMemo(() => {
    const totals: { id: string; name: string; value: number }[] = [];
    let total = 0;

    accounts.forEach((account) => {
      let accountValue = 0;
      symbols.forEach((symbolKey) => {
        // Extract plain symbol from composite key for price lookup
        const lastDashIndex = symbolKey.lastIndexOf("-");
        const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;

        const quantity = account.holdings[symbolKey] || 0;
        const price = priceMap[plainSymbol] || 0;
        accountValue += quantity * price;
      });

      if (accountValue > 0) {
        totals.push({
          id: account.id,
          name: account.name,
          value: accountValue,
        });
        total += accountValue;
      }
    });

    // Sort by value descending
    totals.sort((a, b) => b.value - a.value);

    return { accountTotals: totals, portfolioTotal: total };
  }, [accounts, symbols, priceMap]);

  if (symbols.length === 0 || accountTotals.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-muted/30">
        <h3 className="text-sm font-semibold">Accounts Summary ({currency})</h3>
      </div>

      {/* Account List */}
      <div className="p-4">
        <div className="flex flex-col gap-1">
          {accountTotals.map(({ id, name, value }) => (
            <div key={id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{name}</span>
              <span className="text-emerald-500 tabular-nums">{formatCurrency(value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm pt-2 mt-1 border-t border-border/50">
            <span className="font-semibold">Total</span>
            <span className="font-semibold text-emerald-500 tabular-nums">{formatCurrency(portfolioTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
