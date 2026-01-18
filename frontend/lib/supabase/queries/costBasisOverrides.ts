/**
 * Supabase queries for cost_basis_overrides table
 * Manual cost basis values per portfolio
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type CostBasisOverride = Database["public"]["Tables"]["cost_basis_overrides"]["Row"];
type CostBasisOverrideInsert = Database["public"]["Tables"]["cost_basis_overrides"]["Insert"];

export async function fetchCostBasisOverrides(): Promise<CostBasisOverride[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cost_basis_overrides")
    .select("*")
    .order("portfolio_id", { ascending: true });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.log("[CostBasisOverrides] Table does not exist yet");
      return [];
    }
    console.error("Error fetching cost basis overrides:", error);
    throw error;
  }

  return (data as CostBasisOverride[]) || [];
}

// Convert local costBasisOverrides record to array format for syncing
// Local format: { portfolioId: costBasisValue }
export function convertOverridesToArray(
  overrides: Record<string, number>
): Array<{ portfolioId: string; costBasis: number }> {
  const result: Array<{ portfolioId: string; costBasis: number }> = [];

  for (const [portfolioId, costBasis] of Object.entries(overrides)) {
    result.push({ portfolioId, costBasis });
  }

  return result;
}

// Convert array from Supabase to local record format
export function convertOverridesToRecord(
  overrides: CostBasisOverride[]
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of overrides) {
    result[item.portfolio_id] = item.cost_basis;
  }

  return result;
}

// Bulk sync: replace all cost basis overrides
export async function syncCostBasisOverrides(
  overrides: Array<{ portfolioId: string; costBasis: number }>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing overrides
  const { error: deleteError } = await supabase
    .from("cost_basis_overrides")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
      console.log("[CostBasisOverrides] Table does not exist yet, skipping sync");
      return;
    }
    console.error("Error deleting cost basis overrides:", deleteError);
    throw deleteError;
  }

  // Insert new overrides if any exist
  if (overrides.length > 0) {
    const inserts: CostBasisOverrideInsert[] = overrides.map((o) => ({
      portfolio_id: o.portfolioId,
      cost_basis: o.costBasis,
    }));

    const { error: insertError } = await supabase
      .from("cost_basis_overrides")
      .insert(inserts as never);

    if (insertError) {
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        console.log("[CostBasisOverrides] Table does not exist yet, skipping sync");
        return;
      }
      console.error("Error inserting cost basis overrides:", insertError);
      throw insertError;
    }
  }
}
