import { NextRequest, NextResponse } from "next/server";
import { getPrimaryInboxEmails } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

function isAuthorizedRequest(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : null;
  return !ip || ip.startsWith("127.") || ip.startsWith("::1") || ip.startsWith("100.");
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured. Please run the OAuth setup script." },
        { status: 401 }
      );
    }
    const messages = await getPrimaryInboxEmails(50);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[Gmail API] Error fetching messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
