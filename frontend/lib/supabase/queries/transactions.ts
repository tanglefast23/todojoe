/**
 * Supabase queries for transactions
 * Shared data model (no per-user auth)
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types/database";

// Fetch all transactions
export async function fetchAllTransactions(): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  console.log("[Transactions] Fetching all transactions from Supabase...");

  // Add cache-busting timestamp to force fresh read (helps with Supabase edge caching issues)
  const { data, error, status, statusText } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(10000); // Explicit limit to avoid any default pagination

  if (error) {
    console.error("[Transactions] Fetch error:", { error, status, statusText });
    throw error;
  }

  console.log(`[Transactions] Fetch successful: ${data?.length ?? 0} transactions, status: ${status}`);

  // If we get 0 transactions, log a warning - might be Supabase issue
  if (data?.length === 0) {
    console.warn("[Transactions] WARNING: Got 0 transactions - this may be a Supabase caching/consistency issue");
  }

  return (data as Transaction[]) || [];
}

// Fetch transactions for a specific portfolio
export async function fetchTransactionsByPortfolio(
  portfolioId: string
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data as Transaction[]) || [];
}

// Fetch transactions for a specific account
export async function fetchTransactionsByAccount(
  accountId: string
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("account_id", accountId)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data as Transaction[]) || [];
}

// Create a new transaction
export async function createTransaction(
  transaction: Omit<Transaction, "id" | "created_at" | "updated_at">
): Promise<Transaction> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert(transaction as never)
    .select()
    .single();

  if (error) throw error;
  return data as Transaction;
}

// Update a transaction
export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("transactions")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Transaction;
}

// Delete a transaction
export async function deleteTransaction(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Bulk create transactions (for importing)
export async function bulkCreateTransactions(
  transactions: Omit<Transaction, "id" | "created_at" | "updated_at">[]
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert(transactions as never)
    .select();

  if (error) throw error;
  return (data as Transaction[]) || [];
}

// Sync transactions using upsert (conflict resolution by ID)
export async function syncTransactions(
  transactions: Array<{
    id: string;
    portfolio_id: string;
    account_id: string;
    symbol: string;
    type: "buy" | "sell";
    asset_type: "stock" | "crypto";
    quantity: number;
    price: number;
    date: string;
    notes?: string | null;
    tags?: string[] | null;
    updated_at?: string;
  }>,
  deletedIds?: string[]
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete specified transactions (if any were deleted locally)
  if (deletedIds && deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .in("id", deletedIds);

    if (deleteError) {
      console.error("[Transactions] Delete error:", deleteError);
      throw deleteError;
    }
    console.log(`[Transactions] Deleted ${deletedIds.length} transactions`);
  }

  // Upsert all transactions (insert or update on conflict)
  if (transactions.length > 0) {
    // Ensure updated_at is set
    const now = new Date().toISOString();
    const transactionsWithTimestamp = transactions.map(t => ({
      ...t,
      updated_at: t.updated_at || now,
    }));

    const { error: upsertError } = await supabase
      .from("transactions")
      .upsert(transactionsWithTimestamp as never, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[Transactions] Upsert error:", upsertError);
      throw upsertError;
    }
  }
}
