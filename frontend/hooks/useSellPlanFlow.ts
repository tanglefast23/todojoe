"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { useSellPlanStore, SellPlan, BuyAllocation, AccountAllocation as StoreAccountAllocation } from "@/stores/sellPlanStore";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { formatCurrency } from "@/lib/formatters";
import { isCryptoSymbol } from "@/lib/assetUtils";
import { multiply, divide } from "@/lib/decimal";
import { formatShares, roundShares } from "@/lib/sellPlanningUtils";

// ============================================================================
// Types
// ============================================================================

export type Step = "idle" | "symbol" | "percentage" | "accounts" | "buySymbolsForAccount" | "buyAllocationForAccount";

/** Local planning state for account allocation (doesn't include buyAllocations yet) */
export interface PlanningAccountAllocation {
  accountId: string;
  accountName: string;
  available: number;
  toSell: number;
}

/** Account with symbol holding info */
export interface AccountWithHolding {
  id: string;
  name: string;
  quantity: number;
}

/** Return type for the hook */
export interface SellPlanFlowReturn {
  // Core state
  step: Step;
  mounted: boolean;
  isLoading: boolean;
  error: string | null;

  // Symbol selection
  symbolInput: string;
  selectedSymbol: string | null;
  selectedPlainSymbol: string | null;
  showAutocomplete: boolean;
  filteredSymbols: string[];
  symbolInputRef: React.RefObject<HTMLInputElement | null>;

  // Percentage input
  percentageInput: string;
  percentageInputRef: React.RefObject<HTMLInputElement | null>;

  // Account allocations
  accountAllocations: PlanningAccountAllocation[];
  accountsWithSymbol: AccountWithHolding[];
  neededShares: number;
  totalAllocated: number;
  remaining: number;

  // Buy configuration (per-account)
  currentAccountIndex: number;
  currentSellingAccount: PlanningAccountAllocation | null;
  sellingAccounts: PlanningAccountAllocation[];
  buySymbolInput: string;
  showBuyAutocomplete: boolean;
  filteredBuySymbols: string[];
  buySymbolInputRef: React.RefObject<HTMLInputElement | null>;
  currentAccountBuySymbolsList: string[];
  currentAccountBuyPercentagesMap: Record<string, string>;
  currentAccountTotalBuyPercentage: number;

  // Data
  symbols: string[];
  symbolTypes: Record<string, "stock" | "crypto" | "both">;
  totals: Record<string, number>;
  priceMap: Record<string, number>;
  totalPortfolioValue: number;
  activePortfolioId: string | null;

  // Actions
  handleNewPlan: () => void;
  handleSymbolChange: (value: string) => void;
  handleSymbolSelect: (symbol?: string) => void;
  handleSymbolKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePercentageConfirm: (directPercentage?: number) => void;
  handleSellAll: () => void;
  handlePercentageKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleAllocationChange: (accountId: string, value: string) => void;
  handleAutoFill: (accountId: string) => void;
  handleAccountsConfirm: () => void;
  handleAllocationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, accountId: string) => void;
  handleBuySymbolChange: (value: string) => void;
  handleBuySymbolSelectForAccount: (symbol?: string) => void;
  handleRemoveBuySymbol: (symbolToRemove: string) => void;
  handleBuyPercentageChange: (symbol: string, value: string) => void;
  handleBuyAllocationConfirmForAccount: () => void;
  handleBuyPercentageKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, currentSymbol: string) => void;
  handleBuySymbolKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleCancel: () => void;
  setPercentageInput: (value: string) => void;
  setShowAutocomplete: (show: boolean) => void;
  setShowBuyAutocomplete: (show: boolean) => void;

  // Utilities
  getPlainSymbol: (compositeKey: string) => string;
  formatShares: (shares: number, symbol: string) => string;
  roundShares: (shares: number, symbol: string) => number;
  isCrypto: (symbol: string) => boolean;
}

// Local alias for backwards compatibility with hook return type
const isCrypto = isCryptoSymbol;

// ============================================================================
// Hook
// ============================================================================

