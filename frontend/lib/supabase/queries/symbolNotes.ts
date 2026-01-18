/**
 * Supabase queries for symbol_notes table
 * Notes per symbol in a portfolio - shared across all owners who can view the portfolio
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type SymbolNote = Database["public"]["Tables"]["symbol_notes"]["Row"];
type SymbolNoteInsert = Database["public"]["Tables"]["symbol_notes"]["Insert"];

export async function fetchSymbolNotes(): Promise<SymbolNote[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("symbol_notes")
    .select("*")
    .order("portfolio_id", { ascending: true })
    .order("symbol", { ascending: true });

  if (error) {
    // Table might not exist yet - return empty array
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.log("[SymbolNotes] Table does not exist yet");
      return [];
    }
    console.error("Error fetching symbol notes:", error);
    throw error;
  }

  return (data as SymbolNote[]) || [];
}

// Convert local symbolNotes record to array format for syncing
export function convertNotesToArray(
  symbolNotes: Record<string, string>
): Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto"; note: string }> {
  const result: Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto"; note: string }> = [];

  for (const [key, note] of Object.entries(symbolNotes)) {
    if (!note || note.trim() === "") continue; // Skip empty notes

    // Key format: "portfolioId:SYMBOL:assetType"
    const parts = key.split(":");
    if (parts.length !== 3) continue;

    const [portfolioId, symbol, assetType] = parts;
    if (assetType !== "stock" && assetType !== "crypto") continue;

    result.push({
      portfolioId,
      symbol,
      assetType: assetType as "stock" | "crypto",
      note,
    });
  }

  return result;
}

// Convert array from Supabase to local record format
export function convertNotesToRecord(
  notes: SymbolNote[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const note of notes) {
    const key = `${note.portfolio_id}:${note.symbol.toUpperCase()}:${note.asset_type}`;
    result[key] = note.note;
  }

  return result;
}

// Bulk sync: replace all symbol notes
export async function syncSymbolNotes(
  notes: Array<{ portfolioId: string; symbol: string; assetType: "stock" | "crypto"; note: string }>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing notes
  const { error: deleteError } = await supabase
    .from("symbol_notes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (workaround for "delete all" without where)

  if (deleteError) {
    // Table might not exist yet - that's OK
    if (deleteError.code === "42P01" || deleteError.code === "PGRST205") {
      console.log("[SymbolNotes] Table does not exist yet, skipping sync");
      return;
    }
    console.error("Error deleting symbol notes:", deleteError);
    throw deleteError;
  }

  // Insert new notes if any exist
  if (notes.length > 0) {
    const inserts: SymbolNoteInsert[] = notes.map((n) => ({
      portfolio_id: n.portfolioId,
      symbol: n.symbol.toUpperCase(),
      asset_type: n.assetType,
      note: n.note,
    }));

    const { error: insertError } = await supabase
      .from("symbol_notes")
      .insert(inserts as never);

    if (insertError) {
      // Table might not exist yet - that's OK
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        console.log("[SymbolNotes] Table does not exist yet, skipping sync");
        return;
      }
      console.error("Error inserting symbol notes:", insertError);
      throw insertError;
    }
  }
}
