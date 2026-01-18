/**
 * Authentication utility functions
 * Helpers for checking owner state from session/local storage
 */

import { UNLOCK_STATE_KEY, OWNER_STORAGE_KEY } from "@/types/owner";
import type { Owner } from "@/types/owner";

const ACTIVE_OWNER_KEY = "active-owner-id";
export const GUEST_ID = "__guest__";

/**
 * Get the active (logged-in) owner ID from localStorage
 * Changed from sessionStorage to fix iOS Safari clearing session on sleep
 */
export function getActiveOwnerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Check localStorage (persistent)
    const localValue = localStorage.getItem(ACTIVE_OWNER_KEY);
    if (localValue) return localValue;

    // Migration: check sessionStorage for existing sessions
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

/**
 * Check if the active user is a master user
 */
export function isActiveMaster(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const activeId = getActiveOwnerId();
    if (!activeId || activeId === GUEST_ID) return false;
    const ownerStorage = localStorage.getItem(OWNER_STORAGE_KEY);
    if (!ownerStorage) return false;
    const parsed = JSON.parse(ownerStorage);
    const owners: Owner[] = parsed.state?.owners || [];
    const activeOwner = owners.find((o) => o.id === activeId);
    return activeOwner?.isMaster ?? false;
  } catch {
    return false;
  }
}

/**
 * Get unlocked owner IDs from sessionStorage (legacy)
 */
export function getUnlockedOwnerIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const state = sessionStorage.getItem(UNLOCK_STATE_KEY);
    return state ? JSON.parse(state) : [];
  } catch {
    return [];
  }
}

/**
 * Check if a master owner is unlocked
 */
export function isMasterUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const unlockedIds = getUnlockedOwnerIds();
    const ownerStorage = localStorage.getItem(OWNER_STORAGE_KEY);
    if (!ownerStorage) return false;
    const parsed = JSON.parse(ownerStorage);
    const owners: Owner[] = parsed.state?.owners || [];
    return owners.some((o) => o.isMaster && unlockedIds.includes(o.id));
  } catch {
    return false;
  }
}
