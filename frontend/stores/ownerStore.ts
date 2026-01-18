/**
 * Owner Zustand store with localStorage persistence
 * Manages owner profiles and login session state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Owner } from "@/types/owner";
import { OWNER_STORAGE_KEY, UNLOCK_STATE_KEY } from "@/types/owner";
import { hashPassword, verifyPassword, needsHashUpgrade } from "@/lib/crypto";

// No-op function - portfolio functionality has been removed
function resetPortfolioView(): void {
  // This function was previously used to reset portfolio view on login/logout
  // It's kept as a no-op to maintain function call sites
}

// Special ID for guest users (no password, only sees public portfolios)
export const GUEST_ID = "__guest__";
const ACTIVE_OWNER_KEY = "active-owner-id";

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute lockout
const RATE_LIMIT_KEY = "login-rate-limit";

// Rate limiting types and helpers
interface RateLimitEntry {
  attempts: number;
  lockedUntil: number | null;
}

function getRateLimitData(): Record<string, RateLimitEntry> {
  if (typeof window === "undefined") return {};
  try {
    const data = sessionStorage.getItem(RATE_LIMIT_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function setRateLimitData(data: Record<string, RateLimitEntry>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function isOwnerLockedOut(ownerId: string): { locked: boolean; remainingMs: number } {
  const data = getRateLimitData();
  const entry = data[ownerId];

  if (!entry?.lockedUntil) {
    return { locked: false, remainingMs: 0 };
  }

  const now = Date.now();
  if (now >= entry.lockedUntil) {
    // Lockout expired, clear it
    delete data[ownerId];
    setRateLimitData(data);
    return { locked: false, remainingMs: 0 };
  }

  return { locked: true, remainingMs: entry.lockedUntil - now };
}

function recordFailedAttempt(ownerId: string): { locked: boolean; attemptsRemaining: number } {
  const data = getRateLimitData();
  const entry = data[ownerId] || { attempts: 0, lockedUntil: null };

  entry.attempts += 1;

  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    entry.attempts = 0; // Reset attempts after lockout
    data[ownerId] = entry;
    setRateLimitData(data);
    return { locked: true, attemptsRemaining: 0 };
  }

  data[ownerId] = entry;
  setRateLimitData(data);
  return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS - entry.attempts };
}

function clearRateLimit(ownerId: string): void {
  const data = getRateLimitData();
  delete data[ownerId];
  setRateLimitData(data);
}

function generateId(): string {
  // Use crypto.randomUUID() for proper UUID format (required for Supabase)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments (shouldn't be needed in modern browsers)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Local storage helpers for active login (persists across browser sessions)
// Changed from sessionStorage to localStorage to fix iOS Safari clearing session on sleep
function getActiveOwnerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Check localStorage (persistent) - migrating from sessionStorage
    const localValue = localStorage.getItem(ACTIVE_OWNER_KEY);
    if (localValue) return localValue;

    // Migration: check sessionStorage for existing sessions and move to localStorage
    const sessionValue = sessionStorage.getItem(ACTIVE_OWNER_KEY);
    if (sessionValue) {
      localStorage.setItem(ACTIVE_OWNER_KEY, sessionValue);
      sessionStorage.removeItem(ACTIVE_OWNER_KEY);
      return sessionValue;
    }

    return null;
  } catch {
    return null;
  }
}

// Custom event name for active owner changes (avoids polling)
export const ACTIVE_OWNER_CHANGED_EVENT = "active-owner-changed";

function setActiveOwnerId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_OWNER_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_OWNER_KEY);
  }
  // Clean up any legacy sessionStorage entry
  try {
    sessionStorage.removeItem(ACTIVE_OWNER_KEY);
  } catch {
    // Ignore errors
  }
  // Dispatch custom event so listeners can react without polling
  window.dispatchEvent(new CustomEvent(ACTIVE_OWNER_CHANGED_EVENT, { detail: { ownerId: id } }));
}

// Legacy unlock state helpers (kept for backwards compatibility)
function getUnlockedOwnerIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const state = sessionStorage.getItem(UNLOCK_STATE_KEY);
    return state ? JSON.parse(state) : [];
  } catch {
    return [];
  }
}

function setUnlockedOwnerIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(UNLOCK_STATE_KEY, JSON.stringify(ids));
}

interface OwnerState {
  owners: Owner[];
  setupWizardCompleted: boolean;

  // Initialization
  initializeDefaultOwner: () => Promise<void>;

  // Bulk setter for Supabase sync
  setOwners: (owners: Owner[]) => void;

  // Owner CRUD
  addOwner: (name: string, password: string, isMaster?: boolean) => Promise<string>;
  removeOwner: (id: string) => void;
  updateOwnerName: (id: string, name: string) => void;
  setOwnerMaster: (id: string, isMaster: boolean) => void;
  changeOwnerPassword: (
    id: string,
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;

  // Session login (new approach - single active user)
  getActiveOwnerId: () => string | null;
  getActiveOwner: () => Owner | null;
  isLoggedIn: () => boolean;
  isGuest: () => boolean;
  isMasterLoggedIn: () => boolean;
  login: (id: string, password: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => void;

  // Legacy unlock state (sessionStorage - clears on browser close)
  isOwnerUnlocked: (ownerId: string) => boolean;
  isMasterUnlocked: () => boolean;
  unlockOwner: (id: string, password: string) => Promise<boolean>;
  lockOwner: (id: string) => void;
  lockAllOwners: () => void;
  getUnlockedOwnerIds: () => string[];

  // Rate limiting
  checkRateLimit: (ownerId: string) => { locked: boolean; remainingMs: number };

  // Wizard
  completeSetupWizard: () => void;
  resetSetupWizard: () => void;
}

export const useOwnerStore = create<OwnerState>()(
  persist(
    (set, get) => ({
      owners: [],
      setupWizardCompleted: false,

      setOwners: (owners) => {
        set({ owners });
      },

      initializeDefaultOwner: async () => {
        // No-op: First-time setup is now handled by AccountSelector
        // This keeps the function signature for backwards compatibility
        // but removes the hardcoded password security vulnerability
        return;
      },

      addOwner: async (name, password, isMaster = false) => {
        const id = generateId();

        // First user is automatically master/admin
        const isFirstUser = get().owners.length === 0;
        const shouldBeMaster = isMaster || isFirstUser;

        // Only hash password if provided and user is master (admins require passwords)
        // Non-admin accounts can be passwordless
        const passwordHash = (password && (shouldBeMaster || password.trim()))
          ? await hashPassword(password)
          : "";

        const newOwner: Owner = {
          id,
          name,
          passwordHash,
          createdAt: new Date().toISOString(),
          isMaster: shouldBeMaster,
        };

        set((state) => ({
          owners: [...state.owners, newOwner],
        }));

        return id;
      },

      removeOwner: (id) => {
        set((state) => ({
          owners: state.owners.filter((o) => o.id !== id),
        }));
        // Also remove from unlocked state
        const unlocked = getUnlockedOwnerIds().filter((oid) => oid !== id);
        setUnlockedOwnerIds(unlocked);
      },

      updateOwnerName: (id, name) => {
        set((state) => ({
          owners: state.owners.map((o) =>
            o.id === id ? { ...o, name } : o
          ),
        }));
      },

      setOwnerMaster: (id, isMaster) => {
        set((state) => ({
          owners: state.owners.map((o) =>
            o.id === id ? { ...o, isMaster } : o
          ),
        }));
      },

      changeOwnerPassword: async (id, currentPassword, newPassword) => {
        const owner = get().owners.find((o) => o.id === id);
        if (!owner) return false;

        const isValid = await verifyPassword(currentPassword, owner.passwordHash);
        if (!isValid) return false;

        const newHash = await hashPassword(newPassword);
        set((state) => ({
          owners: state.owners.map((o) =>
            o.id === id ? { ...o, passwordHash: newHash } : o
          ),
        }));
        return true;
      },

      // Session login functions
      getActiveOwnerId: () => {
        return getActiveOwnerId();
      },

      getActiveOwner: () => {
        const activeId = getActiveOwnerId();
        if (!activeId || activeId === GUEST_ID) return null;
        return get().owners.find((o) => o.id === activeId) || null;
      },

      isLoggedIn: () => {
        return getActiveOwnerId() !== null;
      },

      isGuest: () => {
        return getActiveOwnerId() === GUEST_ID;
      },

      isMasterLoggedIn: () => {
        const activeId = getActiveOwnerId();
        if (!activeId || activeId === GUEST_ID) return false;
        const owner = get().owners.find((o) => o.id === activeId);
        return owner?.isMaster ?? false;
      },

      login: async (id, password) => {
        const owner = get().owners.find((o) => o.id === id);
        if (!owner) return false;

        // Non-admin accounts without passwords can login without password
        const isPasswordless = !owner.isMaster && (!owner.passwordHash || owner.passwordHash === "");

        if (!isPasswordless) {
          // Check rate limit before attempting login (only for password-protected accounts)
          const lockStatus = isOwnerLockedOut(id);
          if (lockStatus.locked) {
            console.warn(`[ownerStore] Login blocked: account locked for ${Math.ceil(lockStatus.remainingMs / 1000)}s`);
            return false;
          }

          const isValid = await verifyPassword(password, owner.passwordHash);
          if (!isValid) {
            // Record failed attempt
            const result = recordFailedAttempt(id);
            if (result.locked) {
              console.warn(`[ownerStore] Too many failed attempts. Account locked for 1 minute.`);
            } else {
              console.warn(`[ownerStore] Login failed. ${result.attemptsRemaining} attempts remaining.`);
            }
            return false;
          }

          // Clear rate limit on successful login
          clearRateLimit(id);

          // Upgrade legacy SHA-256 hash to bcrypt if needed
          if (needsHashUpgrade(owner.passwordHash)) {
            const newHash = await hashPassword(password);
            set((state) => ({
              owners: state.owners.map((o) =>
                o.id === id ? { ...o, passwordHash: newHash } : o
              ),
            }));
            console.log(`[ownerStore] Upgraded password hash to bcrypt for owner ${id}`);
          }
        }

        // Reset portfolio view BEFORE changing user (security: prevent data leakage)
        resetPortfolioView();

        setActiveOwnerId(id);
        // Also add to legacy unlock state for backwards compatibility
        const current = getUnlockedOwnerIds();
        if (!current.includes(id)) {
          setUnlockedOwnerIds([...current, id]);
        }
        return true;
      },

      loginAsGuest: () => {
        // Reset portfolio view BEFORE changing user (security: prevent data leakage)
        resetPortfolioView();
        setActiveOwnerId(GUEST_ID);
      },

      logout: () => {
        // Reset portfolio view BEFORE logging out (security: prevent data leakage)
        resetPortfolioView();
        setActiveOwnerId(null);
        // Clear legacy unlock state too
        setUnlockedOwnerIds([]);
      },

      // Legacy unlock functions (kept for backwards compatibility)
      isOwnerUnlocked: (ownerId) => {
        return getUnlockedOwnerIds().includes(ownerId);
      },

      isMasterUnlocked: () => {
        const unlockedIds = getUnlockedOwnerIds();
        const owners = get().owners;
        // Check if any unlocked owner is a master
        return owners.some((o) => o.isMaster && unlockedIds.includes(o.id));
      },

      unlockOwner: async (id, password) => {
        const owner = get().owners.find((o) => o.id === id);
        if (!owner) return false;

        // Check rate limit before attempting unlock
        const lockStatus = isOwnerLockedOut(id);
        if (lockStatus.locked) {
          console.warn(`[ownerStore] Unlock blocked: account locked for ${Math.ceil(lockStatus.remainingMs / 1000)}s`);
          return false;
        }

        const isValid = await verifyPassword(password, owner.passwordHash);
        if (!isValid) {
          // Record failed attempt
          const result = recordFailedAttempt(id);
          if (result.locked) {
            console.warn(`[ownerStore] Too many failed attempts. Account locked for 1 minute.`);
          }
          return false;
        }

        // Clear rate limit on successful unlock
        clearRateLimit(id);

        // Upgrade legacy SHA-256 hash to bcrypt if needed
        if (needsHashUpgrade(owner.passwordHash)) {
          const newHash = await hashPassword(password);
          set((state) => ({
            owners: state.owners.map((o) =>
              o.id === id ? { ...o, passwordHash: newHash } : o
            ),
          }));
          console.log(`[ownerStore] Upgraded password hash to bcrypt for owner ${id}`);
        }

        const current = getUnlockedOwnerIds();
        if (!current.includes(id)) {
          setUnlockedOwnerIds([...current, id]);
        }
        return true;
      },

      lockOwner: (id) => {
        const current = getUnlockedOwnerIds();
        setUnlockedOwnerIds(current.filter((oid) => oid !== id));
      },

      lockAllOwners: () => {
        setUnlockedOwnerIds([]);
      },

      getUnlockedOwnerIds: () => {
        return getUnlockedOwnerIds();
      },

      checkRateLimit: (ownerId) => {
        return isOwnerLockedOut(ownerId);
      },

      completeSetupWizard: () => {
        set({ setupWizardCompleted: true });
      },

      resetSetupWizard: () => {
        set({ setupWizardCompleted: false });
      },
    }),
    {
      name: OWNER_STORAGE_KEY,
      // Don't persist unlock state - it's in sessionStorage
      partialize: (state) => ({
        owners: state.owners,
        setupWizardCompleted: state.setupWizardCompleted,
      }),
      // Migration to convert non-UUID IDs to proper UUIDs
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as { owners: Owner[]; setupWizardCompleted: boolean };

        // v0 → v1: Convert owner IDs to UUIDs for Supabase compatibility
        if (version < 1) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isUUID = (id: string) => uuidRegex.test(id);

          const makeUUID = () => {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
              return crypto.randomUUID();
            }
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
          };

          // Create mapping and convert owner IDs
          const ownerIdMap = new Map<string, string>();
          if (state.owners) {
            state.owners = state.owners.map((owner) => {
              if (!isUUID(owner.id)) {
                const newId = makeUUID();
                ownerIdMap.set(owner.id, newId);
                return { ...owner, id: newId };
              }
              return owner;
            });
          }

          // Update session storage if there are mappings
          if (ownerIdMap.size > 0 && typeof window !== "undefined") {
            try {
              // Update sessionStorage active-owner-id so user stays logged in
              const activeId = sessionStorage.getItem(ACTIVE_OWNER_KEY);
              if (activeId && ownerIdMap.has(activeId)) {
                sessionStorage.setItem(ACTIVE_OWNER_KEY, ownerIdMap.get(activeId)!);
              }

              // Update sessionStorage unlock state
              const unlockState = sessionStorage.getItem(UNLOCK_STATE_KEY);
              if (unlockState) {
                const unlockedIds: string[] = JSON.parse(unlockState);
                const newUnlockedIds = unlockedIds.map((id) => ownerIdMap.get(id) || id);
                sessionStorage.setItem(UNLOCK_STATE_KEY, JSON.stringify(newUnlockedIds));
              }
            } catch (e) {
              console.error("[Migration] Failed to update session storage:", e);
            }
          }

          console.log("[Migration] Converted owner IDs to UUIDs:", ownerIdMap.size);
        }

        return state;
      },
      version: 1,
    }
  )
);
