/**
 * Supabase queries for todo_owners table
 * NOTE: This TODO app uses a SEPARATE todo_owners table from the investment tracker's owners table
 * This allows both apps to share the same Supabase database with independent user lists
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

// Use todo_owners table for this TODO app
type Owner = Database["public"]["Tables"]["todo_owners"]["Row"];
type OwnerInsert = Database["public"]["Tables"]["todo_owners"]["Insert"];
type OwnerUpdate = Database["public"]["Tables"]["todo_owners"]["Update"];

export async function fetchOwners(): Promise<Owner[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("todo_owners")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching todo_owners:", error);
    throw error;
  }

  return (data as Owner[]) || [];
}

export async function createOwner(owner: OwnerInsert): Promise<Owner> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("todo_owners")
    .insert(owner as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating todo_owner:", error);
    throw error;
  }

  return data as Owner;
}

export async function updateOwner(id: string, updates: OwnerUpdate): Promise<Owner> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("todo_owners")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating todo_owner:", error);
    throw error;
  }

  return data as Owner;
}

export async function deleteOwner(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("todo_owners")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting todo_owner:", error);
    throw error;
  }
}

// Bulk sync: replace all todo_owners in database
export async function syncOwners(owners: OwnerInsert[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing todo_owners
  const { error: deleteError } = await supabase
    .from("todo_owners")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting todo_owners:", deleteError);
    throw deleteError;
  }

  // Insert all owners if any exist
  if (owners.length > 0) {
    const { error: insertError } = await supabase
      .from("todo_owners")
      .insert(owners as never);

    if (insertError) {
      console.error("Error inserting todo_owners:", insertError);
      throw insertError;
    }
  }
}
