/**
 * Supabase queries for running_tab table
 * This is a singleton table - there should only be one tab record
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";
import type { RunningTab } from "@/types/runningTab";

type RunningTabRow = Database["public"]["Tables"]["running_tab"]["Row"];
type RunningTabInsert = Database["public"]["Tables"]["running_tab"]["Insert"];
type RunningTabUpdate = Database["public"]["Tables"]["running_tab"]["Update"];

// Convert database row to app type (snake_case to camelCase)
function rowToRunningTab(row: RunningTabRow): RunningTab {
  return {
    id: row.id,
    initialBalance: row.initial_balance,
    currentBalance: row.current_balance,
    initializedBy: row.initialized_by,
    initializedAt: row.initialized_at,
    updatedAt: row.updated_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function tabToInsert(tab: Omit<RunningTab, "id"> & { id?: string }): RunningTabInsert {
  return {
    id: tab.id,
    initial_balance: tab.initialBalance,
    current_balance: tab.currentBalance,
    initialized_by: tab.initializedBy,
    initialized_at: tab.initializedAt,
    updated_at: tab.updatedAt,
  };
}

function tabToUpdate(tab: Partial<RunningTab>): RunningTabUpdate {
  const update: RunningTabUpdate = {};
  if (tab.initialBalance !== undefined) update.initial_balance = tab.initialBalance;
  if (tab.currentBalance !== undefined) update.current_balance = tab.currentBalance;
  if (tab.initializedBy !== undefined) update.initialized_by = tab.initializedBy;
  if (tab.initializedAt !== undefined) update.initialized_at = tab.initializedAt;
  if (tab.updatedAt !== undefined) update.updated_at = tab.updatedAt;
  return update;
}

/**
 * Fetch the running tab record (singleton)
 * Returns null if no tab has been initialized
 */
export async function fetchRunningTab(): Promise<RunningTab | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("running_tab")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    // PGRST116 = no rows found (not an error for singleton)
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching running tab:", error);
    throw error;
  }

  return rowToRunningTab(data as RunningTabRow);
}

/**
 * Initialize the running tab with a starting balance
 */
export async function initializeTab(
  initialBalance: number,
  initializedBy: string | null
): Promise<RunningTab> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const insertData: RunningTabInsert = {
    initial_balance: initialBalance,
    current_balance: initialBalance,
    initialized_by: initializedBy,
    initialized_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("running_tab")
    .insert(insertData as never)
    .select()
    .single();

  if (error) {
    console.error("Error initializing tab:", error);
    throw error;
  }

  return rowToRunningTab(data as RunningTabRow);
}

/**
 * Update the current balance of the running tab
 */
export async function updateTabBalance(id: string, newBalance: number): Promise<RunningTab> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("running_tab")
    .update({
      current_balance: newBalance,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating tab balance:", error);
    throw error;
  }

  return rowToRunningTab(data as RunningTabRow);
}

/**
 * Update the running tab with partial updates
 */
export async function updateRunningTab(id: string, updates: Partial<RunningTab>): Promise<RunningTab> {
  const supabase = getSupabaseClient();
  const updateData = {
    ...tabToUpdate(updates),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("running_tab")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating running tab:", error);
    throw error;
  }

  return rowToRunningTab(data as RunningTabRow);
}

/**
 * Upsert the running tab (for sync purposes)
 * Since this is a singleton, we use upsert to create or update
 */
export async function upsertTab(tab: RunningTab): Promise<void> {
  const supabase = getSupabaseClient();
  const row = tabToInsert(tab);

  const { error } = await supabase
    .from("running_tab")
    .upsert(row as never, { onConflict: "id" });

  if (error) {
    console.error("Error upserting running tab:", error);
    throw error;
  }
}

/**
 * Delete the running tab (reset)
 */
export async function deleteRunningTab(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("running_tab")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting running tab:", error);
    throw error;
  }
}

/**
 * Sync the running tab - replaces existing tab with new one
 */
export async function syncRunningTab(tab: RunningTab | null): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete existing tab
  const { error: deleteError } = await supabase
    .from("running_tab")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting running tab:", deleteError);
    throw deleteError;
  }

  // Insert new tab if provided
  if (tab) {
    const row = tabToInsert(tab);
    const { error: insertError } = await supabase
      .from("running_tab")
      .insert(row as never);

    if (insertError) {
      console.error("Error inserting running tab:", insertError);
      throw insertError;
    }
  }
}
