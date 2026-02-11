"use client";

/**
 * useSupabaseSync Hook
 *
 * Handles bidirectional sync between Zustand stores and Supabase.
 * - On mount: performs initial load from cloud (cloud-as-source-of-truth)
 * - On store changes: debounced sync to cloud
 * - On page unload: flushes all pending syncs
 */

import { useEffect, useRef } from "react";

// Supabase client
import { isSupabaseConfigured } from "@/lib/supabase/client";

// Sync functions
import {
  performInitialLoad,
  flushAllPendingSyncs,
} from "@/lib/supabase/sync";

/**
 * Hook that manages Supabase synchronization for all stores.
 * Should be used once at the app root level via SupabaseSyncProvider.
 */
export function useSupabaseSync(): void {
  // Refs for sync state management
  const isInitialLoad = useRef(true);
  const initialLoadComplete = useRef(false);

  // Check if Supabase is configured - skip all sync if not
  const supabaseEnabled = isSupabaseConfigured();

  // Perform initial load on mount (only if Supabase is configured)
  useEffect(() => {
    if (!supabaseEnabled) {
      // Mark as complete so the app can function without Supabase
      isInitialLoad.current = false;
      initialLoadComplete.current = true;
      return;
    }

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
  }, [supabaseEnabled]);

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
    // Skip visibility sync if Supabase is not configured
    if (!supabaseEnabled) return;

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
  }, [supabaseEnabled]);

  // Tasks sync disabled - individual actions (add, delete, complete, uncomplete)
  // now sync directly to Supabase. Bulk sync was causing deleted tasks to reappear
  // because upsertTasks doesn't delete removed items.
  // useEffect(() => {
  //   if (!initialLoadComplete.current) return;
  //   syncTasks.current(tasks);
  // }, [tasks]);

  // Scheduled events sync disabled - individual actions (add, delete, complete, uncomplete)
  // now sync directly to Supabase (same pattern as tasks).
  // Bulk upsert was causing double writes on every mutation.
  // useEffect(() => {
  //   if (!supabaseEnabled || !initialLoadComplete.current) return;
  //   syncScheduledEvents.current(scheduledEvents);
  // }, [scheduledEvents, supabaseEnabled]);
}
