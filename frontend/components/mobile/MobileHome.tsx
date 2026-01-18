"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobilePortfolioCard } from "./MobilePortfolioCard";
import { MobileWatchlistCard, type MobileWatchlistItem } from "./MobileWatchlistCard";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { useHoldingPeriodChanges, type ChangePeriod } from "@/hooks/useHoldingPeriodChanges";
import { useFormatters } from "@/hooks/useFormatters";
import { formatPercent } from "@/lib/formatters";
import { isCryptoSymbol } from "@/lib/assetUtils";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { LazyAllocationPieChart } from "@/lib/lazyCharts";
import { Skeleton } from "@/components/ui/skeleton";

type TabType = "portfolio" | "watchlist";

/** Parse symbol key to extract symbol and type (e.g., "AAPL-stock" -> {symbol: "AAPL", type: "stock"}) */
function parseSymbolKey(key: string): { symbol: string; type: "stock" | "crypto" } {
  const parts = key.split("-");
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].toLowerCase();
    if (lastPart === "stock" || lastPart === "crypto") {
      return {
        symbol: parts.slice(0, -1).join("-"),
        type: lastPart,
      };
    }
  }
  // Fallback: auto-detect
  return {
    symbol: key,
    type: isCryptoSymbol(key) ? "crypto" : "stock",
  };
}

/** Compact portfolio summary for mobile */
function MobileSummary({
  totalValue,
  dayChange,
  dayChangePercent,
  isLoading,
}: {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  isLoading: boolean;
}) {
  const { formatCurrency } = useFormatters();
  const isDayPositive = dayChange >= 0;

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-border/50 space-y-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-border/50">
      <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalValue)}</p>
      <p
        className={cn(
          "text-sm font-medium tabular-nums",
          isDayPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}
      >
        {isDayPositive ? "+" : ""}
        {formatCurrency(dayChange)} ({formatPercent(dayChangePercent)}) today
      </p>
    </div>
  );
}

