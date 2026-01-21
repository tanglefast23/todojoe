import { NextRequest, NextResponse } from "next/server";
import { queryGroq, queryGroqVision, extractSearchTerms, isGroqConfigured } from "@/lib/groq";
import { getCalendarEvents } from "@/lib/google/calendar";
import { getPrimaryInboxEmails, searchEmails } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function POST(request: NextRequest) {
  try {
    const { query, image } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: "Groq API not configured. Please add GROQ_API_KEY to environment variables." },
        { status: 401 }
      );
    }

    // If an image is provided, use the vision model
    if (image && typeof image === "string") {
      console.log("[Search API] Processing image with vision model");
      const response = await queryGroqVision(query, image);
      return NextResponse.json({ response });
    }

    // Text-only query - requires Google API for calendar/email context
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured" },
        { status: 401 }
      );
    }

    // First, extract search terms from the query using AI
    const searchTerms = await extractSearchTerms(query);
    console.log("[Search API] Extracted search terms:", searchTerms);

    // Fetch calendar events
    const calendarEvents = await getCalendarEvents("primary", 3).catch((err) => {
      console.error("Failed to fetch calendar events:", err);
      return [];
    });

    // Fetch emails - either search or get recent
    let emails;
    if (searchTerms && searchTerms.length > 0) {
      // Search Gmail with extracted terms
      const gmailQuery = searchTerms.join(" OR ");
      console.log("[Search API] Gmail search query:", gmailQuery);
      emails = await searchEmails(gmailQuery, 50).catch((err) => {
        console.error("Failed to search emails:", err);
        return [];
      });
    } else {
      // Fall back to recent emails if no search terms
      emails = await getPrimaryInboxEmails(30).catch((err) => {
        console.error("Failed to fetch emails:", err);
        return [];
      });
    }

    console.log(`[Search API] Found ${emails.length} emails`);

    // Query Groq with the context
    const response = await queryGroq(
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
