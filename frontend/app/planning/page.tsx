"use client";

import { useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { SellPlanningWidget } from "@/components/planning/SellPlanningWidget";
import { AllocationBreakdownWidget } from "@/components/planning/AllocationBreakdownWidget";
import { SellOverviewWidget } from "@/components/planning/SellOverviewWidget";
import { RecentTradesWidget } from "@/components/portfolio/RecentTradesWidget";
import { TagGroupingsWidget } from "@/components/portfolio/TagGroupingsWidget";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePortfolio } from "@/hooks/usePortfolio";

export default function PlanningPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Get holdings for tag groupings widget
  const { holdings } = usePortfolio();

  // Collect all unique tags from holdings
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    holdings.forEach((h) => {
      if (h.tags) {
        h.tags.forEach((tag: string) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).toSorted();
  }, [holdings]);

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <div className="flex-1 px-4 md:px-8 py-10 space-y-8 max-w-6xl tablet-compact-page">
        {/* Portfolio Selector */}
        <PortfolioTabs />

        {/* Allocation & Overview - Side by Side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AllocationBreakdownWidget />
          <SellOverviewWidget />
        </div>

        {/* Sell Planning Widget */}
        <SellPlanningWidget />

        {/* Tag Groupings - Portfolio breakdown by tags */}
        {allTags.length > 0 && (
          <TagGroupingsWidget holdings={holdings} allTags={allTags} />
        )}

        {/* Most Recent Trades */}
        <RecentTradesWidget />
      </div>
    </div>
  );
}
