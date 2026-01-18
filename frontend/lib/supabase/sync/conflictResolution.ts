/**
 * Conflict resolution utilities for Supabase sync
 * Uses timestamp-based "last write wins" strategy
 */

/**
 * Item with timestamp for conflict resolution
 */
export interface TimestampedItem {
  id: string;
  updatedAt?: string;
}

/**
 * Compare two timestamps, returning which is newer
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareTimestamps(a?: string, b?: string): number {
  // If both missing, consider equal
  if (!a && !b) return 0;
  // Missing timestamp is considered oldest
  if (!a) return -1;
  if (!b) return 1;

  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();

  if (timeA > timeB) return 1;
  if (timeA < timeB) return -1;
  return 0;
}

/**
 * Merge two arrays of items based on timestamps
 * For items with same ID, keeps the one with newer updatedAt
 * Items only in one array are included
 *
 * @param local - Local items
 * @param remote - Remote items from Supabase
 * @returns Merged array with newest versions of each item
 */
export function mergeByTimestamp<T extends TimestampedItem>(
  local: T[],
  remote: T[]
): { merged: T[]; localWins: string[]; remoteWins: string[]; newLocal: string[]; newRemote: string[] } {
  const localMap = new Map(local.map(item => [item.id, item]));
  const remoteMap = new Map(remote.map(item => [item.id, item]));

  const merged: T[] = [];
  const localWins: string[] = [];
  const remoteWins: string[] = [];
  const newLocal: string[] = [];
  const newRemote: string[] = [];

  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    if (localItem && remoteItem) {
      // Both exist - compare timestamps
      const comparison = compareTimestamps(localItem.updatedAt, remoteItem.updatedAt);
      if (comparison >= 0) {
        merged.push(localItem);
        if (comparison > 0) localWins.push(id);
      } else {
        merged.push(remoteItem);
        remoteWins.push(id);
      }
    } else if (localItem) {
      // Only exists locally
      merged.push(localItem);
      newLocal.push(id);
    } else if (remoteItem) {
      // Only exists remotely
      merged.push(remoteItem);
      newRemote.push(id);
    }
  }

  return { merged, localWins, remoteWins, newLocal, newRemote };
}

/**
 * Determine items that need to be synced to remote
 * Returns items that are newer locally or don't exist remotely
 */
export function getItemsToSync<T extends TimestampedItem>(
  local: T[],
  remote: T[]
): T[] {
  const remoteMap = new Map(remote.map(item => [item.id, item]));

  return local.filter(localItem => {
    const remoteItem = remoteMap.get(localItem.id);
    if (!remoteItem) return true; // New item
    return compareTimestamps(localItem.updatedAt, remoteItem.updatedAt) > 0;
  });
}

/**
 * Determine items that were deleted locally but exist remotely
 */
export function getDeletedItems<T extends TimestampedItem>(
  local: T[],
  remote: T[]
): string[] {
  const localIds = new Set(local.map(item => item.id));
  return remote.filter(item => !localIds.has(item.id)).map(item => item.id);
}

/**
 * Get current timestamp in ISO format
 */
export function getNow(): string {
  return new Date().toISOString();
}
