/**
 * Memoized selectors for portfolioStore
 *
 * These hooks provide efficient access to computed store values by:
 * 1. Subscribing only to specific state slices (not the whole store)
 * 2. Using useMemo to cache expensive calculations
 * 3. Only recalculating when actual dependencies change
 *
 * Use these instead of calling store methods directly in components.
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { calculateHoldings } from "@/lib/portfolioUtils";
import { getActiveOwnerId, isActiveMaster, GUEST_ID } from "@/lib/authUtils";
import { COMBINED_PORTFOLIO_ID } from "@/types/portfolio";
import type { Portfolio, Transaction, Holding, QuickOverviewData } from "@/types/portfolio";

/**
 * Memoized selector for visible portfolios
 * Only recalculates when portfolios array changes
 */
export function useVisiblePortfolios(): Portfolio[] {
  const portfolios = usePortfolioStore((state) => state.portfolios);

  return useMemo(() => {
    const activeId = getActiveOwnerId();

    // Not logged in - return empty
    if (!activeId) return [];

    let filtered: Portfolio[];

    // Guest - only public portfolios (no owners assigned)
    if (activeId === GUEST_ID) {
      filtered = portfolios.filter(
        (p) => !p.ownerIds || p.ownerIds.length === 0
      );
    } else if (isActiveMaster()) {
      // Master - can see ALL portfolios
      filtered = [...portfolios];
    } else {
      // Regular user - see own portfolios + public portfolios
      filtered = portfolios.filter((p) => {
        // Public portfolios (no owners)
        if (!p.ownerIds || p.ownerIds.length === 0) return true;
        // Portfolios assigned to this user
        return p.ownerIds.includes(activeId);
      });
    }

    // Sort by displayOrder (lower first), fallback to createdAt
    return filtered.sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [portfolios]);
}

/**
 * Memoized selector for active transactions
 * Subscribes to transactions, activePortfolioId, and combinedGroups
 */
export function useActiveTransactions(): Transaction[] {
  const { transactions, activePortfolioId, combinedGroups, portfolios } = usePortfolioStore(
    useShallow((state) => ({
      transactions: state.transactions,
      activePortfolioId: state.activePortfolioId,
      combinedGroups: state.combinedGroups,
      portfolios: state.portfolios,
    }))
  );

  const visiblePortfolios = useVisiblePortfolios();

  return useMemo(() => {
    // Combined view
    if (activePortfolioId === COMBINED_PORTFOLIO_ID) {
      const activeId = getActiveOwnerId();
      if (!activeId) return [];

      // Auto-include all when only 2 or fewer visible portfolios
      const shouldAutoIncludeAll = visiblePortfolios.length <= 2;

      const includedPortfolioIds = new Set(
        visiblePortfolios
          .filter((p) => shouldAutoIncludeAll || p.isIncludedInCombined)
          .map((p) => p.id)
      );

      return transactions.filter((t) => includedPortfolioIds.has(t.portfolioId));
    }

    // Combined group
    const combinedGroup = combinedGroups.find((g) => g.id === activePortfolioId);
    if (combinedGroup) {
      const portfolioIdSet = new Set(combinedGroup.portfolioIds);
      return transactions.filter((t) => portfolioIdSet.has(t.portfolioId));
    }

    // Single portfolio
    return transactions.filter((t) => t.portfolioId === activePortfolioId);
  }, [transactions, activePortfolioId, combinedGroups, visiblePortfolios]);
}

/**
 * Memoized selector for active holdings
 * Calculates holdings from active transactions (expensive operation)
 */
export function useActiveHoldings(): Holding[] {
  const activeTransactions = useActiveTransactions();

  return useMemo(() => {
    return calculateHoldings(activeTransactions);
  }, [activeTransactions]);
}

/**
 * Memoized selector for holdings by portfolio ID
 */
export function useHoldingsByPortfolio(portfolioId: string): Holding[] {
  const transactions = usePortfolioStore((state) => state.transactions);

  return useMemo(() => {
    const portfolioTransactions = portfolioId === COMBINED_PORTFOLIO_ID
      ? transactions // Will be filtered by combined logic
      : transactions.filter((t) => t.portfolioId === portfolioId);
    return calculateHoldings(portfolioTransactions);
  }, [transactions, portfolioId]);
}

/**
 * Memoized selector for Quick Overview grid data
 * This is an expensive calculation that was previously run on every render
 */
export function useQuickOverviewGrid(portfolioId: string): QuickOverviewData {
  const { portfolios, transactions, trackedSymbols } = usePortfolioStore(
    useShallow((state) => ({
      portfolios: state.portfolios,
      transactions: state.transactions,
      trackedSymbols: state.trackedSymbols,
    }))
  );

  return useMemo(() => {
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) {
      return { symbols: [], symbolTypes: {}, accounts: [], totals: {} };
    }

    // Get all transactions for this portfolio
    const portfolioTransactions = transactions.filter(
      (t) => t.portfolioId === portfolioId
    );

    // Build unique symbol-assetType combinations from transactions
    const symbolKeysFromTransactions = new Set<string>();
    portfolioTransactions.forEach((t) => {
      const key = `${t.symbol.toUpperCase()}-${t.assetType}`;
      symbolKeysFromTransactions.add(key);
    });

    // Also include tracked symbols
    const tracked = trackedSymbols[portfolioId] || [];
    tracked.forEach((trackedKey) => {
      if (trackedKey.includes("-")) {
        const lastDashIndex = trackedKey.lastIndexOf("-");
        const symbol = trackedKey.substring(0, lastDashIndex).toUpperCase();
        const assetType = trackedKey.substring(lastDashIndex + 1).toLowerCase();
        symbolKeysFromTransactions.add(`${symbol}-${assetType}`);
      } else {
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

    // Build account holdings
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
  }, [portfolios, transactions, trackedSymbols, portfolioId]);
}

/**
 * Memoized selector for active watchlist
 */
export function useActiveWatchlist(): string[] {
  const { activePortfolioId, watchlistSymbols, combinedGroups } = usePortfolioStore(
    useShallow((state) => ({
      activePortfolioId: state.activePortfolioId,
      watchlistSymbols: state.watchlistSymbols,
      combinedGroups: state.combinedGroups,
    }))
  );

  const visiblePortfolios = useVisiblePortfolios();

  return useMemo(() => {
    // For combined view, merge all portfolio watchlists
    if (activePortfolioId === COMBINED_PORTFOLIO_ID) {
      const allSymbols = new Set<string>();
      visiblePortfolios.forEach((p) => {
        const symbols = watchlistSymbols[p.id] || [];
        symbols.forEach((s) => allSymbols.add(s));
      });
      return Array.from(allSymbols);
    }

    // For combined groups, merge watchlists of group members
    const combinedGroup = combinedGroups.find((g) => g.id === activePortfolioId);
    if (combinedGroup) {
      const allSymbols = new Set<string>();
      combinedGroup.portfolioIds.forEach((pid) => {
        const symbols = watchlistSymbols[pid] || [];
        symbols.forEach((s) => allSymbols.add(s));
      });
      return Array.from(allSymbols);
    }

    // Regular portfolio
    return watchlistSymbols[activePortfolioId] || [];
  }, [activePortfolioId, watchlistSymbols, combinedGroups, visiblePortfolios]);
}

/**
 * Memoized selector for active portfolio
 */
export function useActivePortfolio(): Portfolio | null {
  const { activePortfolioId, portfolios } = usePortfolioStore(
    useShallow((state) => ({
      activePortfolioId: state.activePortfolioId,
      portfolios: state.portfolios,
    }))
  );

  return useMemo(() => {
    if (activePortfolioId === COMBINED_PORTFOLIO_ID) {
      return null;
    }
    return portfolios.find((p) => p.id === activePortfolioId) || null;
  }, [activePortfolioId, portfolios]);
}
