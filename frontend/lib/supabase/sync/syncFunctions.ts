/**
 * Sync function factories for Supabase
 * Each function creates a debounced sync operation for a specific data type
 */

import { GUEST_ID } from "@/stores/ownerStore";
import { syncOwners } from "@/lib/supabase/queries/owners";
import { syncPortfolios, syncAccounts } from "@/lib/supabase/queries/portfolios";
import { syncTransactions } from "@/lib/supabase/queries/transactions";
import {
  syncOwnerDashboard,
  syncOwnerSettings,
  syncOwnerSellPlans,
} from "@/lib/supabase/queries/ownerData";
import { syncTags } from "@/lib/supabase/queries/tags";
import { syncSymbolNotes, convertNotesToArray } from "@/lib/supabase/queries/symbolNotes";
import { syncSymbolTags, convertTagsToArray } from "@/lib/supabase/queries/symbolTags";
import { syncTagGroupings, convertGroupingsToArray } from "@/lib/supabase/queries/tagGroupings";
import { syncTrackedSymbols, convertTrackedToArray } from "@/lib/supabase/queries/trackedSymbols";
import { syncCostBasisOverrides, convertOverridesToArray } from "@/lib/supabase/queries/costBasisOverrides";
import { syncSellPlanProgress, convertProgressToArrays } from "@/lib/supabase/queries/sellPlanProgress";
import { syncAllocationSnapshots, convertSnapshotsToArray } from "@/lib/supabase/queries/allocationSnapshots";
import type { AllocationSnapshot } from "@/stores/allocationHistoryStore";
import { debounce, retryWithBackoff } from "./utils";
import { syncLogger as log } from "@/lib/logger";
import type { Owner } from "@/types/owner";
import type { Portfolio, Transaction } from "@/types/portfolio";
import type { Widget, DashboardLayout, Tag, LayoutItem } from "@/types/dashboard";
import type { SellPlan } from "@/stores/sellPlanStore";
import type { Json } from "@/types/database";

/** Sync state refs passed from the main hook */
export interface SyncStateRefs {
  isSyncing: React.MutableRefObject<boolean>;
  isInitialLoad: React.MutableRefObject<boolean>;
}

/**
 * Create debounced sync function for owners
 */
