/**
 * Supabase queries for scheduled_events table
 */
import { getSupabaseClient, isSupabaseConfigured } from "../client";
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
    description: row.description,
    scheduledAt: row.scheduled_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    status: row.status as ScheduledEvent["status"],
    source: (row.source || "local") as ScheduledEvent["source"],
    googleEventId: row.google_event_id,
    googleCalendarId: row.google_calendar_id,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function scheduledEventToInsert(event: Omit<ScheduledEvent, "id"> & { id?: string }): ScheduledEventInsert {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    scheduled_at: event.scheduledAt,
    end_at: event.endAt,
    created_at: event.createdAt,
    completed_at: event.completedAt,
    status: event.status,
    source: event.source || "local",
    google_event_id: event.googleEventId,
    google_calendar_id: event.googleCalendarId,
    last_synced_at: event.lastSyncedAt,
    updated_at: event.updatedAt,
  };
}

function scheduledEventToUpdate(event: Partial<ScheduledEvent>): ScheduledEventUpdate {
  const update: ScheduledEventUpdate = {};
  if (event.title !== undefined) update.title = event.title;
  if (event.description !== undefined) update.description = event.description;
  if (event.scheduledAt !== undefined) update.scheduled_at = event.scheduledAt;
  if (event.endAt !== undefined) update.end_at = event.endAt;
  if (event.createdAt !== undefined) update.created_at = event.createdAt;
  if (event.completedAt !== undefined) update.completed_at = event.completedAt;
  if (event.status !== undefined) update.status = event.status;
  if (event.source !== undefined) update.source = event.source;
  if (event.googleEventId !== undefined) update.google_event_id = event.googleEventId;
  if (event.googleCalendarId !== undefined) update.google_calendar_id = event.googleCalendarId;
  if (event.lastSyncedAt !== undefined) update.last_synced_at = event.lastSyncedAt;
  if (event.updatedAt !== undefined) update.updated_at = event.updatedAt;
  return update;
}

export async function fetchAllScheduledEvents(): Promise<ScheduledEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("scheduled_events")
    .select("*")
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Error fetching scheduled events:", error.message || error.code || JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch scheduled events");
  }

  return ((data as ScheduledEventRow[]) || []).map(rowToScheduledEvent);
}

export async function createScheduledEvent(event: Omit<ScheduledEvent, "id">): Promise<ScheduledEvent> {
  if (!isSupabaseConfigured()) {
    return { ...event, id: crypto.randomUUID() } as ScheduledEvent;
  }
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
  if (!isSupabaseConfigured()) {
    return { id, ...updates } as ScheduledEvent;
  }
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
  if (!isSupabaseConfigured()) return;
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
  if (!isSupabaseConfigured()) return;
  if (events.length === 0) return;

  const supabase = getSupabaseClient();
  const rows = events.map((event) => scheduledEventToInsert(event));

  const { error } = await supabase
    .from("scheduled_events")
    .upsert(rows as never, { onConflict: "id" });

  if (error) {
    console.error("Error upserting scheduled events:", error.message || error.code || JSON.stringify(error));
    throw new Error(error.message || "Failed to upsert scheduled events");
  }
}
