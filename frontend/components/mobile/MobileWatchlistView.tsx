"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { MobileWatchlistCard, type MobileWatchlistItem } from "./MobileWatchlistCard";
import { MobileVirtualList } from "./MobileVirtualList";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { detectAssetType, parseSymbolKey } from "@/lib/assetUtils";
import { validateSymbol } from "@/lib/quoteUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Plus, Loader2, ArrowUpDown, ChevronDown, LayoutList, LayoutGrid } from "lucide-react";
import {
  MobileBottomSheet,
  MobileSheetHeader,
  AssetTypeSelector,
} from "./MobileBottomSheet";
import { useFormatters } from "@/hooks/useFormatters";

// Debug: Track component mount/unmount
const debugMountId = () => Math.random().toString(36).substr(2, 6);

type AssetTypeOption = "auto" | "stock" | "crypto";

// Sort options for mobile watchlist
type MobileSortField = "symbol" | "price" | "changePercentDay" | "changePercentWeek" | "changePercentMonth" | "changePercentYear";
type SortDirection = "asc" | "desc";

interface SortConfig {
  field: MobileSortField;
  direction: SortDirection;
}

const SORT_OPTIONS: { field: MobileSortField; label: string }[] = [
  { field: "symbol", label: "Symbol" },
  { field: "price", label: "Price" },
  { field: "changePercentDay", label: "Day %" },
  { field: "changePercentWeek", label: "Week %" },
  { field: "changePercentMonth", label: "Month %" },
  { field: "changePercentYear", label: "Year %" },
];

