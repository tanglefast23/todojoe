import { NextResponse } from "next/server";
import { google } from "googleapis";

// Returns only boolean status — no credential metadata, no error details
export async function GET() {
  const configured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );

  if (!configured) {
    return NextResponse.json({ ok: false });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost"
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    await oauth2Client.refreshAccessToken();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log error category server-side for debugging — never expose details to client
    const msg = err instanceof Error ? err.message : String(err);
    const category = msg.includes("invalid_grant") ? "token_expired"
      : msg.includes("invalid_client") ? "client_invalid"
      : msg.includes("access_denied") ? "access_denied"
      : "auth_error";
    console.error(`[google/health] Auth check failed: ${category}`);
    return NextResponse.json({ ok: false });
  }
}