export function createSyncOwnersToSupabase(refs: SyncStateRefs) {
  return debounce(async (owners: Owner[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      log.info(" Syncing owners to Supabase...");
      await syncOwners(
        owners.map((o) => ({
          id: o.id,
          name: o.name,
          password_hash: o.passwordHash,
          is_master: o.isMaster || false,
          created_at: o.createdAt,
        }))
      );
      log.info(" Owners synced successfully");
    } catch (error) {
      log.error(" Failed to sync owners:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for portfolios
 * Uses upsert for conflict resolution (newer timestamp wins)
 */
export function createSyncPortfoliosToSupabase(refs: SyncStateRefs) {
  return debounce(async (portfolios: Portfolio[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      log.info(" Syncing portfolios to Supabase...");
      const now = new Date().toISOString();

      // Sync portfolios with retry
      await retryWithBackoff(
        () =>
          syncPortfolios(
            portfolios.map((p) => ({
              id: p.id,
              name: p.name,
              owner_ids: p.ownerIds || [],
              is_included_in_combined: p.isIncludedInCombined,
              created_at: p.createdAt,
              updated_at: p.updatedAt || now,
            }))
          ),
        3,
        "portfolios sync"
      );

      // Sync accounts (flattened from all portfolios)
      const allAccounts: Array<{
        id: string;
        portfolio_id: string;
        name: string;
        created_at: string;
        updated_at: string;
      }> = [];
      for (const portfolio of portfolios) {
        for (const account of portfolio.accounts) {
          allAccounts.push({
            id: account.id,
            portfolio_id: account.portfolioId,
            name: account.name,
            created_at: account.createdAt,
            updated_at: account.updatedAt || now,
          });
        }
      }
      await retryWithBackoff(() => syncAccounts(allAccounts), 3, "accounts sync");

      log.info(" Portfolios synced successfully");
    } catch (error) {
      // Already logged by retryWithBackoff
    }
  }, 1000);
}

/**
 * Create debounced sync function for transactions
 * Uses upsert for conflict resolution (newer timestamp wins)
 */
export function createSyncTransactionsToSupabase(refs: SyncStateRefs) {
  return debounce(async (transactions: Transaction[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;

    // SAFEGUARD: Never sync empty transactions to avoid deleting cloud data
    if (transactions.length === 0) {
      console.log(
        "[Sync] Skipping transactions sync - local is empty (prevents accidental deletion)"
      );
      return;
    }

    try {
      console.log(`[Sync] Syncing ${transactions.length} transactions to Supabase...`);
      const now = new Date().toISOString();
      await retryWithBackoff(
        () =>
          syncTransactions(
            transactions.map((t) => ({
              id: t.id,
              portfolio_id: t.portfolioId,
              account_id: t.accountId,
              symbol: t.symbol,
              type: t.type,
              asset_type: t.assetType,
              quantity: t.quantity,
              price: t.price,
              date: t.date,
              notes: t.notes || null,
              tags: t.tags || null,
              updated_at: t.updatedAt || now,
            }))
          ),
        3,
        "transactions sync"
      );
      log.info(" Transactions synced successfully");
    } catch (error) {
      // Already logged by retryWithBackoff
    }
  }, 1000);
}

/** Per-portfolio dashboard structure */
interface PortfolioDashboard {
  widgets: Widget[];
  layouts: DashboardLayout;
}

/**
 * Create debounced sync function for dashboard (per-portfolio structure)
 * Syncs the entire dashboards Record<portfolioId, PortfolioDashboard>
 */
export function createSyncDashboardToSupabase(refs: SyncStateRefs) {
  return debounce(
    async (ownerId: string, dashboards: Record<string, PortfolioDashboard>) => {
      const portfolioCount = Object.keys(dashboards || {}).length;
      const totalWidgets = Object.values(dashboards || {}).reduce(
        (sum, d) => sum + (d.widgets?.length || 0),
        0
      );
      console.log("[Dashboard Sync] Triggered:", {
        ownerId: ownerId?.substring(0, 8),
        portfolioCount,
        totalWidgets,
        isSyncing: refs.isSyncing.current,
        isInitialLoad: refs.isInitialLoad.current,
      });

      if (refs.isSyncing.current) {
        console.log("[Dashboard Sync] Skipped - isSyncing is true");
        return;
      }
      if (refs.isInitialLoad.current) {
        console.log("[Dashboard Sync] Skipped - isInitialLoad is true");
        return;
      }
      if (!ownerId) {
        console.log("[Dashboard Sync] Skipped - no ownerId");
        return;
      }
      if (ownerId === GUEST_ID) {
        console.log("[Dashboard Sync] Skipped - guest user");
        return;
      }

      try {
        console.log(`[Dashboard Sync] Syncing ${portfolioCount} portfolio dashboards (${totalWidgets} widgets) to Supabase...`);
        await syncOwnerDashboard(
          ownerId,
          dashboards as unknown as Json,
          null // layouts field deprecated - now stored within dashboards
        );
        console.log("[Dashboard Sync] ✓ Dashboard synced successfully");
      } catch (error) {
        console.error("[Dashboard Sync] ❌ Failed to sync dashboard:", error);
      }
    },
    1000
  );
}

/**
 * Create debounced sync function for settings (per-owner)
 */
export function createSyncSettingsToSupabase(refs: SyncStateRefs) {
  return debounce(
    async (
      ownerId: string,
      settings: {
        autoRefreshEnabled: boolean;
        refreshIntervalSeconds: number;
        metricsMode: string;
        currency: string;
        // Note: mobileMode is intentionally local-only (not synced to cloud)
      }
    ) => {
      if (
        refs.isSyncing.current ||
        refs.isInitialLoad.current ||
        !ownerId ||
        ownerId === GUEST_ID
      )
        return;
      try {
        log.info(" Syncing settings to Supabase...");
        await syncOwnerSettings(ownerId, {
          auto_refresh_enabled: settings.autoRefreshEnabled,
          refresh_interval_seconds: settings.refreshIntervalSeconds,
          metrics_mode: settings.metricsMode as "simple" | "pro",
          currency: settings.currency,
          // mobileMode is NOT synced - it's a local device preference
        });
        log.info(" Settings synced successfully");
      } catch (error) {
        log.error(" Failed to sync settings:", error);
      }
    },
    1000
  );
}

/**
 * Create debounced sync function for sell plans (per-owner)
 * IMPORTANT: Only sync plans created by THIS owner to avoid overwriting others' plans
 */
export function createSyncSellPlansToSupabase(refs: SyncStateRefs) {
  return debounce(async (ownerId: string, plans: SellPlan[]) => {
    if (
      refs.isSyncing.current ||
      refs.isInitialLoad.current ||
      !ownerId ||
      ownerId === GUEST_ID
    )
      return;
    try {
      // Filter to only sync plans created by this owner (or plans without an ownerId, which are legacy local plans)
      const myPlans = plans.filter((p) => !p.ownerId || p.ownerId === ownerId);

      console.log(
        `[Sync] Syncing ${myPlans.length} sell plans to Supabase (filtering from ${plans.length} total)...`
      );
      await syncOwnerSellPlans(
        ownerId,
        myPlans.map((p) => ({
          // Note: Don't pass local `id` - let Supabase auto-generate UUIDs
          portfolio_id: p.portfolioId || null,
          symbol: p.symbol,
          asset_type: p.assetType || "stock",
          plan_type: "sell" as const,
          target_quantity: p.sharesToSell,
          target_price: p.currentPrice,
          notes: JSON.stringify({
            percentage: p.percentage,
            dollarAmount: p.dollarAmount,
            totalShares: p.totalShares,
            portfolioAllocation: p.portfolioAllocation,
            percentOfHolding: p.percentOfHolding,
            accountAllocations: p.accountAllocations,
          }),
          status: "active" as const,
        }))
      );
      log.info(" Sell plans synced successfully");
    } catch (error) {
      log.error(" Failed to sync sell plans:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for tags (shared)
 * Filters out non-UUID IDs (legacy tags)
 */
export function createSyncTagsToSupabase(refs: SyncStateRefs) {
  return debounce(async (tags: Tag[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      // Filter out old non-UUID tag IDs (like "tag-stocks")
      const isValidUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const syncableTags = tags.filter((t) => isValidUUID(t.id));

      if (syncableTags.length === 0) {
        log.info(" No syncable tags (all have non-UUID IDs)");
        return;
      }

      console.log(`[Sync] Syncing ${syncableTags.length} tags to Supabase...`);
      await syncTags(
        syncableTags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          is_default: false,
        }))
      );
      log.info(" Tags synced successfully");
    } catch (error) {
      log.error(" Failed to sync tags:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for symbol notes (shared)
 */
export function createSyncSymbolNotesToSupabase(refs: SyncStateRefs) {
  return debounce(async (notes: Record<string, string>) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      const notesArray = convertNotesToArray(notes);
      if (notesArray.length === 0) {
        log.info(" No symbol notes to sync");
        return;
      }

      console.log(`[Sync] Syncing ${notesArray.length} symbol notes to Supabase...`);
      await syncSymbolNotes(notesArray);
      log.info(" Symbol notes synced successfully");
    } catch (error) {
      // Don't fail silently - but table might not exist yet
      log.warn(" Failed to sync symbol notes:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for symbol tags (shared)
 * Maps symbols to their assigned tag names per portfolio
 */
export function createSyncSymbolTagsToSupabase(refs: SyncStateRefs) {
  return debounce(async (symbolTags: Record<string, string[]>) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      const tagsArray = convertTagsToArray(symbolTags);
      if (tagsArray.length === 0) {
        log.info(" No symbol tags to sync");
        return;
      }

      console.log(`[Sync] Syncing ${tagsArray.length} symbol tags to Supabase...`);
      await syncSymbolTags(tagsArray);
      log.info(" Symbol tags synced successfully");
    } catch (error) {
      // Don't fail silently - but table might not exist yet
      log.warn(" Failed to sync symbol tags:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for tag groupings (per-portfolio)
 * User-created combinations of tags for aggregated portfolio views
 */
export function createSyncTagGroupingsToSupabase(refs: SyncStateRefs) {
  return debounce(async (tagGroupings: Record<string, Array<{ id: string; tags: string[] }>>) => {
    console.log("[Sync] Tag groupings sync triggered");
    console.log("[Sync] Guards - isSyncing:", refs.isSyncing.current, "isInitialLoad:", refs.isInitialLoad.current);

    if (refs.isSyncing.current || refs.isInitialLoad.current) {
      console.log("[Sync] Skipping - blocked by guards");
      return;
    }

    try {
      const portfolioCount = Object.keys(tagGroupings).length;
      console.log(`[Sync] Tag groupings input: ${portfolioCount} portfolios`);
      const groupingsArray = convertGroupingsToArray(tagGroupings);
      console.log(`[Sync] Converted to ${groupingsArray.length} items`);

      if (groupingsArray.length === 0) {
        console.log("[Sync] No tag groupings to sync");
        return;
      }

      console.log(`[Sync] Syncing ${groupingsArray.length} tag groupings to Supabase...`);
      await syncTagGroupings(groupingsArray);
      console.log("[Sync] ✓ Tag groupings synced successfully");
    } catch (error) {
      console.error("[Sync] ❌ Failed to sync tag groupings:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for tracked symbols (shared)
 * Symbols tracked in Quick Overview without transactions
 */
export function createSyncTrackedSymbolsToSupabase(refs: SyncStateRefs) {
  return debounce(async (trackedSymbols: Record<string, string[]>) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      const symbolsArray = convertTrackedToArray(trackedSymbols);
      if (symbolsArray.length === 0) {
        log.info(" No tracked symbols to sync");
        return;
      }

      console.log(`[Sync] Syncing ${symbolsArray.length} tracked symbols to Supabase...`);
      await syncTrackedSymbols(symbolsArray);
      log.info(" Tracked symbols synced successfully");
    } catch (error) {
      log.warn(" Failed to sync tracked symbols:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for cost basis overrides (shared)
 * Manual cost basis values per portfolio
 */
export function createSyncCostBasisOverridesToSupabase(refs: SyncStateRefs) {
  return debounce(async (costBasisOverrides: Record<string, number>) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      const overridesArray = convertOverridesToArray(costBasisOverrides);
      if (overridesArray.length === 0) {
        log.info(" No cost basis overrides to sync");
        return;
      }

      console.log(`[Sync] Syncing ${overridesArray.length} cost basis overrides to Supabase...`);
      await syncCostBasisOverrides(overridesArray);
      log.info(" Cost basis overrides synced successfully");
    } catch (error) {
      log.warn(" Failed to sync cost basis overrides:", error);
    }
  }, 1000);
}

/**
 * Create debounced sync function for sell plan progress (per-owner)
 * Tracks completed sell/buy steps
 */
export function createSyncSellPlanProgressToSupabase(refs: SyncStateRefs) {
  return debounce(
    async (ownerId: string, completedSellIds: Set<string>, completedBuyIds: Set<string>) => {
      if (
        refs.isSyncing.current ||
        refs.isInitialLoad.current ||
        !ownerId ||
        ownerId === GUEST_ID
      )
        return;
      try {
        const progressArray = convertProgressToArrays(completedSellIds, completedBuyIds);
        console.log(`[Sync] Syncing ${progressArray.length} sell plan progress items to Supabase...`);
        await syncSellPlanProgress(ownerId, progressArray);
        log.info(" Sell plan progress synced successfully");
      } catch (error) {
        log.warn(" Failed to sync sell plan progress:", error);
      }
    },
    1000
  );
}

/**
 * Create debounced sync function for allocation snapshots (shared)
 * Historical allocation data saved when plans complete
 */
export function createSyncAllocationSnapshotsToSupabase(refs: SyncStateRefs) {
  return debounce(async (snapshots: AllocationSnapshot[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    try {
      const snapshotsArray = convertSnapshotsToArray(snapshots);
      if (snapshotsArray.length === 0) {
        log.info(" No allocation snapshots to sync");
        return;
      }

      console.log(`[Sync] Syncing ${snapshotsArray.length} allocation snapshots to Supabase...`);
      await syncAllocationSnapshots(snapshotsArray);
      log.info(" Allocation snapshots synced successfully");
    } catch (error) {
      log.warn(" Failed to sync allocation snapshots:", error);
    }
  }, 1000);
}
