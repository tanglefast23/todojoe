/**
 * Permissions Zustand store with localStorage persistence
 * Manages application permissions for each owner
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppPermissions } from "@/types/runningTab";
import { useOwnerStore } from "./ownerStore";

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
        set((state) => {
          const existing = state.permissions[ownerId];
          if (existing) {
            return {
              permissions: {
                ...state.permissions,
                [ownerId]: {
                  ...existing,
                  canCompleteTasks: value,
                  updatedAt: now,
                },
              },
            };
          }
          // Create new permissions if they don't exist
          return {
            permissions: {
              ...state.permissions,
              [ownerId]: {
                id: generateId(),
                ownerId,
                canCompleteTasks: value,
                canApproveExpenses: false,
                updatedAt: now,
              },
            },
          };
        });
      },

      setCanApproveExpenses: (ownerId, value) => {
        const now = new Date().toISOString();
        set((state) => {
          const existing = state.permissions[ownerId];
          if (existing) {
            return {
              permissions: {
                ...state.permissions,
                [ownerId]: {
                  ...existing,
                  canApproveExpenses: value,
                  updatedAt: now,
                },
              },
            };
          }
          // Create new permissions if they don't exist
          return {
            permissions: {
              ...state.permissions,
              [ownerId]: {
                id: generateId(),
                ownerId,
                canCompleteTasks: false,
                canApproveExpenses: value,
                updatedAt: now,
              },
            },
          };
        });
      },

      initializePermissions: (ownerId) => {
        const now = new Date().toISOString();
        set((state) => {
          // Don't overwrite existing permissions
          if (state.permissions[ownerId]) {
            return state;
          }
          return {
            permissions: {
              ...state.permissions,
              [ownerId]: {
                id: generateId(),
                ownerId,
                canCompleteTasks: false,
                canApproveExpenses: false,
                updatedAt: now,
              },
            },
          };
        });
      },
    }),
    {
      name: PERMISSIONS_STORAGE_KEY,
    }
  )
);
