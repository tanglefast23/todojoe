/**
 * Sync utilities for Supabase operations
 * - Retry with exponential backoff
 * - Debounce with flush support for beforeunload
 */

// Track pending sync operations for flush on unload
// Use a Set for O(1) add/remove and automatic deduplication
export const pendingFlushCallbacks = new Set<() => void>();

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param label - Label for logging
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  label = "operation"
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        console.warn(
          `[Sync] ${label} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error(
          `[Sync] ${label} failed after ${maxRetries} attempts:`,
          error
        );
        throw error;
      }
    }
  }
  throw new Error("Retry exhausted"); // TypeScript guard
}

/**
 * Debounce helper with flush support
 * Registers flush callback for beforeunload to prevent data loss
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T & { flush: () => void; cleanup: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>;
  let pendingArgs: Parameters<T> | null = null;

  const execute = () => {
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      fn(...args);
    }
  };

  const debounced = ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    pendingArgs = args;
    timeoutId = setTimeout(execute, ms);
  }) as T & { flush: () => void; cleanup: () => void };

  debounced.flush = () => {
    clearTimeout(timeoutId);
    execute();
  };

  // Cleanup function to remove from global flush callbacks
  debounced.cleanup = () => {
    pendingFlushCallbacks.delete(debounced.flush);
  };

  // Register for global flush on unload
  pendingFlushCallbacks.add(debounced.flush);

  return debounced;
}

// Flush all pending syncs on page unload (best-effort to prevent data loss)
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    for (const flush of pendingFlushCallbacks) {
      try {
        flush();
      } catch {
        // Best effort - ignore errors during unload
      }
    }
  });
}
