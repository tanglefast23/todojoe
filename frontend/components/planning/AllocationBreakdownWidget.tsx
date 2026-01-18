"use client";

import { useMemo, memo, useState, useEffect } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useSellPlanStore } from "@/stores/sellPlanStore";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { usePrivacyBlur } from "@/hooks/usePrivacyMode";
import { SymbolBadge } from "@/components/ui/symbol-badge";
import { ArrowRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export const AllocationBreakdownWidget = memo(function AllocationBreakdownWidget() {
  // Prevent hydration mismatch - store has data on client but not server
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const getQuickOverviewGrid = usePortfolioStore((state) => state.getQuickOverviewGrid);
  const _transactions = usePortfolioStore((state) => state.transactions);
  const getSymbolTags = usePortfolioStore((state) => state.getSymbolTags);

  // Get sell plans for projected allocations
  const sellPlans = useSellPlanStore((state) => state.sellPlans);

  const gridData = getQuickOverviewGrid(activePortfolioId);
  const { symbols, symbolTypes, totals } = gridData;

  // Helper to extract plain symbol from potentially composite key
  const getPlainSymbol = (key: string): string => {
    const lastDashIndex = key.lastIndexOf("-");
    if (lastDashIndex > 0) {
      const suffix = key.substring(lastDashIndex + 1);
      if (suffix === "stock" || suffix === "crypto") {
        return key.substring(0, lastDashIndex);
      }
    }
    return key;
  };

  // Separate stocks and crypto for price fetching
  // Symbols are composite keys like "IREN-stock" - extract plain symbol
  // Also include buy symbols from sell plans so we can calculate projected allocations
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocks = new Set<string>();
    const crypto = new Set<string>();

    // Add current portfolio symbols
    symbols.forEach((key) => {
      // Extract plain symbol from composite key (e.g., "BRK-B" from "BRK-B-stock")
      const lastDashIndex = key.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? key.substring(0, lastDashIndex) : key;
      const assetType = symbolTypes[key];

      if (assetType === "crypto") {
        crypto.add(plainSymbol);
      } else {
        stocks.add(plainSymbol);
      }
    });

    // Add buy symbols from sell plans (so we can fetch their prices for projections)
    sellPlans.forEach((plan) => {
      plan.accountAllocations.forEach((acc) => {
        acc.buyAllocations.forEach((buy) => {
          const buyPlainSymbol = getPlainSymbol(buy.symbol);
          if (buy.assetType === "crypto") {
            crypto.add(buyPlainSymbol);
          } else {
            stocks.add(buyPlainSymbol);
          }
        });
      });
    });

    return { stockSymbols: Array.from(stocks), cryptoSymbols: Array.from(crypto) };
  }, [symbols, symbolTypes, sellPlans]);

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

  // Calculate total portfolio value
  const totalPortfolioValue = useMemo(() => {
    let total = 0;
    symbols.forEach((symbolKey) => {
      // Extract plain symbol from composite key for price lookup
      const lastDashIndex = symbolKey.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
      total += (totals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
    });
    return total;
  }, [symbols, totals, priceMap]);

  // Calculate allocation percentages for each symbol
  const allocations = useMemo(() => {
    return symbols.map((symbolKey) => {
      // Extract plain symbol from composite key for price lookup and display
      const lastDashIndex = symbolKey.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
      const assetType = symbolTypes[symbolKey];
      const value = (totals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
      const percentage = totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0;
      return { symbol: plainSymbol, symbolKey, percentage, assetType, shares: totals[symbolKey] || 0 };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [symbols, symbolTypes, totals, priceMap, totalPortfolioValue]);

  // Calculate projected holdings after all sell plans complete
  const projectedData = useMemo(() => {
    // Filter sell plans for active portfolio only
    const portfolioPlans = sellPlans.filter(
      (p) => !p.portfolioId || p.portfolioId === activePortfolioId || activePortfolioId === "combined"
    );

    if (portfolioPlans.length === 0) {
      return null; // No upcoming orders
    }

    // Clone current totals
    const projectedTotals: Record<string, number> = { ...totals };

    // Apply all sell plans
    portfolioPlans.forEach((plan) => {
      // plan.symbol is now a plain symbol (e.g., "MU"), construct composite key
      const plainSymbol = getPlainSymbol(plan.symbol); // Handle legacy composite keys
      const symbolKey = `${plainSymbol}-${plan.assetType || "stock"}`;
      const totalToSell = plan.accountAllocations.reduce((sum, acc) => sum + acc.toSell, 0);
      projectedTotals[symbolKey] = Math.max(0, (projectedTotals[symbolKey] || 0) - totalToSell);

      // Apply buy allocations
      plan.accountAllocations.forEach((acc) => {
        acc.buyAllocations.forEach((buy) => {
          // buy.symbol is now a plain symbol, construct composite key
          const buyPlainSymbol = getPlainSymbol(buy.symbol); // Handle legacy composite keys
          const buyKey = `${buyPlainSymbol}-${buy.assetType}`;
          // Estimate shares from dollar amount / price (using plain symbol for price lookup)
          const buyPrice = priceMap[buyPlainSymbol] || 0;
          if (buyPrice > 0) {
            const sharesToBuy = buy.dollarAmount / buyPrice;
            projectedTotals[buyKey] = (projectedTotals[buyKey] || 0) + sharesToBuy;
          }
        });
      });
    });

    // Calculate projected total portfolio value
    let projectedTotal = 0;
    const allSymbolKeys = new Set([...Object.keys(projectedTotals), ...symbols]);
    allSymbolKeys.forEach((symbolKey) => {
      const lastDashIndex = symbolKey.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
      projectedTotal += (projectedTotals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
    });

    // Calculate projected allocations
    const projectedAllocations: Record<string, number> = {};
    allSymbolKeys.forEach((symbolKey) => {
      const lastDashIndex = symbolKey.lastIndexOf("-");
      const plainSymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
      const value = (projectedTotals[symbolKey] || 0) * (priceMap[plainSymbol] || 0);
      if (value > 0) {
        projectedAllocations[plainSymbol] = projectedTotal > 0 ? (value / projectedTotal) * 100 : 0;
      }
    });

    return projectedAllocations;
  }, [sellPlans, activePortfolioId, totals, symbols, priceMap]);

  const hasProjectedChanges = projectedData !== null;

  // Calculate tag-based allocations
  const tagAllocations = useMemo(() => {
    const tagValues: Record<string, number> = {};
    const tagSymbols: Record<string, string[]> = {};

    allocations.forEach(({ symbol, assetType, percentage }) => {
      // Skip if assetType is "both" (shouldn't happen in practice)
      if (assetType === "both") return;
      const tags = getSymbolTags(symbol, assetType);
      if (tags.length === 0) {
        // No tags - group under "Untagged"
        tagValues["Untagged"] = (tagValues["Untagged"] || 0) + percentage;
        tagSymbols["Untagged"] = [...(tagSymbols["Untagged"] || []), symbol];
      } else {
        // Distribute evenly across tags (or you could choose first tag only)
        tags.forEach((tag) => {
          tagValues[tag] = (tagValues[tag] || 0) + percentage / tags.length;
          if (!tagSymbols[tag]) tagSymbols[tag] = [];
          if (!tagSymbols[tag].includes(symbol)) tagSymbols[tag].push(symbol);
        });
      }
    });

    return Object.entries(tagValues)
      .map(([tag, percentage]) => ({ tag, percentage, symbols: tagSymbols[tag] || [] }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [allocations, getSymbolTags]);

  // Privacy mode blur
  const blurClass = usePrivacyBlur();

  // Tab state: 'holdings' or 'tags'
  const [activeTab, setActiveTab] = useState<"holdings" | "tags">("holdings");

  // Return consistent empty state during SSR and initial mount
  if (!mounted || symbols.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab("holdings")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
            activeTab === "holdings"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Holdings
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
            activeTab === "tags"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <Tag className="h-3 w-3" />
          Tags
        </button>
      </div>

      {activeTab === "holdings" ? (
        <>
          {/* Header row with column labels */}
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className="font-medium text-muted-foreground w-20">Symbol</span>
            <span className="text-emerald-500 font-medium w-20 text-center">Now</span>
            {hasProjectedChanges && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-blue-500 font-medium w-20 text-center text-xs">Projected</span>
              </>
            )}
          </div>
          <div className="flex flex-col">
            {allocations.map(({ symbol, percentage }, index) => {
              const projected = projectedData?.[symbol];
              const change = projected !== undefined ? projected - percentage : null;

              return (
                <div
                  key={symbol}
                  className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                    index % 2 === 0 ? "bg-muted/30" : ""
                  }`}
                >
                  <span className="font-medium w-20">
                    <SymbolBadge symbolKey={symbol} size="sm" />
                  </span>
                  <span className={`text-emerald-500 tabular-nums w-20 text-center ${blurClass}`}>
                    {percentage.toFixed(1)}%
                  </span>
                  {hasProjectedChanges && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span
                        className={cn(
                          "tabular-nums w-20 text-center",
                          blurClass,
                          projected !== undefined
                            ? change && change > 0.1
                              ? "text-emerald-500"
                              : change && change < -0.1
                                ? "text-red-500"
                                : "text-blue-500"
                            : "text-red-500/50"
                        )}
                      >
                        {projected !== undefined ? `${projected.toFixed(1)}%` : "0%"}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
            {/* Show new symbols from buy orders */}
            {hasProjectedChanges &&
              Object.entries(projectedData || {})
                .filter(([sym]) => !allocations.find((a) => a.symbol === sym))
                .map(([symbol, projected], i) => (
                  <div
                    key={symbol}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                      (allocations.length + i) % 2 === 0 ? "bg-muted/30" : ""
                    }`}
                  >
                    <span className="font-medium w-20">
                      <SymbolBadge symbolKey={symbol} size="sm" />
                    </span>
                    <span className={`text-muted-foreground/50 tabular-nums w-20 text-center ${blurClass}`}>
                      0%
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={`text-emerald-500 tabular-nums w-20 text-center ${blurClass}`}>
                      {projected.toFixed(1)}%
                    </span>
                  </div>
                ))}
          </div>
        </>
      ) : (
        <>
          {/* Tag breakdown view */}
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className="font-medium text-muted-foreground flex-1">Tag</span>
            <span className="text-emerald-500 font-medium w-20 text-center">%</span>
          </div>
          <div className="flex flex-col">
            {tagAllocations.map(({ tag, percentage, symbols: tagSyms }, index) => (
              <div
                key={tag}
                className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                  index % 2 === 0 ? "bg-muted/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "font-medium",
                      tag === "Untagged" && "text-muted-foreground/70 italic"
                    )}
                  >
                    {tag}
                  </span>
                  <div className="text-xs text-muted-foreground truncate">
                    {tagSyms.slice(0, 4).join(", ")}
                    {tagSyms.length > 4 && ` +${tagSyms.length - 4}`}
                  </div>
                </div>
                <span className={`text-emerald-500 tabular-nums w-20 text-center ${blurClass}`}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
