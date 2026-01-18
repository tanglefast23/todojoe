/**
 * Supabase queries for portfolios and accounts
 * Shared data model (no per-user auth)
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Portfolio, Account, PortfolioWithAccounts, AppSettings } from "@/types/database";

// Fetch all portfolios with their accounts
export async function fetchPortfolios(): Promise<PortfolioWithAccounts[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select(`
      *,
      accounts (*)
    `)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as PortfolioWithAccounts[]) || [];
}

// Fetch a single portfolio by ID
export async function fetchPortfolio(id: string): Promise<PortfolioWithAccounts | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select(`
      *,
      accounts (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as PortfolioWithAccounts;
}

// Create a new portfolio
export async function createPortfolio(
  name: string,
  ownerIds: string[] = []
): Promise<Portfolio> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ name, owner_ids: ownerIds } as never)
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

// Update portfolio
export async function updatePortfolio(
  id: string,
  updates: Partial<Portfolio>
): Promise<Portfolio> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("portfolios")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

// Delete portfolio
export async function deletePortfolio(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Create account
export async function createAccount(
  portfolioId: string,
  name: string
): Promise<Account> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .insert({ portfolio_id: portfolioId, name } as never)
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

// Update account
export async function updateAccount(id: string, name: string): Promise<Account> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ name } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

// Delete account
export async function deleteAccount(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Fetch all accounts
export async function fetchAccounts(): Promise<Account[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as Account[]) || [];
}

// Fetch app settings (singleton)
export async function fetchAppSettings(): Promise<AppSettings | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "default")
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as AppSettings | null;
}

// Update app settings
export async function updateAppSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .upsert({ id: "default", ...updates } as never)
    .select()
    .single();

  if (error) throw error;
  return data as AppSettings;
}

// ============ Bulk Sync Functions ============

// Sync portfolios using upsert (conflict resolution by ID)
export async function syncPortfolios(
  portfolios: Array<{
    id: string;
    name: string;
    owner_ids: string[];
    is_included_in_combined: boolean;
    created_at: string;
    updated_at?: string;
  }>,
  deletedIds?: string[]
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete specified portfolios (if any were deleted locally)
  if (deletedIds && deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("portfolios")
      .delete()
      .in("id", deletedIds);

    if (deleteError) {
      console.error("[Portfolios] Delete error:", deleteError);
      throw deleteError;
    }
    console.log(`[Portfolios] Deleted ${deletedIds.length} portfolios`);
  }

  // Upsert all portfolios
  if (portfolios.length > 0) {
    const now = new Date().toISOString();
    const portfoliosWithTimestamp = portfolios.map(p => ({
      ...p,
      updated_at: p.updated_at || now,
    }));

    const { error: upsertError } = await supabase
      .from("portfolios")
      .upsert(portfoliosWithTimestamp as never, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[Portfolios] Upsert error:", upsertError);
      throw upsertError;
    }
  }
}

// Sync accounts using upsert (conflict resolution by ID)
export async function syncAccounts(
  accounts: Array<{
    id: string;
    portfolio_id: string;
    name: string;
    created_at: string;
    updated_at?: string;
  }>,
  deletedIds?: string[]
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete specified accounts (if any were deleted locally)
  if (deletedIds && deletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .in("id", deletedIds);

    if (deleteError) {
      console.error("[Accounts] Delete error:", deleteError);
      throw deleteError;
    }
    console.log(`[Accounts] Deleted ${deletedIds.length} accounts`);
  }

  // Upsert all accounts
  if (accounts.length > 0) {
    const now = new Date().toISOString();
    const accountsWithTimestamp = accounts.map(a => ({
      ...a,
      updated_at: a.updated_at || now,
    }));

    const { error: upsertError } = await supabase
      .from("accounts")
      .upsert(accountsWithTimestamp as never, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[Accounts] Upsert error:", upsertError);
      throw upsertError;
    }
  }
}
