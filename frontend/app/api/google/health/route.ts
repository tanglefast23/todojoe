import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
      clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...",
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

    // Try to refresh the token
    const { credentials } = await oauth2Client.refreshAccessToken();

    diagnostics.auth = {
      success: true,
      hasAccessToken: !!credentials.access_token,
      expiryDate: credentials.expiry_date,
    };
  } catch (error) {
    diagnostics.auth = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: error,
    };
  }

  return NextResponse.json(diagnostics);
}
