/**
 * Supabase queries for tags table
 * Tags are shared across all owners
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";

type Tag = Database["public"]["Tables"]["tags"]["Row"];
type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];
type TagUpdate = Database["public"]["Tables"]["tags"]["Update"];

export async function fetchTags(): Promise<Tag[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching tags:", error);
    throw error;
  }

  return (data as Tag[]) || [];
}

export async function createTag(tag: TagInsert): Promise<Tag> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tags")
    .insert(tag as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating tag:", error);
    throw error;
  }

  return data as Tag;
}

export async function updateTag(id: string, updates: TagUpdate): Promise<Tag> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tags")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating tag:", error);
    throw error;
  }

  return data as Tag;
}

export async function deleteTag(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting tag:", error);
    throw error;
  }
}

// Bulk sync: replace all non-default tags
export async function syncTags(tags: TagInsert[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all non-default tags
  const { error: deleteError } = await supabase
    .from("tags")
    .delete()
    .eq("is_default", false);

  if (deleteError) {
    console.error("Error deleting tags:", deleteError);
    throw deleteError;
  }

  // Insert custom tags if any exist
  const customTags = tags.filter((t) => !t.is_default);
  if (customTags.length > 0) {
    const { error: insertError } = await supabase
      .from("tags")
      .insert(customTags as never);

    if (insertError) {
      console.error("Error inserting tags:", insertError);
      throw insertError;
    }
  }
}
