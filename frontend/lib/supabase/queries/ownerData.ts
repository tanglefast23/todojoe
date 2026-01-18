/**
 * Supabase queries for per-owner data (dashboards, settings, sell plans)
 * Each owner has their own personalized data
 */
import { getSupabaseClient } from "../client";
import type { Database, Json } from "@/types/database";

type OwnerDashboard = Database["public"]["Tables"]["owner_dashboards"]["Row"];
type OwnerDashboardInsert = Database["public"]["Tables"]["owner_dashboards"]["Insert"];
type OwnerSettings = Database["public"]["Tables"]["owner_settings"]["Row"];
type OwnerSettingsInsert = Database["public"]["Tables"]["owner_settings"]["Insert"];
type SellPlan = Database["public"]["Tables"]["sell_plans"]["Row"];
type SellPlanInsert = Database["public"]["Tables"]["sell_plans"]["Insert"];

// =====================================================
// OWNER DASHBOARDS
// =====================================================

export async function fetchOwnerDashboard(ownerId: string): Promise<OwnerDashboard | null> {
  console.log("[Dashboard Query] Fetching dashboard for owner:", ownerId.substring(0, 8));
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("owner_dashboards")
    .select("*")
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    console.log("[Dashboard Query] Error code:", error.code, error.message);
    // PGRST116 = no rows found (not an error for us)
    if (error.code === "PGRST116") {
      console.log("[Dashboard Query] No dashboard found for this owner (PGRST116)");
      return null;
    }
    // Table doesn't exist yet
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("[Dashboard Query] ⚠️ Table owner_dashboards does not exist - run the SQL to create it");
      return null;
    }
    console.error("[Dashboard Query] Error fetching owner dashboard:", error);
    throw error;
  }

  const dashboard = data as OwnerDashboard;
  console.log("[Dashboard Query] ✓ Dashboard found with", (dashboard.widgets as unknown[])?.length || 0, "widgets");
  return dashboard;
}

export async function syncOwnerDashboard(
  ownerId: string,
  widgets: Json,
  layouts: Json | null
): Promise<void> {
  console.log("[Dashboard Query] Syncing dashboard for owner:", ownerId.substring(0, 8));
  const supabase = getSupabaseClient();

  const dashboardData: OwnerDashboardInsert = {
    owner_id: ownerId,
    widgets, // Now stores the entire dashboards Record<portfolioId, PortfolioDashboard>
    layouts: layouts ?? {}, // Deprecated - kept for backwards compatibility
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("owner_dashboards")
    .upsert(dashboardData as never, { onConflict: "owner_id" });

  if (error) {
    console.log("[Dashboard Query] Upsert error code:", error.code, error.message);
    // Table doesn't exist yet
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("[Dashboard Query] ⚠️ Table owner_dashboards does not exist - run the SQL to create it");
      return;
    }
    console.error("[Dashboard Query] Error syncing owner dashboard:", error);
    throw error;
  }
  console.log("[Dashboard Query] ✓ Dashboard synced successfully");
}

// =====================================================
// OWNER SETTINGS
// =====================================================

export async function fetchOwnerSettings(ownerId: string): Promise<OwnerSettings | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("owner_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching owner settings:", error);
    throw error;
  }

  return data as OwnerSettings;
}

export async function syncOwnerSettings(
  ownerId: string,
  settings: Partial<Omit<OwnerSettingsInsert, "owner_id">>
): Promise<void> {
  const supabase = getSupabaseClient();

  const settingsData: OwnerSettingsInsert = {
    owner_id: ownerId,
    ...settings,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("owner_settings")
    .upsert(settingsData as never, { onConflict: "owner_id" });

  if (error) {
    // Column doesn't exist - try without mobile_mode
    if (error.code === "42703" || error.message?.includes("column") || Object.keys(error).length === 0) {
      console.warn("[Settings Sync] mobile_mode column may not exist, retrying without it...");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { mobile_mode, ...settingsWithoutMobile } = settings as { mobile_mode?: string } & Record<string, unknown>;
      const fallbackData = {
        owner_id: ownerId,
        ...settingsWithoutMobile,
        updated_at: new Date().toISOString(),
      };
      const { error: retryError } = await supabase
        .from("owner_settings")
        .upsert(fallbackData as never, { onConflict: "owner_id" });

      if (retryError) {
        console.error("Error syncing owner settings (fallback):", retryError);
        throw retryError;
      }
      return;
    }
    console.error("Error syncing owner settings:", error);
    throw error;
  }
}

// =====================================================
// SELL PLANS
// =====================================================

/**
 * Fetch sell plans by portfolio ID (for shared portfolio access)
 * Returns empty array for "combined" view - sell plans require a specific portfolio
 */
export async function fetchPortfolioSellPlans(portfolioId: string): Promise<SellPlan[]> {
  // No plans for combined view - user must select a specific portfolio
  if (!portfolioId || portfolioId === "combined") {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sell_plans")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sell plans for portfolio:", error);
    return [];
  }

  return (data as SellPlan[]) || [];
}

/**
 * @deprecated Use fetchPortfolioSellPlans instead for shared portfolio access
 * Kept for sync purposes - only syncs plans created by this owner
 */
export async function fetchOwnerSellPlans(ownerId: string): Promise<SellPlan[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sell_plans")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sell plans:", error);
    throw error;
  }

  return (data as SellPlan[]) || [];
}

export async function createSellPlan(plan: SellPlanInsert): Promise<SellPlan> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sell_plans")
    .insert(plan as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating sell plan:", error);
    throw error;
  }

  return data as SellPlan;
}

export async function updateSellPlan(
  id: string,
  updates: Partial<SellPlanInsert>
): Promise<SellPlan> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sell_plans")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating sell plan:", error);
    throw error;
  }

  return data as SellPlan;
}

export async function deleteSellPlan(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("sell_plans")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting sell plan:", error);
    throw error;
  }
}

// Bulk sync: replace all sell plans for an owner
export async function syncOwnerSellPlans(
  ownerId: string,
  plans: Omit<SellPlanInsert, "owner_id">[]
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing plans for this owner
  const { error: deleteError } = await supabase
    .from("sell_plans")
    .delete()
    .eq("owner_id", ownerId);

  if (deleteError) {
    console.error("Error deleting sell plans:", deleteError);
    throw deleteError;
  }

  // Insert all plans if any exist
  if (plans.length > 0) {
    const plansWithOwner = plans.map((plan) => ({
      ...plan,
      owner_id: ownerId,
    }));

    const { error: insertError } = await supabase
      .from("sell_plans")
      .insert(plansWithOwner as never);

    if (insertError) {
      console.error("Error inserting sell plans:", insertError);
      throw insertError;
    }
  }
}
