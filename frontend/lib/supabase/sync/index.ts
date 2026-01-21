/**
 * Supabase Sync Module
 *
 * Exports all sync utilities, functions, and initial load logic
 * for cross-device synchronization.
 */

// Utilities
export {
  debounce,
  retryWithBackoff,
  flushAllPendingSyncs,
  pendingFlushCallbacks,
  arraysEqual,
  objectsEqual,
  type SyncStateRefs,
} from "./utils";

// Sync functions
export {
  createSyncTasksToSupabase,
  createSyncScheduledEventsToSupabase,
} from "./syncFunctions";

// Initial load
export { performInitialLoad } from "./initialLoad";
