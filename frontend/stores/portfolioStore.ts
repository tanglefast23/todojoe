/**
 * Portfolio Zustand store with localStorage persistence
 * Supports multiple portfolios with accounts and a combined view
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import type {
  Transaction,
  Holding,
  Portfolio,
  Account,
  AssetType,
  QuickOverviewData,
  CombinedGroup,
} from "@/types/portfolio";
import { COMBINED_PORTFOLIO_ID, OTHER_ACCOUNT_ID } from "@/types/portfolio";
import {
  generateId,
  isValidUUID,
  calculateHoldings,
  createDefaultAccounts,
} from "@/lib/portfolioUtils";
import {
  getActiveOwnerId,
  isActiveMaster,
  isMasterUnlocked,
  GUEST_ID,
} from "@/lib/authUtils";

interface PortfolioState {
  portfolios: Portfolio[];
  transactions: Transaction[];
  activePortfolioId: string; // Current portfolio, "combined", or a combined group ID
  // User-created combined portfolio groups (e.g., "Karen + Kim")
  combinedGroups: CombinedGroup[];
  // Symbols tracked in Quick Overview (separate from transactions)
  trackedSymbols: Record<string, string[]>; // portfolioId -> symbol[]
  // Watchlist symbols per portfolio (e.g., "AAPL-stock", "BTC-crypto")
  watchlistSymbols: Record<string, string[]>; // portfolioId -> symbol[]
  // Notes per symbol (key: "portfolioId:symbol:assetType")
  symbolNotes: Record<string, string>;
  // Tags per symbol (key: "portfolioId:symbol:assetType", value: tag names array)
  symbolTags: Record<string, string[]>;
  // Tag groupings per portfolio (user-created combinations of tags)
  tagGroupings: Record<string, Array<{ id: string; tags: string[] }>>;
  // Manual cost basis overrides per portfolio (overrides calculated cost basis)
  costBasisOverrides: Record<string, number>; // portfolioId -> cost basis

  // Bulk setters for Supabase sync
  setPortfolios: (portfolios: Portfolio[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setSymbolNotes: (notes: Record<string, string>) => void;
  setSymbolTags: (tags: Record<string, string[]>) => void;
  setTagGroupings: (groupings: Record<string, Array<{ id: string; tags: string[] }>>) => void;
  setTrackedSymbols: (trackedSymbols: Record<string, string[]>) => void;
  setWatchlistSymbols: (watchlistSymbols: Record<string, string[]>) => void;
  setCostBasisOverrides: (overrides: Record<string, number>) => void;
  setCombinedGroups: (groups: CombinedGroup[]) => void;

  // Portfolio Actions
  addPortfolio: (name: string) => string;
  renamePortfolio: (id: string, name: string) => void;
  deletePortfolio: (id: string) => void;
  setActivePortfolio: (id: string) => void;
  togglePortfolioInCombined: (id: string) => void;
  setPortfolioOwners: (portfolioId: string, ownerIds: string[]) => void;
  addOwnerToPortfolio: (portfolioId: string, ownerId: string) => void;
  removeOwnerFromPortfolio: (portfolioId: string, ownerId: string) => void;
  reorderPortfolios: (portfolioIds: string[]) => void;

  // Combined Group Actions
  addCombinedGroup: (portfolioIds: string[]) => string;
  removeCombinedGroup: (groupId: string) => void;
  getCombinedGroup: (groupId: string) => CombinedGroup | null;
  getTransactionsForCombinedGroup: (groupId: string) => Transaction[];
  addOwnerToCombinedGroup: (groupId: string, ownerId: string) => void;
  removeOwnerFromCombinedGroup: (groupId: string, ownerId: string) => void;
  canAccessCombinedGroup: (groupId: string) => boolean;

  // Account Actions
  addAccount: (portfolioId: string, name: string) => string;
  renameAccount: (portfolioId: string, accountId: string, name: string) => void;
  removeAccount: (portfolioId: string, accountId: string, forceRemove?: boolean) => void;
  getAccountsForPortfolio: (portfolioId: string) => Account[];

  // Transaction Actions
  addTransaction: (
    transaction: Omit<Transaction, "id" | "portfolioId" | "accountId">,
    portfolioId?: string,
    accountId?: string
  ) => void;
  removeTransaction: (id: string) => void;
  clearAllTransactions: () => void;
  resetAllData: () => void;

  // Quick Overview Actions
  updateQuickOverviewQuantity: (
    portfolioId: string,
    accountId: string,
    symbol: string,
    newQuantity: number,
    currentPrice: number,
    assetType: AssetType
  ) => void;
  getQuickOverviewGrid: (portfolioId: string) => QuickOverviewData;
  addSymbolToQuickOverview: (portfolioId: string, symbol: string, assetType?: "stock" | "crypto") => void;
  removeSymbolFromQuickOverview: (portfolioId: string, symbol: string) => void;

  // Computed / Getters
  getVisiblePortfolios: () => Portfolio[];
  getActivePortfolio: () => Portfolio | null;
  getActiveTransactions: () => Transaction[];
  getActiveHoldings: () => Holding[];
  getTransactionsByPortfolio: (portfolioId: string) => Transaction[];
  getHoldingsByPortfolio: (portfolioId: string) => Holding[];
  getHoldingsByAccount: (portfolioId: string, accountId: string) => Holding[];
  getCombinedTransactions: () => Transaction[];
  getCombinedHoldings: () => Holding[];

  // Symbol Notes Actions
  getSymbolNote: (symbol: string, assetType: AssetType) => string;
  setSymbolNote: (symbol: string, assetType: AssetType, note: string) => void;

  // Symbol Tags Actions
  getSymbolTags: (symbol: string, assetType: AssetType) => string[];
  addSymbolTags: (symbol: string, assetType: AssetType, tags: string[]) => void;
  removeSymbolTag: (symbol: string, assetType: AssetType, tag: string) => void;
  clearSymbolTags: (symbol: string, assetType: AssetType) => void;

  // Cost Basis Override Actions
  getCostBasisOverride: (portfolioId: string) => number | null;
  setCostBasisOverride: (portfolioId: string, value: number | null) => void;

  // Tag Groupings Actions
  getTagGroupings: (portfolioId: string) => Array<{ id: string; tags: string[] }>;
  addTagGrouping: (portfolioId: string, tags: string[]) => string;
  removeTagGrouping: (portfolioId: string, groupingId: string) => void;

  // Watchlist Actions (per-portfolio watchlist)
  getActiveWatchlist: () => string[];
  addWatchlistSymbol: (symbolKey: string) => void;
  removeWatchlistSymbol: (symbolKey: string) => void;
  reorderWatchlistSymbols: (symbols: string[]) => void;
}

// Default portfolio created on first use
const DEFAULT_PORTFOLIO: Portfolio = {
  id: "default",
  name: "My Portfolio",
  createdAt: new Date().toISOString(),
  isIncludedInCombined: true,
  accounts: createDefaultAccounts("default"),
};

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    temporal(
      (set, get) => ({
      portfolios: [DEFAULT_PORTFOLIO],
      transactions: [],
      activePortfolioId: "default",
      combinedGroups: [],
      trackedSymbols: {},
      watchlistSymbols: {},
      symbolNotes: {},
      symbolTags: {},
      tagGroupings: {},
      costBasisOverrides: {},

      // Bulk setters for Supabase sync
      setPortfolios: (portfolios) => {
        set({ portfolios });
      },

      setTransactions: (transactions) => {
        set({ transactions });
      },

      setSymbolNotes: (notes) => {
        set({ symbolNotes: notes });
      },

      setSymbolTags: (tags) => {
        set({ symbolTags: tags });
      },

      setTagGroupings: (groupings) => {
        set({ tagGroupings: groupings });
      },

      setTrackedSymbols: (trackedSymbols) => {
        set({ trackedSymbols });
      },

      setWatchlistSymbols: (watchlistSymbols) => {
        set({ watchlistSymbols });
      },

      setCostBasisOverrides: (overrides) => {
        set({ costBasisOverrides: overrides });
      },

      setCombinedGroups: (groups) => {
        set({ combinedGroups: groups });
      },

      // Portfolio Actions
      addPortfolio: (name) => {
        const id = generateId();
        const activeId = getActiveOwnerId();

        // Auto-assign to logged-in owner (not guest, not null)
        const ownerIds: string[] = [];
        if (activeId && activeId !== GUEST_ID) {
          ownerIds.push(activeId);
        }

        const newPortfolio: Portfolio = {
          id,
          name,
          createdAt: new Date().toISOString(),
          isIncludedInCombined: true,
          accounts: createDefaultAccounts(id),
          ownerIds, // Auto-assigned to current user
        };
        set((state) => ({
          portfolios: [...state.portfolios, newPortfolio],
        }));
        return id;
      },

      renamePortfolio: (id, name) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === id ? { ...p, name } : p
          ),
        }));
      },

      deletePortfolio: (id) => {
        const state = get();
        // Don't delete if it's the only portfolio
        if (state.portfolios.length <= 1) return;

        // Clean up orphaned symbolNotes and symbolTags for this portfolio
        // Keys are formatted as "portfolioId:symbol:assetType"
        const cleanedSymbolNotes = Object.fromEntries(
          Object.entries(state.symbolNotes).filter(([key]) => !key.startsWith(`${id}:`))
        );
        const cleanedSymbolTags = Object.fromEntries(
          Object.entries(state.symbolTags).filter(([key]) => !key.startsWith(`${id}:`))
        );

        set((state) => ({
          portfolios: state.portfolios.filter((p) => p.id !== id),
          transactions: state.transactions.filter((t) => t.portfolioId !== id),
          symbolNotes: cleanedSymbolNotes,
          symbolTags: cleanedSymbolTags,
          // Switch to first available portfolio if active was deleted
          activePortfolioId:
            state.activePortfolioId === id
              ? state.portfolios.find((p) => p.id !== id)?.id || COMBINED_PORTFOLIO_ID
              : state.activePortfolioId,
        }));
      },

      setActivePortfolio: (id) => {
        set({ activePortfolioId: id });
      },

      togglePortfolioInCombined: (id) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === id ? { ...p, isIncludedInCombined: !p.isIncludedInCombined } : p
          ),
        }));
      },

      setPortfolioOwners: (portfolioId, ownerIds) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId ? { ...p, ownerIds } : p
          ),
        }));
      },

      addOwnerToPortfolio: (portfolioId, ownerId) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) => {
            if (p.id !== portfolioId) return p;
            const currentOwners = p.ownerIds || [];
            if (currentOwners.includes(ownerId)) return p;
            return { ...p, ownerIds: [...currentOwners, ownerId] };
          }),
        }));
      },

      removeOwnerFromPortfolio: (portfolioId, ownerId) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) => {
            if (p.id !== portfolioId) return p;
            const currentOwners = p.ownerIds || [];
            return { ...p, ownerIds: currentOwners.filter((id) => id !== ownerId) };
          }),
        }));
      },

      reorderPortfolios: (portfolioIds) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) => {
            const newOrder = portfolioIds.indexOf(p.id);
            return { ...p, displayOrder: newOrder >= 0 ? newOrder : 999 };
          }),
        }));
      },

      // Combined Group Actions
      addCombinedGroup: (portfolioIds) => {
        const state = get();
        const id = generateId();

        // Generate short name from first letter of each portfolio (e.g., "K/D")
        const names = portfolioIds
          .map((pid) => state.portfolios.find((p) => p.id === pid)?.name)
          .filter(Boolean);

        // Use first letter joined by /
        const name = names
          .map((n) => {
            if (!n) return "?";
            return n.charAt(0).toUpperCase();
          })
          .join("/");

        // Track who created this combined group (they auto-have access)
        const creatorOwnerId = getActiveOwnerId() || undefined;

        const newGroup: CombinedGroup = {
          id,
          name,
          portfolioIds,
          createdAt: new Date().toISOString(),
          creatorOwnerId,
          allowedOwnerIds: [], // Start with empty, creator auto-has access via creatorOwnerId
        };

        set((state) => ({
          combinedGroups: [...state.combinedGroups, newGroup],
          activePortfolioId: id, // Auto-select the new group
        }));

        return id;
      },

      removeCombinedGroup: (groupId) => {
        set((state) => ({
          combinedGroups: state.combinedGroups.filter((g) => g.id !== groupId),
          // Switch away if active was deleted
          activePortfolioId:
            state.activePortfolioId === groupId
              ? state.portfolios[0]?.id || COMBINED_PORTFOLIO_ID
              : state.activePortfolioId,
        }));
      },

      getCombinedGroup: (groupId) => {
        const state = get();
        return state.combinedGroups.find((g) => g.id === groupId) || null;
      },

      getTransactionsForCombinedGroup: (groupId) => {
        const state = get();
        const group = state.combinedGroups.find((g) => g.id === groupId);
        if (!group) return [];

        const portfolioIdSet = new Set(group.portfolioIds);
        return state.transactions.filter((t) => portfolioIdSet.has(t.portfolioId));
      },

      addOwnerToCombinedGroup: (groupId, ownerId) => {
        set((state) => ({
          combinedGroups: state.combinedGroups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  allowedOwnerIds: [...new Set([...(g.allowedOwnerIds || []), ownerId])],
                }
              : g
          ),
        }));
      },

      removeOwnerFromCombinedGroup: (groupId, ownerId) => {
        set((state) => ({
          combinedGroups: state.combinedGroups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  allowedOwnerIds: (g.allowedOwnerIds || []).filter((id) => id !== ownerId),
                }
              : g
          ),
        }));
      },

      canAccessCombinedGroup: (groupId) => {
        const state = get();
        const group = state.combinedGroups.find((g) => g.id === groupId);
        if (!group) return false;

        const activeOwnerId = getActiveOwnerId();

        // Master always has access
        if (isMasterUnlocked()) return true;

        // No active owner = guest mode, check if group has no restrictions
        if (!activeOwnerId) {
          // Guest can access if group has no creator and no allowed owners
          return !group.creatorOwnerId && (!group.allowedOwnerIds || group.allowedOwnerIds.length === 0);
        }

        // Creator always has access
        if (group.creatorOwnerId === activeOwnerId) return true;

        // Check if in allowed list
        if (group.allowedOwnerIds?.includes(activeOwnerId)) return true;

        return false;
      },

      // Account Actions
      addAccount: (portfolioId, name) => {
        const id = generateId();
        const newAccount: Account = {
          id,
          name,
          portfolioId,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId
              ? { ...p, accounts: [...p.accounts, newAccount] }
              : p
          ),
        }));
        return id;
      },

      renameAccount: (portfolioId, accountId, name) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId
              ? {
                  ...p,
                  accounts: p.accounts.map((a) =>
                    a.id === accountId ? { ...a, name } : a
                  ),
                }
              : p
          ),
        }));
      },

      removeAccount: (portfolioId, accountId, forceRemove = false) => {
        const state = get();
        const portfolio = state.portfolios.find((p) => p.id === portfolioId);
        // Don't remove if it's the only account
        if (!portfolio || portfolio.accounts.length <= 1) return;

        const hasTransactions = state.transactions.some(
          (t) => t.portfolioId === portfolioId && t.accountId === accountId
        );

        // Block deletion if account has transactions (unless forceRemove is true)
        if (hasTransactions && !forceRemove) return;

        set((state) => ({
          // Remove account from portfolio
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId
              ? { ...p, accounts: p.accounts.filter((a) => a.id !== accountId) }
              : p
          ),
          // Keep transactions - they serve as historical record (sells added before account deletion)
          transactions: state.transactions,
        }));
      },

      getAccountsForPortfolio: (portfolioId) => {
        const state = get();
        if (portfolioId === COMBINED_PORTFOLIO_ID) {
          // Return all accounts from all included portfolios
          return state.portfolios
            .filter((p) => p.isIncludedInCombined)
            .flatMap((p) => p.accounts);
        }
        const portfolio = state.portfolios.find((p) => p.id === portfolioId);
        return portfolio?.accounts || [];
      },

      // Transaction Actions
      addTransaction: (transaction, portfolioId, accountId) => {
        const state = get();
        const targetPortfolioId = portfolioId ||
          (state.activePortfolioId === COMBINED_PORTFOLIO_ID
            ? state.portfolios[0]?.id || "default"
            : state.activePortfolioId);

        // Default to "Other" account if not specified
        const portfolio = state.portfolios.find((p) => p.id === targetPortfolioId);
        const otherAccount = portfolio?.accounts.find((a) => a.name === "Other");
        const targetAccountId = accountId || otherAccount?.id || `${targetPortfolioId}-other`;

        const newTransaction: Transaction = {
          ...transaction,
          id: generateId(),
          portfolioId: targetPortfolioId,
          accountId: targetAccountId,
        };

        set((state) => ({
          transactions: [...state.transactions, newTransaction],
        }));
      },

      removeTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
      },

      clearAllTransactions: () => {
        set({ transactions: [] });
      },

      resetAllData: () => {
        set({
          portfolios: [DEFAULT_PORTFOLIO],
          transactions: [],
          activePortfolioId: "default",
          combinedGroups: [],
          trackedSymbols: {},
          watchlistSymbols: {},
          symbolNotes: {},
          symbolTags: {},
          tagGroupings: {},
          costBasisOverrides: {},
        });
      },

      // Computed / Getters
      getVisiblePortfolios: () => {
        const state = get();
        const activeId = getActiveOwnerId();

        // Not logged in - return empty
        if (!activeId) return [];

        let portfolios: Portfolio[];

        // Guest - only public portfolios (no owners assigned)
        if (activeId === GUEST_ID) {
          portfolios = state.portfolios.filter(
            (p) => !p.ownerIds || p.ownerIds.length === 0
          );
        } else if (isActiveMaster()) {
          // Master - can see ALL portfolios
          portfolios = [...state.portfolios];
        } else {
          // Regular user - see own portfolios + public portfolios
          portfolios = state.portfolios.filter((p) => {
            // Public portfolios (no owners)
            if (!p.ownerIds || p.ownerIds.length === 0) return true;
            // Portfolios assigned to this user
            return p.ownerIds.includes(activeId);
          });
        }

        // Sort by displayOrder (lower first), fallback to createdAt
        return portfolios.sort((a, b) => {
          const orderA = a.displayOrder ?? 999;
          const orderB = b.displayOrder ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      },

      getActivePortfolio: () => {
        const state = get();
        if (state.activePortfolioId === COMBINED_PORTFOLIO_ID) {
          return null; // Combined is not a real portfolio
        }
        return state.portfolios.find((p) => p.id === state.activePortfolioId) || null;
      },

      getActiveTransactions: () => {
        const state = get();
        if (state.activePortfolioId === COMBINED_PORTFOLIO_ID) {
          return state.getCombinedTransactions();
        }
        // Check if it's a combined group
        const combinedGroup = state.combinedGroups.find(
          (g) => g.id === state.activePortfolioId
        );
        if (combinedGroup) {
          return state.getTransactionsForCombinedGroup(combinedGroup.id);
        }
        return state.transactions.filter(
          (t) => t.portfolioId === state.activePortfolioId
        );
      },

      getActiveHoldings: () => {
        const state = get();
        return calculateHoldings(state.getActiveTransactions());
      },

      getTransactionsByPortfolio: (portfolioId) => {
        const state = get();
        if (portfolioId === COMBINED_PORTFOLIO_ID) {
          return state.getCombinedTransactions();
        }
        return state.transactions.filter((t) => t.portfolioId === portfolioId);
      },

      getHoldingsByPortfolio: (portfolioId) => {
        const state = get();
        return calculateHoldings(state.getTransactionsByPortfolio(portfolioId));
      },

      getHoldingsByAccount: (portfolioId, accountId) => {
        const state = get();
        const transactions = state.transactions.filter(
          (t) => t.portfolioId === portfolioId && t.accountId === accountId
        );
        return calculateHoldings(transactions);
      },

      // Quick Overview Actions
      updateQuickOverviewQuantity: (
        portfolioId,
        accountId,
        symbol,
        newQuantity,
        currentPrice,
        assetType
      ) => {
        // Validate: prevent negative quantities (clamp to 0)
        if (newQuantity < 0) {
          console.warn(`[portfolioStore] Cannot set negative quantity for ${symbol}. Clamping to 0.`);
          newQuantity = 0;
        }

        const state = get();
        // Calculate current quantity from existing transactions
        const accountTransactions = state.transactions.filter(
          (t) =>
            t.portfolioId === portfolioId &&
            t.accountId === accountId &&
            t.symbol === symbol
        );
        const holdings = calculateHoldings(accountTransactions);
        const currentHolding = holdings.find((h) => h.symbol === symbol);
        const currentQuantity = currentHolding?.quantity || 0;

        const difference = newQuantity - currentQuantity;
        if (difference === 0) return; // No change needed

        // Create buy or sell transaction based on difference
        const transactionType = difference > 0 ? "buy" : "sell";
        const quantity = Math.abs(difference);

        const newTransaction: Transaction = {
          id: generateId(),
          symbol,
          type: transactionType,
          assetType,
          quantity,
          price: currentPrice,
          date: new Date().toISOString(),
          notes: `Quick Overview adjustment`,
          portfolioId,
          accountId,
        };

        set((state) => ({
          transactions: [...state.transactions, newTransaction],
        }));
      },

      getQuickOverviewGrid: (portfolioId) => {
        const state = get();

        // Check if this is a combined group
        const combinedGroup = state.combinedGroups.find((g) => g.id === portfolioId);

        // Get portfolios to include
        let portfoliosToInclude: typeof state.portfolios = [];

        if (combinedGroup) {
          // Combined group - get all portfolios in the group
          portfoliosToInclude = state.portfolios.filter((p) =>
            combinedGroup.portfolioIds.includes(p.id)
          );
        } else {
          // Single portfolio
          const portfolio = state.portfolios.find((p) => p.id === portfolioId);
          if (portfolio) {
            portfoliosToInclude = [portfolio];
          }
        }

        if (portfoliosToInclude.length === 0) {
          return { symbols: [], symbolTypes: {}, accounts: [], totals: {} };
        }

        // Get all transactions for included portfolios
        const portfolioIds = new Set(portfoliosToInclude.map((p) => p.id));
        const portfolioTransactions = state.transactions.filter(
          (t) => portfolioIds.has(t.portfolioId)
        );

        // Build unique symbol-assetType combinations from transactions
        // This ensures BTC (stock) and BTC (crypto) are separate columns
        const symbolKeysFromTransactions = new Set<string>();
        portfolioTransactions.forEach((t) => {
          const key = `${t.symbol.toUpperCase()}-${t.assetType}`;
          symbolKeysFromTransactions.add(key);
        });

        // Also include tracked symbols from all included portfolios
        portfoliosToInclude.forEach((portfolio) => {
          const trackedSymbols = state.trackedSymbols[portfolio.id] || [];
          trackedSymbols.forEach((trackedKey) => {
            // Handle both old format (just symbol) and new format (symbol-assetType)
            if (trackedKey.includes("-")) {
              // New format: "BTC-crypto" - extract symbol and asset type separately
              // Only uppercase the symbol part, keep asset type lowercase
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
        });

        const symbolKeys = Array.from(symbolKeysFromTransactions);

        // Build display symbols (just the ticker) and types map
        const symbols: string[] = [];
        const symbolTypes: Record<string, "stock" | "crypto" | "both"> = {};

        for (const key of symbolKeys) {
          // Use lastIndexOf to handle symbols with dashes (e.g., "BRK-B-stock")
          const lastDashIndex = key.lastIndexOf("-");
          const assetType = key.substring(lastDashIndex + 1) as "stock" | "crypto";
          symbols.push(key); // Use full key as the column identifier
          symbolTypes[key] = assetType;
        }

        // Build account holdings using composite keys
        // For combined groups, include accounts from all portfolios
        const accounts: { id: string; name: string; holdings: Record<string, number> }[] = [];
        portfoliosToInclude.forEach((portfolio) => {
          const portfolioTxns = portfolioTransactions.filter(
            (t) => t.portfolioId === portfolio.id
          );
          portfolio.accounts.forEach((account) => {
            const accountHoldings = calculateHoldings(
              portfolioTxns.filter((t) => t.accountId === account.id)
            );
            const holdings: Record<string, number> = {};
            // Use composite key (symbol-assetType) for each holding
            for (const holding of accountHoldings) {
              const key = `${holding.symbol}-${holding.assetType}`;
              holdings[key] = holding.quantity;
            }
            accounts.push({
              id: account.id,
              name: combinedGroup ? `${portfolio.name} - ${account.name}` : account.name,
              holdings,
            });
          });
        });

        // Calculate totals per symbol key (combined across all accounts)
        const totals: Record<string, number> = {};
        for (const key of symbols) {
          totals[key] = accounts.reduce(
            (sum, acc) => sum + (acc.holdings[key] || 0),
            0
          );
        }

        return { symbols, symbolTypes, accounts, totals };
      },

      addSymbolToQuickOverview: (portfolioId, symbol, assetType = "stock") => {
        // Track the symbol without creating a fake transaction
        // Store as composite key "SYMBOL-assetType" (e.g., "BTC-crypto")
        const state = get();
        const upperSymbol = symbol.toUpperCase();
        const compositeKey = `${upperSymbol}-${assetType}`;

        // Check if symbol already exists in transactions with this asset type
        const existingTransactions = state.transactions.filter(
          (t) =>
            t.portfolioId === portfolioId &&
            t.symbol.toUpperCase() === upperSymbol &&
            t.assetType === assetType
        );
        if (existingTransactions.length > 0) return; // Symbol already has transactions

        // Check if symbol is already tracked (check composite key)
        const currentTracked = state.trackedSymbols[portfolioId] || [];
        if (currentTracked.includes(compositeKey)) return; // Already tracked

        // Add to trackedSymbols using composite key
        set((state) => ({
          trackedSymbols: {
            ...state.trackedSymbols,
            [portfolioId]: [...(state.trackedSymbols[portfolioId] || []), compositeKey],
          },
        }));
      },

      removeSymbolFromQuickOverview: (portfolioId, symbol) => {
        const state = get();
        const upperSymbol = symbol.toUpperCase();

        // Get all transactions for this symbol in this portfolio
        const symbolTransactions = state.transactions.filter(
          (t) => t.portfolioId === portfolioId && t.symbol.toUpperCase() === upperSymbol
        );

        // Calculate net holdings
        const holdings = calculateHoldings(symbolTransactions);
        const holding = holdings.find((h) => h.symbol.toUpperCase() === upperSymbol);
        const netQuantity = holding?.quantity || 0;

        // Only remove if net quantity is 0 (no actual holdings)
        if (netQuantity === 0) {
          // Clean up orphaned symbolNotes and symbolTags for this symbol
          // Keys are formatted as "portfolioId:symbol:assetType"
          const keyPrefix = `${portfolioId}:${upperSymbol}:`;
          const cleanedSymbolNotes = Object.fromEntries(
            Object.entries(state.symbolNotes).filter(([key]) => !key.startsWith(keyPrefix))
          );
          const cleanedSymbolTags = Object.fromEntries(
            Object.entries(state.symbolTags).filter(([key]) => !key.startsWith(keyPrefix))
          );

          set((state) => ({
            // Remove any transactions for this symbol
            transactions: state.transactions.filter(
              (t) => !(t.portfolioId === portfolioId && t.symbol.toUpperCase() === upperSymbol)
            ),
            // Also remove from tracked symbols
            // Symbols may be stored as composite keys (e.g., "OKLO-stock") or plain (e.g., "OKLO")
            trackedSymbols: {
              ...state.trackedSymbols,
              [portfolioId]: (state.trackedSymbols[portfolioId] || []).filter((s) => {
                const sUpper = s.toUpperCase();
                // Remove if exact match OR if it's a composite key starting with the symbol
                // (e.g., "OKLO-stock" should be removed when symbol is "OKLO")
                if (sUpper === upperSymbol) return false;
                if (sUpper.startsWith(upperSymbol + "-")) return false;
                return true;
              }),
            },
            // Clean up orphaned notes and tags
            symbolNotes: cleanedSymbolNotes,
            symbolTags: cleanedSymbolTags,
          }));
        }
        // If there are actual holdings, don't remove (user should sell first)
      },

      getCombinedTransactions: () => {
        const state = get();
        const activeId = getActiveOwnerId();

        // Not logged in - return empty
        if (!activeId) return [];

        // Get visible portfolios based on login status
        const visiblePortfolios = state.getVisiblePortfolios();

        // Auto-include all when only 2 or fewer visible portfolios
        const shouldAutoIncludeAll = visiblePortfolios.length <= 2;

        const includedPortfolioIds = new Set(
          visiblePortfolios
            .filter((p) => {
              // If only 2 or fewer portfolios, auto-include all
              if (shouldAutoIncludeAll) return true;
              // Otherwise, respect the isIncludedInCombined flag
              return p.isIncludedInCombined;
            })
            .map((p) => p.id)
        );

        return state.transactions.filter((t) =>
          includedPortfolioIds.has(t.portfolioId)
        );
      },

      getCombinedHoldings: () => {
        const state = get();
        return calculateHoldings(state.getCombinedTransactions());
      },

      // Symbol Notes Actions
      getSymbolNote: (symbol, assetType) => {
        const state = get();
        const portfolioId = state.activePortfolioId === COMBINED_PORTFOLIO_ID
          ? "combined"
          : state.activePortfolioId;
        const key = `${portfolioId}:${symbol.toUpperCase()}:${assetType}`;
        return state.symbolNotes[key] || "";
      },

      setSymbolNote: (symbol, assetType, note) => {
        const state = get();
        const portfolioId = state.activePortfolioId === COMBINED_PORTFOLIO_ID
          ? "combined"
          : state.activePortfolioId;
        const key = `${portfolioId}:${symbol.toUpperCase()}:${assetType}`;

        set((state) => ({
          symbolNotes: {
            ...state.symbolNotes,
            [key]: note,
          },
        }));
      },

      // Symbol Tags Actions
      getSymbolTags: (symbol, assetType) => {
        const state = get();
        const portfolioId = state.activePortfolioId === COMBINED_PORTFOLIO_ID
          ? "combined"
          : state.activePortfolioId;
        const key = `${portfolioId}:${symbol.toUpperCase()}:${assetType}`;
        return state.symbolTags[key] || [];
      },

      addSymbolTags: (symbol, assetType, tags) => {
        const state = get();
        const portfolioId = state.activePortfolioId === COMBINED_PORTFOLIO_ID
          ? "combined"
          : state.activePortfolioId;
        const key = `${portfolioId}:${symbol.toUpperCase()}:${assetType}`;
        const existingTags = state.symbolTags[key] || [];
        // Append new tags, avoiding duplicates
        const newTags = [...existingTags];
        for (const tag of tags) {
          const normalizedTag = tag.toLowerCase().trim();
          if (normalizedTag && !newTags.includes(normalizedTag)) {
            newTags.push(normalizedTag);
          }
        }

        set((state) => ({
          symbolTags: {
            ...state.symbolTags,
            [key]: newTags,
          },
        }));
      },

      removeSymbolTag: (symbol, assetType, tag) => {
        const state = get();
        const portfolioId = state.activePortfolioId === COMBINED_PORTFOLIO_ID
          ? "combined"
          : state.activePortfolioId;
        const key = `${portfolioId}:${symbol.toUpperCase()}:${assetType}`;
        const existingTags = state.symbolTags[key] || [];
        const newTags = existingTags.filter((t) => t !== tag.toLowerCase());

        set((state) => ({
          symbolTags: {
            ...state.symbolTags,
            [key]: newTags,
          },
        }));
      },

      clearSymbolTags: (symbol, assetType) => {
        const state = get();
        const portfolioId = state.activePortfolioId === COMBINED_PORTFOLIO_ID
          ? "combined"
          : state.activePortfolioId;
        const key = `${portfolioId}:${symbol.toUpperCase()}:${assetType}`;

        set((state) => {
          const { [key]: _, ...rest } = state.symbolTags;
          return { symbolTags: rest };
        });
      },

      // Cost Basis Override Actions
      getCostBasisOverride: (portfolioId) => {
        const state = get();
        return state.costBasisOverrides[portfolioId] ?? null;
      },

      setCostBasisOverride: (portfolioId, value) => {
        set((state) => {
          if (value === null) {
            // Remove override
            const { [portfolioId]: _, ...rest } = state.costBasisOverrides;
            return { costBasisOverrides: rest };
          }
          return {
            costBasisOverrides: {
              ...state.costBasisOverrides,
              [portfolioId]: value,
            },
          };
        });
      },

      // Tag Groupings Actions
      getTagGroupings: (portfolioId) => {
        return get().tagGroupings[portfolioId] || [];
      },

      addTagGrouping: (portfolioId, tags) => {
        const id = generateId();
        set((state) => ({
          tagGroupings: {
            ...state.tagGroupings,
            [portfolioId]: [
              ...(state.tagGroupings[portfolioId] || []),
              { id, tags },
            ],
          },
        }));
        return id;
      },

      removeTagGrouping: (portfolioId, groupingId) => {
        set((state) => ({
          tagGroupings: {
            ...state.tagGroupings,
            [portfolioId]: (state.tagGroupings[portfolioId] || []).filter(
              (g) => g.id !== groupingId
            ),
          },
        }));
      },

      // Watchlist Actions (per-portfolio watchlist)
      getActiveWatchlist: () => {
        const state = get();
        const portfolioId = state.activePortfolioId;

        // For combined view, merge all portfolio watchlists
        if (portfolioId === COMBINED_PORTFOLIO_ID) {
          const allSymbols = new Set<string>();
          const visiblePortfolios = state.getVisiblePortfolios();
          visiblePortfolios.forEach((p) => {
            const symbols = state.watchlistSymbols[p.id] || [];
            symbols.forEach((s) => allSymbols.add(s));
          });
          return Array.from(allSymbols);
        }

        // For combined groups, merge watchlists of group members
        const combinedGroup = state.combinedGroups.find((g) => g.id === portfolioId);
        if (combinedGroup) {
          const allSymbols = new Set<string>();
          combinedGroup.portfolioIds.forEach((pid) => {
            const symbols = state.watchlistSymbols[pid] || [];
            symbols.forEach((s) => allSymbols.add(s));
          });
          return Array.from(allSymbols);
        }

        // Regular portfolio
        return state.watchlistSymbols[portfolioId] || [];
      },

      addWatchlistSymbol: (symbolKey) => {
        const state = get();
        let portfolioId = state.activePortfolioId;

        // For combined view, add to the first portfolio
        if (portfolioId === COMBINED_PORTFOLIO_ID) {
          const visiblePortfolios = state.getVisiblePortfolios();
          portfolioId = visiblePortfolios[0]?.id || "default";
        }

        // For combined groups, add to the first portfolio in the group
        const combinedGroup = state.combinedGroups.find((g) => g.id === portfolioId);
        if (combinedGroup) {
          portfolioId = combinedGroup.portfolioIds[0] || "default";
        }

        const currentSymbols = state.watchlistSymbols[portfolioId] || [];
        if (currentSymbols.includes(symbolKey)) return; // Already exists

        set((state) => ({
          watchlistSymbols: {
            ...state.watchlistSymbols,
            [portfolioId]: [...currentSymbols, symbolKey],
          },
        }));
      },

      removeWatchlistSymbol: (symbolKey) => {
        const state = get();
        let portfolioId = state.activePortfolioId;

        // For combined view, remove from all portfolios that have it
        if (portfolioId === COMBINED_PORTFOLIO_ID) {
          const visiblePortfolios = state.getVisiblePortfolios();
          const newWatchlistSymbols = { ...state.watchlistSymbols };
          visiblePortfolios.forEach((p) => {
            if (newWatchlistSymbols[p.id]?.includes(symbolKey)) {
              newWatchlistSymbols[p.id] = newWatchlistSymbols[p.id].filter((s) => s !== symbolKey);
            }
          });
          set({ watchlistSymbols: newWatchlistSymbols });
          return;
        }

        // For combined groups, remove from all portfolios in the group
        const combinedGroup = state.combinedGroups.find((g) => g.id === portfolioId);
        if (combinedGroup) {
          const newWatchlistSymbols = { ...state.watchlistSymbols };
          combinedGroup.portfolioIds.forEach((pid) => {
            if (newWatchlistSymbols[pid]?.includes(symbolKey)) {
              newWatchlistSymbols[pid] = newWatchlistSymbols[pid].filter((s) => s !== symbolKey);
            }
          });
          set({ watchlistSymbols: newWatchlistSymbols });
          return;
        }

        // Regular portfolio
        const currentSymbols = state.watchlistSymbols[portfolioId] || [];
        set((state) => ({
          watchlistSymbols: {
            ...state.watchlistSymbols,
            [portfolioId]: currentSymbols.filter((s) => s !== symbolKey),
          },
        }));
      },

      reorderWatchlistSymbols: (symbols) => {
        const state = get();
        let portfolioId = state.activePortfolioId;

        // For combined view or groups, don't allow reordering (merged lists)
        if (portfolioId === COMBINED_PORTFOLIO_ID) return;
        const combinedGroup = state.combinedGroups.find((g) => g.id === portfolioId);
        if (combinedGroup) return;

        set((state) => ({
          watchlistSymbols: {
            ...state.watchlistSymbols,
            [portfolioId]: symbols,
          },
        }));
      },
    }),
    {
      // Only track data changes, not UI state like activePortfolioId
      partialize: (state) => ({
        portfolios: state.portfolios,
        transactions: state.transactions,
        combinedGroups: state.combinedGroups,
        trackedSymbols: state.trackedSymbols,
        watchlistSymbols: state.watchlistSymbols,
        symbolNotes: state.symbolNotes,
        symbolTags: state.symbolTags,
        tagGroupings: state.tagGroupings,
      }),
      limit: 50, // Keep last 50 states
    }
    ),
    {
      name: "portfolio-storage",
      // Migrate old data structure to new one
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as PortfolioState & { holdings?: Holding[] };

        // v1 → v2: Add portfolioId to transactions
        if (state.transactions?.length > 0 && !state.transactions[0]?.portfolioId) {
          state.transactions = state.transactions.map((t) => ({
            ...t,
            portfolioId: "default",
          }));
        }

        // Ensure portfolios array exists
        if (!state.portfolios || state.portfolios.length === 0) {
          state.portfolios = [DEFAULT_PORTFOLIO];
        }

        // Ensure activePortfolioId exists
        if (!state.activePortfolioId) {
          state.activePortfolioId = "default";
        }

        // Remove old holdings array (it's now computed)
        delete state.holdings;

        // v2 → v3: Add accounts to portfolios and accountId to transactions
        if (version < 3) {
          const now = new Date().toISOString();

          // Add default accounts to portfolios that don't have them
          state.portfolios = state.portfolios.map((p) => {
            if (!p.accounts || p.accounts.length === 0) {
              return {
                ...p,
                accounts: [
                  { id: `${p.id}-tfsa`, name: "TFSA", portfolioId: p.id, createdAt: now },
                  { id: `${p.id}-rrsp`, name: "RRSP", portfolioId: p.id, createdAt: now },
                  { id: `${p.id}-other`, name: "Other", portfolioId: p.id, createdAt: now },
                ],
              };
            }
            return p;
          });

          // Add accountId to transactions that don't have it (default to "Other")
          state.transactions = state.transactions.map((t) => {
            if (!t.accountId) {
              return {
                ...t,
                accountId: `${t.portfolioId}-other`,
              };
            }
            return t;
          });
        }

        // v3 → v4: Add trackedSymbols and clean up 0-quantity placeholder transactions
        if (version < 4) {
          // Initialize trackedSymbols if not present
          if (!state.trackedSymbols) {
            state.trackedSymbols = {};
          }

          // Remove any 0-quantity placeholder transactions (legacy from old approach)
          state.transactions = state.transactions.filter(
            (t) => t.quantity !== 0 || t.price !== 0
          );
        }

        // v4 → v5: Add ownerIds field to portfolios (empty = public)
        if (version < 5) {
          state.portfolios = state.portfolios.map((p) => ({
            ...p,
            ownerIds: p.ownerIds ?? [],
          }));
        }

        // v5 → v6: Convert all non-UUID IDs to proper UUIDs for Supabase compatibility
        if (version < 6) {
          // UUID regex for validation
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isUUID = (id: string) => uuidRegex.test(id);

          // Generate UUID helper (same as generateId but can be called at migration time)
          const makeUUID = () => {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
              return crypto.randomUUID();
            }
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
          };

          // Create ID mappings
          const portfolioIdMap = new Map<string, string>();
          const accountIdMap = new Map<string, string>();
          const transactionIdMap = new Map<string, string>();

          // First pass: create mappings for all non-UUID IDs
          for (const portfolio of state.portfolios) {
            if (!isUUID(portfolio.id)) {
              portfolioIdMap.set(portfolio.id, makeUUID());
            }
            for (const account of portfolio.accounts || []) {
              if (!isUUID(account.id)) {
                accountIdMap.set(account.id, makeUUID());
              }
            }
          }
          for (const transaction of state.transactions) {
            if (!isUUID(transaction.id)) {
              transactionIdMap.set(transaction.id, makeUUID());
            }
          }

          // Second pass: apply mappings
          state.portfolios = state.portfolios.map((p) => {
            const newPortfolioId = portfolioIdMap.get(p.id) || p.id;
            return {
              ...p,
              id: newPortfolioId,
              accounts: (p.accounts || []).map((a) => ({
                ...a,
                id: accountIdMap.get(a.id) || a.id,
                portfolioId: portfolioIdMap.get(a.portfolioId) || a.portfolioId,
              })),
            };
          });

          state.transactions = state.transactions.map((t) => ({
            ...t,
            id: transactionIdMap.get(t.id) || t.id,
            portfolioId: portfolioIdMap.get(t.portfolioId) || t.portfolioId,
            accountId: accountIdMap.get(t.accountId) || t.accountId,
          }));

          // Update trackedSymbols keys
          if (state.trackedSymbols) {
            const newTrackedSymbols: Record<string, string[]> = {};
            for (const [portfolioId, symbols] of Object.entries(state.trackedSymbols)) {
              const newId = portfolioIdMap.get(portfolioId) || portfolioId;
              newTrackedSymbols[newId] = symbols;
            }
            state.trackedSymbols = newTrackedSymbols;
          }

          // Update activePortfolioId if needed
          if (state.activePortfolioId && portfolioIdMap.has(state.activePortfolioId)) {
            state.activePortfolioId = portfolioIdMap.get(state.activePortfolioId)!;
          }

          console.log("[Migration] Converted IDs to UUIDs:", {
            portfolios: portfolioIdMap.size,
            accounts: accountIdMap.size,
            transactions: transactionIdMap.size,
          });
        }

        // v6 → v7: Add symbolNotes storage
        if (version < 7) {
          if (!state.symbolNotes) {
            state.symbolNotes = {};
          }
        }

        // v7 → v8: Add watchlistSymbols (per-portfolio watchlist)
        if (version < 8) {
          if (!state.watchlistSymbols) {
            state.watchlistSymbols = {};
          }
        }

        return state;
      },
      version: 8,
    }
  )
);

// Convenience hook for getting current holdings (for backward compatibility)
export function useCurrentHoldings(): Holding[] {
  return usePortfolioStore((state) => state.getActiveHoldings());
}

// Convenience hook for getting current transactions
export function useCurrentTransactions(): Transaction[] {
  return usePortfolioStore((state) => state.getActiveTransactions());
}
