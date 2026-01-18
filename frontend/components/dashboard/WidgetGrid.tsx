"use client";

import { useMemo, useCallback, useState, memo, lazy, Suspense } from "react";
import { GridLayout, LayoutItem as RGLLayoutItem, useContainerWidth, verticalCompactor } from "react-grid-layout";
import { useShallow } from "zustand/react/shallow";
import { Columns } from "lucide-react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { WidgetWrapper } from "./WidgetWrapper";
import { AssetCardWidget } from "./widgets/AssetCardWidget";
import { WatchlistWidget } from "./widgets/WatchlistWidget";
import { AddSymbolPopover } from "./widgets/AddSymbolPopover";
import { QuickStatsWidget } from "./widgets/QuickStatsWidget";
import { useMetrics } from "@/hooks/useMetrics";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle
import type { Widget, LayoutItem, DashboardLayout } from "@/types/dashboard";

// Lazy load heavy chart components for better initial load performance
const ChartWidget = lazy(() => import("./widgets/ChartWidget").then(m => ({ default: m.ChartWidget })));
const AllocationPieChart = lazy(() => import("@/components/charts/AllocationPieChart").then(m => ({ default: m.AllocationPieChart })));

// Import react-grid-layout styles
import "react-grid-layout/css/styles.css";

/** Loading fallback for lazy-loaded chart components */
function ChartLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

function getWidgetTitle(widget: Widget): string {
  switch (widget.type) {
    case "asset-card":
      return widget.config.symbol || "Asset";
    case "watchlist":
      return widget.config.title || "Watchlist";
    case "chart":
      return `${widget.config.symbol || "Chart"} Chart`;
    case "quick-stats":
      return "Portfolio Stats";
    case "allocation-pie":
      return "Allocation";
    default:
      return "Widget";
  }
}

interface WidgetContentProps {
  widget: Widget;
  isCompact?: boolean;
  watchlistSymbols?: string[];
  onSymbolsChange?: (symbols: string[]) => void;
  onOpenChart?: (symbol: string, assetType: "stock" | "crypto") => void;
}

/** Memoized widget content - prevents re-renders when other widgets update */
const WidgetContent = memo(function WidgetContent({ widget, isCompact, watchlistSymbols, onSymbolsChange, onOpenChart }: WidgetContentProps) {
  const { holdings } = usePortfolio();
  const { metrics } = useMetrics(holdings);

  switch (widget.type) {
    case "asset-card":
      return (
        <AssetCardWidget
          symbol={widget.config.symbol || "AAPL"}
          assetType={widget.config.symbol?.match(/^(BTC|ETH|SOL|XRP|DOGE|ADA|AVAX|DOT|MATIC|LINK|UNI|ATOM|LTC|BCH|SHIB)$/i) ? "crypto" : "stock"}
        />
      );
    case "watchlist":
      return (
        <WatchlistWidget
          symbols={watchlistSymbols || []}
          title={widget.config.title}
          isCompact={isCompact}
          onSymbolsChange={onSymbolsChange}
          onOpenChart={onOpenChart}
        />
      );
    case "chart":
      return (
        <ErrorBoundary>
          <Suspense fallback={<ChartLoadingFallback />}>
            <ChartWidget
              symbol={widget.config.symbol || "AAPL"}
              timeRange={widget.config.timeRange || "1M"}
            />
          </Suspense>
        </ErrorBoundary>
      );
    case "quick-stats":
      return <QuickStatsWidget />;
    case "allocation-pie":
      return (
        <ErrorBoundary>
          <Suspense fallback={<ChartLoadingFallback />}>
            <div className="h-full -m-3">
              <AllocationPieChart data={metrics.allocation} title="" />
            </div>
          </Suspense>
        </ErrorBoundary>
      );
    default:
      return <div>Unknown widget type</div>;
  }
});

