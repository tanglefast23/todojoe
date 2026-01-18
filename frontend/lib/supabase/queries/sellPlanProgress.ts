/**
 * Supabase queries for sell_plan_progress table
 * Tracks completed sell/buy steps per owner
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type SellPlanProgress = Database["public"]["Tables"]["sell_plan_progress"]["Row"];
type SellPlanProgressInsert = Database["public"]["Tables"]["sell_plan_progress"]["Insert"];

export async function fetchSellPlanProgress(ownerId: string): Promise<SellPlanProgress[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sell_plan_progress")
    .select("*")
    .eq("owner_id", ownerId);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.log("[SellPlanProgress] Table does not exist yet");
      return [];
    }
    console.error("Error fetching sell plan progress:", error);
    throw error;
  }

  return (data as SellPlanProgress[]) || [];
}

// Convert local Sets to array format for syncing
export function convertProgressToArrays(
  completedSellIds: Set<string>,
  completedBuyIds: Set<string>
): Array<{ planId: string; accountId: string; progressType: "sell" | "buy"; buySymbol: string | null }> {
  const result: Array<{ planId: string; accountId: string; progressType: "sell" | "buy"; buySymbol: string | null }> = [];

  // Convert sell completions: format is "planId:accountId"
  for (const key of completedSellIds) {
    const parts = key.split(":");
    if (parts.length >= 2) {
      result.push({
        planId: parts[0],
        accountId: parts[1],
        progressType: "sell",
        buySymbol: null,
      });
    }
  }

  // Convert buy completions: format is "planId:accountId:buySymbol"
  for (const key of completedBuyIds) {
    const parts = key.split(":");
    if (parts.length >= 3) {
      result.push({
        planId: parts[0],
        accountId: parts[1],
        progressType: "buy",
        buySymbol: parts[2],
      });
    }
  }

  return result;
}

// Convert array from Supabase to local Set formats
export function convertProgressToSets(
  progress: SellPlanProgress[]
): { completedSellIds: string[]; completedBuyIds: string[] } {
  const completedSellIds: string[] = [];
  const completedBuyIds: string[] = [];

  for (const item of progress) {
    if (item.progress_type === "sell") {
      completedSellIds.push(`${item.plan_id}:${item.account_id}`);
    } else if (item.progress_type === "buy" && item.buy_symbol) {
      completedBuyIds.push(`${item.plan_id}:${item.account_id}:${item.buy_symbol}`);
    }
  }

  return { completedSellIds, completedBuyIds };
}

// Sync sell plan progress for an owner
export async function syncSellPlanProgress(
  ownerId: string,
  progress: Array<{ planId: string; accountId: string; progressType: "sell" | "buy"; buySymbol: string | null }>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing progress for this owner
  const { error: deleteError } = await supabase
    .from("sell_plan_progress")
    .delete()
    .eq("owner_id", ownerId);

  if (deleteError) {
    if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
      console.log("[SellPlanProgress] Table does not exist yet, skipping sync");
      return;
    }
    console.error("Error deleting sell plan progress:", deleteError);
    throw deleteError;
  }

  // Insert new progress if any exist
  if (progress.length > 0) {
    const inserts: SellPlanProgressInsert[] = progress.map((p) => ({
      owner_id: ownerId,
      plan_id: p.planId,
      account_id: p.accountId,
      progress_type: p.progressType,
      buy_symbol: p.buySymbol,
    }));

    const { error: insertError } = await supabase
      .from("sell_plan_progress")
      .insert(inserts as never);

    if (insertError) {
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        console.log("[SellPlanProgress] Table does not exist yet, skipping sync");
        return;
      }
      console.error("Error inserting sell plan progress:", insertError);
      throw insertError;
    }
  }
}
