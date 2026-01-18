/**
 * Load per-owner data from Supabase
 * Handles dashboard, settings, and sell plans for specific owners
 */

import { GUEST_ID } from "@/stores/ownerStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import {
  fetchOwnerDashboard,
  fetchOwnerSettings,
  fetchPortfolioSellPlans,
  fetchOwnerSellPlans,
  syncOwnerDashboard,
} from "@/lib/supabase/queries/ownerData";
import { syncLogger as log } from "@/lib/logger";
import type { Widget, DashboardLayout } from "@/types/dashboard";
import type { Json } from "@/types/database";
import type { SellPlan } from "@/stores/sellPlanStore";

type MetricsMode = "simple" | "pro";

/** Per-portfolio dashboard structure */
interface PortfolioDashboard {
  widgets: Widget[];
  layouts: DashboardLayout;
}

interface LoadOwnerDataDeps {
  setAllDashboards: (dashboards: Record<string, PortfolioDashboard>) => void;
  setSettings: (settings: {
    autoRefreshEnabled?: boolean;
    refreshIntervalSeconds?: number;
    metricsMode?: MetricsMode;
    currency?: string;
    // Note: mobileMode is intentionally local-only (not synced)
  }) => void;
  setSellPlans: (plans: SellPlan[]) => void;
}

interface LoadOwnerDataRefs {
  lastLoadedOwnerId: React.MutableRefObject<string | null>;
  loadingOwnerId: React.MutableRefObject<string | null>;
}

/**
 * Load per-owner data from Supabase
 * Includes dashboard, settings, and sell plans for accessible portfolios
 */
