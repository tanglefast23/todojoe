import { NextRequest, NextResponse } from "next/server";
import { queryGemini, isGeminiConfigured } from "@/lib/google/gemini";
import { getCalendarEvents } from "@/lib/google/calendar";
import { getPrimaryInboxEmails } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "Gemini API not configured. Please add GEMINI_API_KEY to environment variables." },
        { status: 401 }
      );
    }

    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured" },
        { status: 401 }
      );
    }

    // Fetch calendar events and emails in parallel
    const [calendarEvents, emails] = await Promise.all([
      getCalendarEvents("primary", 3).catch((err) => {
        console.error("Failed to fetch calendar events:", err);
        return [];
      }),
      getPrimaryInboxEmails(30).catch((err) => {
        console.error("Failed to fetch emails:", err);
        return [];
      }),
    ]);

    // Query Gemini with the context
    const response = await queryGemini(
      query,
      calendarEvents.map((e) => ({
        title: e.title,
        scheduledAt: e.scheduledAt,
        description: e.description,
      })),
      emails.map((e) => ({
        subject: e.subject,
        fromName: e.fromName,
        fromEmail: e.fromEmail,
        snippet: e.snippet,
        receivedAt: e.receivedAt,
      }))
    );

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[Search API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
