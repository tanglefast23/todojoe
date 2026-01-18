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

  // Subscribe to store changes
  const tasks = useTasksStore((state) => state.tasks);
  const tags = useTagsStore((state) => state.tags);
  const owners = useOwnerStore((state) => state.owners);
  const permissions = usePermissionsStore((state) => state.permissions);
  const tab = useRunningTabStore((state) => state.tab);
  const expenses = useRunningTabStore((state) => state.expenses);
  const history = useRunningTabStore((state) => state.history);

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
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && initialLoadComplete.current) {
        console.log("[Sync] Tab visible - refreshing data from cloud...");
        isInitialLoad.current = true;
        try {
          await performInitialLoad();
        } catch (error) {
          console.error("[Sync] Visibility refresh failed:", error);
        } finally {
          isInitialLoad.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
}
