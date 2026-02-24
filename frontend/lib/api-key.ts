/**
 * Returns the standard headers for internal API calls.
 * Reads NEXT_PUBLIC_TODOJOE_API_KEY (browser-safe) and includes x-api-key if set.
 */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_TODOJOE_API_KEY;
  return {
    ...(key ? { "x-api-key": key } : {}),
    ...extra,
  };
}