export async function loadOwnerDataFromSupabase(
  ownerId: string,
  deps: LoadOwnerDataDeps,
  refs: LoadOwnerDataRefs
): Promise<void> {
  const { setAllDashboards, setSettings, setSellPlans } = deps;
  const { lastLoadedOwnerId, loadingOwnerId } = refs;

  if (!ownerId || ownerId === GUEST_ID || ownerId === lastLoadedOwnerId.current) return;
  // Guard against concurrent loads for different owners
  if (loadingOwnerId.current === ownerId) return; // Already loading this owner

  console.log(`[Sync] Loading per-owner data for ${ownerId.substring(0, 8)}...`);
  loadingOwnerId.current = ownerId;
  lastLoadedOwnerId.current = ownerId;

  try {
    // Fetch dashboard and settings (per-owner)
    console.log("[Sync] Fetching dashboard and settings from Supabase...");
    const [dashboard, settings] = await Promise.all([
      fetchOwnerDashboard(ownerId),
      fetchOwnerSettings(ownerId),
    ]);
    console.log("[Sync] Dashboard fetch result:", dashboard ? "found" : "null");
    console.log("[Sync] Settings fetch result:", settings ? "found" : "null");

    // Race condition guard: if owner changed during fetch, discard results
    if (loadingOwnerId.current !== ownerId) {
      console.log(
        `[Sync] Owner changed during fetch (${ownerId} -> ${loadingOwnerId.current}), discarding results`
      );
      return;
    }

    // Apply dashboard - handle cloud vs local data
    // The widgets field now stores the entire dashboards Record<portfolioId, PortfolioDashboard>
    if (dashboard) {
      const dashboardsData = dashboard.widgets as unknown;

      // Check if it's the new format (Record of portfolio dashboards)
      if (dashboardsData && typeof dashboardsData === "object" && !Array.isArray(dashboardsData)) {
        // New format: Record<portfolioId, { widgets, layouts }>
        const portfolioDashboards = dashboardsData as Record<string, PortfolioDashboard>;
        const portfolioCount = Object.keys(portfolioDashboards).length;
        console.log(`[Sync] Loading per-portfolio dashboards: ${portfolioCount} portfolios`);
        setAllDashboards(portfolioDashboards);
        log.info(` Loaded ${portfolioCount} portfolio dashboards from cloud`);
      } else if (Array.isArray(dashboardsData)) {
        // Legacy format: widgets array - migrate to new format
        // Put all widgets under a "default" portfolio key (will be migrated properly on next save)
        console.log(`[Sync] Migrating legacy dashboard format: ${dashboardsData.length} widgets`);
        const layoutsData = dashboard.layouts as unknown as DashboardLayout;
        setAllDashboards({
          __legacy__: {
            widgets: dashboardsData as Widget[],
            layouts: layoutsData ?? { lg: [], md: [], sm: [] },
          },
        });
        log.info(" Migrated legacy dashboard format to per-portfolio structure");
      } else {
        // Fallback: reset to defaults
        setAllDashboards({});
        log.info(" Reset dashboard to defaults (unrecognized format)");
      }
    } else {
      // No cloud data - check if localStorage has data to sync UP
      const localDashboard = useDashboardStore.getState();
      const hasLocalData = localDashboard.dashboards && Object.keys(localDashboard.dashboards).length > 0;

      if (hasLocalData) {
        // Keep localStorage data and sync it TO cloud (don't reset!)
        const localCount = Object.keys(localDashboard.dashboards).length;
        console.log(`[Sync] No cloud dashboard, but found ${localCount} local portfolio dashboards - syncing to cloud`);
        try {
          await syncOwnerDashboard(
            ownerId,
            localDashboard.dashboards as unknown as Json,
            null
          );
          log.info(" Synced local dashboards to cloud (first-time sync for this owner)");
        } catch (syncError) {
          console.warn("[Sync] Failed to sync local dashboards to cloud:", syncError);
        }
        // Don't call setAllDashboards - keep the existing localStorage data
      } else {
        // No cloud data AND no local data - start fresh
        setAllDashboards({});
        log.info(" Reset dashboard to defaults (no saved data anywhere)");
      }
    }

    // Apply settings - reset to defaults if no data exists for this owner
    // Note: mobileMode is intentionally NOT synced - it stays local to this device
    if (settings) {
      setSettings({
        autoRefreshEnabled: settings.auto_refresh_enabled,
        refreshIntervalSeconds: settings.refresh_interval_seconds,
        metricsMode: settings.metrics_mode,
        currency: settings.currency,
      });
      log.info(" Loaded settings");
    } else {
      // Reset to default settings for new owner
      // Note: mobileMode is NOT reset - it's a local device preference
      setSettings({
        autoRefreshEnabled: true,
        refreshIntervalSeconds: 30,
        metricsMode: "simple",
        currency: "CAD",
      });
      log.info(" Reset settings to defaults (no saved data for this owner)");
    }

    // SELL PLANS: Fetch by portfolio access (shared data), not by owner
    // Get all portfolios this owner has access to
    const currentPortfolios = usePortfolioStore.getState().portfolios;
    const accessiblePortfolios = currentPortfolios.filter(
      (p) => p.ownerIds && p.ownerIds.includes(ownerId)
    );

    // Fetch sell plans for all accessible portfolios IN PARALLEL (was sequential waterfall)
    const sellPlansResults = await Promise.all(
      accessiblePortfolios.map((portfolio) =>
        fetchPortfolioSellPlans(portfolio.id).catch((err) => {
          console.warn(`[Sync] Failed to fetch sell plans for portfolio ${portfolio.id}:`, err);
          return [] as Awaited<ReturnType<typeof fetchPortfolioSellPlans>>;
        })
      )
    );

    // Helper to convert DB plan to local format
    const convertDbPlan = (p: Awaited<ReturnType<typeof fetchPortfolioSellPlans>>[number]): SellPlan => {
      const notes = p.notes ? JSON.parse(p.notes) : {};
      return {
        id: p.id,
        symbol: p.symbol,
        percentage: notes.percentage || 0,
        dollarAmount: notes.dollarAmount || 0,
        sharesToSell: p.target_quantity || 0,
        currentPrice: p.target_price || 0,
        totalShares: notes.totalShares || 0,
        portfolioAllocation: notes.portfolioAllocation || 0,
        percentOfHolding: notes.percentOfHolding || 0,
        accountAllocations: notes.accountAllocations || [],
        portfolioId: p.portfolio_id || undefined,
        assetType: p.asset_type,
        ownerId: p.owner_id,
      };
    };

    // Flatten results into single array
    const allSellPlans: SellPlan[] = [];
    const seenIds = new Set<string>();
    for (const dbPlans of sellPlansResults) {
      for (const p of dbPlans) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allSellPlans.push(convertDbPlan(p));
        }
      }
    }

    // FALLBACK: If no plans found by portfolio, also check by owner_id
    // This recovers plans that might have been saved with incorrect portfolioIds
    // (e.g., combined group IDs instead of actual portfolio IDs)
    if (allSellPlans.length === 0) {
      try {
        const ownerPlans = await fetchOwnerSellPlans(ownerId);
        for (const p of ownerPlans) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            allSellPlans.push(convertDbPlan(p));
          }
        }
        if (ownerPlans.length > 0) {
          console.log(`[Sync] Recovered ${ownerPlans.length} sell plans via owner_id fallback`);
        }
      } catch (err) {
        console.warn(`[Sync] Failed to fetch sell plans by owner_id:`, err);
      }
    }

    // Race condition guard: if owner changed during sell plans fetch, discard
    if (loadingOwnerId.current !== ownerId) {
      console.log(`[Sync] Owner changed during sell plans fetch, discarding results`);
      return;
    }

    if (allSellPlans.length > 0) {
      setSellPlans(allSellPlans);
      console.log(
        `[Sync] Loaded ${allSellPlans.length} sell plans from ${accessiblePortfolios.length} portfolios`
      );
    } else {
      // Don't wipe local state if no plans found - preserve existing local plans
      // Only set empty if we're confident there are truly no plans
      log.info(" No sell plans found in accessible portfolios (preserving local state)");
    }

    log.info(" Per-owner data loaded successfully");
  } catch (error) {
    log.error(" Failed to load per-owner data:", error);
  } finally {
    // Clear loading state (only if we were the one loading)
    if (loadingOwnerId.current === ownerId) {
      loadingOwnerId.current = null;
    }
  }
}
