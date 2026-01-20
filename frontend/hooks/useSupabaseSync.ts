"use client";

/**
 * useSupabaseSync Hook
 *
 * Handles bidirectional sync between Zustand stores and Supabase.
 * - On mount: performs initial load from cloud (cloud-as-source-of-truth)
 * - On store changes: debounced sync to cloud
 * - On page unload: flushes all pending syncs
 */

import { useEffect, useRef, useCallback } from "react";

// Stores
import { useTasksStore } from "@/stores/tasksStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { useRunningTabStore } from "@/stores/runningTabStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";

// Sync functions
import {
  performInitialLoad,
  createSyncTasksToSupabase,
  createSyncTagsToSupabase,
  createSyncOwnersToSupabase,
  createSyncPermissionsToSupabase,
  createSyncRunningTabToSupabase,
  createSyncExpensesToSupabase,
  createSyncTabHistoryToSupabase,
  createSyncScheduledEventsToSupabase,
  flushAllPendingSyncs,
  type SyncStateRefs,
} from "@/lib/supabase/sync";

/**
 * Hook that manages Supabase synchronization for all stores.
 * Should be used once at the app root level via SupabaseSyncProvider.
 */
export function useSupabaseSync(): void {
  // Refs for sync state management
  const isInitialLoad = useRef(true);
  const isSyncing = useRef(false);
  const initialLoadComplete = useRef(false);

  // Create refs object for sync functions
  const refs: SyncStateRefs = {
    isInitialLoad,
    isSyncing,
  };

  // Create debounced sync functions (memoized to avoid recreating on each render)
  const syncTasks = useRef(createSyncTasksToSupabase(refs));
  const syncTags = useRef(createSyncTagsToSupabase(refs));
  const syncOwners = useRef(createSyncOwnersToSupabase(refs));
  const syncPermissions = useRef(createSyncPermissionsToSupabase(refs));
  const syncRunningTab = useRef(createSyncRunningTabToSupabase(refs));
  const syncExpenses = useRef(createSyncExpensesToSupabase(refs));
  const syncTabHistory = useRef(createSyncTabHistoryToSupabase(refs));
  const syncScheduledEvents = useRef(createSyncScheduledEventsToSupabase(refs));

  // Subscribe to store changes
  const tasks = useTasksStore((state) => state.tasks);
  const tags = useTagsStore((state) => state.tags);
  const owners = useOwnerStore((state) => state.owners);
  const permissions = usePermissionsStore((state) => state.permissions);
  const tab = useRunningTabStore((state) => state.tab);
  const expenses = useRunningTabStore((state) => state.expenses);
  const history = useRunningTabStore((state) => state.history);
  const scheduledEvents = useScheduledEventsStore((state) => state.events);

  // Perform initial load on mount
  useEffect(() => {
    const doInitialLoad = async () => {
      try {
        await performInitialLoad();
      } catch (error) {
        console.error("[Sync] Initial load failed:", error);
      } finally {
        isInitialLoad.current = false;
        initialLoadComplete.current = true;
      }
    };

    doInitialLoad();
  }, []);

  // Setup beforeunload handler to flush pending syncs
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushAllPendingSyncs();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Re-fetch data when tab becomes visible (user switches back to app or device)
  // This enables cross-device sync without requiring manual refresh
  // Uses multiple event types for better mobile compatibility (iOS Safari especially)
  useEffect(() => {
    let lastSyncTime = 0;
    const MIN_SYNC_INTERVAL = 5000; // Don't sync more than once per 5 seconds

    const refreshFromCloud = async (source: string) => {
      const now = Date.now();
      if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        console.log(`[Sync] Skipping ${source} refresh (too soon)`);
        return;
      }
      if (!initialLoadComplete.current || isInitialLoad.current) {
        return;
      }

      console.log(`[Sync] ${source} - refreshing data from cloud...`);
      lastSyncTime = now;
      isInitialLoad.current = true;
      try {
        await performInitialLoad();
      } catch (error) {
        console.error(`[Sync] ${source} refresh failed:`, error);
      } finally {
        isInitialLoad.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshFromCloud("Tab visible");
      }
    };

    // pageshow fires when page is restored from back-forward cache (common on iOS)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refreshFromCloud("Page restored from bfcache");
      }
    };

    // focus event as fallback for iOS Safari where visibilitychange is unreliable
    const handleFocus = () => {
      refreshFromCloud("Window focus");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Tasks sync disabled - individual actions (add, delete, complete, uncomplete)
  // now sync directly to Supabase. Bulk sync was causing deleted tasks to reappear
  // because upsertTasks doesn't delete removed items.
  // useEffect(() => {
  //   if (!initialLoadComplete.current) return;
  //   syncTasks.current(tasks);
  // }, [tasks]);

  // Sync tags when they change
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    syncTags.current(tags);
  }, [tags]);

  // Sync owners when they change
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    syncOwners.current(owners);
  }, [owners]);

  // Sync permissions when they change
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    syncPermissions.current(permissions);
  }, [permissions]);

  // Sync running tab when it changes
  useEffect(() => {
    if (!initialLoadComplete.current || !tab) return;
    syncRunningTab.current(tab);
  }, [tab]);

  // Expenses sync disabled - individual actions (add, approve, reject, delete, clear)
  // now sync directly to Supabase. Bulk sync was causing deleted items to reappear
  // because upsertExpenses doesn't delete removed items.
  // useEffect(() => {
  //   if (!initialLoadComplete.current) return;
  //   syncExpenses.current(expenses);
  // }, [expenses]);

  // Sync tab history when it changes
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    syncTabHistory.current(history);
  }, [history]);

  // Sync scheduled events when they change
  // Note: Individual actions (add, complete, delete) also sync directly to Supabase.
  // This provides retry logic and ensures changes aren't lost if individual syncs fail.
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    syncScheduledEvents.current(scheduledEvents);
  }, [scheduledEvents]);
}