/** Tab switcher with indicator */
function TabSwitcher({
  activeTab,
  onTabChange,
  portfolioCount,
  watchlistCount,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  portfolioCount: number;
  watchlistCount: number;
}) {
  return (
    <div className="flex border-b border-border/50">
      <button
        onClick={() => onTabChange("portfolio")}
        className={cn(
          "flex-1 py-2.5 text-sm font-medium transition-colors relative",
          activeTab === "portfolio"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Portfolio ({portfolioCount})
        {activeTab === "portfolio" && (
          <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
        )}
      </button>
      <button
        onClick={() => onTabChange("watchlist")}
        className={cn(
          "flex-1 py-2.5 text-sm font-medium transition-colors relative",
          activeTab === "watchlist"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Watchlist ({watchlistCount})
        {activeTab === "watchlist" && (
          <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
        )}
      </button>
    </div>
  );
}

export function MobileHome() {
  const { holdings, summary, isLoading, refetch } = usePortfolio();
  const { formatCurrency } = useFormatters();

  // Period selector state (shared across all cards)
  const [selectedPeriod, setSelectedPeriod] = useState<ChangePeriod>("1D");

  // Fetch period changes for all holdings
  const { periodChanges } = useHoldingPeriodChanges(
    holdings,
    selectedPeriod,
    !isLoading && holdings.length > 0
  );

  // Get watchlist symbols from dashboard store
  const widgets = useDashboardStore((state) => state.widgets);
  const watchlistSymbols = useMemo(() => {
    // Find all watchlist widgets and collect their symbols
    const symbols: string[] = [];
    widgets.forEach((widget) => {
      if (widget.type === "watchlist" && widget.config?.symbols) {
        symbols.push(...(widget.config.symbols as string[]));
      }
    });
    // Remove duplicates
    return Array.from(new Set(symbols));
  }, [widgets]);

  // Parse symbols into stock and crypto groups
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocks: string[] = [];
    const cryptos: string[] = [];
    watchlistSymbols.forEach((key) => {
      const { symbol, type } = parseSymbolKey(key);
      if (type === "crypto") {
        cryptos.push(symbol);
      } else {
        stocks.push(symbol);
      }
    });
    return { stockSymbols: stocks, cryptoSymbols: cryptos };
  }, [watchlistSymbols]);

  // Fetch watchlist data
  const { data: stockQuotes } = useBatchStockQuotes(stockSymbols);
  const { data: cryptoQuotes } = useBatchCryptoQuotes(cryptoSymbols);

  // Transform watchlist data for display
  const watchlistItems: MobileWatchlistItem[] = useMemo(() => {
    const items: MobileWatchlistItem[] = [];

    // Add stock quotes
    stockQuotes?.forEach((quote) => {
      items.push({
        symbol: quote.symbol,
        name: quote.name || quote.symbol,
        price: quote.price,
        type: "stock",
        changePercent1h: null,
        changePercentDay: quote.changePercent,
        changePercentWeek: quote.changePercentWeek ?? null,
        changePercentMonth: quote.changePercentMonth ?? null,
        changePercentYear: quote.changePercentYear ?? null,
        preMarketChangePercent: quote.preMarketChangePercent ?? null,
        postMarketChangePercent: quote.postMarketChangePercent ?? null,
        logoUrl: quote.logoUrl || `https://assets.parqet.com/logos/symbol/${quote.symbol}?format=png`,
      });
    });

    // Add crypto quotes
    cryptoQuotes?.forEach((quote) => {
      items.push({
        symbol: quote.symbol.toUpperCase(),
        name: quote.name,
        price: quote.price,
        type: "crypto",
        changePercent1h: quote.changePercent1h ?? null,
        changePercentDay: quote.changePercent24h,
        changePercentWeek: quote.changePercent7d ?? null,
        changePercentMonth: quote.changePercent30d ?? null,
        changePercentYear: quote.changePercent1y ?? null,
        preMarketChangePercent: null,
        postMarketChangePercent: null,
        logoUrl: quote.logoUrl || `https://assets.coincap.io/assets/icons/${quote.symbol.toLowerCase()}@2x.png`,
      });
    });

    return items;
  }, [stockQuotes, cryptoQuotes]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("portfolio");

  // Scroll container ref for swipe detection
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle scroll-snap for tab switching
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const width = container.clientWidth;
      const newTab = scrollLeft > width / 2 ? "watchlist" : "portfolio";
      if (newTab !== activeTab) {
        setActiveTab(newTab);
      }
    };

    container.addEventListener("scrollend", handleScroll);
    return () => container.removeEventListener("scrollend", handleScroll);
  }, [activeTab]);

  // Programmatic scroll when tab button is clicked
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        left: tab === "watchlist" ? container.clientWidth : 0,
        behavior: "smooth",
      });
    }
  };

  // Allocation data for pie chart
  const allocationData = useMemo(() => {
    return holdings.map((h) => ({
      name: h.symbol,
      value: h.currentValue,
      percentage: h.allocation,
    }));
  }, [holdings]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader onRefresh={refetch} isRefreshing={isLoading} />

      {/* Portfolio Summary */}
      <MobileSummary
        totalValue={summary.totalValue}
        dayChange={summary.dayChange}
        dayChangePercent={summary.dayChangePercent}
        isLoading={isLoading}
      />

      {/* Tab Switcher */}
      <TabSwitcher
        activeTab={activeTab}
        onTabChange={handleTabChange}
        portfolioCount={holdings.length}
        watchlistCount={watchlistItems.length}
      />

      {/* Swipeable Content Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="flex h-full">
          {/* Portfolio Panel */}
          <div className="w-full h-full flex-shrink-0 snap-center overflow-y-auto">
            <div className="p-3 space-y-2">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))
              ) : holdings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No holdings yet</p>
                  <p className="text-xs mt-1">Add transactions from desktop</p>
                </div>
              ) : (
                holdings.map((holding) => (
                  <MobilePortfolioCard
                    key={holding.id}
                    holding={holding}
                    selectedPeriod={selectedPeriod}
                    periodChange={periodChanges[holding.symbol]?.[selectedPeriod]}
                  />
                ))
              )}
            </div>

            {/* Allocation Pie Chart */}
            {holdings.length > 0 && (
              <div className="px-3 pb-4">
                <ErrorBoundary>
                  <div className="h-[280px]">
                    <LazyAllocationPieChart data={allocationData} title="" />
                  </div>
                </ErrorBoundary>
              </div>
            )}
          </div>

          {/* Watchlist Panel */}
          <div className="w-full h-full flex-shrink-0 snap-center overflow-y-auto">
            <div className="p-3 space-y-1.5">
              {watchlistItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No watchlist items</p>
                  <p className="text-xs mt-1">Add symbols from dashboard</p>
                </div>
              ) : (
                watchlistItems.map((item) => (
                  <MobileWatchlistCard key={item.symbol} item={item} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