/** Full-page watchlist view for mobile - synced with desktop dashboard widgets */
export function MobileWatchlistView() {
  const { formatCurrency } = useFormatters();

  // Get active portfolio
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);

  // Dashboard store for watchlist widgets (same data source as desktop)
  const dashboards = useDashboardStore((state) => state.dashboards);
  const getDashboard = useDashboardStore((state) => state.getDashboard);
  const addWidget = useDashboardStore((state) => state.addWidget);
  const updateWidgetConfig = useDashboardStore((state) => state.updateWidgetConfig);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [assetTypeOption, setAssetTypeOption] = useState<AssetTypeOption>("auto");
  const [isValidating, setIsValidating] = useState(false);
  const [validatedPrice, setValidatedPrice] = useState<number | null>(null);
  const [validatedName, setValidatedName] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Compact mode state
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Reordering state - tracks the symbol key being moved
  const [reorderingSymbol, setReorderingSymbol] = useState<string | null>(null);

  // Debug: Track component instance
  const mountIdRef = useRef(debugMountId());

  // Debug: Log on mount and when dashboards change
  useEffect(() => {
    const storeState = useDashboardStore.getState();
    const dashboard = storeState.dashboards[activePortfolioId];
    const watchlistWidget = dashboard?.widgets?.filter((w) => w.type === "watchlist");

    console.log(`[MobileWatchlist:${mountIdRef.current}] Component MOUNTED`);
    console.log(`[MobileWatchlist:${mountIdRef.current}] Active portfolio:`, activePortfolioId);
    console.log(`[MobileWatchlist:${mountIdRef.current}] Store dashboards (from getState):`, storeState.dashboards);
    console.log(`[MobileWatchlist:${mountIdRef.current}] Watchlist widgets:`, watchlistWidget?.map((w) => ({ id: w.id, symbols: w.config.symbols })));

    return () => {
      console.log(`[MobileWatchlist:${mountIdRef.current}] Component UNMOUNTED`);
    };
  }, []);

  // Debug: Log when dashboards subscription changes
  useEffect(() => {
    console.log(`[MobileWatchlist:${mountIdRef.current}] Dashboards subscription changed`);
    console.log(`[MobileWatchlist:${mountIdRef.current}] dashboards (from hook):`, dashboards);
  }, [dashboards]);

  // Get all watchlist widgets for the active portfolio
  // IMPORTANT: Also read directly from store to ensure fresh data on mount
  const watchlistWidgets = useMemo(() => {
    // Force read from current store state to avoid any stale subscription issues
    const freshDashboards = useDashboardStore.getState().dashboards;
    const dashboard = freshDashboards[activePortfolioId] || getDashboard(activePortfolioId);
    const widgets = dashboard.widgets.filter((w) => w.type === "watchlist");

    // Debug logging to trace data flow
    console.log("[MobileWatchlist] Reading widgets for portfolio:", activePortfolioId);
    console.log("[MobileWatchlist] Found", widgets.length, "watchlist widget(s)");
    widgets.forEach((w, i) => {
      console.log(`[MobileWatchlist] Widget ${i} (${w.id}):`, w.config.symbols);
    });

    return widgets;
  }, [getDashboard, activePortfolioId, dashboards]);

  // Combine all symbols from all watchlist widgets (deduplicated)
  const watchlistSymbols = useMemo(() => {
    const allSymbols: string[] = [];
    for (const widget of watchlistWidgets) {
      const symbols = widget.config.symbols || [];
      allSymbols.push(...symbols);
    }
    return [...new Set(allSymbols)];
  }, [watchlistWidgets]);

  // Parse symbols into stock and crypto groups
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocks: string[] = [];
    const cryptos: string[] = [];
    watchlistSymbols.forEach((key) => {
      const { symbol, assetType } = parseSymbolKey(key);
      if (assetType === "crypto") {
        cryptos.push(symbol);
      } else {
        stocks.push(symbol);
      }
    });
    return { stockSymbols: stocks, cryptoSymbols: cryptos };
  }, [watchlistSymbols]);

  // Fetch watchlist data
  const { data: stockQuotes, isLoading: stocksLoading } = useBatchStockQuotes(stockSymbols);
  const { data: cryptoQuotes, isLoading: cryptoLoading } = useBatchCryptoQuotes(cryptoSymbols);

  const isLoading = stocksLoading || cryptoLoading;

  // Transform watchlist data for display
  // IMPORTANT: Iterate over watchlistSymbols (source of truth) first, then lookup quotes
  // This matches desktop WatchlistWidget pattern which is proven to work
  const watchlistItems: MobileWatchlistItem[] = useMemo(() => {
    // Build quote maps for O(1) lookup (matching desktop pattern)
    const stockQuoteMap = new Map<string, typeof stockQuotes extends (infer T)[] | undefined ? T : never>();
    const cryptoQuoteMap = new Map<string, typeof cryptoQuotes extends (infer T)[] | undefined ? T : never>();

    stockQuotes?.forEach((quote) => {
      stockQuoteMap.set(quote.symbol.toUpperCase(), quote);
    });

    cryptoQuotes?.forEach((quote) => {
      cryptoQuoteMap.set(quote.symbol.toUpperCase(), quote);
    });

    // Build items by iterating over watchlistSymbols (source of truth)
    // This ensures deleted items are immediately excluded
    const items: MobileWatchlistItem[] = [];

    watchlistSymbols.forEach((symbolKey) => {
      const { symbol, assetType } = parseSymbolKey(symbolKey);
      const upperSymbol = symbol.toUpperCase();

      if (assetType === "crypto") {
        const quote = cryptoQuoteMap.get(upperSymbol);
        if (quote) {
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
        }
      } else {
        const quote = stockQuoteMap.get(upperSymbol);
        if (quote) {
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
        }
      }
    });

    return items;
  }, [stockQuotes, cryptoQuotes, watchlistSymbols]);

  // Handle sort selection
  const handleSortSelect = useCallback((field: MobileSortField) => {
    setSortConfig((prev) => {
      if (!prev || prev.field !== field) {
        // First click: sort descending (highest to lowest)
        return { field, direction: "desc" };
      }
      if (prev.direction === "desc") {
        // Second click: sort ascending (lowest to highest)
        return { field, direction: "asc" };
      }
      // Third click: clear sort
      return null;
    });
    setShowSortMenu(false);
  }, []);

  // Apply sorting to watchlist items
  const sortedWatchlistItems = useMemo(() => {
    if (!sortConfig) {
      return watchlistItems;
    }

    const { field, direction } = sortConfig;
    const sorted = [...watchlistItems].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (field === "symbol") {
        aVal = a.symbol;
        bVal = b.symbol;
      } else {
        aVal = a[field];
        bVal = b[field];
      }

      // Handle nulls - push to bottom
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // String comparison for symbol
      if (field === "symbol") {
        const comparison = (aVal as string).localeCompare(bVal as string);
        return direction === "desc" ? -comparison : comparison;
      }

      // Numeric comparison
      const comparison = (aVal as number) - (bVal as number);
      return direction === "desc" ? -comparison : comparison;
    });

    return sorted;
  }, [watchlistItems, sortConfig]);

  // Validate symbol using shared utility
  const handleValidateSymbol = useCallback(async (symbol: string, typeOption: AssetTypeOption) => {
    if (!symbol || symbol.length < 1) {
      setValidatedPrice(null);
      setValidatedName(null);
      return;
    }

    setIsValidating(true);
    setValidatedPrice(null);
    setValidatedName(null);

    try {
      const result = await validateSymbol(symbol, typeOption);
      if (result) {
        setValidatedPrice(result.price);
        setValidatedName(result.name);
      } else {
        setValidatedPrice(null);
        setValidatedName(null);
      }
    } catch {
      setValidatedPrice(null);
      setValidatedName(null);
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Debounced validation when symbol changes
  useEffect(() => {
    if (!showAddModal || !newSymbol) {
      setValidatedPrice(null);
      setValidatedName(null);
      return;
    }

    const timer = setTimeout(() => {
      handleValidateSymbol(newSymbol, assetTypeOption);
    }, 500);

    return () => clearTimeout(timer);
  }, [showAddModal, newSymbol, assetTypeOption, handleValidateSymbol]);

  // Open add modal
  const openAddModal = () => {
    setShowAddModal(true);
    setNewSymbol("");
    setAssetTypeOption("auto");
    setValidatedPrice(null);
    setValidatedName(null);
  };

  // Close add modal
  const closeAddModal = () => {
    setShowAddModal(false);
    setNewSymbol("");
    setValidatedPrice(null);
    setValidatedName(null);
  };

  // Add symbol to watchlist widget
  const handleAddSymbol = useCallback(() => {
    if (!newSymbol) return;

    const assetType = assetTypeOption === "auto" ? detectAssetType(newSymbol) : assetTypeOption;
    const symbolKey = `${newSymbol.toUpperCase()}-${assetType}`;

    // Check if already in any watchlist widget
    if (watchlistSymbols.includes(symbolKey)) {
      closeAddModal();
      return;
    }

    // Add to first watchlist widget, or create one if none exist
    if (watchlistWidgets.length > 0) {
      const firstWidget = watchlistWidgets[0];
      const currentSymbols = firstWidget.config.symbols || [];
      updateWidgetConfig(activePortfolioId, firstWidget.id, {
        symbols: [...currentSymbols, symbolKey],
      });
    } else {
      // Create a new watchlist widget with this symbol
      addWidget(activePortfolioId, "watchlist", {
        symbols: [symbolKey],
        title: "Watchlist",
      });
    }

    // Show success
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      closeAddModal();
    }, 1000);
  }, [newSymbol, assetTypeOption, watchlistSymbols, watchlistWidgets, activePortfolioId, updateWidgetConfig, addWidget]);

  // Delete symbol from ALL watchlist widgets
  // Uses hook-based updateWidgetConfig (matching desktop pattern) for proper re-render triggering
  const handleDeleteSymbol = useCallback((symbolKey: string) => {
    console.log("[MobileWatchlist] Deleting symbol:", symbolKey);
    console.log("[MobileWatchlist] Current watchlistWidgets:", watchlistWidgets.length);

    // Use watchlistWidgets from memo (automatically updated when store changes)
    // and hook-based updateWidgetConfig for proper subscription triggering
    watchlistWidgets.forEach((widget) => {
      const symbols = widget.config.symbols || [];
      console.log(`[MobileWatchlist] Widget ${widget.id} has symbols:`, symbols);
      if (symbols.includes(symbolKey)) {
        const newSymbols = symbols.filter((s: string) => s !== symbolKey);
        console.log(`[MobileWatchlist] Updating widget ${widget.id} to:`, newSymbols);
        updateWidgetConfig(activePortfolioId, widget.id, { symbols: newSymbols });

        // Verify the update happened
        setTimeout(() => {
          const freshState = useDashboardStore.getState();
          const freshDashboard = freshState.dashboards[activePortfolioId];
          const freshWidget = freshDashboard?.widgets.find((w) => w.id === widget.id);
          console.log(`[MobileWatchlist] After update, widget ${widget.id} has:`, freshWidget?.config.symbols);
        }, 100);
      }
    });
  }, [watchlistWidgets, activePortfolioId, updateWidgetConfig]);

  // Start moving a symbol - enters reorder mode
  const handleMoveStart = useCallback((symbolKey: string) => {
    setReorderingSymbol(symbolKey);
  }, []);

  // Cancel reorder mode
  const handleCancelReorder = useCallback(() => {
    setReorderingSymbol(null);
  }, []);

  // Handle tapping a card while in reorder mode - swap positions
  const handleReorderSelect = useCallback((targetSymbolKey: string) => {
    if (!reorderingSymbol || reorderingSymbol === targetSymbolKey) {
      setReorderingSymbol(null);
      return;
    }

    // Find the widget and swap the positions
    for (const widget of watchlistWidgets) {
      const symbols = widget.config.symbols || [];
      const sourceIndex = symbols.indexOf(reorderingSymbol);
      const targetIndex = symbols.indexOf(targetSymbolKey);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        // Both symbols in same widget - swap them
        const newSymbols = [...symbols];
        [newSymbols[sourceIndex], newSymbols[targetIndex]] = [newSymbols[targetIndex], newSymbols[sourceIndex]];
        updateWidgetConfig(activePortfolioId, widget.id, { symbols: newSymbols });
        break;
      }
    }

    setReorderingSymbol(null);
  }, [reorderingSymbol, watchlistWidgets, activePortfolioId, updateWidgetConfig]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <div className="flex items-center gap-2">
            {/* Compact Mode Toggle */}
            <button
              onClick={() => setIsCompactMode(!isCompactMode)}
              className={`flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
                isCompactMode
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-background border-border/50 text-muted-foreground hover:bg-muted"
              }`}
              title={isCompactMode ? "Switch to expanded view" : "Switch to compact view"}
            >
              {isCompactMode ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <LayoutList className="h-4 w-4" />
              )}
            </button>

            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                  sortConfig
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-background border-border/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortConfig ? (
                  <span className="flex items-center gap-1">
                    {SORT_OPTIONS.find(o => o.field === sortConfig.field)?.label}
                    <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === "asc" ? "rotate-180" : ""}`} />
                  </span>
                ) : (
                  "Sort"
                )}
              </button>

              {/* Sort Dropdown */}
              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                    {sortConfig && (
                      <button
                        onClick={() => {
                          setSortConfig(null);
                          setShowSortMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Clear sort
                      </button>
                    )}
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.field}
                        onClick={() => handleSortSelect(option.field)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                          sortConfig?.field === option.field ? "text-primary font-medium" : ""
                        }`}
                      >
                        {option.label}
                        {sortConfig?.field === option.field && (
                          <ChevronDown className={`h-3 w-3 ${sortConfig.direction === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Add Button */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Reorder Mode Banner */}
      {reorderingSymbol && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Tap a symbol to swap with {reorderingSymbol.split("-")[0]}
              </span>
            </div>
            <button
              onClick={handleCancelReorder}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Watchlist Table - virtualized for large lists */}
      <div className="px-3 pt-3 pb-20 flex-1 overflow-y-auto">
        <MobileVirtualList
          items={sortedWatchlistItems}
          keyExtractor={(item) => `${item.symbol}-${item.type}`}
          estimatedItemHeight={48}
          gap={8}
          isLoading={isLoading}
          loadingPlaceholder={
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          }
          emptyState={
            <div className="text-center py-16 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No watchlist items</p>
              <p className="text-xs mt-1">Tap Add to start tracking symbols</p>
            </div>
          }
          renderItem={(item) => {
            const symbolKey = `${item.symbol}-${item.type}`;
            return (
              <MobileWatchlistCard
                item={item}
                isCompact={isCompactMode}
                onDelete={() => handleDeleteSymbol(symbolKey)}
                onMoveStart={() => handleMoveStart(symbolKey)}
                isReordering={reorderingSymbol === symbolKey}
                onClick={reorderingSymbol ? () => handleReorderSelect(symbolKey) : undefined}
              />
            );
          }}
        />
      </div>

      {/* Add to Watchlist Modal */}
      <MobileBottomSheet
        isOpen={showAddModal}
        onClose={closeAddModal}
        successMessage={showSuccess ? "Added to Watchlist!" : null}
      >
        {/* Header */}
        <MobileSheetHeader
          icon={<Eye className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
          title="Add to Watchlist"
          subtitle="Track a new symbol"
        />

        {/* Symbol Input */}
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Symbol
          </label>
          <Input
            type="text"
            placeholder="e.g. AAPL, BTC, TSLA"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === "Tab") && newSymbol && (validatedPrice !== null || !isValidating)) {
                e.preventDefault();
                handleAddSymbol();
              }
            }}
            className="h-14 text-xl text-center font-semibold rounded-xl uppercase"
            autoFocus
          />
        </div>

        {/* Asset Type Selector */}
        <AssetTypeSelector
          value={assetTypeOption}
          onChange={setAssetTypeOption}
        />

        {/* Validation Status */}
        {newSymbol && (
          <div className="mb-5 rounded-xl bg-muted/50 p-4 border border-border/50">
            {isValidating ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Looking up {newSymbol}...</span>
              </div>
            ) : validatedPrice !== null ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{validatedName || newSymbol}</p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(validatedPrice)}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Symbol found</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p className="text-sm">Symbol not found</p>
                <p className="text-xs mt-1">Check the symbol and try again</p>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleAddSymbol}
          disabled={!newSymbol || (validatedPrice === null && !isValidating)}
          size="lg"
          className="w-full h-14 text-lg font-semibold rounded-xl"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add {newSymbol || "Symbol"}
        </Button>
      </MobileBottomSheet>
    </div>
  );
}
