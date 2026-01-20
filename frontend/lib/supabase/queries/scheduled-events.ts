/**
 * Supabase queries for scheduled_events table
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";
import type { ScheduledEvent } from "@/types/scheduled-events";

type ScheduledEventRow = Database["public"]["Tables"]["scheduled_events"]["Row"];
type ScheduledEventInsert = Database["public"]["Tables"]["scheduled_events"]["Insert"];
type ScheduledEventUpdate = Database["public"]["Tables"]["scheduled_events"]["Update"];

// Convert database row to app type (snake_case to camelCase)
function rowToScheduledEvent(row: ScheduledEventRow): ScheduledEvent {
  return {
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function scheduledEventToInsert(event: Omit<ScheduledEvent, "id"> & { id?: string }): ScheduledEventInsert {
  return {
    id: event.id,
    title: event.title,
    scheduled_at: event.scheduledAt,
    created_by: event.createdBy,
    created_at: event.createdAt,
    completed_by: event.completedBy,
    completed_at: event.completedAt,
    status: event.status,
    updated_at: event.updatedAt,
  };
}

function scheduledEventToUpdate(event: Partial<ScheduledEvent>): ScheduledEventUpdate {
  const update: ScheduledEventUpdate = {};
  if (event.title !== undefined) update.title = event.title;
  if (event.scheduledAt !== undefined) update.scheduled_at = event.scheduledAt;
  if (event.createdBy !== undefined) update.created_by = event.createdBy;
  if (event.createdAt !== undefined) update.created_at = event.createdAt;
  if (event.completedBy !== undefined) update.completed_by = event.completedBy;
  if (event.completedAt !== undefined) update.completed_at = event.completedAt;
  if (event.status !== undefined) update.status = event.status;
  if (event.updatedAt !== undefined) update.updated_at = event.updatedAt;
  return update;
}

export async function fetchAllScheduledEvents(): Promise<ScheduledEvent[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("scheduled_events")
    .select("*")
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Error fetching scheduled events:", error);
    throw error;
  }

  return ((data as ScheduledEventRow[]) || []).map(rowToScheduledEvent);
}

export async function createScheduledEvent(event: Omit<ScheduledEvent, "id">): Promise<ScheduledEvent> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("scheduled_events")
    .insert(scheduledEventToInsert(event) as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating scheduled event:", error);
    throw error;
  }

  return rowToScheduledEvent(data as ScheduledEventRow);
}

export async function updateScheduledEvent(id: string, updates: Partial<ScheduledEvent>): Promise<ScheduledEvent> {
  const supabase = getSupabaseClient();
  const updateData = {
    ...scheduledEventToUpdate(updates),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("scheduled_events")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating scheduled event:", error);
    throw error;
  }

  return rowToScheduledEvent(data as ScheduledEventRow);
}

export async function deleteScheduledEvent(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("scheduled_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting scheduled event:", error);
    throw error;
  }
}

export async function upsertScheduledEvents(events: ScheduledEvent[]): Promise<void> {
  if (events.length === 0) return;

  const supabase = getSupabaseClient();
  const rows = events.map((event) => scheduledEventToInsert(event));

  const { error } = await supabase
    .from("scheduled_events")
    .upsert(rows as never, { onConflict: "id" });

  if (error) {
    console.error("Error upserting scheduled events:", error);
    throw error;
  }
}
