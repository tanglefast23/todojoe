import { NextRequest, NextResponse } from "next/server";
import { queryGroq, queryGeminiVision, extractSearchTerms, isGroqConfigured } from "@/lib/groq";
import { getCalendarEvents, createCalendarEvent } from "@/lib/google/calendar";
import { getPrimaryInboxEmails, searchEmails } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

/** Strip HTML tags and dangerous patterns from LLM output before returning to client */
function stripHtml(text: string): string {
  return text
    .replace(/<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// Check if the query is asking to create a calendar event
function isEventCreationRequest(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    (lowerQuery.includes("create") || lowerQuery.includes("make") || lowerQuery.includes("add")) &&
    (lowerQuery.includes("event") || lowerQuery.includes("calendar"))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: { query?: string; image?: string; timeZone?: string } = await request.json();
    const { query, image, timeZone } = body;

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

      // Check if user wants to create a calendar event
      if (isEventCreationRequest(query)) {
        console.log("[Search API] Event creation requested, extracting details as JSON");

        // Get structured JSON from Gemini
        const jsonResponse = await queryGeminiVision(query, image, true);
        console.log("[Search API] Gemini JSON response:", jsonResponse);

        try {
          // Parse the JSON response - strip markdown code blocks if present
          let cleanJson = jsonResponse.trim();
          // Remove ```json ... ``` or ``` ... ``` wrappers
          const codeBlockMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) {
            cleanJson = codeBlockMatch[1].trim();
          }
          const parsed = JSON.parse(cleanJson);

          // Sanitize LLM output — limit field lengths, strip unexpected content
          function sanitizeEventField(val: unknown, maxLen = 200): string {
            if (typeof val !== 'string') return '';
            return val.slice(0, maxLen).replace(/[<>]/g, '');
          }

          // Handle both single object and array of events
          const rawEvents = Array.isArray(parsed) ? parsed : [parsed];
          const events = rawEvents.slice(0, 20).map((e: any) => ({
            title: sanitizeEventField(e.title, 100),
            date: sanitizeEventField(e.date, 10),
            time: sanitizeEventField(e.time, 8),
            location: sanitizeEventField(e.location, 200),
            description: sanitizeEventField(e.description, 500),
          }));

          if (events.length === 0) {
            throw new Error("No events found in the image");
          }

          // Image-sourced events require user confirmation before creation.
          // LLM-parsed data from arbitrary images can be manipulated (prompt injection),
          // so we return pendingEvents for the caller to confirm rather than auto-creating.
          const pendingEvents = events.filter(
            (e) => e.title && e.date && e.time
          ).map((eventData) => {
            const startDateTime = new Date(`${eventData.date}T${eventData.time}:00`);
            return {
              title: eventData.title,
              date: eventData.date,
              time: eventData.time,
              location: eventData.location || "",
              description: eventData.description || "",
              startIso: isNaN(startDateTime.getTime()) ? null : startDateTime.toISOString(),
            };
          });

          if (pendingEvents.length === 0) {
            return NextResponse.json({
              response: "⚠️ Found event data in the image but couldn't parse valid date/time fields. Please add the event manually.",
            });
          }

          const summary = pendingEvents.map(e =>
            `**${e.title}** — ${e.date} ${e.time}${e.location ? ` @ ${e.location}` : ""}`
          ).join("\n");

          return NextResponse.json({
            response: `📅 Found ${pendingEvents.length} event${pendingEvents.length > 1 ? "s" : ""} — please confirm before adding to calendar:\n\n${summary}`,
            pendingEvents,
          });
        } catch (parseError) {
          console.error("[Search API] Failed to parse/create event:", parseError);
          // Fall back to regular vision response
          const response = await queryGeminiVision(query, image, false);
          return NextResponse.json({
            response: stripHtml(response) + "\n\n⚠️ *I found the event details but couldn't automatically create the event. You can manually add it to your calendar.*"
          });
        }
      }

      // Regular image analysis (not event creation)
      const response = await queryGeminiVision(query, image, false);
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
