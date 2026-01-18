/**
 * Owner types for portfolio security
 * Owners are profiles that can protect portfolios with passwords
 */

export interface Owner {
  id: string;
  name: string;           // Display name: "Joe", "Leonard"
  passwordHash: string;   // SHA-256 hash of password
  createdAt: string;      // ISO date string
  isMaster?: boolean;     // Master owner can see ALL portfolios when unlocked
}

export interface OwnerUnlockState {
  unlockedOwnerIds: string[];  // IDs of owners whose portfolios are unlocked this session
}

// Storage keys
export const OWNER_STORAGE_KEY = "owner-storage";
export const UNLOCK_STATE_KEY = "owner-unlock-state";
