"use client";

import { useState, useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Header } from "@/components/layout/Header";
import { WidgetGrid, AddWidgetModal } from "@/components/dashboard";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { useDashboardStore } from "@/stores/dashboardStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMobileMode } from "@/hooks/useMobileMode";
import { MobileApp } from "@/components/mobile/MobileApp";

export default function DashboardPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Mobile mode detection
  const { isMobile, isMounted: isMobileMounted } = useMobileMode();

  // Portfolio store for active portfolio
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Get widgets from per-portfolio dashboard structure
  const dashboards = useDashboardStore((state) => state.dashboards);
  const getDashboard = useDashboardStore((state) => state.getDashboard);

  // Get widgets for current portfolio (recomputes when dashboards or activePortfolioId changes)
  const widgets = useMemo(() => {
    return getDashboard(activePortfolioId).widgets;
  }, [getDashboard, activePortfolioId, dashboards]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Parallelize independent invalidations to avoid request waterfall
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock"] }),
      queryClient.invalidateQueries({ queryKey: ["crypto"] }),
    ]);
    setIsRefreshing(false);
  };

  const hasWidgets = widgets.length > 0;

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show mobile app when in mobile mode
  if (isMobileMounted && isMobile) {
    return <MobileApp />;
  }

  // Desktop mode: always show the widget grid dashboard
  // (activeView is only used for mobile navigation)

  return (
    <div className="flex flex-col">
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 space-y-4 p-6">
        {/* Portfolio Selector */}
        <PortfolioTabs />

        {/* Add Widget Button */}
        <div className="flex justify-start">
          <AddWidgetModal />
        </div>

        {/* Widget Grid or Empty State */}
        {hasWidgets ? (
          <WidgetGrid />
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-muted p-4">
                <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No widgets yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add widgets to customize your dashboard with real-time market data,
                  watchlists, and price charts.
                </p>
              </div>
              <AddWidgetModal />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
