/**
 * Supabase queries for symbol_tags table
 * Maps symbols to their assigned tags per portfolio
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type SymbolTag = Database["public"]["Tables"]["symbol_tags"]["Row"];
type SymbolTagInsert = Database["public"]["Tables"]["symbol_tags"]["Insert"];

export async function fetchSymbolTags(): Promise<SymbolTag[]> {
  const supabase = getSupabaseClient();
  console.log("[SymbolTags] Fetching from Supabase...");

  const { data, error } = await supabase
    .from("symbol_tags")
    .select("*")
    .order("portfolio_id", { ascending: true })
    .order("symbol", { ascending: true });

  if (error) {
    // Table might not exist yet - return empty array
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("[SymbolTags] ⚠️ Table does not exist yet - run the SQL to create it");
      return [];
    }
    console.error("[SymbolTags] ❌ Fetch error:", error.message, error.code, error);
    throw error;
  }

  console.log(`[SymbolTags] ✓ Fetched ${data?.length || 0} symbol tags from cloud`);
  return (data as SymbolTag[]) || [];
}

// Convert local symbolTags record to array format for syncing
export function convertTagsToArray(
  symbolTags: Record<string, string[]>
): Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto"; tags: string[] }> {
  const result: Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto"; tags: string[] }> = [];

  for (const [key, tags] of Object.entries(symbolTags)) {
    if (!tags || tags.length === 0) continue; // Skip empty tags

    // Key format: "portfolioId:SYMBOL:assetType"
    const parts = key.split(":");
    if (parts.length !== 3) continue;

    const [portfolioId, symbol, assetType] = parts;
    if (assetType !== "stock" && assetType !== "crypto") continue;

    result.push({
      portfolioId,
      symbol,
      assetType: assetType as "stock" | "crypto",
      tags,
    });
  }

  return result;
}

// Convert array from Supabase to local record format
export function convertTagsToRecord(
  symbolTags: SymbolTag[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const item of symbolTags) {
    const key = `${item.portfolio_id}:${item.symbol.toUpperCase()}:${item.asset_type}`;
    result[key] = item.tags || [];
  }

  return result;
}

// Bulk sync: replace all symbol tags
export async function syncSymbolTags(
  tags: Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto"; tags: string[] }>
): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`[SymbolTags] Syncing ${tags.length} symbol tags to Supabase...`);

  // Delete all existing tags
  const { error: deleteError } = await supabase
    .from("symbol_tags")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (workaround for "delete all" without where)

  if (deleteError) {
    // Table might not exist yet - that's OK
    if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
      console.warn("[SymbolTags] ⚠️ Table does not exist yet - run the SQL to create it");
      return;
    }
    console.error("[SymbolTags] ❌ Delete error:", deleteError.message, deleteError.code, deleteError);
    throw deleteError;
  }

  // Insert new tags if any exist
  if (tags.length > 0) {
    const inserts: SymbolTagInsert[] = tags.map((t) => ({
      portfolio_id: t.portfolioId,
      symbol: t.symbol.toUpperCase(),
      asset_type: t.assetType,
      tags: t.tags,
    }));

    console.log("[SymbolTags] Inserting:", inserts.map(i => `${i.symbol}:${i.tags.join(",")}`).join(" | "));

    const { error: insertError } = await supabase
      .from("symbol_tags")
      .insert(inserts as never);

    if (insertError) {
      // Table might not exist yet - that's OK
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        console.warn("[SymbolTags] ⚠️ Table does not exist yet - run the SQL to create it");
        return;
      }
      console.error("[SymbolTags] ❌ Insert error:", insertError.message, insertError.code, insertError);
      throw insertError;
    }

    console.log(`[SymbolTags] ✓ Synced ${tags.length} symbol tags to cloud`);
  } else {
    console.log("[SymbolTags] ✓ No tags to sync (cleared all)");
  }
}
