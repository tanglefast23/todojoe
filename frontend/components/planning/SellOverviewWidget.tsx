"use client";

import { memo, useCallback, useState, useMemo, useEffect } from "react";
import { Check, TrendingUp, TrendingDown, X } from "lucide-react";
import { useSellPlanStore, playDingSound, SellPlan, AccountAllocation, BuyAllocation } from "@/stores/sellPlanStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useAllocationHistoryStore } from "@/stores/allocationHistoryStore";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isCryptoSymbol } from "@/lib/assetUtils";
import { formatShares } from "@/lib/sellPlanningUtils";

// Account color palette - each account gets a unique color
const ACCOUNT_COLORS = [
  { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
  { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/30" },
  { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
  { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-500/30" },
];

// Get consistent color for an account based on its ID
const getAccountColor = (accountId: string, allAccountIds: string[]) => {
  const index = allAccountIds.indexOf(accountId);
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
};

// Play a celebratory sound (more elaborate than the simple ding)
function playCelebrationSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Play a triumphant ascending arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const durations = [0.15, 0.15, 0.15, 0.4];
    let startTime = audioContext.currentTime;

    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(freq, startTime);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i]);

      oscillator.start(startTime);
      oscillator.stop(startTime + durations[i] + 0.1);

      // Add a harmonic for richness
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();

      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);

      oscillator2.frequency.setValueAtTime(freq * 2, startTime);
      oscillator2.type = "sine";

      gainNode2.gain.setValueAtTime(0, startTime);
      gainNode2.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i] * 0.7);

      oscillator2.start(startTime);
      oscillator2.stop(startTime + durations[i]);

      startTime += durations[i] * 0.8; // Slight overlap for smoothness
    });
  } catch {
    console.log("Audio playback not available");
  }
}

