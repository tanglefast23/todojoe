"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { TransactionForm } from "@/components/portfolio/TransactionForm";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { MetricsPanel } from "@/components/portfolio/MetricsPanel";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { TagGroupingsWidget } from "@/components/portfolio/TagGroupingsWidget";
import { BulkTagEditorDialog } from "@/components/portfolio/BulkTagEditorDialog";
// Lazy load heavy chart components to reduce initial bundle size
import { LazyAllocationPieChart, LazyHoldingsPieChart } from "@/lib/lazyCharts";
import { ProfitSummaryWidget } from "@/components/portfolio/quick-overview";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useMetrics } from "@/hooks/useMetrics";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Plus, Filter, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileMode } from "@/hooks/useMobileMode";
import { MobileApp } from "@/components/mobile/MobileApp";

export default function PortfolioPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Mobile mode detection
  const { isMobile, isMounted: isMobileMounted } = useMobileMode();

  // Prevent hydration mismatch: server has no persisted data, client does
  // Both must render the same content initially, then client updates after mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { holdings, summary, isLoading, refetch } = usePortfolio();
  const { metrics } = useMetrics(holdings);
  const { metricsMode, setMetricsMode } = useSettingsStore();
  const { currency } = useCurrency();

  // Use key prop on chart container to force complete remount on currency change
  // This avoids useState/useEffect entirely, preventing infinite loop issues with Recharts
  const chartKey = `charts-${currency}`;

  // Subscribe to raw transactions for undo/redo re-render (getActiveTransactions is a stable function ref)
  const _transactions = usePortfolioStore((state) => state.transactions);
  const getActiveTransactions = usePortfolioStore((state) => state.getActiveTransactions);
  const transactions = getActiveTransactions();

  // Tag filter and bulk editor state
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [isBulkTagEditorOpen, setIsBulkTagEditorOpen] = useState(false);

  const handleRefresh = () => {
    refetch();
  };

  // Only check hasHoldings after mount to prevent hydration mismatch
  // Server always renders "no holdings" state, client matches until mounted
  const hasHoldings = isMounted && holdings.length > 0;

  // Collect all unique tags from holdings
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    holdings.forEach((h) => {
      if (h.tags) {
        h.tags.forEach((tag) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).toSorted();
  }, [holdings]);

  // Filter holdings by active tag filters
  const filteredHoldings = useMemo(() => {
    if (activeTagFilters.length === 0) return holdings;
    return holdings.filter((h) =>
      h.tags && activeTagFilters.every((filterTag) => h.tags?.includes(filterTag))
    );
  }, [holdings, activeTagFilters]);

  // Toggle a tag filter
  const toggleTagFilter = useCallback((tag: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Clear all tag filters
  const clearTagFilters = useCallback(() => {
    setActiveTagFilters([]);
  }, []);

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Render mobile view when mobile mode is active (after mount to avoid hydration mismatch)
  if (isMobileMounted && isMobile) {
    return <MobileApp />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <div className="flex-1 px-4 md:px-8 py-6 space-y-6 max-w-6xl tablet-compact-page">
        {/* Portfolio Tabs */}
        <PortfolioTabs />

        {/* Hero Summary */}
        <PortfolioSummary summary={summary} isLoading={isLoading} />

        {/* Metrics Mode Toggle - Refined */}
        <div className="flex items-center gap-6">
          <span id="view-mode-label" className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            View
          </span>
          <div
            role="group"
            aria-labelledby="view-mode-label"
            className="flex gap-1 p-1 rounded-lg bg-muted/50"
          >
            <button
              onClick={() => setMetricsMode("simple")}
              aria-pressed={metricsMode === "simple"}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                metricsMode === "simple"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Simple
            </button>
            <button
              onClick={() => setMetricsMode("pro")}
              aria-pressed={metricsMode === "pro"}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                metricsMode === "pro"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Professional
            </button>
          </div>
        </div>

        {/* Professional Metrics (only in pro mode) */}
        {metricsMode === "pro" && hasHoldings && (
          <MetricsPanel metrics={metrics} isLoading={isLoading} />
        )}

        {/* Holdings Section - No Card Wrapper */}
        <section className="space-y-3">
          <div className="flex items-center justify-end gap-2">
            {/* Filter Button - only render after mount to avoid Radix hydration mismatch */}
            {isMounted && allTags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={activeTagFilters.length > 0 ? "default" : "outline"}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    {activeTagFilters.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
                        {activeTagFilters.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allTags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag}
                      checked={activeTagFilters.includes(tag)}
                      onCheckedChange={() => toggleTagFilter(tag)}
                    >
                      {tag}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {activeTagFilters.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={false}
                        onCheckedChange={clearTagFilters}
                        className="text-muted-foreground"
                      >
                        Clear filters
                      </DropdownMenuCheckboxItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Add Tags Button */}
            <Button
              variant="outline"
              onClick={() => setIsBulkTagEditorOpen(true)}
            >
              <Tag className="mr-2 h-4 w-4" />
              Add Tags
            </Button>

            {/* Add Transaction Button */}
            <TransactionForm />
          </div>

          {hasHoldings ? (
            <HoldingsTable holdings={filteredHoldings} isLoading={isLoading} />
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/30">
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">No holdings yet</h3>
                  <p className="text-sm text-muted-foreground max-w-[280px]">
                    Add your first transaction to start tracking your portfolio performance
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Tags & Groupings */}
        {hasHoldings && allTags.length > 0 && (
          <TagGroupingsWidget holdings={holdings} allTags={allTags} />
        )}

        {/* Allocation & Holdings Charts */}
        {hasHoldings && (
          <div key={chartKey} className="grid gap-8 lg:grid-cols-2">
            <ErrorBoundary>
              <LazyAllocationPieChart
                data={metrics.allocation}
                title=""
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <LazyHoldingsPieChart
                data={holdings.map((h) => ({
                  name: h.symbol,
                  value: h.currentValue,
                  percentage: h.allocation,
                }))}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Profit Summary */}
        <ProfitSummaryWidget />
      </div>

      {/* Bulk Tag Editor Dialog */}
      <BulkTagEditorDialog
        open={isBulkTagEditorOpen}
        onOpenChange={setIsBulkTagEditorOpen}
      />
    </div>
  );
}
