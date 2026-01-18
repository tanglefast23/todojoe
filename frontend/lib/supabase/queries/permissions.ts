/**
 * Supabase queries for app_permissions table
 * Manages per-owner permissions for tasks and expenses
 */
import { getSupabaseClient } from "../client";
import type { Database } from "@/types/database";
import type { AppPermissions } from "@/types/runningTab";

type AppPermissionsRow = Database["public"]["Tables"]["app_permissions"]["Row"];
type AppPermissionsInsert = Database["public"]["Tables"]["app_permissions"]["Insert"];
type AppPermissionsUpdate = Database["public"]["Tables"]["app_permissions"]["Update"];

// Convert database row to app type (snake_case to camelCase)
function rowToPermissions(row: AppPermissionsRow): AppPermissions {
  return {
    id: row.id,
    ownerId: row.owner_id,
    canCompleteTasks: row.can_complete_tasks,
    canApproveExpenses: row.can_approve_expenses,
    updatedAt: row.updated_at,
  };
}

// Convert app type to database row (camelCase to snake_case)
function permissionsToInsert(
  permissions: Omit<AppPermissions, "id"> & { id?: string }
): AppPermissionsInsert {
  return {
    id: permissions.id,
    owner_id: permissions.ownerId,
    can_complete_tasks: permissions.canCompleteTasks,
    can_approve_expenses: permissions.canApproveExpenses,
    updated_at: permissions.updatedAt,
  };
}

function permissionsToUpdate(permissions: Partial<AppPermissions>): AppPermissionsUpdate {
  const update: AppPermissionsUpdate = {};
  if (permissions.ownerId !== undefined) update.owner_id = permissions.ownerId;
  if (permissions.canCompleteTasks !== undefined) update.can_complete_tasks = permissions.canCompleteTasks;
  if (permissions.canApproveExpenses !== undefined) update.can_approve_expenses = permissions.canApproveExpenses;
  if (permissions.updatedAt !== undefined) update.updated_at = permissions.updatedAt;
  return update;
}

/**
 * Fetch all permission records
 */
export async function fetchAllPermissions(): Promise<AppPermissions[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_permissions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching permissions:", error);
    throw error;
  }

  return ((data as AppPermissionsRow[]) || []).map(rowToPermissions);
}

/**
 * Fetch permissions for a specific owner
 */
export async function fetchPermissionsByOwner(ownerId: string): Promise<AppPermissions | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_permissions")
    .select("*")
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    // PGRST116 = no rows found
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching permissions by owner:", error);
    throw error;
  }

  return rowToPermissions(data as AppPermissionsRow);
}

/**
 * Create or update permissions for an owner
 * Uses upsert with owner_id as the conflict column
 */
export async function upsertPermission(permission: AppPermissions): Promise<AppPermissions> {
  const supabase = getSupabaseClient();
  const row = {
    ...permissionsToInsert(permission),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("app_permissions")
    .upsert(row as never, { onConflict: "owner_id" })
    .select()
    .single();

  if (error) {
    console.error("Error upserting permission:", error);
    throw error;
  }

  return rowToPermissions(data as AppPermissionsRow);
}

/**
 * Update permissions for an owner by permission ID
 */
export async function updatePermission(
  id: string,
  updates: Partial<AppPermissions>
): Promise<AppPermissions> {
  const supabase = getSupabaseClient();
  const updateData = {
    ...permissionsToUpdate(updates),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("app_permissions")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating permission:", error);
    throw error;
  }

  return rowToPermissions(data as AppPermissionsRow);
}

/**
 * Delete permission record for an owner
 */
export async function deletePermission(ownerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("app_permissions")
    .delete()
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Error deleting permission:", error);
    throw error;
  }
}

/**
 * Delete permission record by ID
 */
export async function deletePermissionById(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("app_permissions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting permission:", error);
    throw error;
  }
}

/**
 * Bulk upsert permissions (for sync purposes)
 */
export async function upsertPermissions(permissions: AppPermissions[]): Promise<void> {
  if (permissions.length === 0) return;

  const supabase = getSupabaseClient();
  const rows = permissions.map((permission) => permissionsToInsert(permission));

  const { error } = await supabase
    .from("app_permissions")
    .upsert(rows as never, { onConflict: "owner_id" });

  if (error) {
    console.error("Error upserting permissions:", error);
    throw error;
  }
}

/**
 * Sync permissions - replaces all permission records
 */
export async function syncPermissions(permissions: AppPermissions[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete all existing permissions
  const { error: deleteError } = await supabase
    .from("app_permissions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (deleteError) {
    console.error("Error deleting permissions:", deleteError);
    throw deleteError;
  }

  // Insert all permissions if any exist
  if (permissions.length > 0) {
    const rows = permissions.map((permission) => permissionsToInsert(permission));
    const { error: insertError } = await supabase
      .from("app_permissions")
      .insert(rows as never);

    if (insertError) {
      console.error("Error inserting permissions:", insertError);
      throw insertError;
    }
  }
}
