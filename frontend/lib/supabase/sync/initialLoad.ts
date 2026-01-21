/**
 * Initial Load Logic for Supabase Sync
 *
 * Implements cloud-as-source-of-truth pattern:
 * - If cloud has data -> use cloud data
 * - If cloud is empty AND local has data -> push local to cloud (recovery mode)
 * - Never overwrite local data with empty cloud data
 */

import { fetchAllTasks, upsertTasks } from "@/lib/supabase/queries/tasks";
import { fetchAllScheduledEvents, upsertScheduledEvents } from "@/lib/supabase/queries/scheduled-events";

import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";

import { retryWithBackoff } from "./utils";

import type { Task } from "@/types/tasks";
import type { ScheduledEvent } from "@/types/scheduled-events";

/**
 * Performs the initial load from Supabase, applying cloud-as-source-of-truth logic.
 *
 * For each data type:
 * - If cloud has data: update local store with cloud data
 * - If cloud is empty AND local has data: push local to cloud (recovery mode)
 * - If both are empty: skip
 */
export async function performInitialLoad(): Promise<void> {
  console.log("[Sync] Starting initial load from Supabase...");

  // Fetch all data from Supabase in parallel with retry logic
  const [cloudTasks, cloudScheduledEvents] = await Promise.all([
    retryWithBackoff(() => fetchAllTasks(), 3, "fetchAllTasks"),
    retryWithBackoff(() => fetchAllScheduledEvents(), 3, "fetchAllScheduledEvents"),
  ]);

  // Get local state from stores
  const localTasks = useTasksStore.getState().tasks;
  const localScheduledEvents = useScheduledEventsStore.getState().events;

  // Sync Tasks
  await syncDataType<Task[]>({
    name: "tasks",
    cloudData: cloudTasks,
    localData: localTasks,
    hasCloudData: (data) => Array.isArray(data) && data.length > 0,
    hasLocalData: (data) => Array.isArray(data) && data.length > 0,
    updateLocal: (data) => useTasksStore.getState().setTasks(data),
    pushToCloud: (data) => upsertTasks(data),
  });

  // Sync Scheduled Events
  await syncDataType<ScheduledEvent[]>({
    name: "scheduledEvents",
    cloudData: cloudScheduledEvents,
    localData: localScheduledEvents,
    hasCloudData: (data) => Array.isArray(data) && data.length > 0,
    hasLocalData: (data) => Array.isArray(data) && data.length > 0,
    updateLocal: (data) => useScheduledEventsStore.getState().setEvents(data),
    pushToCloud: (data) => upsertScheduledEvents(data),
  });

  console.log("[Sync] Initial load complete");
}

/**
 * Generic sync logic for a data type
 */
interface SyncDataTypeConfig<T> {
  name: string;
  cloudData: T | undefined;
  localData: T;
  hasCloudData: (data: T | undefined) => boolean;
  hasLocalData: (data: T) => boolean;
  updateLocal: (data: T) => void;
  pushToCloud: (data: T) => Promise<void>;
}

async function syncDataType<T>(config: SyncDataTypeConfig<T>): Promise<void> {
  const { name, cloudData, localData, hasCloudData, hasLocalData, updateLocal, pushToCloud } =
    config;

  if (hasCloudData(cloudData)) {
    // Cloud has data - use it as source of truth
    updateLocal(cloudData as T);
  } else if (hasLocalData(localData)) {
    // Cloud is empty but local has data - recovery mode
    console.log(`[Sync] Recovery: pushing local ${name} to cloud`);
    try {
      await pushToCloud(localData);
    } catch (error) {
      console.error(`[Sync] Failed to push local ${name} to cloud:`, error);
    }
  }
  // If both are empty, skip
}
