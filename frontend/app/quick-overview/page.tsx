"use client";

import { Header } from "@/components/layout/Header";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import {
  HoldingsGridWidget,
} from "@/components/portfolio/quick-overview";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function QuickOverviewPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

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

        {/* Holdings Grid - Full Width */}
        <HoldingsGridWidget />
      </div>
    </div>
  );
}
