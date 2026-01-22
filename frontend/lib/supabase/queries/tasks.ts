/**
 * Supabase queries for tasks table
 */
import { getSupabaseClient, isSupabaseConfigured } from "../client";
import type { Database } from "@/types/database";
import type { Task } from "@/types/tasks";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

// Convert database row to app type (snake_case to camelCase)
function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority as Task["priority"],
    createdAt: row.created_at,
    completedAt: row.completed_at,
    status: row.status as Task["status"],
    attachmentUrl: row.attachment_url,
    updatedAt: row.updated_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function taskToInsert(task: Omit<Task, "id"> & { id?: string }): TaskInsert {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    created_at: task.createdAt,
    completed_at: task.completedAt,
    status: task.status,
    attachment_url: task.attachmentUrl,
    updated_at: task.updatedAt,
  };
}

function taskToUpdate(task: Partial<Task>): TaskUpdate {
  const update: TaskUpdate = {};
  if (task.title !== undefined) update.title = task.title;
  if (task.priority !== undefined) update.priority = task.priority;
  if (task.createdAt !== undefined) update.created_at = task.createdAt;
  if (task.completedAt !== undefined) update.completed_at = task.completedAt;
  if (task.status !== undefined) update.status = task.status;
  if (task.attachmentUrl !== undefined) update.attachment_url = task.attachmentUrl;
  if (task.updatedAt !== undefined) update.updated_at = task.updatedAt;
  return update;
}

export async function fetchAllTasks(): Promise<Task[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error.message || error.code || JSON.stringify(error));
    throw new Error(error.message || "Failed to fetch tasks");
  }

  return ((data as TaskRow[]) || []).map(rowToTask);
}

export async function createTask(task: Omit<Task, "id">): Promise<Task> {
  if (!isSupabaseConfigured()) {
    // Return a mock task with generated ID when Supabase is not configured
    return { ...task, id: crypto.randomUUID() } as Task;
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(taskToInsert(task) as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    throw error;
  }

  return rowToTask(data as TaskRow);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  if (!isSupabaseConfigured()) {
    // Return updates with ID when Supabase is not configured
    return { id, ...updates } as Task;
  }
  const supabase = getSupabaseClient();
  const updateData = {
    ...taskToUpdate(updates),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    throw error;
  }

  return rowToTask(data as TaskRow);
}

export async function deleteTask(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
}

export async function upsertTasks(tasks: Task[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (tasks.length === 0) return;

  const supabase = getSupabaseClient();
  const rows = tasks.map((task) => taskToInsert(task));

  const { error } = await supabase
    .from("tasks")
    .upsert(rows as never, { onConflict: "id" });

  if (error) {
    console.error("Error upserting tasks:", error.message || error.code || JSON.stringify(error));
    throw new Error(error.message || "Failed to upsert tasks");
  }
}

// Bulk sync: replace all tasks
export async function syncTasks(tasks: Task[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();

  // Delete all existing tasks
  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting tasks:", deleteError);
    throw deleteError;
  }

  // Insert all tasks if any exist
  if (tasks.length > 0) {
    const rows = tasks.map((task) => taskToInsert(task));
    const { error: insertError } = await supabase
      .from("tasks")
      .insert(rows as never);

    if (insertError) {
      console.error("Error inserting tasks:", insertError);
      throw insertError;
    }
  }
}
