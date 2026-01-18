/**
 * Supabase sync hook
 * Fetches data from Supabase on mount and syncs changes back
 * Handles both shared data (portfolios, transactions, tags) and per-owner data (dashboard, settings, sell plans)
 */
"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useOwnerStore, GUEST_ID, ACTIVE_OWNER_CHANGED_EVENT } from "@/stores/ownerStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSellPlanStore } from "@/stores/sellPlanStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useAllocationHistoryStore } from "@/stores/allocationHistoryStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import {
  createSyncOwnersToSupabase,
  createSyncPortfoliosToSupabase,
  createSyncTransactionsToSupabase,
  createSyncDashboardToSupabase,
  createSyncSettingsToSupabase,
  createSyncSellPlansToSupabase,
  createSyncTagsToSupabase,
  createSyncSymbolNotesToSupabase,
  createSyncSymbolTagsToSupabase,
  createSyncTagGroupingsToSupabase,
  createSyncTrackedSymbolsToSupabase,
  createSyncCostBasisOverridesToSupabase,
  createSyncSellPlanProgressToSupabase,
  createSyncAllocationSnapshotsToSupabase,
  performInitialLoad,
  loadOwnerDataFromSupabase,
} from "@/lib/supabase/sync";

export function useSupabaseSync() {
  const isInitialLoad = useRef(true);
  const isSyncing = useRef(false);
  const lastLoadedOwnerId = useRef<string | null>(null);
  // Track which owner is currently being loaded (race condition guard)
  const loadingOwnerId = useRef<string | null>(null);
  // State to trigger effects after initial load completes
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Owner store
  const owners = useOwnerStore((state) => state.owners);
  const setOwners = useOwnerStore((state) => state.setOwners);
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);

  // Portfolio store
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const transactions = usePortfolioStore((state) => state.transactions);
  const symbolNotes = usePortfolioStore((state) => state.symbolNotes);
  const symbolTags = usePortfolioStore((state) => state.symbolTags);
  const tagGroupings = usePortfolioStore((state) => state.tagGroupings);
  const trackedSymbols = usePortfolioStore((state) => state.trackedSymbols);
  const costBasisOverrides = usePortfolioStore((state) => state.costBasisOverrides);
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios);
  const setTransactions = usePortfolioStore((state) => state.setTransactions);
  const setSymbolNotes = usePortfolioStore((state) => state.setSymbolNotes);
  const setSymbolTags = usePortfolioStore((state) => state.setSymbolTags);
  const setTagGroupings = usePortfolioStore((state) => state.setTagGroupings);
  const setTrackedSymbols = usePortfolioStore((state) => state.setTrackedSymbols);
  const setCostBasisOverrides = usePortfolioStore((state) => state.setCostBasisOverrides);

  // Dashboard store (per-portfolio structure)
  const dashboards = useDashboardStore((state) => state.dashboards);
  const setAllDashboards = useDashboardStore((state) => state.setAllDashboards);

  // Settings store (per-owner, except mobileMode which is local-only)
  const autoRefreshEnabled = useSettingsStore((state) => state.autoRefreshEnabled);
  const refreshIntervalSeconds = useSettingsStore((state) => state.refreshIntervalSeconds);
  const metricsMode = useSettingsStore((state) => state.metricsMode);
  const currency = useSettingsStore((state) => state.currency);
  // Note: mobileMode is NOT synced - it persists locally via Zustand persist
  const setSettings = useSettingsStore((state) => state.setSettings);

  // Sell plans store (per-owner)
  const sellPlans = useSellPlanStore((state) => state.sellPlans);
  const completedSellIds = useSellPlanStore((state) => state.completedSellIds);
  const completedBuyIds = useSellPlanStore((state) => state.completedBuyIds);
  const setSellPlans = useSellPlanStore((state) => state.setSellPlans);

  // Allocation history store (shared)
  const allocationSnapshots = useAllocationHistoryStore((state) => state.snapshots);

  // Currency store (consolidate with settingsStore)
  const currencyStoreCurrency = useCurrencyStore((state) => state.currency);
  const setCurrencyStoreCurrency = useCurrencyStore((state) => state.setCurrency);

  // Tags store (shared)
  const tags = useTagsStore((state) => state.tags);
  const setTags = useTagsStore((state) => state.setTags);

  // Track active owner for per-owner data loading
  const [activeOwnerId, setActiveOwnerIdState] = useState<string | null>(null);

  // Create sync state refs object for sync functions
  const syncStateRefs = useMemo(
    () => ({
      isSyncing,
      isInitialLoad,
    }),
    []
  );

  // Create debounced sync functions
  const syncOwnersToSupabase = useMemo(
    () => createSyncOwnersToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncPortfoliosToSupabase = useMemo(
    () => createSyncPortfoliosToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncTransactionsToSupabase = useMemo(
    () => createSyncTransactionsToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncDashboardToSupabase = useMemo(
    () => createSyncDashboardToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncSettingsToSupabase = useMemo(
    () => createSyncSettingsToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncSellPlansToSupabase = useMemo(
    () => createSyncSellPlansToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncTagsToSupabase = useMemo(
    () => createSyncTagsToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncSymbolNotesToSupabase = useMemo(
    () => createSyncSymbolNotesToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncSymbolTagsToSupabase = useMemo(
    () => createSyncSymbolTagsToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncTagGroupingsToSupabase = useMemo(
    () => createSyncTagGroupingsToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncTrackedSymbolsToSupabase = useMemo(
    () => createSyncTrackedSymbolsToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncCostBasisOverridesToSupabase = useMemo(
    () => createSyncCostBasisOverridesToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncSellPlanProgressToSupabase = useMemo(
    () => createSyncSellPlanProgressToSupabase(syncStateRefs),
    [syncStateRefs]
  );
  const syncAllocationSnapshotsToSupabase = useMemo(
    () => createSyncAllocationSnapshotsToSupabase(syncStateRefs),
    [syncStateRefs]
  );

  // Listen for active owner changes via custom event (no polling needed)
  useEffect(() => {
    // Check on mount
    const currentOwnerId = getActiveOwnerId();
    if (currentOwnerId !== activeOwnerId) {
      setActiveOwnerIdState(currentOwnerId);
    }

    // Listen for changes via custom event
    const handleOwnerChange = (event: CustomEvent<{ ownerId: string | null }>) => {
      setActiveOwnerIdState(event.detail.ownerId);
    };

    window.addEventListener(
      ACTIVE_OWNER_CHANGED_EVENT,
      handleOwnerChange as EventListener
    );
    return () => {
      window.removeEventListener(
        ACTIVE_OWNER_CHANGED_EVENT,
        handleOwnerChange as EventListener
      );
    };
  }, [activeOwnerId, getActiveOwnerId]);

  // Load per-owner data from Supabase
  const loadOwnerData = useCallback(
    async (ownerId: string) => {
      await loadOwnerDataFromSupabase(
        ownerId,
        { setAllDashboards, setSettings, setSellPlans },
        { lastLoadedOwnerId, loadingOwnerId }
      );
    },
    [setAllDashboards, setSettings, setSellPlans]
  );

  // Initial load from Supabase
  useEffect(() => {
    async function loadFromSupabase() {
      isSyncing.current = true;
      try {
        await performInitialLoad({
          setOwners,
          setPortfolios,
          setTransactions,
          setTags,
          setSymbolNotes,
          setSymbolTags,
          setTagGroupings,
          setTrackedSymbols,
          setCostBasisOverrides,
        });
      } catch (error) {
        console.error("[Sync] ✗ Failed to load from Supabase:", error);
        console.log("[Sync] Keeping local data due to cloud error");
        // IMPORTANT: On error, keep local data - don't clear anything
      } finally {
        isSyncing.current = false;
        isInitialLoad.current = false;
        setInitialLoadComplete(true);
        console.log("[Sync] Initial load complete, ready for per-owner sync");
      }
    }

    loadFromSupabase();
  }, [setOwners, setPortfolios, setTransactions, setTags, setSymbolNotes, setSymbolTags, setTagGroupings, setTrackedSymbols, setCostBasisOverrides]);

  // Sync owners when they change
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncOwnersToSupabase(owners);
    }
  }, [owners, syncOwnersToSupabase]);

  // Sync portfolios when they change
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncPortfoliosToSupabase(portfolios);
    }
  }, [portfolios, syncPortfoliosToSupabase]);

  // Sync transactions when they change
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncTransactionsToSupabase(transactions);
    }
  }, [transactions, syncTransactionsToSupabase]);

  // Sync tags when they change (shared)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncTagsToSupabase(tags);
    }
  }, [tags, syncTagsToSupabase]);

  // Sync symbol notes when they change (shared)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncSymbolNotesToSupabase(symbolNotes);
    }
  }, [symbolNotes, syncSymbolNotesToSupabase]);

  // Sync symbol tags when they change (shared)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncSymbolTagsToSupabase(symbolTags);
    }
  }, [symbolTags, syncSymbolTagsToSupabase]);

  // Sync tag groupings when they change (per-portfolio)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncTagGroupingsToSupabase(tagGroupings);
    }
  }, [tagGroupings, syncTagGroupingsToSupabase]);

  // Load per-owner data when active owner changes (or when initial load completes)
  // CRITICAL: Clear pending syncs when switching users to prevent cross-user data writes
  useEffect(() => {
    console.log("[Sync Effect] Owner data effect:", { initialLoadComplete, activeOwnerId: activeOwnerId?.substring(0, 8) });
    if (initialLoadComplete && activeOwnerId && activeOwnerId !== GUEST_ID) {
      // When switching users, we need to be careful:
      // 1. If the previous user had pending changes, those should have been flushed
      //    when they were still active (via the dashboard sync effect)
      // 2. Now that we're switching, we should NOT flush because the pending data
      //    may belong to the OLD user, not the NEW user
      // 3. Instead, just load the new user's data - the old pending data will be
      //    discarded (which is correct behavior for user switching)
      console.log("[Sync Effect] Loading owner data for new user...");
      loadOwnerData(activeOwnerId);
    }
  }, [initialLoadComplete, activeOwnerId, loadOwnerData]);

  // Sync dashboard when it changes (per-portfolio structure)
  useEffect(() => {
    console.log("[Sync Effect] Dashboard effect:", {
      initialLoadComplete,
      activeOwnerId: activeOwnerId?.substring(0, 8),
      dashboardCount: Object.keys(dashboards || {}).length,
    });
    if (initialLoadComplete && activeOwnerId && activeOwnerId !== GUEST_ID) {
      console.log("[Sync Effect] Calling syncDashboardToSupabase...");
      syncDashboardToSupabase(activeOwnerId, dashboards);
    }
  }, [initialLoadComplete, activeOwnerId, dashboards, syncDashboardToSupabase]);

  // Sync settings when they change (per-owner)
  // Note: mobileMode is intentionally NOT synced - it's a local device preference
  useEffect(() => {
    if (!isInitialLoad.current && activeOwnerId && activeOwnerId !== GUEST_ID) {
      syncSettingsToSupabase(activeOwnerId, {
        autoRefreshEnabled,
        refreshIntervalSeconds,
        metricsMode,
        currency,
      });
    }
  }, [
    activeOwnerId,
    autoRefreshEnabled,
    refreshIntervalSeconds,
    metricsMode,
    currency,
    syncSettingsToSupabase,
  ]);

  // Sync sell plans when they change (per-owner)
  useEffect(() => {
    if (!isInitialLoad.current && activeOwnerId && activeOwnerId !== GUEST_ID) {
      syncSellPlansToSupabase(activeOwnerId, sellPlans);
    }
  }, [activeOwnerId, sellPlans, syncSellPlansToSupabase]);

  // Sync tracked symbols when they change (shared)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncTrackedSymbolsToSupabase(trackedSymbols);
    }
  }, [trackedSymbols, syncTrackedSymbolsToSupabase]);

  // Sync cost basis overrides when they change (shared)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncCostBasisOverridesToSupabase(costBasisOverrides);
    }
  }, [costBasisOverrides, syncCostBasisOverridesToSupabase]);

  // Sync sell plan progress when it changes (per-owner)
  useEffect(() => {
    if (!isInitialLoad.current && activeOwnerId && activeOwnerId !== GUEST_ID) {
      syncSellPlanProgressToSupabase(activeOwnerId, completedSellIds, completedBuyIds);
    }
  }, [activeOwnerId, completedSellIds, completedBuyIds, syncSellPlanProgressToSupabase]);

  // Sync allocation snapshots when they change (shared)
  useEffect(() => {
    if (!isInitialLoad.current) {
      syncAllocationSnapshotsToSupabase(allocationSnapshots);
    }
  }, [allocationSnapshots, syncAllocationSnapshotsToSupabase]);

  // Consolidate currencyStore with settingsStore (settingsStore is synced to Supabase)
  // Only sync FROM cloud TO local on initial load - no bidirectional sync to avoid loops
  // The CurrencyToggle component updates both stores directly
  const hasSyncedCurrencyFromCloud = useRef(false);

  useEffect(() => {
    // One-time sync: when settings are loaded from cloud, update currencyStore
    if (initialLoadComplete && !hasSyncedCurrencyFromCloud.current && currency) {
      if (currency === "USD" || currency === "CAD") {
        hasSyncedCurrencyFromCloud.current = true;
        if (currency !== currencyStoreCurrency) {
          setCurrencyStoreCurrency(currency);
        }
      }
    }
  }, [initialLoadComplete, currency, currencyStoreCurrency, setCurrencyStoreCurrency]);
}
