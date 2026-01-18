/**
 * Supabase queries for tag_groupings table
 * Tag groupings are user-created combinations of tags for aggregated portfolio views
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type TagGroupingRow = Database["public"]["Tables"]["tag_groupings"]["Row"];
type TagGroupingInsert = Database["public"]["Tables"]["tag_groupings"]["Insert"];

// Local type for tag grouping (matches what's used in the widget)
export interface TagGrouping {
  id: string;
  tags: string[];
}

export async function fetchTagGroupings(): Promise<TagGroupingRow[]> {
  const supabase = getSupabaseClient();
  console.log("[TagGroupings] Fetching from Supabase...");

  const { data, error } = await supabase
    .from("tag_groupings")
    .select("*")
    .order("portfolio_id", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    // Table might not exist yet - return empty array
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("[TagGroupings] ⚠️ Table does not exist yet - run the SQL to create it");
      return [];
    }
    console.error("[TagGroupings] ❌ Fetch error:", error.message, error.code, error);
    throw error;
  }

  console.log(`[TagGroupings] ✓ Fetched ${data?.length || 0} groupings from cloud`);
  return (data as TagGroupingRow[]) || [];
}

// Convert local tagGroupings record to array format for syncing
export function convertGroupingsToArray(
  tagGroupings: Record<string, TagGrouping[]>
): Array<{ portfolioId: string; id: string; tags: string[] }> {
  const result: Array<{ portfolioId: string; id: string; tags: string[] }> = [];

  for (const [portfolioId, groupings] of Object.entries(tagGroupings)) {
    for (const grouping of groupings) {
      result.push({
        portfolioId,
        id: grouping.id,
        tags: grouping.tags,
      });
    }
  }

  return result;
}

// Convert array from Supabase to local record format
export function convertGroupingsToRecord(
  tagGroupings: TagGroupingRow[]
): Record<string, TagGrouping[]> {
  const result: Record<string, TagGrouping[]> = {};

  for (const item of tagGroupings) {
    if (!result[item.portfolio_id]) {
      result[item.portfolio_id] = [];
    }
    result[item.portfolio_id].push({
      id: item.id,
      tags: item.tags,
    });
  }

  return result;
}

// Bulk sync: replace all tag groupings for given portfolios
export async function syncTagGroupings(
  groupings: Array<{ portfolioId: string; id: string; tags: string[] }>
): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`[TagGroupings] Syncing ${groupings.length} groupings to Supabase...`);

  // Get unique portfolio IDs being synced
  const portfolioIds = [...new Set(groupings.map((g) => g.portfolioId))];
  console.log(`[TagGroupings] Portfolio IDs:`, portfolioIds);

  // Delete existing groupings for these portfolios
  if (portfolioIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("tag_groupings")
      .delete()
      .in("portfolio_id", portfolioIds);

    if (deleteError) {
      // Table might not exist yet - that's OK
      if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
        console.warn("[TagGroupings] ⚠️ Table does not exist yet - run the SQL to create it");
        return;
      }
      console.error("[TagGroupings] ❌ Delete error:", deleteError.message, deleteError.code);
      throw deleteError;
    }
  }

  // Insert new groupings if any exist
  if (groupings.length > 0) {
    const inserts: TagGroupingInsert[] = groupings.map((g) => ({
      id: g.id,
      portfolio_id: g.portfolioId,
      tags: g.tags,
    }));

    console.log("[TagGroupings] Inserting:", inserts.map(i => `${i.tags.join("+")}`).join(" | "));

    const { error: insertError } = await supabase
      .from("tag_groupings")
      .insert(inserts as never);

    if (insertError) {
      // Table might not exist yet - that's OK
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        console.warn("[TagGroupings] ⚠️ Table does not exist yet - run the SQL to create it");
        return;
      }
      console.error("[TagGroupings] ❌ Insert error:", insertError.message, insertError.code);
      throw insertError;
    }

    console.log(`[TagGroupings] ✓ Synced ${groupings.length} groupings to cloud`);
  } else {
    console.log("[TagGroupings] ✓ No groupings to sync (cleared all)");
  }
}