export const SellOverviewWidget = memo(function SellOverviewWidget() {
  // Prevent hydration mismatch - store has data on client but not server
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sellPlans = useSellPlanStore((state) => state.sellPlans);
  // Subscribe to the actual data (Sets) so component re-renders when they change
  const completedSellIds = useSellPlanStore((state) => state.completedSellIds);
  const completedBuyIds = useSellPlanStore((state) => state.completedBuyIds);
  const markPlanDone = useSellPlanStore((state) => state.markPlanDone);
  const markSellCompleted = useSellPlanStore((state) => state.markSellCompleted);
  const markBuyCompleted = useSellPlanStore((state) => state.markBuyCompleted);
  const removePlan = useSellPlanStore((state) => state.removePlan);
  const addTransaction = usePortfolioStore((state) => state.addTransaction);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const getQuickOverviewGrid = usePortfolioStore((state) => state.getQuickOverviewGrid);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const _transactions = usePortfolioStore((state) => state.transactions);
  const saveAllocationSnapshot = useAllocationHistoryStore((state) => state.saveSnapshot);

  // Get portfolio data for allocation calculation
  const gridData = getQuickOverviewGrid(activePortfolioId);
  const { symbols, symbolTypes, totals } = gridData;

  // Build a map of accountId -> current account name for dynamic lookup
  const accountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    portfolios.forEach((portfolio) => {
      portfolio.accounts.forEach((account) => {
        map[account.id] = account.name;
      });
    });
    return map;
  }, [portfolios]);

  // Build a map of accountId -> portfolioId for resolving which portfolio an account belongs to
  const accountToPortfolioMap = useMemo(() => {
    const map: Record<string, string> = {};
    portfolios.forEach((portfolio) => {
      portfolio.accounts.forEach((account) => {
        map[account.id] = portfolio.id;
      });
    });
    return map;
  }, [portfolios]);

  // Build a map of accountId -> portfolio name for display
  const accountToPortfolioNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    portfolios.forEach((portfolio) => {
      portfolio.accounts.forEach((account) => {
        map[account.id] = portfolio.name;
      });
    });
    return map;
  }, [portfolios]);

  // Helper to get the actual portfolio ID for an account (resolves combined group to real portfolio)
  const getPortfolioIdForAccount = useCallback((accountId: string, fallbackPortfolioId?: string): string => {
    return accountToPortfolioMap[accountId] || fallbackPortfolioId || "default";
  }, [accountToPortfolioMap]);

  // Helper to get portfolio name for an account
  const getPortfolioNameForAccount = useCallback((accountId: string): string | undefined => {
    return accountToPortfolioNameMap[accountId];
  }, [accountToPortfolioNameMap]);

  // Check if we're in a multi-portfolio context (combined view or combined group)
  const combinedGroups = usePortfolioStore((state) => state.combinedGroups);
  const isMultiPortfolioView = useMemo(() => {
    if (activePortfolioId === "combined") return true;
    // Check if activePortfolioId is a combined group ID
    return combinedGroups.some((g) => g.id === activePortfolioId);
  }, [activePortfolioId, combinedGroups]);

  // Format account label with portfolio name when in multi-portfolio view
  const getFullAccountLabel = useCallback((accountId: string, fallbackAccountName: string): string => {
    const accountName = accountNameMap[accountId] || fallbackAccountName;
    if (isMultiPortfolioView) {
      const portfolioName = accountToPortfolioNameMap[accountId];
      if (portfolioName) {
        return `${portfolioName} - ${accountName}`;
      }
    }
    return accountName;
  }, [accountNameMap, accountToPortfolioNameMap, isMultiPortfolioView]);

  // Helper to get current account name (falls back to stored name if not found)
  const getAccountName = useCallback((accountId: string, fallbackName: string): string => {
    return accountNameMap[accountId] || fallbackName;
  }, [accountNameMap]);

  // Helper to extract plain symbol from composite key (e.g., "MU" from "MU-stock")
  const getPlainSymbol = useCallback((compositeKey: string): string => {
    const lastDashIndex = compositeKey.lastIndexOf("-");
    return lastDashIndex > 0 ? compositeKey.substring(0, lastDashIndex) : compositeKey;
  }, []);

  // Filter sell plans to only show those for the current portfolio
  // "combined" view shows all plans, individual portfolios show only their own
  // NOTE: Defined early so we can include buy target symbols in price fetching
  const filteredSellPlans = useMemo(() => {
    if (activePortfolioId === "combined") {
      return sellPlans;
    }
    return sellPlans.filter((plan) => plan.portfolioId === activePortfolioId);
  }, [sellPlans, activePortfolioId]);

  // Separate stocks and crypto for price fetching
  // Symbols are composite keys like "MU-stock" - extract plain symbol for API
  // Also include buy target symbols from sell plans so we have their current prices
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocksSet = new Set<string>();
    const cryptoSet = new Set<string>();

    // Add portfolio symbols
    symbols.forEach((key) => {
      const plainSymbol = getPlainSymbol(key);
      const assetType = symbolTypes[key];

      if (assetType === "crypto") {
        cryptoSet.add(plainSymbol);
      } else {
        stocksSet.add(plainSymbol);
      }
    });

    // Add buy target symbols from sell plans
    filteredSellPlans.forEach((plan) => {
      plan.accountAllocations.forEach((acc) => {
        acc.buyAllocations.forEach((buyAlloc) => {
          if (buyAlloc.assetType === "crypto") {
            cryptoSet.add(buyAlloc.symbol);
          } else {
            stocksSet.add(buyAlloc.symbol);
          }
        });
      });
    });

    return { stockSymbols: Array.from(stocksSet), cryptoSymbols: Array.from(cryptoSet) };
  }, [symbols, symbolTypes, getPlainSymbol, filteredSellPlans]);

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

  // Calculate current allocations for snapshot saving
  const currentAllocations = useMemo(() => {
    let totalValue = 0;
    symbols.forEach((symbolKey) => {
      const plainSymbol = getPlainSymbol(symbolKey);
      totalValue += (totals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
    });
    const allocations: Record<string, number> = {};
    symbols.forEach((symbolKey) => {
      const plainSymbol = getPlainSymbol(symbolKey);
      const value = (totals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
      allocations[plainSymbol] = totalValue > 0 ? (value / totalValue) * 100 : 0;
    });
    return allocations;
  }, [symbols, totals, priceMap, getPlainSymbol]);

  // Helper functions that use the subscribed data
  const isSellCompleted = useCallback((planId: string, accountId: string) => {
    return completedSellIds.has(`${planId}:${accountId}`);
  }, [completedSellIds]);

  const isBuyCompleted = useCallback((planId: string, accountId: string, buySymbol: string) => {
    return completedBuyIds.has(`${planId}:${accountId}:${buySymbol}`);
  }, [completedBuyIds]);

  // State for buy flow - tracks shares input for each buy (keyed by planId:accountId:buySymbol)
  const [buySharesMap, setBuySharesMap] = useState<Record<string, string>>({});

  // State for celebration animation
  const [celebratingPlanIds, setCelebratingPlanIds] = useState<Set<string>>(new Set());
  const [fadingPlanIds, setFadingPlanIds] = useState<Set<string>>(new Set());

  // Collect all unique account IDs across filtered plans for consistent coloring
  const allAccountIds = useMemo(() => {
    const ids = new Set<string>();
    filteredSellPlans.forEach((plan) => {
      plan.accountAllocations.forEach((acc) => {
        ids.add(acc.accountId);
      });
    });
    return Array.from(ids);
  }, [filteredSellPlans]);

  // Check if a plan is fully completed (all sells + all buys for all accounts)
  const isPlanFullyCompleted = useCallback((plan: SellPlan): boolean => {
    // Check all account sells
    const allSellsDone = plan.accountAllocations.every((acc) =>
      isSellCompleted(plan.id, acc.accountId)
    );
    // Check all account buys
    const allBuysDone = plan.accountAllocations.every((acc) =>
      acc.buyAllocations.every((ba) =>
        isBuyCompleted(plan.id, acc.accountId, ba.symbol)
      )
    );
    return allSellsDone && allBuysDone;
  }, [isSellCompleted, isBuyCompleted]);

  // Trigger celebration when a plan becomes fully completed
  const triggerCelebration = useCallback((planId: string) => {
    // Play celebration sound
    playCelebrationSound();

    // Save allocation snapshot for historical tracking
    saveAllocationSnapshot(currentAllocations, activePortfolioId);

    // Start celebration animation
    setCelebratingPlanIds((prev) => new Set([...prev, planId]));

    // After celebration, start fading
    setTimeout(() => {
      setFadingPlanIds((prev) => new Set([...prev, planId]));
    }, 1500);

    // After fade, remove the plan
    setTimeout(() => {
      markPlanDone(planId);
      setCelebratingPlanIds((prev) => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
      setFadingPlanIds((prev) => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
    }, 2500);
  }, [markPlanDone, saveAllocationSnapshot, currentAllocations, activePortfolioId]);

  // Handle sell done for a specific account
  const handleSellDone = useCallback((plan: SellPlan, accountAlloc: AccountAllocation) => {
    // Don't process if already completed
    if (isSellCompleted(plan.id, accountAlloc.accountId)) return;

    // Play the ding sound
    playDingSound();

    // Mark as completed
    markSellCompleted(plan.id, accountAlloc.accountId);

    // Extract plain symbol from composite key (e.g., "AAPL" from "AAPL-stock")
    const plainSymbol = getPlainSymbol(plan.symbol);

    // Resolve the actual portfolio ID for this account
    // (plan.portfolioId might be a combined group ID, not a real portfolio)
    const actualPortfolioId = getPortfolioIdForAccount(accountAlloc.accountId, plan.portfolioId);

    // Create sell transaction for this account
    addTransaction(
      {
        symbol: plainSymbol,
        type: "sell",
        assetType: plan.assetType || "stock",
        quantity: accountAlloc.toSell,
        price: plan.currentPrice,
        date: new Date().toISOString(),
        notes: `Sell plan executed - ${plan.percentage}% of portfolio`,
      },
      actualPortfolioId,
      accountAlloc.accountId
    );

    // Check if plan is now fully completed (after a short delay to let state update)
    setTimeout(() => {
      // Recheck completion
      const allSellsDone = plan.accountAllocations.every((acc) =>
        acc.accountId === accountAlloc.accountId || isSellCompleted(plan.id, acc.accountId)
      );
      const allBuysDone = plan.accountAllocations.every((acc) =>
        acc.buyAllocations.every((ba) =>
          isBuyCompleted(plan.id, acc.accountId, ba.symbol)
        )
      );
      if (allSellsDone && allBuysDone) {
        triggerCelebration(plan.id);
      }
    }, 100);
  }, [isSellCompleted, isBuyCompleted, markSellCompleted, addTransaction, triggerCelebration, getPortfolioIdForAccount, getPlainSymbol]);

  // Handle buy shares input change
  const handleBuySharesChange = useCallback((buyKey: string, value: string) => {
    setBuySharesMap((prev) => ({ ...prev, [buyKey]: value }));
  }, []);

  // Complete buy transaction for a specific buy allocation
  const handleBuyDone = useCallback((plan: SellPlan, accountAlloc: AccountAllocation, buyAllocation: BuyAllocation) => {
    const buyKey = `${plan.id}:${accountAlloc.accountId}:${buyAllocation.symbol}`;
    const shares = parseFloat(buySharesMap[buyKey] || "0");
    if (isNaN(shares) || shares <= 0) return;
    if (isBuyCompleted(plan.id, accountAlloc.accountId, buyAllocation.symbol)) return;

    // Play the ding sound
    playDingSound();

    // Mark this specific buy as completed
    markBuyCompleted(plan.id, accountAlloc.accountId, buyAllocation.symbol);

    // Get current price for the buy symbol
    const currentBuyPrice = priceMap[buyAllocation.symbol] || 0;

    // Resolve the actual portfolio ID for this account
    // (plan.portfolioId might be a combined group ID, not a real portfolio)
    const actualPortfolioId = getPortfolioIdForAccount(accountAlloc.accountId, plan.portfolioId);

    // Create buy transaction with current market price
    addTransaction(
      {
        symbol: buyAllocation.symbol,
        type: "buy",
        assetType: buyAllocation.assetType,
        quantity: shares,
        price: currentBuyPrice,
        date: new Date().toISOString(),
        notes: `Buy from sell plan - ${plan.symbol} → ${buyAllocation.symbol} (${buyAllocation.percentage}% of ${getAccountName(accountAlloc.accountId, accountAlloc.accountName)})`,
      },
      actualPortfolioId,
      accountAlloc.accountId
    );

    // Check if plan is now fully completed (after a short delay)
    setTimeout(() => {
      const allSellsDone = plan.accountAllocations.every((acc) =>
        isSellCompleted(plan.id, acc.accountId)
      );
      const allBuysDone = plan.accountAllocations.every((acc) =>
        acc.buyAllocations.every((ba) =>
          isBuyCompleted(plan.id, acc.accountId, ba.symbol) ||
          (acc.accountId === accountAlloc.accountId && ba.symbol === buyAllocation.symbol)
        )
      );
      if (allSellsDone && allBuysDone) {
        triggerCelebration(plan.id);
      }
    }, 100);
  }, [buySharesMap, isBuyCompleted, markBuyCompleted, addTransaction, isSellCompleted, triggerCelebration, priceMap, getAccountName, getPortfolioIdForAccount]);

  // Return consistent empty state during SSR and initial mount
  if (!mounted || filteredSellPlans.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="text-sm font-medium text-muted-foreground mb-3">Upcoming Orders</div>
        <div className="text-sm text-muted-foreground">No sell plans yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="text-sm font-medium text-muted-foreground mb-3">Upcoming Orders</div>
      <div className="flex flex-col gap-4">
        {filteredSellPlans.map((plan, index) => {
          const planNumber = index + 1;
          const isCelebrating = celebratingPlanIds.has(plan.id);
          const isFading = fadingPlanIds.has(plan.id);

          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-lg border p-3 space-y-3 transition-all duration-500 relative overflow-hidden",
                isCelebrating && !isFading
                  ? "border-emerald-500 bg-emerald-500/20"
                  : "border-border/40 bg-muted/20",
                isFading && "opacity-0 scale-95 -mt-2 mb-0 py-0 max-h-0"
              )}
              style={{
                transition: isFading
                  ? "all 0.5s ease-out, max-height 0.5s ease-out, margin 0.5s ease-out, padding 0.5s ease-out"
                  : "all 0.3s ease-out",
              }}
            >
              {/* Celebration Overlay */}
              {isCelebrating && !isFading && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 backdrop-blur-[1px] z-10 animate-pulse">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce">
                      <Check className="h-10 w-10 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-emerald-100 font-bold text-lg">Complete!</span>
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold transition-colors",
                    isCelebrating ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"
                  )}>
                    {planNumber}
                  </span>
                  <span className="text-sm text-foreground font-medium">
                    Sell {plan.symbol}
                  </span>
                </div>
                {!isCelebrating && (
                  <button
                    onClick={() => removePlan(plan.id)}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete plan"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Account Groups - each account's sell + buys grouped together */}
              <div className="space-y-4">
                {plan.accountAllocations.map((accountAlloc) => {
                  const sellCompleted = isSellCompleted(plan.id, accountAlloc.accountId);
                  const accountColor = getAccountColor(accountAlloc.accountId, allAccountIds);

                  return (
                    <div key={accountAlloc.accountId} className="space-y-2">
                      {/* Account Sell Row */}
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 flex-1">
                          <span className={cn(
                            "text-xs font-medium px-1.5 py-0.5 rounded border",
                            accountColor.bg, accountColor.text, accountColor.border
                          )}>
                            {getFullAccountLabel(accountAlloc.accountId, accountAlloc.accountName)}
                          </span>
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                          <span className={cn("font-medium", sellCompleted && "line-through text-muted-foreground")}>
                            Sell {plan.symbol}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({formatShares(accountAlloc.toSell, plan.symbol)} shares)
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={sellCompleted ? "default" : "outline"}
                          className={cn(
                            "h-7 px-2 text-xs transition-all",
                            sellCompleted && "bg-emerald-500 hover:bg-emerald-500 text-white border-emerald-500"
                          )}
                          onClick={() => handleSellDone(plan, accountAlloc)}
                          disabled={sellCompleted || isCelebrating}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {sellCompleted ? "Sold!" : "Done"}
                        </Button>
                      </div>

                      {/* Account Buy Rows - inline input with Done button */}
                      {accountAlloc.buyAllocations.map((buyAllocation) => {
                        const buyKey = `${plan.id}:${accountAlloc.accountId}:${buyAllocation.symbol}`;
                        const buyCompleted = isBuyCompleted(plan.id, accountAlloc.accountId, buyAllocation.symbol);
                        const sharesValue = buySharesMap[buyKey] || "";
                        const hasValidShares = sharesValue && parseFloat(sharesValue) > 0;
                        const accountColor = getAccountColor(accountAlloc.accountId, allAccountIds);

                        return (
                          <div key={buyAllocation.symbol} className="ml-4">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2 flex-1">
                                <span className={cn(
                                  "text-xs font-medium px-1.5 py-0.5 rounded border",
                                  accountColor.bg, accountColor.text, accountColor.border
                                )}>
                                  {getFullAccountLabel(accountAlloc.accountId, accountAlloc.accountName)}
                                </span>
                                <span className="text-xs text-emerald-500 font-medium">
                                  {buyAllocation.percentage}%
                                </span>
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                <span className={cn("font-medium", buyCompleted && "line-through text-muted-foreground")}>
                                  Buy {buyAllocation.symbol}
                                </span>
                              </div>
                              {/* Inline shares input + Done button */}
                              <div className="flex items-center gap-2">
                                {!buyCompleted && (
                                  <Input
                                    type="number"
                                    min="0"
                                    step={isCryptoSymbol(buyAllocation.symbol) ? "0.01" : "1"}
                                    value={sharesValue}
                                    onChange={(e) => handleBuySharesChange(buyKey, e.target.value)}
                                    placeholder="shares"
                                    className="h-7 w-20 text-xs"
                                    disabled={isCelebrating}
                                  />
                                )}
                                <Button
                                  size="sm"
                                  variant={buyCompleted ? "default" : "outline"}
                                  className={cn(
                                    "h-7 px-2 text-xs transition-all",
                                    buyCompleted && "bg-emerald-500 hover:bg-emerald-500 text-white border-emerald-500"
                                  )}
                                  onClick={() => handleBuyDone(plan, accountAlloc, buyAllocation)}
                                  disabled={buyCompleted || isCelebrating || !hasValidShares}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  {buyCompleted ? "Bought!" : "Done"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
