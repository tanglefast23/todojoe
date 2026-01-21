/**
 * Sync Functions
 *
 * Factory functions that create debounced sync functions for each data type.
 * Each function handles sync state management and retry logic.
 */

import { SyncStateRefs, debounce, retryWithBackoff } from "./utils";

// Query imports
import { upsertTasks } from "@/lib/supabase/queries/tasks";
import { upsertScheduledEvents } from "@/lib/supabase/queries/scheduled-events";

// Type imports
import type { Task } from "@/types/tasks";
import type { ScheduledEvent } from "@/types/scheduled-events";

/**
 * Creates a debounced sync function for tasks.
 * Uses upsertTasks to sync all tasks to Supabase.
 */
export function createSyncTasksToSupabase(refs: SyncStateRefs) {
  return debounce(async (tasks: Task[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    refs.isSyncing.current = true;
    try {
      console.log("[Sync] Syncing tasks to Supabase...");
      await retryWithBackoff(() => upsertTasks(tasks), 3, "tasks sync");
    } finally {
      refs.isSyncing.current = false;
    }
  }, 1000);
}

/**
 * Creates a debounced sync function for scheduled events.
 * Uses upsertScheduledEvents to sync all events to Supabase.
 */
export function createSyncScheduledEventsToSupabase(refs: SyncStateRefs) {
  return debounce(async (events: ScheduledEvent[]) => {
    if (refs.isSyncing.current || refs.isInitialLoad.current) return;
    refs.isSyncing.current = true;
    try {
      console.log("[Sync] Syncing scheduled events to Supabase...");
      await retryWithBackoff(() => upsertScheduledEvents(events), 3, "scheduled events sync");
    } finally {
      refs.isSyncing.current = false;
    }
  }, 1000);
}
