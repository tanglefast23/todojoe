/**
 * Cryptographic utilities for password hashing
 * Uses bcrypt for secure password hashing with automatic salting
 */

import bcrypt from "bcryptjs";

// bcrypt cost factor - 10 is a good balance of security and performance for client-side
const BCRYPT_ROUNDS = 10;

/**
 * Hash a password using bcrypt (secure, salted, slow-by-design)
 * This is the proper way to hash passwords for storage
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Legacy SHA-256 hash for backward compatibility
 * Used to verify existing passwords before bcrypt migration
 */
async function legacySha256Hash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Check if a hash is in bcrypt format (starts with $2a$, $2b$, or $2y$)
 */
function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d+\$/.test(hash);
}

/**
 * Verify a password against a stored hash
 * Supports both bcrypt (new) and SHA-256 (legacy) formats
 * Returns { valid: boolean, needsRehash: boolean }
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // Check if this is a bcrypt hash
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy SHA-256 verification
  const sha256Hash = await legacySha256Hash(password);
  return sha256Hash === storedHash;
}

/**
 * Check if a stored hash needs to be upgraded to bcrypt
 * Call this after successful verification to determine if password should be rehashed
 */
export function needsHashUpgrade(storedHash: string): boolean {
  return !isBcryptHash(storedHash);
}
