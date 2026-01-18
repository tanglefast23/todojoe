/**
 * Supabase queries for expenses table
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";
import type { Expense } from "@/types/runningTab";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

// Convert database row to app type (snake_case to camelCase)
function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    createdBy: row.created_by,
    createdAt: row.created_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    status: row.status,
    attachmentUrl: row.attachment_url,
    rejectionReason: row.rejection_reason,
    updatedAt: row.updated_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function expenseToInsert(expense: Omit<Expense, "id"> & { id?: string }): ExpenseInsert {
  return {
    id: expense.id,
    name: expense.name,
    amount: expense.amount,
    created_by: expense.createdBy,
    created_at: expense.createdAt,
    approved_by: expense.approvedBy,
    approved_at: expense.approvedAt,
    status: expense.status,
    attachment_url: expense.attachmentUrl,
    rejection_reason: expense.rejectionReason,
    updated_at: expense.updatedAt,
  };
}

function expenseToUpdate(expense: Partial<Expense>): ExpenseUpdate {
  const update: ExpenseUpdate = {};
  if (expense.name !== undefined) update.name = expense.name;
  if (expense.amount !== undefined) update.amount = expense.amount;
  if (expense.createdBy !== undefined) update.created_by = expense.createdBy;
  if (expense.createdAt !== undefined) update.created_at = expense.createdAt;
  if (expense.approvedBy !== undefined) update.approved_by = expense.approvedBy;
  if (expense.approvedAt !== undefined) update.approved_at = expense.approvedAt;
  if (expense.status !== undefined) update.status = expense.status;
  if (expense.attachmentUrl !== undefined) update.attachment_url = expense.attachmentUrl;
  if (expense.rejectionReason !== undefined) update.rejection_reason = expense.rejectionReason;
  if (expense.updatedAt !== undefined) update.updated_at = expense.updatedAt;
  return update;
}

export async function fetchAllExpenses(): Promise<Expense[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching expenses:", error);
    throw error;
  }

  return ((data as ExpenseRow[]) || []).map(rowToExpense);
}

export async function createExpense(expense: Omit<Expense, "id">): Promise<Expense> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert(expenseToInsert(expense) as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating expense:", error);
    throw error;
  }

  return rowToExpense(data as ExpenseRow);
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
  const supabase = getSupabaseClient();
  const updateData = {
    ...expenseToUpdate(updates),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("expenses")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating expense:", error);
    throw error;
  }

  return rowToExpense(data as ExpenseRow);
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}

/**
 * Delete all completed (approved/rejected) expenses from Supabase
 * Used when clearing completed expenses for cross-device sync
 */
export async function deleteCompletedExpenses(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .in("status", ["approved", "rejected"]);

  if (error) {
    console.error("Error deleting completed expenses:", error);
    throw error;
  }
}

export async function upsertExpenses(expenses: Expense[]): Promise<void> {
  if (expenses.length === 0) return;

  const supabase = getSupabaseClient();
  const rows = expenses.map((expense) => expenseToInsert(expense));

  const { error } = await supabase
    .from("expenses")
    .upsert(rows as never, { onConflict: "id" });

  if (error) {
    console.error("Error upserting expenses:", error);
    throw error;
  }
}

// Bulk sync: replace all expenses
export async function syncExpenses(expenses: Expense[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing expenses
  const { error: deleteError } = await supabase
    .from("expenses")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting expenses:", deleteError);
    throw deleteError;
  }

  // Insert all expenses if any exist
  if (expenses.length > 0) {
    const rows = expenses.map((expense) => expenseToInsert(expense));
    const { error: insertError } = await supabase
      .from("expenses")
      .insert(rows as never);

    if (insertError) {
      console.error("Error inserting expenses:", insertError);
      throw insertError;
    }
  }
}
