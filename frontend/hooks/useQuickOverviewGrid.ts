/**
 * Hook for memoized Quick Overview grid data
 * Prevents recalculation on every render by caching results
 */

import { useMemo } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import type { QuickOverviewData } from "@/types/portfolio";
import { calculateHoldings } from "@/lib/portfolioUtils";

interface UseQuickOverviewGridResult {
  gridData: QuickOverviewData;
  activePortfolioId: string;
}

/**
 * Returns memoized Quick Overview grid data for the active portfolio.
 * Only recomputes when relevant data actually changes.
 */
export function useQuickOverviewGrid(): UseQuickOverviewGridResult {
  // Subscribe to raw state - filtering done in useMemo
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const transactions = usePortfolioStore((state) => state.transactions);
  const trackedSymbolsMap = usePortfolioStore((state) => state.trackedSymbols);

  // Memoize derived data
  const portfolio = useMemo(
    () => portfolios.find((p) => p.id === activePortfolioId),
    [portfolios, activePortfolioId]
  );

  const portfolioTransactions = useMemo(
    () => transactions.filter((t) => t.portfolioId === activePortfolioId),
    [transactions, activePortfolioId]
  );

  const trackedSymbols = useMemo(
    () => trackedSymbolsMap[activePortfolioId] || [],
    [trackedSymbolsMap, activePortfolioId]
  );

  // Memoize the grid calculation
  const gridData = useMemo((): QuickOverviewData => {
    if (!portfolio) {
      return { symbols: [], symbolTypes: {}, accounts: [], totals: {} };
    }

    // Build unique symbol-assetType combinations from transactions
    const symbolKeysFromTransactions = new Set<string>();
    portfolioTransactions.forEach((t) => {
      const key = `${t.symbol.toUpperCase()}-${t.assetType}`;
      symbolKeysFromTransactions.add(key);
    });

    // Also include tracked symbols
    trackedSymbols.forEach((trackedKey) => {
      if (trackedKey.includes("-")) {
        // New format: "BTC-crypto"
        const lastDashIndex = trackedKey.lastIndexOf("-");
        const symbol = trackedKey.substring(0, lastDashIndex).toUpperCase();
        const assetType = trackedKey.substring(lastDashIndex + 1).toLowerCase();
        symbolKeysFromTransactions.add(`${symbol}-${assetType}`);
      } else {
        // Old format: just "BTC" - default to stock if not already present
        const sym = trackedKey.toUpperCase();
        const hasStock = symbolKeysFromTransactions.has(`${sym}-stock`);
        const hasCrypto = symbolKeysFromTransactions.has(`${sym}-crypto`);
        if (!hasStock && !hasCrypto) {
          symbolKeysFromTransactions.add(`${sym}-stock`);
        }
      }
    });

    const symbolKeys = Array.from(symbolKeysFromTransactions);

    // Build display symbols and types map
    const symbols: string[] = [];
    const symbolTypes: Record<string, "stock" | "crypto" | "both"> = {};

    for (const key of symbolKeys) {
      const lastDashIndex = key.lastIndexOf("-");
      const assetType = key.substring(lastDashIndex + 1) as "stock" | "crypto";
      symbols.push(key);
      symbolTypes[key] = assetType;
    }

    // Build account holdings using composite keys
    const accounts = portfolio.accounts.map((account) => {
      const accountHoldings = calculateHoldings(
        portfolioTransactions.filter((t) => t.accountId === account.id)
      );
      const holdings: Record<string, number> = {};
      for (const holding of accountHoldings) {
        const key = `${holding.symbol}-${holding.assetType}`;
        holdings[key] = holding.quantity;
      }
      return {
        id: account.id,
        name: account.name,
        holdings,
      };
    });

    // Calculate totals per symbol key
    const totals: Record<string, number> = {};
    for (const key of symbols) {
      totals[key] = accounts.reduce(
        (sum, acc) => sum + (acc.holdings[key] || 0),
        0
      );
    }

    return { symbols, symbolTypes, accounts, totals };
  }, [portfolio, portfolioTransactions, trackedSymbols]);

  return { gridData, activePortfolioId };
}