export function useSellPlanFlow(): SellPlanFlowReturn {
  // -------------------------------------------------------------------------
  // Hydration guard
  // -------------------------------------------------------------------------
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // -------------------------------------------------------------------------
  // Store access
  // -------------------------------------------------------------------------
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const getQuickOverviewGrid = usePortfolioStore((state) => state.getQuickOverviewGrid);
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);
  const addPlan = useSellPlanStore((state) => state.addPlan);

  // Helper: look up which portfolio contains a given account
  const getPortfolioIdForAccount = useCallback((accountId: string): string | undefined => {
    for (const portfolio of portfolios) {
      if (portfolio.accounts.some((acc) => acc.id === accountId)) {
        return portfolio.id;
      }
    }
    return undefined;
  }, [portfolios]);

  const gridData = getQuickOverviewGrid(activePortfolioId);
  const { symbols, symbolTypes, accounts, totals } = gridData;

  // -------------------------------------------------------------------------
  // Helper: extract plain symbol from composite key (e.g., "MU" from "MU-stock")
  // -------------------------------------------------------------------------
  const getPlainSymbol = useCallback((compositeKey: string): string => {
    const lastDashIndex = compositeKey.lastIndexOf("-");
    return lastDashIndex > 0 ? compositeKey.substring(0, lastDashIndex) : compositeKey;
  }, []);

  // -------------------------------------------------------------------------
  // Separate stocks and crypto for price fetching
  // -------------------------------------------------------------------------
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocks: string[] = [];
    const crypto: string[] = [];
    symbols.forEach((key) => {
      const plainSymbol = getPlainSymbol(key);
      const assetType = symbolTypes[key];
      if (assetType === "crypto") {
        crypto.push(plainSymbol);
      } else {
        stocks.push(plainSymbol);
      }
    });
    return { stockSymbols: stocks, cryptoSymbols: crypto };
  }, [symbols, symbolTypes, getPlainSymbol]);

  const stocksQuery = useBatchStockQuotes(stockSymbols, stockSymbols.length > 0);
  const cryptoQuery = useBatchCryptoQuotes(cryptoSymbols, cryptoSymbols.length > 0);

  // -------------------------------------------------------------------------
  // Price map
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Total portfolio value
  // -------------------------------------------------------------------------
  const totalPortfolioValue = useMemo(() => {
    let total = 0;
    symbols.forEach((symbolKey) => {
      const plainSymbol = getPlainSymbol(symbolKey);
      total += (totals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
    });
    return total;
  }, [symbols, totals, priceMap, getPlainSymbol]);

  // -------------------------------------------------------------------------
  // Core state
  // -------------------------------------------------------------------------
  const [step, setStep] = useState<Step>("idle");
  const [symbolInput, setSymbolInput] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [percentageInput, setPercentageInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [accountAllocations, setAccountAllocations] = useState<PlanningAccountAllocation[]>([]);

  // Per-account buy configuration
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [buySymbolInput, setBuySymbolInput] = useState("");
  const [showBuyAutocomplete, setShowBuyAutocomplete] = useState(false);
  const [accountBuySymbols, setAccountBuySymbols] = useState<Record<string, string[]>>({});
  const [accountBuyPercentages, setAccountBuyPercentages] = useState<Record<string, Record<string, string>>>({});

  // Refs
  const symbolInputRef = useRef<HTMLInputElement>(null);
  const percentageInputRef = useRef<HTMLInputElement>(null);
  const buySymbolInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Derived: selected plain symbol
  // -------------------------------------------------------------------------
  const selectedPlainSymbol = useMemo(() => {
    return selectedSymbol ? getPlainSymbol(selectedSymbol) : null;
  }, [selectedSymbol, getPlainSymbol]);

  // -------------------------------------------------------------------------
  // Derived: filtered symbols for autocomplete
  // -------------------------------------------------------------------------
  const filteredSymbols = useMemo(() => {
    if (!symbolInput.trim()) return symbols;
    const input = symbolInput.toUpperCase();
    return symbols.filter((s) => s.toUpperCase().includes(input));
  }, [symbols, symbolInput]);

  const filteredBuySymbols = useMemo(() => {
    if (!buySymbolInput.trim()) return symbols;
    const input = buySymbolInput.toUpperCase();
    return symbols.filter((s) => s.toUpperCase().includes(input));
  }, [symbols, buySymbolInput]);

  // -------------------------------------------------------------------------
  // Derived: selling accounts
  // -------------------------------------------------------------------------
  const sellingAccounts = useMemo(() => {
    return accountAllocations.filter((a) => a.toSell > 0);
  }, [accountAllocations]);

  const currentSellingAccount = useMemo(() => {
    return sellingAccounts[currentAccountIndex] || null;
  }, [sellingAccounts, currentAccountIndex]);

  // -------------------------------------------------------------------------
  // Derived: current account's buy configuration
  // -------------------------------------------------------------------------
  const currentAccountBuySymbolsList = useMemo(() => {
    if (!currentSellingAccount) return [];
    return accountBuySymbols[currentSellingAccount.accountId] || [];
  }, [currentSellingAccount, accountBuySymbols]);

  const currentAccountBuyPercentagesMap = useMemo(() => {
    if (!currentSellingAccount) return {};
    return accountBuyPercentages[currentSellingAccount.accountId] || {};
  }, [currentSellingAccount, accountBuyPercentages]);

  const currentAccountTotalBuyPercentage = useMemo(() => {
    return Object.values(currentAccountBuyPercentagesMap).reduce(
      (sum, pct) => sum + (parseFloat(pct) || 0),
      0
    );
  }, [currentAccountBuyPercentagesMap]);

  // -------------------------------------------------------------------------
  // Derived: accounts with the selected symbol
  // -------------------------------------------------------------------------
  const accountsWithSymbol = useMemo((): AccountWithHolding[] => {
    if (!selectedSymbol) return [];
    return accounts
      .filter((account) => (account.holdings[selectedSymbol] || 0) > 0)
      .map((account) => ({
        id: account.id,
        name: account.name,
        quantity: account.holdings[selectedSymbol] || 0,
      }));
  }, [selectedSymbol, accounts]);

  // -------------------------------------------------------------------------
  // Derived: needed shares and remaining
  // -------------------------------------------------------------------------
  const { neededShares, totalAllocated, remaining } = useMemo(() => {
    if (!selectedSymbol) return { neededShares: 0, totalAllocated: 0, remaining: 0 };

    const percentage = parseFloat(percentageInput) || 0;
    const currentPrice = priceMap[selectedPlainSymbol || ""] || 0;
    const dollarAmount = totalPortfolioValue * (percentage / 100);
    const rawNeeded = currentPrice > 0 ? dollarAmount / currentPrice : 0;
    const needed = roundShares(rawNeeded, selectedSymbol);
    const allocated = accountAllocations.reduce((sum, a) => sum + a.toSell, 0);

    return {
      neededShares: needed,
      totalAllocated: allocated,
      remaining: needed - allocated,
    };
  }, [selectedSymbol, percentageInput, priceMap, selectedPlainSymbol, totalPortfolioValue, accountAllocations]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  const isLoading = stocksQuery.isLoading || cryptoQuery.isLoading;

  // -------------------------------------------------------------------------
  // Keyboard shortcut: "s" to start sell flow
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key.toLowerCase() === "s" && !isInput && step === "idle") {
        e.preventDefault();
        setStep("symbol");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  // -------------------------------------------------------------------------
  // Global Escape key listener
  // -------------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    setStep("idle");
    setSymbolInput("");
    setSelectedSymbol(null);
    setPercentageInput("");
    setError(null);
    setShowAutocomplete(false);
    setAccountAllocations([]);
    setCurrentAccountIndex(0);
    setBuySymbolInput("");
    setShowBuyAutocomplete(false);
    setAccountBuySymbols({});
    setAccountBuyPercentages({});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "idle") {
        e.preventDefault();
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [step, handleCancel]);

  // -------------------------------------------------------------------------
  // Action: Start new plan
  // -------------------------------------------------------------------------
  const handleNewPlan = useCallback(() => {
    setStep("symbol");
    setError(null);
    setSymbolInput("");
    setSelectedSymbol(null);
    setPercentageInput("");
    setAccountAllocations([]);
    setCurrentAccountIndex(0);
    setBuySymbolInput("");
    setShowBuyAutocomplete(false);
    setAccountBuySymbols({});
    setAccountBuyPercentages({});
    // Longer timeout to ensure the SymbolSelector component is fully mounted
    // (especially important when triggered via keyboard shortcut)
    setTimeout(() => symbolInputRef.current?.focus(), 150);
  }, []);

  // -------------------------------------------------------------------------
  // Action: Symbol input change
  // -------------------------------------------------------------------------
  const handleSymbolChange = useCallback((value: string) => {
    setSymbolInput(value.toUpperCase());
    setShowAutocomplete(true);
    setError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Action: Symbol selection
  // -------------------------------------------------------------------------
  const handleSymbolSelect = useCallback((symbol?: string) => {
    const toSelect = symbol || filteredSymbols[0];

    if (!toSelect && symbolInput.trim()) {
      setError(`You don't own any ${symbolInput.toUpperCase()}`);
      return;
    }

    if (!toSelect) {
      setError("Please enter a symbol");
      return;
    }

    if (!symbols.includes(toSelect)) {
      setError(`You don't own any ${symbolInput.toUpperCase() || toSelect}`);
      return;
    }

    setSelectedSymbol(toSelect);
    setSymbolInput(toSelect);
    setShowAutocomplete(false);
    setStep("percentage");
    setError(null);
    setTimeout(() => percentageInputRef.current?.focus(), 50);
  }, [filteredSymbols, symbols, symbolInput]);

  // -------------------------------------------------------------------------
  // Action: Symbol keydown
  // -------------------------------------------------------------------------
  const handleSymbolKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      handleSymbolSelect();
    } else if (e.key === "Escape") {
      setStep("idle");
      setShowAutocomplete(false);
    }
  }, [handleSymbolSelect]);

  // -------------------------------------------------------------------------
  // Action: Percentage confirmation
  // -------------------------------------------------------------------------
  const handlePercentageConfirm = useCallback((directPercentage?: number) => {
    // Use direct percentage if provided (from quick buttons), otherwise use state
    const percentage = directPercentage !== undefined ? directPercentage : parseFloat(percentageInput);

    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      setError("Please enter a valid percentage between 0 and 100");
      return;
    }

    if (!selectedSymbol) return;

    const currentPrice = priceMap[selectedPlainSymbol || ""] || 0;
    const dollarAmount = totalPortfolioValue * (percentage / 100);
    const rawSharesToSell = currentPrice > 0 ? dollarAmount / currentPrice : 0;
    const sharesToSell = roundShares(rawSharesToSell, selectedSymbol);
    const totalShares = totals[selectedSymbol] || 0;

    if (sharesToSell > totalShares) {
      setError(`You only own ${totalShares.toFixed(2)} shares. That's worth ${formatCurrency(totalShares * currentPrice)} (${((totalShares * currentPrice / totalPortfolioValue) * 100).toFixed(2)}% of portfolio)`);
      return;
    }

    const initialAllocations: PlanningAccountAllocation[] = accountsWithSymbol.map((acc) => ({
      accountId: acc.id,
      accountName: acc.name,
      available: acc.quantity,
      toSell: 0,
    }));

    // Auto-skip account selection if only one account with enough shares
    if (accountsWithSymbol.length === 1 && accountsWithSymbol[0].quantity >= sharesToSell) {
      const autoFilledAllocations: PlanningAccountAllocation[] = [{
        accountId: accountsWithSymbol[0].id,
        accountName: accountsWithSymbol[0].name,
        available: accountsWithSymbol[0].quantity,
        toSell: sharesToSell,
      }];
      setAccountAllocations(autoFilledAllocations);
      setCurrentAccountIndex(0);
      setStep("buySymbolsForAccount");
      setError(null);
      setBuySymbolInput("");
      setShowBuyAutocomplete(false);
      setTimeout(() => buySymbolInputRef.current?.focus(), 50);
      return;
    }

    setAccountAllocations(initialAllocations);
    setStep("accounts");
    setError(null);
  }, [percentageInput, selectedSymbol, priceMap, selectedPlainSymbol, totalPortfolioValue, totals, accountsWithSymbol]);

  // -------------------------------------------------------------------------
  // Action: Sell ALL - fast track that fills all accounts and skips ahead
  // -------------------------------------------------------------------------
  const handleSellAll = useCallback(() => {
    if (!selectedSymbol) return;

    const currentPrice = priceMap[selectedPlainSymbol || ""] || 0;
    if (currentPrice <= 0) return;

    // Calculate 100% of this holding
    const holdingsValue = (totals[selectedSymbol] || 0) * currentPrice;
    const pct = multiply(divide(holdingsValue, totalPortfolioValue), 100);
    setPercentageInput(pct.toFixed(2));

    // Fill ALL accounts with their maximum available shares
    const autoFilledAllocations: PlanningAccountAllocation[] = accountsWithSymbol.map((acc) => ({
      accountId: acc.id,
      accountName: acc.name,
      available: acc.quantity,
      toSell: acc.quantity, // Fill to max
    }));

    setAccountAllocations(autoFilledAllocations);
    setCurrentAccountIndex(0);
    setStep("buySymbolsForAccount");
    setError(null);
    setBuySymbolInput("");
    setShowBuyAutocomplete(false);
    setTimeout(() => buySymbolInputRef.current?.focus(), 50);
  }, [selectedSymbol, priceMap, selectedPlainSymbol, totals, totalPortfolioValue, accountsWithSymbol]);

  // -------------------------------------------------------------------------
  // Action: Percentage keydown
  // -------------------------------------------------------------------------
  const handlePercentageKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      handlePercentageConfirm();
    } else if (e.key === "Escape") {
      setStep("idle");
    } else if (e.key === "a" || e.key === "A") {
      // "A" key = Sell ALL - fast track that fills all accounts and skips ahead
      e.preventDefault();
      handleSellAll();
    }
  }, [handlePercentageConfirm, handleSellAll]);

  // -------------------------------------------------------------------------
  // Action: Account allocation change
  // -------------------------------------------------------------------------
  const handleAllocationChange = useCallback((accountId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const roundedValue = selectedSymbol ? roundShares(numValue, selectedSymbol) : numValue;
    setAccountAllocations((prev) =>
      prev.map((a) =>
        a.accountId === accountId
          ? { ...a, toSell: Math.min(roundedValue, a.available) }
          : a
      )
    );
    setError(null);
  }, [selectedSymbol]);

  // -------------------------------------------------------------------------
  // Action: Auto-fill remaining shares
  // -------------------------------------------------------------------------
  const handleAutoFill = useCallback((accountId: string) => {
    const account = accountAllocations.find((a) => a.accountId === accountId);
    if (!account || !selectedSymbol) return;

    const toAdd = Math.min(remaining, account.available - account.toSell);
    if (toAdd > 0) {
      const newValue = roundShares(account.toSell + toAdd, selectedSymbol);
      setAccountAllocations((prev) =>
        prev.map((a) =>
          a.accountId === accountId ? { ...a, toSell: Math.min(newValue, a.available) } : a
        )
      );
    }
  }, [accountAllocations, remaining, selectedSymbol]);

  // -------------------------------------------------------------------------
  // Action: Accounts confirmation
  // -------------------------------------------------------------------------
  const handleAccountsConfirm = useCallback(() => {
    if (remaining > 0.01) {
      setError(`You still need to allocate ${remaining.toFixed(2)} more shares`);
      return;
    }

    if (!selectedSymbol) return;

    setCurrentAccountIndex(0);
    setStep("buySymbolsForAccount");
    setError(null);
    setBuySymbolInput("");
    setShowBuyAutocomplete(false);
    setTimeout(() => buySymbolInputRef.current?.focus(), 50);
  }, [remaining, selectedSymbol]);

  // -------------------------------------------------------------------------
  // Action: Allocation keydown (auto-fill next account)
  // -------------------------------------------------------------------------
  const handleAllocationKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, accountId: string) => {
    if (e.key === "Escape") {
      setStep("idle");
      return;
    }

    if (e.key === "Tab" || e.key === "Enter") {
      const currentTotal = accountAllocations.reduce((sum, a) => sum + a.toSell, 0);
      const stillNeeded = neededShares - currentTotal;

      if (stillNeeded > 0.01) {
        const currentIndex = accountAllocations.findIndex((a) => a.accountId === accountId);

        for (let i = currentIndex + 1; i < accountAllocations.length; i++) {
          const nextAccount = accountAllocations[i];
          if (nextAccount.available > nextAccount.toSell) {
            const toFill = Math.min(stillNeeded, nextAccount.available - nextAccount.toSell);
            if (toFill > 0 && selectedSymbol) {
              const newValue = roundShares(nextAccount.toSell + toFill, selectedSymbol);
              setAccountAllocations((prev) =>
                prev.map((a) =>
                  a.accountId === nextAccount.accountId
                    ? { ...a, toSell: Math.min(newValue, a.available) }
                    : a
                )
              );
            }
            break;
          }
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleAccountsConfirm();
      }
    }
  }, [accountAllocations, neededShares, selectedSymbol, handleAccountsConfirm]);

  // -------------------------------------------------------------------------
  // Action: Buy symbol input change
  // -------------------------------------------------------------------------
  const handleBuySymbolChange = useCallback((value: string) => {
    setBuySymbolInput(value.toUpperCase());
    setShowBuyAutocomplete(true);
    setError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Helper: Parse comma/space separated symbols
  // -------------------------------------------------------------------------
  const parseSymbolInput = useCallback((input: string): string[] => {
    const parsedSymbols = input
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    return [...new Set(parsedSymbols)];
  }, []);

  // -------------------------------------------------------------------------
  // Helper: Move to next account or create plan
  // -------------------------------------------------------------------------
  const moveToNextAccountOrCreatePlan = useCallback((pendingBuyConfig?: {
    accountId: string;
    symbols: string[];
    percentages: Record<string, string>;
  }) => {
    if (!selectedSymbol) return;

    const nextIndex = currentAccountIndex + 1;

    if (nextIndex < sellingAccounts.length) {
      setCurrentAccountIndex(nextIndex);
      setStep("buySymbolsForAccount");
      setBuySymbolInput("");
      setShowBuyAutocomplete(false);
      setError(null);
      setTimeout(() => buySymbolInputRef.current?.focus(), 50);
    } else {
      // All accounts configured - create the plan
      const percentage = parseFloat(percentageInput);
      const currentPrice = priceMap[selectedPlainSymbol || ""] || 0;
      const dollarAmount = totalPortfolioValue * (percentage / 100);
      const totalShares = totals[selectedSymbol] || 0;
      const symbolValue = totalShares * currentPrice;
      const portfolioAllocation = totalPortfolioValue > 0 ? (symbolValue / totalPortfolioValue) * 100 : 0;
      const percentOfHolding = totalShares > 0 ? (totalAllocated / totalShares) * 100 : 0;

      const mergedBuySymbols = pendingBuyConfig
        ? { ...accountBuySymbols, [pendingBuyConfig.accountId]: pendingBuyConfig.symbols }
        : accountBuySymbols;
      const mergedBuyPercentages = pendingBuyConfig
        ? { ...accountBuyPercentages, [pendingBuyConfig.accountId]: pendingBuyConfig.percentages }
        : accountBuyPercentages;

      const finalAccountAllocations: StoreAccountAllocation[] = sellingAccounts.map((acc) => {
        const accBuySymbols = mergedBuySymbols[acc.accountId] || [];
        const accBuyPercentages = mergedBuyPercentages[acc.accountId] || {};
        const accSellProceeds = acc.toSell * currentPrice;

        const buyAllocations: BuyAllocation[] = accBuySymbols.map((symbol) => {
          const pct = parseFloat(accBuyPercentages[symbol]) || 0;
          // Extract plain symbol from composite key (e.g., "COIN" from "COIN-crypto")
          const plainSymbol = getPlainSymbol(symbol);
          // Check if original was crypto or if plain symbol looks like crypto
          const isSymbolCrypto = symbol.endsWith("-crypto") || isCrypto(plainSymbol);
          return {
            symbol: plainSymbol, // Store plain symbol, not composite key
            percentage: pct,
            dollarAmount: accSellProceeds * (pct / 100),
            assetType: isSymbolCrypto ? "crypto" : "stock",
          };
        });

        return {
          accountId: acc.accountId,
          accountName: acc.accountName,
          available: acc.available,
          toSell: acc.toSell,
          buyAllocations,
        };
      });

      // Extract plain symbol for storage (composite key -> plain symbol)
      const sellPlainSymbol = getPlainSymbol(selectedSymbol);
      const isSellCrypto = selectedSymbol.endsWith("-crypto") || isCrypto(sellPlainSymbol);

      // Resolve the actual portfolioId from the first account allocation
      // This is important when in combined view - we need the real portfolio ID, not the combined group ID
      const firstAccountId = finalAccountAllocations[0]?.accountId;
      const resolvedPortfolioId = firstAccountId
        ? getPortfolioIdForAccount(firstAccountId)
        : activePortfolioId;

      const plan: SellPlan = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol: sellPlainSymbol, // Store plain symbol, not composite key
        percentage,
        dollarAmount,
        sharesToSell: totalAllocated,
        currentPrice,
        totalShares,
        portfolioAllocation,
        percentOfHolding,
        accountAllocations: finalAccountAllocations,
        portfolioId: resolvedPortfolioId ?? undefined,
        assetType: isSellCrypto ? "crypto" : "stock",
        ownerId: getActiveOwnerId() || undefined,
      };

      addPlan(plan);
      setStep("idle");
      setError(null);
      setSymbolInput("");
      setSelectedSymbol(null);
      setPercentageInput("");
      setAccountAllocations([]);
      setCurrentAccountIndex(0);
      setBuySymbolInput("");
      setShowBuyAutocomplete(false);
      setAccountBuySymbols({});
      setAccountBuyPercentages({});
    }
  }, [
    selectedSymbol, currentAccountIndex, sellingAccounts, percentageInput,
    priceMap, selectedPlainSymbol, totalPortfolioValue, totals, totalAllocated,
    accountBuySymbols, accountBuyPercentages, activePortfolioId, addPlan, getActiveOwnerId,
    getPortfolioIdForAccount,
  ]);

  // -------------------------------------------------------------------------
  // Action: Buy symbol selection for current account
  // -------------------------------------------------------------------------
  const handleBuySymbolSelectForAccount = useCallback((symbol?: string) => {
    if (!currentSellingAccount) return;

    const accountId = currentSellingAccount.accountId;
    const existingSymbols = accountBuySymbols[accountId] || [];

    const inputSymbols = symbol
      ? [symbol.toUpperCase()]
      : parseSymbolInput(buySymbolInput);

    if (inputSymbols.length === 0) {
      setError("Please enter at least one symbol to buy");
      return;
    }

    const allSymbols = [...new Set([...existingSymbols, ...inputSymbols])];

    setAccountBuySymbols((prev) => ({
      ...prev,
      [accountId]: allSymbols,
    }));

    // If only 1 symbol, auto-set 100% and move to next account or create plan
    if (allSymbols.length === 1) {
      const newPercentages = { [allSymbols[0]]: "100" };
      setAccountBuyPercentages((prev) => ({
        ...prev,
        [accountId]: newPercentages,
      }));
      setBuySymbolInput("");
      setShowBuyAutocomplete(false);

      if (currentAccountIndex + 1 >= sellingAccounts.length) {
        moveToNextAccountOrCreatePlan({
          accountId,
          symbols: allSymbols,
          percentages: newPercentages,
        });
      } else {
        setCurrentAccountIndex((prev) => prev + 1);
        setStep("buySymbolsForAccount");
        setError(null);
        setTimeout(() => buySymbolInputRef.current?.focus(), 50);
      }
      return;
    }

    // Multiple symbols - go to allocation step
    const equalPct = Math.floor(100 / allSymbols.length);
    const initialPercentages: Record<string, string> = {};
    allSymbols.forEach((s, i) => {
      initialPercentages[s] = i === allSymbols.length - 1
        ? (100 - equalPct * (allSymbols.length - 1)).toString()
        : equalPct.toString();
    });
    setAccountBuyPercentages((prev) => ({
      ...prev,
      [accountId]: initialPercentages,
    }));

    setBuySymbolInput("");
    setShowBuyAutocomplete(false);
    setStep("buyAllocationForAccount");
    setError(null);
  }, [
    currentSellingAccount, accountBuySymbols, buySymbolInput, parseSymbolInput,
    currentAccountIndex, sellingAccounts.length, moveToNextAccountOrCreatePlan,
  ]);

  // -------------------------------------------------------------------------
  // Action: Remove buy symbol from current account
  // -------------------------------------------------------------------------
  const handleRemoveBuySymbol = useCallback((symbolToRemove: string) => {
    if (!currentSellingAccount) return;
    const accountId = currentSellingAccount.accountId;

    setAccountBuySymbols((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] || []).filter((s) => s !== symbolToRemove),
    }));
  }, [currentSellingAccount]);

  // -------------------------------------------------------------------------
  // Action: Buy percentage change for current account
  // -------------------------------------------------------------------------
  const handleBuyPercentageChange = useCallback((symbol: string, value: string) => {
    if (!currentSellingAccount) return;
    const accountId = currentSellingAccount.accountId;

    setAccountBuyPercentages((prev) => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || {}),
        [symbol]: value,
      },
    }));
    setError(null);
  }, [currentSellingAccount]);

  // -------------------------------------------------------------------------
  // Action: Confirm buy allocations for current account
  // -------------------------------------------------------------------------
  const handleBuyAllocationConfirmForAccount = useCallback(() => {
    if (Math.abs(currentAccountTotalBuyPercentage - 100) > 0.01) {
      setError(`Percentages must add up to 100% (currently ${currentAccountTotalBuyPercentage.toFixed(1)}%)`);
      return;
    }

    moveToNextAccountOrCreatePlan();
  }, [currentAccountTotalBuyPercentage, moveToNextAccountOrCreatePlan]);

  // -------------------------------------------------------------------------
  // Global Enter key listener for allocation step
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && step === "buyAllocationForAccount" && Math.abs(currentAccountTotalBuyPercentage - 100) <= 0.01) {
        e.preventDefault();
        handleBuyAllocationConfirmForAccount();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [step, currentAccountTotalBuyPercentage, handleBuyAllocationConfirmForAccount]);

  // -------------------------------------------------------------------------
  // Action: Buy percentage keydown (auto-balance)
  // -------------------------------------------------------------------------
  const handleBuyPercentageKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, currentSymbol: string) => {
    if (e.key === "Escape") {
      setStep("idle");
      return;
    }

    if (!currentSellingAccount) return;
    const accountId = currentSellingAccount.accountId;
    const buySymbolsList = currentAccountBuySymbolsList;
    const percentagesMap = currentAccountBuyPercentagesMap;

    if (e.key === "Tab" || e.key === "Enter") {
      const symbolIndex = buySymbolsList.indexOf(currentSymbol);
      const remainingSymbols = buySymbolsList.slice(symbolIndex + 1);

      if (remainingSymbols.length > 0) {
        let allocatedTotal = 0;
        buySymbolsList.slice(0, symbolIndex + 1).forEach((s) => {
          allocatedTotal += parseFloat(percentagesMap[s]) || 0;
        });

        const remainingPercentage = Math.max(0, 100 - allocatedTotal);
        const perSymbol = Math.floor(remainingPercentage / remainingSymbols.length);
        const lastSymbolExtra = remainingPercentage - (perSymbol * remainingSymbols.length);

        setAccountBuyPercentages((prev) => {
          const updated = prev[accountId] ? { ...prev[accountId] } : {};
          remainingSymbols.forEach((s, i) => {
            const value = i === remainingSymbols.length - 1
              ? perSymbol + lastSymbolExtra
              : perSymbol;
            updated[s] = value.toString();
          });
          return { ...prev, [accountId]: updated };
        });
      } else if (e.key === "Enter" && Math.abs(currentAccountTotalBuyPercentage - 100) <= 0.01) {
        e.preventDefault();
        handleBuyAllocationConfirmForAccount();
      }
    }
  }, [currentSellingAccount, currentAccountBuySymbolsList, currentAccountBuyPercentagesMap, currentAccountTotalBuyPercentage, handleBuyAllocationConfirmForAccount]);

  // -------------------------------------------------------------------------
  // Action: Buy symbol keydown
  // -------------------------------------------------------------------------
  const handleBuySymbolKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      handleBuySymbolSelectForAccount();
    } else if (e.key === "Escape") {
      setStep("idle");
      setShowBuyAutocomplete(false);
    }
  }, [handleBuySymbolSelectForAccount]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    // Core state
    step,
    mounted,
    isLoading,
    error,

    // Symbol selection
    symbolInput,
    selectedSymbol,
    selectedPlainSymbol,
    showAutocomplete,
    filteredSymbols,
    symbolInputRef,

    // Percentage input
    percentageInput,
    percentageInputRef,

    // Account allocations
    accountAllocations,
    accountsWithSymbol,
    neededShares,
    totalAllocated,
    remaining,

    // Buy configuration
    currentAccountIndex,
    currentSellingAccount,
    sellingAccounts,
    buySymbolInput,
    showBuyAutocomplete,
    filteredBuySymbols,
    buySymbolInputRef,
    currentAccountBuySymbolsList,
    currentAccountBuyPercentagesMap,
    currentAccountTotalBuyPercentage,

    // Data
    symbols,
    symbolTypes,
    totals,
    priceMap,
    totalPortfolioValue,
    activePortfolioId,

    // Actions
    handleNewPlan,
    handleSymbolChange,
    handleSymbolSelect,
    handleSymbolKeyDown,
    handlePercentageConfirm,
    handleSellAll,
    handlePercentageKeyDown,
    handleAllocationChange,
    handleAutoFill,
    handleAccountsConfirm,
    handleAllocationKeyDown,
    handleBuySymbolChange,
    handleBuySymbolSelectForAccount,
    handleRemoveBuySymbol,
    handleBuyPercentageChange,
    handleBuyAllocationConfirmForAccount,
    handleBuyPercentageKeyDown,
    handleBuySymbolKeyDown,
    handleCancel,
    setPercentageInput,
    setShowAutocomplete,
    setShowBuyAutocomplete,

    // Utilities
    getPlainSymbol,
    formatShares,
    roundShares,
    isCrypto,
  };
}
