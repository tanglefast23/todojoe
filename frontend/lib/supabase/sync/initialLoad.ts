/**
 * Initial Load Logic for Supabase Sync
 *
 * Implements cloud-as-source-of-truth pattern:
 * - If cloud has data -> use cloud data
 * - If cloud is empty AND local has data -> push local to cloud (recovery mode)
 * - Never overwrite local data with empty cloud data
 */

import { fetchAllTasks, upsertTasks } from "@/lib/supabase/queries/tasks";
import { fetchTags, syncTags } from "@/lib/supabase/queries/tags";
import { fetchOwners, syncOwners } from "@/lib/supabase/queries/owners"; // Uses todo_owners table
import {
  fetchAllPermissions,
  upsertPermissions,
} from "@/lib/supabase/queries/permissions";
import { fetchRunningTab, upsertTab } from "@/lib/supabase/queries/runningTab";
import { fetchAllExpenses, upsertExpenses } from "@/lib/supabase/queries/expenses";
import { fetchTabHistory, upsertHistory } from "@/lib/supabase/queries/tabHistory";
import { fetchAllScheduledEvents, upsertScheduledEvents } from "@/lib/supabase/queries/scheduled-events";

import { useTasksStore } from "@/stores/tasksStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useOwnerStore } from "@/stores/ownerStore"; // Syncs to todo_owners table
import { usePermissionsStore } from "@/stores/permissionsStore";
import { useRunningTabStore } from "@/stores/runningTabStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";

import { retryWithBackoff } from "./utils";

import type { Task } from "@/types/tasks";
import type { ScheduledEvent } from "@/types/scheduled-events";
import type { Tag } from "@/types/dashboard";
import type { Owner } from "@/types/owner";
import type { AppPermissions, RunningTab, Expense, TabHistoryEntry } from "@/types/runningTab";
import type { Database } from "@/types/database";

// Database row types for conversions
// NOTE: Uses todo_owners table (separate from investment tracker's owners table)
type OwnerRow = Database["public"]["Tables"]["todo_owners"]["Row"];
type OwnerInsert = Database["public"]["Tables"]["todo_owners"]["Insert"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];

/**
 * Convert database owner row to app Owner type
 */
function ownerRowToApp(row: OwnerRow): Owner {
  return {
    id: row.id,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    isMaster: row.is_master,
  };
}

/**
 * Convert app Owner type to database insert format
 */
function ownerAppToInsert(owner: Owner): OwnerInsert {
  return {
    id: owner.id,
    name: owner.name,
    password_hash: owner.passwordHash,
    created_at: owner.createdAt,
    is_master: owner.isMaster ?? false,
  };
}

/**
 * Convert database tag row to app Tag type
 */
function tagRowToApp(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  };
}

/**
 * Convert app Tag type to database insert format
 */