export function WidgetGrid() {
  // Dashboard store - batched subscriptions to reduce re-renders
  const {
    dashboards,
    getDashboard,
    removeWidget,
    updateLayouts,
    updateWidgetConfig,
    addWidget,
  } = useDashboardStore(
    useShallow((state) => ({
      dashboards: state.dashboards,
      getDashboard: state.getDashboard,
      removeWidget: state.removeWidget,
      updateLayouts: state.updateLayouts,
      updateWidgetConfig: state.updateWidgetConfig,
      addWidget: state.addWidget,
    }))
  );

  // Portfolio store - batched subscriptions to reduce re-renders
  const {
    addWatchlistSymbol,
    removeWatchlistSymbol,
    reorderWatchlistSymbols,
    activePortfolioId,
    portfolios,
    combinedGroups,
    watchlistSymbolsState,
    getActiveWatchlist,
  } = usePortfolioStore(
    useShallow((state) => ({
      addWatchlistSymbol: state.addWatchlistSymbol,
      removeWatchlistSymbol: state.removeWatchlistSymbol,
      reorderWatchlistSymbols: state.reorderWatchlistSymbols,
      activePortfolioId: state.activePortfolioId,
      portfolios: state.portfolios,
      combinedGroups: state.combinedGroups,
      watchlistSymbolsState: state.watchlistSymbols,
      getActiveWatchlist: state.getActiveWatchlist,
    }))
  );

  // Check if current view is a combined view
  const isCombinedView = activePortfolioId === "combined" ||
    combinedGroups.some((g) => g.id === activePortfolioId);

  // Get portfolio IDs to show widgets for
  const portfolioIdsForWidgets = useMemo(() => {
    if (activePortfolioId === "combined") {
      // Show widgets from all portfolios
      return portfolios.map((p) => p.id);
    }
    const group = combinedGroups.find((g) => g.id === activePortfolioId);
    if (group) {
      // Show widgets from portfolios in this combined group
      return group.portfolioIds;
    }
    // Single portfolio view
    return [activePortfolioId];
  }, [activePortfolioId, portfolios, combinedGroups]);

  // Get the dashboard(s) for the active view
  // For combined views, aggregate widgets from all member portfolios
  const { widgets, layouts, widgetPortfolioMap } = useMemo(() => {
    if (portfolioIdsForWidgets.length === 1) {
      // Single portfolio - use directly
      const dashboard = getDashboard(portfolioIdsForWidgets[0]);
      const map: Record<string, string> = {};
      dashboard.widgets.forEach((w) => {
        map[w.id] = portfolioIdsForWidgets[0];
      });
      return { widgets: dashboard.widgets, layouts: dashboard.layouts, widgetPortfolioMap: map };
    }

    // Combined view - aggregate widgets from multiple portfolios
    const allWidgets: Widget[] = [];
    const allLayouts: LayoutItem[] = [];
    const map: Record<string, string> = {};
    let yOffset = 0;

    for (const portfolioId of portfolioIdsForWidgets) {
      const dashboard = getDashboard(portfolioId);
      for (const widget of dashboard.widgets) {
        allWidgets.push(widget);
        map[widget.id] = portfolioId;
      }
      // Offset layouts vertically for each portfolio's widgets
      const maxY = dashboard.layouts.lg.length > 0
        ? Math.max(...dashboard.layouts.lg.map((l) => l.y + l.h))
        : 0;
      for (const layout of dashboard.layouts.lg) {
        allLayouts.push({ ...layout, y: layout.y + yOffset });
      }
      yOffset += maxY;
    }

    return {
      widgets: allWidgets,
      layouts: { lg: allLayouts, md: allLayouts, sm: allLayouts },
      widgetPortfolioMap: map,
    };
  }, [portfolioIdsForWidgets, getDashboard, dashboards]);

  // Use v2 hook for container width measurement (fixes hydration issues)
  const { width: containerWidth, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
    initialWidth: 1200,
  });

  // Track compact mode state per watchlist widget
  const [compactModes, setCompactModes] = useState<Record<string, boolean>>({});

  // Get portfolio-specific watchlist symbols (recomputes when state changes)
  const watchlistSymbols = useMemo(() => {
    return getActiveWatchlist();
  }, [getActiveWatchlist, activePortfolioId, watchlistSymbolsState]);

  // Handler for watchlist changes (adding, removing, reordering)
  const handleWatchlistChange = useCallback((newSymbols: string[]) => {
    const currentSymbols = getActiveWatchlist();

    // Find added symbols (in newSymbols but not in currentSymbols)
    const addedSymbols = newSymbols.filter((s) => !currentSymbols.includes(s));

    // Find removed symbols (in currentSymbols but not in newSymbols)
    const removedSymbols = currentSymbols.filter((s) => !newSymbols.includes(s));

    // Add new symbols
    addedSymbols.forEach((symbol) => addWatchlistSymbol(symbol));

    // Remove symbols
    removedSymbols.forEach((symbol) => removeWatchlistSymbol(symbol));

    // If no additions/removals but order changed, reorder
    if (addedSymbols.length === 0 && removedSymbols.length === 0) {
      reorderWatchlistSymbols(newSymbols);
    }
  }, [getActiveWatchlist, addWatchlistSymbol, removeWatchlistSymbol, reorderWatchlistSymbols]);

  // Handler for renaming watchlist widgets
  const handleTitleChange = useCallback((widgetId: string, newTitle: string) => {
    const portfolioId = widgetPortfolioMap[widgetId] || activePortfolioId;
    updateWidgetConfig(portfolioId, widgetId, { title: newTitle });
  }, [updateWidgetConfig, activePortfolioId, widgetPortfolioMap]);

  // Handler for opening chart from watchlist double-click
  const handleOpenChart = useCallback((symbol: string, assetType: "stock" | "crypto") => {
    // For combined views, add to the first portfolio
    const targetPortfolioId = portfolioIdsForWidgets[0] || activePortfolioId;
    addWidget(targetPortfolioId, "chart", { symbol, assetType });
  }, [addWidget, activePortfolioId, portfolioIdsForWidgets]);

  // Toggle compact mode for a specific widget
  const toggleCompactMode = useCallback((widgetId: string) => {
    setCompactModes(prev => ({ ...prev, [widgetId]: !prev[widgetId] }));
  }, []);


  // Use lg layout for the grid - convert to RGL format
  // Ensure every widget has a corresponding layout item (defensive sync)
  const gridLayout: RGLLayoutItem[] = useMemo(() => {
    const lgLayouts = layouts?.lg ?? [];
    const layoutMap = new Map(lgLayouts.map((l) => [l.i, l]));

    const defaults: Record<string, { w: number; h: number; minW: number; minH: number }> = {
      "asset-card": { w: 3, h: 2, minW: 2, minH: 2 },
      "watchlist": { w: 6, h: 4, minW: 4, minH: 3 },
      "chart": { w: 6, h: 4, minW: 4, minH: 3 },
      "quick-stats": { w: 4, h: 2, minW: 3, minH: 2 },
      "allocation-pie": { w: 4, h: 4, minW: 3, minH: 3 },
    };

    // Track running y offset for widgets that need fallback positions
    let fallbackY = 0;
    // First, find the max Y from existing layouts
    if (lgLayouts.length > 0) {
      fallbackY = Math.max(...lgLayouts.map((l) => l.y + l.h));
    }

    // Create layout items for all widgets, using existing layout or creating default
    const result: RGLLayoutItem[] = [];
    for (const widget of widgets) {
      const existingLayout = layoutMap.get(widget.id);
      if (existingLayout) {
        result.push({
          i: existingLayout.i,
          x: existingLayout.x,
          y: existingLayout.y,
          w: existingLayout.w,
          h: existingLayout.h,
          minW: existingLayout.minW,
          minH: existingLayout.minH,
        });
      } else {
        // Fallback: create a default layout for this widget
        // This handles cases where layout might be out of sync with widgets
        const typeDefaults = defaults[widget.type] || { w: 4, h: 3, minW: 2, minH: 2 };
        result.push({
          i: widget.id,
          x: 0,
          y: fallbackY,
          w: typeDefaults.w,
          h: typeDefaults.h,
          minW: typeDefaults.minW,
          minH: typeDefaults.minH,
        });
        // Increment fallbackY for next fallback widget
        fallbackY += typeDefaults.h;
      }
    }

    return result;
  }, [layouts, widgets]);

  const handleLayoutChange = useCallback(
    (newLayout: readonly RGLLayoutItem[]) => {
      // In combined view, don't persist layout changes (too complex to split across portfolios)
      if (isCombinedView) {
        return;
      }

      // Convert back to our DashboardLayout type
      const layoutItems: LayoutItem[] = newLayout.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        minW: l.minW,
        minH: l.minH,
      }));

      const newLayouts: DashboardLayout = {
        lg: layoutItems,
        md: layoutItems.map((l) => ({ ...l, w: Math.min(l.w, 8) })),
        sm: layoutItems.map((l) => ({ ...l, w: Math.min(l.w, 4) })),
      };
      updateLayouts(activePortfolioId, newLayouts);
    },
    [updateLayouts, activePortfolioId, isCombinedView]
  );

  if (widgets.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef}>
      {mounted && (
        <GridLayout
          className="layout"
          width={containerWidth}
          layout={gridLayout}
          gridConfig={{
            cols: 12,
            rowHeight: 100,
            margin: [16, 16],
            containerPadding: [0, 0],
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: true,
            handle: ".widget-handle",
          }}
          resizeConfig={{
            enabled: true,
            handles: ["se"], // Bottom-right corner resize handle
          }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
          autoSize={true}
        >
        {widgets.map((widget) => {
          const widgetPortfolioId = widgetPortfolioMap[widget.id] || activePortfolioId;
          return (
          <div key={widget.id} className="widget-container">
            {widget.type === "asset-card" ? (
              // Asset cards render their own header with company name and badge
              <AssetCardWidget
                symbol={widget.config.symbol || "AAPL"}
                assetType={widget.config.symbol?.match(/^(BTC|ETH|SOL|XRP|DOGE|ADA|AVAX|DOT|MATIC|LINK|UNI|ATOM|LTC|BCH|SHIB)$/i) ? "crypto" : "stock"}
                showHeader={true}
                onRemove={() => removeWidget(widgetPortfolioId, widget.id)}
              />
            ) : (
              <WidgetWrapper
                id={widget.id}
                title={getWidgetTitle(widget)}
                onRemove={(widgetId) => removeWidget(widgetPortfolioId, widgetId)}
                onTitleChange={widget.type === "watchlist" ? (newTitle) => handleTitleChange(widget.id, newTitle) : undefined}
                headerAction={
                  widget.type === "watchlist" ? (
                    <div className="flex items-center gap-1">
                      <AddSymbolPopover
                        symbols={widget.config.symbols || []}
                        onAddSymbol={(newSymbols) => {
                          // Update this specific widget's symbols
                          updateWidgetConfig(widgetPortfolioId, widget.id, { symbols: newSymbols });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompactMode(widget.id);
                        }}
                        title={compactModes[widget.id] ? "Show all columns" : "Hide week/month/year columns"}
                      >
                        <Columns className="h-3 w-3 mr-1" />
                        {compactModes[widget.id] ? "Expand" : "Compact"}
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                <WidgetContent
                  widget={widget}
                  isCompact={compactModes[widget.id]}
                  watchlistSymbols={widget.type === "watchlist" ? (widget.config.symbols || []) : undefined}
                  onSymbolsChange={widget.type === "watchlist" ? (newSymbols) => {
                    // Update this specific widget's symbols
                    updateWidgetConfig(widgetPortfolioId, widget.id, { symbols: newSymbols });
                  } : undefined}
                  onOpenChart={handleOpenChart}
                />
              </WidgetWrapper>
            )}
          </div>
        );
        })}
        </GridLayout>
      )}
    </div>
  );
}
