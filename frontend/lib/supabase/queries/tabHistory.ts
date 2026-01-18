/**
 * Supabase queries for tab_history table
 * Audit log for all changes to the running tab balance
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";
import type { TabHistoryEntry } from "@/types/runningTab";

type TabHistoryRow = Database["public"]["Tables"]["tab_history"]["Row"];
type TabHistoryInsert = Database["public"]["Tables"]["tab_history"]["Insert"];

// Convert database row to app type (snake_case to camelCase)
function rowToHistoryEntry(row: TabHistoryRow): TabHistoryEntry {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    relatedExpenseId: row.related_expense_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function entryToInsert(entry: Omit<TabHistoryEntry, "id"> & { id?: string }): TabHistoryInsert {
  return {
    id: entry.id,
    type: entry.type,
    amount: entry.amount,
    description: entry.description,
    related_expense_id: entry.relatedExpenseId,
    created_by: entry.createdBy,
    created_at: entry.createdAt,
  };
}

/**
 * Fetch all tab history entries, ordered by most recent first
 */
export async function fetchTabHistory(): Promise<TabHistoryEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tab_history")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tab history:", error);
    throw error;
  }

  return ((data as TabHistoryRow[]) || []).map(rowToHistoryEntry);
}

/**
 * Add a new history entry
 */
export async function addHistoryEntry(
  entry: Omit<TabHistoryEntry, "id">
): Promise<TabHistoryEntry> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tab_history")
    .insert(entryToInsert(entry) as never)
    .select()
    .single();

  if (error) {
    console.error("Error adding history entry:", error);
    throw error;
  }

  return rowToHistoryEntry(data as TabHistoryRow);
}

/**
 * Bulk upsert history entries (for sync purposes)
 */
export async function upsertHistory(entries: TabHistoryEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const supabase = getSupabaseClient();
  const rows = entries.map((entry) => entryToInsert(entry));

  const { error } = await supabase
    .from("tab_history")
    .upsert(rows as never, { onConflict: "id" });

  if (error) {
    console.error("Error upserting history entries:", error);
    throw error;
  }
}

/**
 * Delete a history entry
 */
export async function deleteHistoryEntry(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("tab_history")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting history entry:", error);
    throw error;
  }
}

/**
 * Fetch history entries related to a specific expense
 */
export async function fetchHistoryByExpense(expenseId: string): Promise<TabHistoryEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tab_history")
    .select("*")
    .eq("related_expense_id", expenseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching history by expense:", error);
    throw error;
  }

  return ((data as TabHistoryRow[]) || []).map(rowToHistoryEntry);
}

/**
 * Sync tab history - replaces all entries with new ones
 */
export async function syncTabHistory(entries: TabHistoryEntry[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing history
  const { error: deleteError } = await supabase
    .from("tab_history")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting tab history:", deleteError);
    throw deleteError;
  }

  // Insert all entries if any exist
  if (entries.length > 0) {
    const rows = entries.map((entry) => entryToInsert(entry));
    const { error: insertError } = await supabase
      .from("tab_history")
      .insert(rows as never);

    if (insertError) {
      console.error("Error inserting tab history:", insertError);
      throw insertError;
    }
  }
}
