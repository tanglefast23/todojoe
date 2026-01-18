/**
 * Permissions Zustand store with localStorage persistence
 * Manages application permissions for each owner
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppPermissions } from "@/types/runningTab";
import { useOwnerStore } from "./ownerStore";
import { upsertPermission } from "@/lib/supabase/queries/permissions";

const PERMISSIONS_STORAGE_KEY = "permissions-storage";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface PermissionsState {
  permissions: Record<string, AppPermissions>;

  // Bulk setter for Supabase sync
  setPermissions: (permissions: Record<string, AppPermissions>) => void;

  // Getters
  getPermissions: (ownerId: string) => AppPermissions | undefined;
  canCompleteTasks: (ownerId: string) => boolean;
  canApproveExpenses: (ownerId: string) => boolean;

  // Setters
  setCanCompleteTasks: (ownerId: string, value: boolean) => void;
  setCanApproveExpenses: (ownerId: string, value: boolean) => void;

  // Initialization
  initializePermissions: (ownerId: string) => void;
}

export const usePermissionsStore = create<PermissionsState>()(
  persist(
    (set, get) => ({
      permissions: {},

      setPermissions: (permissions) => set({ permissions }),

      getPermissions: (ownerId) => {
        return get().permissions[ownerId];
      },

      canCompleteTasks: (ownerId) => {
        // Master users always have all permissions
        const ownerStore = useOwnerStore.getState();
        const owner = ownerStore.owners.find((o) => o.id === ownerId);
        if (owner?.isMaster) {
          return true;
        }

        const perms = get().permissions[ownerId];
        return perms?.canCompleteTasks ?? false;
      },

      canApproveExpenses: (ownerId) => {
        // Master users always have all permissions
        const ownerStore = useOwnerStore.getState();
        const owner = ownerStore.owners.find((o) => o.id === ownerId);
        if (owner?.isMaster) {
          return true;
        }

        const perms = get().permissions[ownerId];
        return perms?.canApproveExpenses ?? false;
      },

      setCanCompleteTasks: (ownerId, value) => {
        const now = new Date().toISOString();
        let permissionToSync: AppPermissions | null = null;

        set((state) => {
          const existing = state.permissions[ownerId];
          if (existing) {
            permissionToSync = {
              ...existing,
              canCompleteTasks: value,
              updatedAt: now,
            };
            return {
              permissions: {
                ...state.permissions,
                [ownerId]: permissionToSync,
              },
            };
          }
          // Create new permissions if they don't exist
          permissionToSync = {
            id: generateId(),
            ownerId,
            canCompleteTasks: value,
            canApproveExpenses: false,
            updatedAt: now,
          };
          return {
            permissions: {
              ...state.permissions,
              [ownerId]: permissionToSync,
            },
          };
        });

        // Sync to Supabase for cross-device sync
        if (permissionToSync) {
          upsertPermission(permissionToSync).catch((error) => {
            console.error("[Store] Failed to sync permission to Supabase:", error);
          });
        }
      },

      setCanApproveExpenses: (ownerId, value) => {
        const now = new Date().toISOString();
        let permissionToSync: AppPermissions | null = null;

        set((state) => {
          const existing = state.permissions[ownerId];
          if (existing) {
            permissionToSync = {
              ...existing,
              canApproveExpenses: value,
              updatedAt: now,
            };
            return {
              permissions: {
                ...state.permissions,
                [ownerId]: permissionToSync,
              },
            };
          }
          // Create new permissions if they don't exist
          permissionToSync = {
            id: generateId(),
            ownerId,
            canCompleteTasks: false,
            canApproveExpenses: value,
            updatedAt: now,
          };
          return {
            permissions: {
              ...state.permissions,
              [ownerId]: permissionToSync,
            },
          };
        });

        // Sync to Supabase for cross-device sync
        if (permissionToSync) {
          upsertPermission(permissionToSync).catch((error) => {
            console.error("[Store] Failed to sync permission to Supabase:", error);
          });
        }
      },

      initializePermissions: (ownerId) => {
        const now = new Date().toISOString();
        let permissionToSync: AppPermissions | null = null;

        set((state) => {
          // Don't overwrite existing permissions
          if (state.permissions[ownerId]) {
            return state;
          }
          permissionToSync = {
            id: generateId(),
            ownerId,
            canCompleteTasks: false,
            canApproveExpenses: false,
            updatedAt: now,
          };
          return {
            permissions: {
              ...state.permissions,
              [ownerId]: permissionToSync,
            },
          };
        });

        // Sync to Supabase for cross-device sync (only if new permission was created)
        if (permissionToSync) {
          upsertPermission(permissionToSync).catch((error) => {
            console.error("[Store] Failed to sync permission to Supabase:", error);
          });
        }
      },
    }),
    {
      name: PERMISSIONS_STORAGE_KEY,
    }
  )
);
