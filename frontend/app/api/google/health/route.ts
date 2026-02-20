import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  // Diagnostic endpoint — credential details stripped to prevent info leakage
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
      // clientIdPrefix intentionally omitted — leaks credential info
    },
  };

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    diagnostics.auth = {
      success: true,
      hasAccessToken: !!credentials.access_token,
      expiryDate: credentials.expiry_date,
    };
  } catch (error) {
    diagnostics.auth = {
      success: false,
      // errorDetails intentionally omitted — may contain token fragments/stack traces
      error: error instanceof Error ? error.message : "Auth failed",
    };
  }

  return NextResponse.json(diagnostics);
}
