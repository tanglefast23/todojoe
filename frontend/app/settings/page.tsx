"use client";

import { useState, useEffect } from "react";
import { Download, Upload, Trash2 } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { useSellPlanStore } from "@/stores/sellPlanStore";
import { useAllocationHistoryStore } from "@/stores/allocationHistoryStore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { OwnerManagement } from "@/components/settings/OwnerManagement";
import { CombinedPortfolioPermissions } from "@/components/settings/CombinedPortfolioPermissions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  const portfolioStore = usePortfolioStore();
  const dashboardStore = useDashboardStore();
  const tagsStore = useTagsStore();
  const settingsStore = useSettingsStore();
  const sellPlanStore = useSellPlanStore();
  const allocationHistoryStore = useAllocationHistoryStore();
  const isMasterLoggedIn = useOwnerStore((state) => state.isMasterLoggedIn);
  const queryClient = useQueryClient();

  // Hydration-safe check for master status
  const [isMounted, setIsMounted] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showOwnerManagement = isMounted && isMasterLoggedIn();

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleExport = () => {
    // Export ALL data that gets synced to Supabase (complete backup)
    const data = {
      version: "2.0.0", // Updated version to reflect new schema
      exportedAt: new Date().toISOString(),
      portfolio: {
        portfolios: portfolioStore.portfolios,
        transactions: portfolioStore.transactions,
        // Additional portfolioStore data synced to backend
        trackedSymbols: portfolioStore.trackedSymbols,
        watchlistSymbols: portfolioStore.watchlistSymbols,
        symbolNotes: portfolioStore.symbolNotes,
        symbolTags: portfolioStore.symbolTags,
        tagGroupings: portfolioStore.tagGroupings,
        costBasisOverrides: portfolioStore.costBasisOverrides,
        combinedGroups: portfolioStore.combinedGroups,
      },
      dashboard: {
        dashboards: dashboardStore.dashboards,
      },
      tags: tagsStore.tags,
      settings: {
        autoRefreshEnabled: settingsStore.autoRefreshEnabled,
        refreshIntervalSeconds: settingsStore.refreshIntervalSeconds,
        metricsMode: settingsStore.metricsMode,
        currency: settingsStore.currency,
      },
      // Sell plans and progress
      sellPlans: {
        plans: sellPlanStore.sellPlans,
        completedSellIds: Array.from(sellPlanStore.completedSellIds),
        completedBuyIds: Array.from(sellPlanStore.completedBuyIds),
      },
      // Allocation history snapshots
      allocationHistory: {
        snapshots: allocationHistoryStore.snapshots,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `investment-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data structure
        if (!data.version || !data.portfolio) {
          alert("Invalid backup file format");
          return;
        }

        // Import portfolio data
        if (data.portfolio.portfolios) {
          portfolioStore.setPortfolios(data.portfolio.portfolios);
        }
        if (data.portfolio.transactions) {
          portfolioStore.setTransactions(data.portfolio.transactions);
        }
        // Import additional portfolio fields (v2.0.0+)
        if (data.portfolio.trackedSymbols) {
          portfolioStore.setTrackedSymbols(data.portfolio.trackedSymbols);
        }
        if (data.portfolio.watchlistSymbols) {
          portfolioStore.setWatchlistSymbols(data.portfolio.watchlistSymbols);
        }
        if (data.portfolio.symbolNotes) {
          portfolioStore.setSymbolNotes(data.portfolio.symbolNotes);
        }
        if (data.portfolio.symbolTags) {
          portfolioStore.setSymbolTags(data.portfolio.symbolTags);
        }
        if (data.portfolio.tagGroupings) {
          portfolioStore.setTagGroupings(data.portfolio.tagGroupings);
        }
        if (data.portfolio.costBasisOverrides) {
          portfolioStore.setCostBasisOverrides(data.portfolio.costBasisOverrides);
        }
        if (data.portfolio.combinedGroups) {
          portfolioStore.setCombinedGroups(data.portfolio.combinedGroups);
        }

        // Import dashboard data
        if (data.dashboard?.dashboards) {
          dashboardStore.setAllDashboards(data.dashboard.dashboards);
        }

        // Import tags
        if (data.tags) {
          tagsStore.setTags(data.tags);
        }

        // Import settings
        if (data.settings) {
          if (data.settings.autoRefreshEnabled !== undefined) {
            settingsStore.setAutoRefresh(data.settings.autoRefreshEnabled);
          }
          if (data.settings.refreshIntervalSeconds !== undefined) {
            settingsStore.setRefreshInterval(data.settings.refreshIntervalSeconds);
          }
          if (data.settings.metricsMode !== undefined) {
            settingsStore.setMetricsMode(data.settings.metricsMode);
          }
          if (data.settings.currency !== undefined) {
            settingsStore.setCurrency(data.settings.currency);
          }
        }

        // Import sell plans (v2.0.0+)
        if (data.sellPlans) {
          sellPlanStore.setSellPlans(
            data.sellPlans.plans || [],
            data.sellPlans.completedSellIds || [],
            data.sellPlans.completedBuyIds || []
          );
        }

        // Import allocation history (v2.0.0+)
        if (data.allocationHistory?.snapshots) {
          allocationHistoryStore.setSnapshots(data.allocationHistory.snapshots);
        }

        alert("Data imported successfully! Page will reload to apply changes.");
        window.location.reload();
      } catch (error) {
        console.error("Import error:", error);
        alert("Failed to import data. Please check the file format.");
      }
    };
    input.click();
  };

  const handleClearAllData = () => {
    setClearDataOpen(true);
  };

  const confirmClearAllData = async () => {
    setIsClearing(true);

    // Nil UUID used as "delete all" workaround (Supabase requires a WHERE clause)
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";

    try {
      // === STEP 1: Delete from Supabase (in correct order for foreign key constraints) ===
      const supabase = getSupabaseClient();

      // Delete in order: child tables first, then parent tables
      // This prevents foreign key constraint violations

      // 1. Tables that depend on portfolios (delete first)
      const portfolioDependentTables = [
        "transactions",      // depends on accounts → portfolios
        "accounts",          // depends on portfolios
        "tracked_symbols",   // depends on portfolios
        "symbol_notes",      // depends on portfolios
        "symbol_tags",       // depends on portfolios
        "tag_groupings",     // depends on portfolios
        "cost_basis_overrides", // depends on portfolios
        "allocation_snapshots", // depends on portfolios (nullable)
      ];

      for (const table of portfolioDependentTables) {
        const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
        if (error) {
          console.error(`[ClearData] Error deleting from ${table}:`, error);
          // Continue anyway - some tables might be empty or not exist
        } else {
          console.log(`[ClearData] Cleared ${table}`);
        }
      }

      // 2. Tables that depend on owners (but NOT owners itself)
      const ownerDependentTables = [
        "sell_plan_progress", // depends on sell_plans → owners
        "sell_plans",         // depends on owners
        "owner_dashboards",   // depends on owners
        "owner_settings",     // depends on owners
      ];

      for (const table of ownerDependentTables) {
        const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
        if (error) {
          console.error(`[ClearData] Error deleting from ${table}:`, error);
        } else {
          console.log(`[ClearData] Cleared ${table}`);
        }
      }

      // 3. Portfolios (now safe to delete after dependent tables are cleared)
      {
        const { error } = await supabase.from("portfolios").delete().neq("id", NIL_UUID);
        if (error) {
          console.error("[ClearData] Error deleting portfolios:", error);
        } else {
          console.log("[ClearData] Cleared portfolios");
        }
      }

      // 4. Global tables (no foreign key dependencies)
      {
        const { error } = await supabase.from("tags").delete().neq("id", NIL_UUID);
        if (error) {
          console.error("[ClearData] Error deleting tags:", error);
        } else {
          console.log("[ClearData] Cleared tags");
        }
      }

      // 5. Reset app_settings to defaults (instead of deleting)
      {
        const { error } = await supabase.from("app_settings").upsert({
          id: "default",
          auto_refresh_enabled: true,
          refresh_interval_seconds: 30,
          metrics_mode: "simple",
          currency: "USD",
          risk_free_rate: 0.05,
          active_portfolio_id: null,
        } as never);
        if (error) {
          console.error("[ClearData] Error resetting app_settings:", error);
        } else {
          console.log("[ClearData] Reset app_settings to defaults");
        }
      }

      // NOTE: We intentionally do NOT delete from "owners" table
      // to preserve user accounts (matches the localStorage behavior)

      console.log("[ClearData] Supabase data cleared successfully");

    } catch (error) {
      console.error("[ClearData] Error clearing Supabase data:", error);
      // Continue to clear local data even if Supabase fails
    }

    // === STEP 2: Clear local stores ===
    portfolioStore.resetAllData();
    dashboardStore.clearAllDashboards();
    sellPlanStore.clearPlans();
    allocationHistoryStore.clearHistory();
    tagsStore.setTags([]);

    // Reset settings to defaults (except mobileMode which is just display preference)
    settingsStore.setAutoRefresh(true);
    settingsStore.setRefreshInterval(30);
    settingsStore.setMetricsMode("simple");
    settingsStore.setCurrency("USD");

    // === STEP 3: Clear localStorage (preserving owner accounts) ===
    const keysToPreserve = ["owner-storage", "active-owner-id"];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // === STEP 4: Clear React Query cache ===
    queryClient.clear();
    console.log("[ClearData] React Query cache cleared");

    // === STEP 5: Clear sessionStorage (rate limits, unlock state, etc.) ===
    sessionStorage.clear();
    console.log("[ClearData] Session storage cleared");

    setIsClearing(false);
    window.location.reload();
  };

  return (
    <div className="flex flex-col">
      <Header />

      <div className="flex-1 space-y-6 p-6">
        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Export or import your portfolio data as JSON backup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
              <Button onClick={handleImport} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Owner Profiles - Master Only */}
        {showOwnerManagement && <OwnerManagement />}

        {/* Combined Portfolio Permissions - Master Only */}
        {showOwnerManagement && <CombinedPortfolioPermissions />}

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
            <CardDescription>
              Customize how data is displayed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label id="auto-refresh-label">Auto Refresh</Label>
              <div className="flex items-center gap-4" role="group" aria-labelledby="auto-refresh-label">
                <Button
                  variant={settingsStore.autoRefreshEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => settingsStore.setAutoRefresh(true)}
                >
                  Enabled
                </Button>
                <Button
                  variant={!settingsStore.autoRefreshEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => settingsStore.setAutoRefresh(false)}
                >
                  Disabled
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label id="refresh-interval-label">Refresh Interval</Label>
              <div className="flex items-center gap-2" role="group" aria-labelledby="refresh-interval-label">
                {[15, 30, 60, 120].map((seconds) => (
                  <Button
                    key={seconds}
                    variant={settingsStore.refreshIntervalSeconds === seconds ? "default" : "outline"}
                    size="sm"
                    onClick={() => settingsStore.setRefreshInterval(seconds)}
                  >
                    {seconds}s
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label id="metrics-view-label">Default Metrics View</Label>
              <div className="flex items-center gap-4" role="group" aria-labelledby="metrics-view-label">
                <Button
                  variant={settingsStore.metricsMode === "simple" ? "default" : "outline"}
                  size="sm"
                  onClick={() => settingsStore.setMetricsMode("simple")}
                >
                  Simple
                </Button>
                <Button
                  variant={settingsStore.metricsMode === "pro" ? "default" : "outline"}
                  size="sm"
                  onClick={() => settingsStore.setMetricsMode("pro")}
                >
                  Professional
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Information */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
            <CardDescription>
              Information about price data providers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium">Stocks</Label>
                <p className="text-sm text-muted-foreground">
                  Yahoo Finance (primary), Alpha Vantage, Polygon.io
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Crypto</Label>
                <p className="text-sm text-muted-foreground">
                  CoinGecko (primary), Binance, CoinMarketCap
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Prices are cached for 30 seconds. Data may be delayed.
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions - proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleClearAllData} disabled={isClearing}>
              <Trash2 className="mr-2 h-4 w-4" />
              {isClearing ? "Clearing..." : "Clear All Data"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={clearDataOpen}
        onOpenChange={setClearDataOpen}
        title="Clear All Data"
        description="Are you sure you want to clear all data? This will permanently delete all portfolios, transactions, settings, and preferences from both local storage AND the cloud. Your account profile will be preserved. This action cannot be undone."
        confirmLabel="Clear All Data"
        cancelLabel="Cancel"
        onConfirm={confirmClearAllData}
        variant="destructive"
      />
    </div>
  );
}
