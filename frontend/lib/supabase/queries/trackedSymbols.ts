/**
 * Supabase queries for tracked_symbols table
 * Symbols tracked in Quick Overview without transactions
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type TrackedSymbol = Database["public"]["Tables"]["tracked_symbols"]["Row"];
type TrackedSymbolInsert = Database["public"]["Tables"]["tracked_symbols"]["Insert"];

export async function fetchTrackedSymbols(): Promise<TrackedSymbol[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tracked_symbols")
    .select("*")
    .order("portfolio_id", { ascending: true })
    .order("symbol", { ascending: true });

  if (error) {
    // Table might not exist yet - return empty array
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.log("[TrackedSymbols] Table does not exist yet");
      return [];
    }
    console.error("Error fetching tracked symbols:", error);
    throw error;
  }

  return (data as TrackedSymbol[]) || [];
}

// Convert local trackedSymbols record to array format for syncing
// Local format: { portfolioId: ["SYMBOL-assetType", ...] }
export function convertTrackedToArray(
  trackedSymbols: Record<string, string[]>
): Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto" }> {
  const result: Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto" }> = [];

  for (const [portfolioId, symbols] of Object.entries(trackedSymbols)) {
    for (const compositeKey of symbols) {
      // Handle both new format "SYMBOL-assetType" and old format "SYMBOL"
      if (compositeKey.includes("-")) {
        const lastDashIndex = compositeKey.lastIndexOf("-");
        const symbol = compositeKey.substring(0, lastDashIndex).toUpperCase();
        const assetType = compositeKey.substring(lastDashIndex + 1).toLowerCase();
        if (assetType === "stock" || assetType === "crypto") {
          result.push({ portfolioId, symbol, assetType });
        }
      } else {
        // Old format - default to stock
        result.push({ portfolioId, symbol: compositeKey.toUpperCase(), assetType: "stock" });
      }
    }
  }

  return result;
}

// Convert array from Supabase to local record format
export function convertTrackedToRecord(
  trackedSymbols: TrackedSymbol[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const item of trackedSymbols) {
    if (!result[item.portfolio_id]) {
      result[item.portfolio_id] = [];
    }
    // Store as composite key "SYMBOL-assetType"
    const compositeKey = `${item.symbol.toUpperCase()}-${item.asset_type}`;
    result[item.portfolio_id].push(compositeKey);
  }

  return result;
}

// Bulk sync: replace all tracked symbols
export async function syncTrackedSymbols(
  symbols: Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto" }>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing tracked symbols
  const { error: deleteError } = await supabase
    .from("tracked_symbols")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
      console.log("[TrackedSymbols] Table does not exist yet, skipping sync");
      return;
    }
    console.error("Error deleting tracked symbols:", deleteError);
    throw deleteError;
  }

  // Insert new tracked symbols if any exist
  if (symbols.length > 0) {
    const inserts: TrackedSymbolInsert[] = symbols.map((s) => ({
      portfolio_id: s.portfolioId,
      symbol: s.symbol.toUpperCase(),
      asset_type: s.assetType,
    }));

    const { error: insertError } = await supabase
      .from("tracked_symbols")
      .insert(inserts as never);

    if (insertError) {
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        console.log("[TrackedSymbols] Table does not exist yet, skipping sync");
        return;
      }
      console.error("Error inserting tracked symbols:", insertError);
      throw insertError;
    }
  }
}
