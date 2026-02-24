import { NextRequest, NextResponse } from "next/server";

/**
 * API key middleware for todojoe.
 *
 * If TODOJOE_API_KEY is set, all /api/* routes (except /api/google/health)
 * require a matching key via:
 *   - Header: x-api-key: <key>
 *   - Query:  ?api_key=<key>
 *
 * If TODOJOE_API_KEY is not set, all requests are allowed (dev/backwards compat).
 *
 * The public-facing NEXT_PUBLIC_TODOJOE_API_KEY var lets browser-side code
 * include the key in fetch headers without an extra BFF layer.
 */
export function middleware(req: NextRequest) {
  const apiKey = process.env.TODOJOE_API_KEY;

  // No key configured → allow everything (dev mode / backwards compat)
  if (!apiKey) return NextResponse.next();

  // Only gate /api/* routes
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  // /api/google/health is public — used for status checks
  if (req.nextUrl.pathname === "/api/google/health") return NextResponse.next();

  // Check header first, then query param
  const headerKey = req.headers.get("x-api-key");
  const queryKey = req.nextUrl.searchParams.get("api_key");

  if (headerKey === apiKey || queryKey === apiKey) return NextResponse.next();

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
