import { NextResponse } from "next/server";
import { getPrimaryInboxEmails } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function GET() {
  try {
    // Check if Google API is configured
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured. Please run the OAuth setup script." },
        { status: 401 }
      );
    }

    // Fetch emails from Primary inbox (both read and unread)
    const messages = await getPrimaryInboxEmails(30);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[Gmail API] Error fetching messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
