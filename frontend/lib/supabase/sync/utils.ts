/**
 * Sync Utilities
 *
 * Provides debouncing with flush support (for page unload),
 * exponential backoff retry, and global flush tracking.
 */

// Global set of pending flush callbacks - used to flush all pending syncs on page unload
export const pendingFlushCallbacks = new Set<() => void>();

/**
 * Reference types for sync state management
 */
export interface SyncStateRefs {
  isInitialLoad: React.MutableRefObject<boolean>;
  isSyncing: React.MutableRefObject<boolean>;
}

/**
 * Creates a debounced function with flush support.
 *
 * Unlike standard debounce, this version:
 * - Registers with pendingFlushCallbacks for page unload handling
 * - Returns a function with .flush() method for immediate execution
 * - Properly cleans up when flushed or cancelled
 *
 * @param fn - The function to debounce
 * @param delay - Delay in milliseconds (default 1000ms)
 * @returns Debounced function with flush() method
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number = 1000
): ((...args: TArgs) => void) & { flush: () => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs !== null) {
      const args: TArgs = lastArgs;
      lastArgs = null;
      pendingFlushCallbacks.delete(flush);
      fn.apply(null, args);
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    pendingFlushCallbacks.delete(flush);
  };

  const debounced = ((...args: TArgs) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Register flush callback for page unload handling
    pendingFlushCallbacks.add(flush);

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs !== null) {
        const currentArgs: TArgs = lastArgs;
        lastArgs = null;
        pendingFlushCallbacks.delete(flush);
        fn.apply(null, currentArgs);
      }
    }, delay);
  }) as ((...args: TArgs) => void) & { flush: () => void; cancel: () => void };

  debounced.flush = flush;
  debounced.cancel = cancel;

  return debounced;
}

/**
 * Retries an async operation with exponential backoff.
 *
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of attempts (default 3)
 * @param operationName - Name for logging purposes
 * @param baseDelay - Base delay in ms (default 1000, doubles each retry)
 * @returns Promise resolving to the function result or undefined on failure
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  operationName: string = "operation",
  baseDelay: number = 1000
): Promise<T | undefined> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(
          `[Sync] ${operationName} failed (attempt ${attempt}/${maxAttempts}), ` +
          `retrying in ${delay}ms:`,
          lastError.message
        );
        await sleep(delay);
      }
    }
  }

  console.error(
    `[Sync] ${operationName} failed after ${maxAttempts} attempts:`,
    lastError?.message
  );

  return undefined;
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Flushes all pending sync operations.
 * Call this on page unload (beforeunload event) to ensure
 * all pending changes are saved before the page closes.
 */
export function flushAllPendingSyncs(): void {
  console.log(`[Sync] Flushing ${pendingFlushCallbacks.size} pending sync operations`);
  pendingFlushCallbacks.forEach(flush => {
    try {
      flush();
    } catch (error) {
      console.error("[Sync] Error during flush:", error);
    }
  });
}

/**
 * Compares two arrays for equality (shallow comparison of elements by JSON).
 * Used to detect if store data has actually changed.
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const aJson = JSON.stringify(a);
  const bJson = JSON.stringify(b);
  return aJson === bJson;
}

/**
 * Compares two objects for equality (shallow comparison by JSON).
 * Used to detect if store data has actually changed.
 */
export function objectsEqual<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
