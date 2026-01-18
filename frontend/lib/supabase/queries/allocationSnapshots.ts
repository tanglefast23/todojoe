/**
 * Supabase queries for allocation_snapshots table
 * Historical allocation data saved when plans complete
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";
import type { AllocationSnapshot } from "@/stores/allocationHistoryStore";

type DBAllocationSnapshot = Database["public"]["Tables"]["allocation_snapshots"]["Row"];
type AllocationSnapshotInsert = Database["public"]["Tables"]["allocation_snapshots"]["Insert"];

export async function fetchAllocationSnapshots(): Promise<DBAllocationSnapshot[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("allocation_snapshots")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(50); // Keep last 50 snapshots

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      // Table doesn't exist yet - silently return empty
      return [];
    }
    console.error("Error fetching allocation snapshots:", error);
    throw error;
  }

  return (data as DBAllocationSnapshot[]) || [];
}

// Convert local snapshots to array format for syncing
export function convertSnapshotsToArray(
  snapshots: AllocationSnapshot[]
): Array<{ portfolioId: string | null; allocations: Record<string, number>; timestamp: number }> {
  return snapshots.map((s) => ({
    portfolioId: s.portfolioId,
    allocations: s.allocations,
    timestamp: s.timestamp,
  }));
}

// Convert array from Supabase to local format
export function convertSnapshotsToLocal(
  snapshots: DBAllocationSnapshot[]
): AllocationSnapshot[] {
  return snapshots.map((s) => ({
    portfolioId: s.portfolio_id,
    allocations: s.allocations as Record<string, number>,
    timestamp: s.timestamp,
  }));
}

// Bulk sync: replace all allocation snapshots
export async function syncAllocationSnapshots(
  snapshots: Array<{ portfolioId: string | null; allocations: Record<string, number>; timestamp: number }>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing snapshots
  const { error: deleteError } = await supabase
    .from("allocation_snapshots")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
      return; // Table doesn't exist yet
    }
    console.error("Error deleting allocation snapshots:", deleteError);
    throw deleteError;
  }

  // Insert new snapshots if any exist
  if (snapshots.length > 0) {
    const inserts: AllocationSnapshotInsert[] = snapshots.map((s) => ({
      portfolio_id: s.portfolioId,
      allocations: s.allocations,
      timestamp: s.timestamp,
    }));

    const { error: insertError } = await supabase
      .from("allocation_snapshots")
      .insert(inserts as never);

    if (insertError) {
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        return; // Table doesn't exist yet
      }
      console.error("Error inserting allocation snapshots:", insertError);
      throw insertError;
    }
  }
}
