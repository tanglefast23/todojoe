"use client";

import { useMemo, useState, useCallback } from "react";
import { MobilePortfolioCard } from "./MobilePortfolioCard";
import { MobilePnLChart } from "./MobilePnLChart";
import { MobileVirtualList } from "./MobileVirtualList";
import { AssetDetailModal } from "@/components/portfolio/AssetDetailModal";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useHoldingPeriodChanges, type ChangePeriod } from "@/hooks/useHoldingPeriodChanges";
import { useFormatters } from "@/hooks/useFormatters";
import { formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { LazyAllocationPieChart } from "@/lib/lazyCharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase } from "lucide-react";
import type { AssetType, HoldingWithValue } from "@/types/portfolio";

// Period labels for display
const PERIOD_LABELS: Record<ChangePeriod, string> = {
  "1H": "1h",
  "1D": "1d",
  "1W": "1w",
  "1M": "1m",
  "YTD": "ytd",
  "1Y": "1y",
  "ALL": "all",
};

/** Compact portfolio summary for mobile (left side of header) */
function MobileSummaryLeft({
  totalValue,
  selectedPeriod,
  periodChange,
  isPeriodLoading,
  portfolioName,
  isLoading,
}: {
  totalValue: number;
  selectedPeriod: ChangePeriod;
  periodChange: { dollars: number; percent: number } | null;
  isPeriodLoading: boolean;
  portfolioName: string;
  isLoading: boolean;
}) {
  const { formatCurrency } = useFormatters();

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-28" />
      </div>
    );
  }

  const hasData = periodChange !== null && !isPeriodLoading;
  const isPositive = hasData ? periodChange.dollars >= 0 : true;

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-0.5">{portfolioName}</p>
      <p className="text-3xl font-bold tabular-nums">{formatCurrency(totalValue, 0, 0)}</p>
      <p
        className={cn(
          "text-base font-medium tabular-nums",
          hasData
            ? isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            : "text-muted-foreground"
        )}
      >
        {hasData ? (
          <>
            {isPositive ? "+" : "-"}{formatCurrency(Math.abs(periodChange.dollars), 0, 0)} ({formatPercent(periodChange.percent)}) {PERIOD_LABELS[selectedPeriod]}
          </>
        ) : (
          <>— {PERIOD_LABELS[selectedPeriod]}</>
        )}
      </p>
    </div>
  );
}

/** Full-page portfolio view for mobile */
export function MobilePortfolioView() {
  const { holdings, summary, isLoading } = usePortfolio();
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const portfolios = usePortfolioStore((state) => state.portfolios);

  // Get the active portfolio name
  const portfolioName = useMemo(() => {
    const portfolio = portfolios.find(p => p.id === activePortfolioId);
    return portfolio?.name || "Portfolio";
  }, [portfolios, activePortfolioId]);

  // Period selector state (shared across all cards)
  const [selectedPeriod, setSelectedPeriod] = useState<ChangePeriod>("1D");

  // Asset detail modal state
  const [selectedHolding, setSelectedHolding] = useState<HoldingWithValue | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Handle holding tap - open detail modal
  const handleHoldingTap = useCallback((holding: HoldingWithValue) => {
    setSelectedHolding(holding);
    setIsDetailModalOpen(true);
  }, []);

  // Fetch period changes for all holdings
  const { periodChanges, isLoading: isPeriodLoading } = useHoldingPeriodChanges(
    holdings,
    selectedPeriod,
    !isLoading && holdings.length > 0
  );

  // Calculate total period change for the portfolio
  const totalPeriodChange = useMemo(() => {
    // For 1D, use existing summary data (always available)
    if (selectedPeriod === "1D") {
      return {
        dollars: summary.dayChange,
        percent: summary.dayChangePercent,
      };
    }

    // For other periods, sum up individual holding changes
    let totalDollars = 0;
    let hasAnyData = false;

    holdings.forEach((holding) => {
      const change = periodChanges[holding.symbol]?.[selectedPeriod];
      if (change) {
        totalDollars += change.dollars;
        hasAnyData = true;
      }
    });

    if (!hasAnyData) return null;

    // Calculate percent from total dollars change
    const startingValue = summary.totalValue - totalDollars;
    const percent = startingValue > 0 ? (totalDollars / startingValue) * 100 : 0;

    return { dollars: totalDollars, percent };
  }, [selectedPeriod, summary, holdings, periodChanges]);

  // Allocation data for pie chart
  const allocationData = useMemo(() => {
    return holdings.map((h) => ({
      name: h.symbol,
      value: h.currentValue,
      percentage: h.allocation,
    }));
  }, [holdings]);

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header: Summary + P&L Chart side by side */}
      <div className="flex items-stretch gap-4 px-5 py-4">
        {/* Left: Portfolio Summary */}
        <div className="flex-shrink-0">
          <MobileSummaryLeft
            totalValue={summary.totalValue}
            selectedPeriod={selectedPeriod}
            periodChange={totalPeriodChange}
            isPeriodLoading={isPeriodLoading}
            portfolioName={portfolioName}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Compact P&L Chart */}
        {!isLoading && holdings.length > 0 && (
          <div className="flex-1 min-w-0 h-[102px]">
            <ErrorBoundary>
              <MobilePnLChart
                holdings={holdings}
                compact
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* Holdings List - virtualized for large portfolios */}
      <div className="p-4">
        <MobileVirtualList
          items={holdings}
          keyExtractor={(holding) => holding.id}
          estimatedItemHeight={80}
          gap={12}
          isLoading={isLoading}
          loadingPlaceholder={
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          }
          emptyState={
            <div className="text-center py-20 text-muted-foreground">
              <Briefcase className="h-14 w-14 mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium">No holdings yet</p>
              <p className="text-sm mt-1">Add transactions from desktop</p>
            </div>
          }
          renderItem={(holding) => (
            <MobilePortfolioCard
              holding={holding}
              selectedPeriod={selectedPeriod}
              periodChange={periodChanges[holding.symbol]?.[selectedPeriod]}
              onClick={() => handleHoldingTap(holding)}
            />
          )}
        />
      </div>

      {/* Allocation Pie Chart */}
      {holdings.length > 0 && (
        <div className="px-4 pb-5">
          <ErrorBoundary>
            <div className="h-[336px]">
              <LazyAllocationPieChart data={allocationData} title="" />
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Asset Detail Modal */}
      <AssetDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        symbol={selectedHolding?.symbol ?? null}
        assetType={selectedHolding?.assetType ?? null}
        currentPrice={selectedHolding?.currentPrice ?? 0}
        assetName={selectedHolding?.name}
        totalPortfolioValue={summary.totalValue}
      />
    </div>
  );
}
