/**
 * Supabase queries for owners table
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type Owner = Database["public"]["Tables"]["owners"]["Row"];
type OwnerInsert = Database["public"]["Tables"]["owners"]["Insert"];
type OwnerUpdate = Database["public"]["Tables"]["owners"]["Update"];

export async function fetchOwners(): Promise<Owner[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("owners")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching owners:", error);
    throw error;
  }

  return (data as Owner[]) || [];
}

export async function createOwner(owner: OwnerInsert): Promise<Owner> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("owners")
    .insert(owner as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating owner:", error);
    throw error;
  }

  return data as Owner;
}

export async function updateOwner(id: string, updates: OwnerUpdate): Promise<Owner> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("owners")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating owner:", error);
    throw error;
  }

  return data as Owner;
}

export async function deleteOwner(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("owners")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting owner:", error);
    throw error;
  }
}

// Bulk sync: replace all owners in database
export async function syncOwners(owners: OwnerInsert[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing owners
  const { error: deleteError } = await supabase
    .from("owners")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting owners:", deleteError);
    throw deleteError;
  }

  // Insert all owners if any exist
  if (owners.length > 0) {
    const { error: insertError } = await supabase
      .from("owners")
      .insert(owners as never);

    if (insertError) {
      console.error("Error inserting owners:", insertError);
      throw insertError;
    }
  }
}