function tagAppToInsert(tag: Tag): TagInsert {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}

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
  // NOTE: Owners sync to todo_owners table (separate from investment tracker's owners table)
  const [
    cloudTasks,
    cloudTagRows,
    cloudOwnerRows,
    cloudPermissions,
    cloudRunningTab,
    cloudExpenses,
    cloudTabHistory,
    cloudScheduledEvents,
  ] = await Promise.all([
    retryWithBackoff(() => fetchAllTasks(), 3, "fetchAllTasks"),
    retryWithBackoff(() => fetchTags(), 3, "fetchTags"),
    retryWithBackoff(() => fetchOwners(), 3, "fetchOwners"), // Uses todo_owners table
    retryWithBackoff(() => fetchAllPermissions(), 3, "fetchAllPermissions"),
    retryWithBackoff(() => fetchRunningTab(), 3, "fetchRunningTab"),
    retryWithBackoff(() => fetchAllExpenses(), 3, "fetchAllExpenses"),
    retryWithBackoff(() => fetchTabHistory(), 3, "fetchTabHistory"),
    retryWithBackoff(() => fetchAllScheduledEvents(), 3, "fetchAllScheduledEvents"),
  ]);

  // Convert database rows to app types
  const cloudTags = cloudTagRows?.map(tagRowToApp);
  const cloudOwners = cloudOwnerRows?.map(ownerRowToApp);

  // Get local state from stores
  const localTasks = useTasksStore.getState().tasks;
  const localTags = useTagsStore.getState().tags;
  const localOwners = useOwnerStore.getState().owners;
  const localPermissions = usePermissionsStore.getState().permissions;
  const localTab = useRunningTabStore.getState().tab;
  const localExpenses = useRunningTabStore.getState().expenses;
  const localHistory = useRunningTabStore.getState().history;
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

  // Sync Tags
  await syncDataType<Tag[]>({
    name: "tags",
    cloudData: cloudTags,
    localData: localTags,
    hasCloudData: (data) => Array.isArray(data) && data.length > 0,
    hasLocalData: (data) => Array.isArray(data) && data.length > 0,
    updateLocal: (data) => useTagsStore.getState().setTags(data),
    pushToCloud: (data) => syncTags(data.map(tagAppToInsert)),
  });

  // Sync Owners (uses todo_owners table - separate from investment tracker)
  await syncDataType<Owner[]>({
    name: "owners",
    cloudData: cloudOwners,
    localData: localOwners,
    hasCloudData: (data) => Array.isArray(data) && data.length > 0,
    hasLocalData: (data) => Array.isArray(data) && data.length > 0,
    updateLocal: (data) => useOwnerStore.getState().setOwners(data),
    pushToCloud: (data) => syncOwners(data.map(ownerAppToInsert)),
  });

  // Sync Permissions (requires conversion between formats)
  await syncPermissionsData(cloudPermissions, localPermissions);

  // Sync Running Tab
  await syncDataType<RunningTab | null>({
    name: "runningTab",
    cloudData: cloudRunningTab,
    localData: localTab,
    hasCloudData: (data) => data !== null && data !== undefined,
    hasLocalData: (data) => data !== null && data !== undefined,
    updateLocal: (data) => useRunningTabStore.getState().setTab(data),
    pushToCloud: (data) => (data ? upsertTab(data) : Promise.resolve()),
  });

  // Sync Expenses
  await syncDataType<Expense[]>({
    name: "expenses",
    cloudData: cloudExpenses,
    localData: localExpenses,
    hasCloudData: (data) => Array.isArray(data) && data.length > 0,
    hasLocalData: (data) => Array.isArray(data) && data.length > 0,
    updateLocal: (data) => useRunningTabStore.getState().setExpenses(data),
    pushToCloud: (data) => upsertExpenses(data),
  });

  // Sync Tab History
  await syncDataType<TabHistoryEntry[]>({
    name: "tabHistory",
    cloudData: cloudTabHistory,
    localData: localHistory,
    hasCloudData: (data) => Array.isArray(data) && data.length > 0,
    hasLocalData: (data) => Array.isArray(data) && data.length > 0,
    updateLocal: (data) => useRunningTabStore.getState().setHistory(data),
    pushToCloud: (data) => upsertHistory(data),
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

/**
 * Special handling for permissions due to format conversion
 *
 * DB format: array of { id, ownerId, canCompleteTasks, canApproveExpenses, updatedAt }
 *   (already converted to camelCase by the query's rowToPermissions converter)
 * Store format: Record<string, AppPermissions> where key is ownerId
 */
async function syncPermissionsData(
  cloudPermissions: AppPermissions[] | undefined,
  localPermissions: Record<string, AppPermissions>
): Promise<void> {
  const hasCloudData = Array.isArray(cloudPermissions) && cloudPermissions.length > 0;
  const hasLocalData = Object.keys(localPermissions).length > 0;

  if (hasCloudData) {
    // Convert cloud array to local Record format
    // Note: Query functions already return camelCase data (via rowToPermissions converter)
    const permissionsRecord: Record<string, AppPermissions> = {};
    for (const permission of cloudPermissions) {
      permissionsRecord[permission.ownerId] = permission;
    }
    usePermissionsStore.getState().setPermissions(permissionsRecord);
  } else if (hasLocalData) {
    // Recovery mode: push local permissions to cloud
    console.log("[Sync] Recovery: pushing local permissions to cloud");
    try {
      // Convert local Record to array for upsert
      const permissionsArray = Object.values(localPermissions);
      await upsertPermissions(permissionsArray);
    } catch (error) {
      console.error("[Sync] Failed to push local permissions to cloud:", error);
    }
  }
  // If both are empty, skip
}
