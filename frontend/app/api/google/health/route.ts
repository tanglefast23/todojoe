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
  } catch {
    // Error details intentionally omitted — may contain token fragments
    return NextResponse.json({ ok: false });
  }
}
