import { NextRequest, NextResponse } from "next/server";
import { queryGroq, queryGeminiVision, extractSearchTerms, isGroqConfigured } from "@/lib/groq";
import { getCalendarEvents, createCalendarEvent } from "@/lib/google/calendar";
import { getPrimaryInboxEmails, searchEmails } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

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
    const { query, image, timeZone } = await request.json();

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

          // Handle both single object and array of events
          const events = Array.isArray(parsed) ? parsed : [parsed];

          if (events.length === 0) {
            throw new Error("No events found in the image");
          }

          const createdEvents: string[] = [];
          const failedEvents: string[] = [];

          for (const eventData of events) {
            try {
              // Validate required fields
              if (!eventData.title || !eventData.date || !eventData.time) {
                failedEvents.push(`Missing details for: ${eventData.title || "Unknown event"}`);
                continue;
              }

              // Construct the start time in ISO format
              const startDateTime = new Date(`${eventData.date}T${eventData.time}:00`);
              if (isNaN(startDateTime.getTime())) {
                failedEvents.push(`Invalid date/time for: ${eventData.title}`);
                continue;
              }

              // Create the calendar event
              await createCalendarEvent(
                eventData.title,
                startDateTime.toISOString(),
                undefined, // end time (will default to 1 hour)
                [eventData.location, eventData.description].filter(Boolean).join("\n") || undefined,
                "primary",
                timeZone
              );

              createdEvents.push(
                `**${eventData.title}**\n` +
                `📅 ${startDateTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}\n` +
                `🕐 ${startDateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` +
                (eventData.location ? `\n📍 ${eventData.location}` : "")
              );
            } catch (err) {
              failedEvents.push(`Failed to create: ${eventData.title || "Unknown"}`);
            }
          }

          console.log("[Search API] Created events:", createdEvents.length, "Failed:", failedEvents.length);

          // Build response message
          let response = "";
          if (createdEvents.length > 0) {
            response = `✅ **${createdEvents.length} calendar event${createdEvents.length > 1 ? "s" : ""} created!**\n\n`;
            response += createdEvents.join("\n\n---\n\n");
            response += "\n\nAll events have been added to your Google Calendar.";
          }
          if (failedEvents.length > 0) {
            response += `\n\n⚠️ Could not create: ${failedEvents.join(", ")}`;
          }

          return NextResponse.json({ response });
        } catch (parseError) {
          console.error("[Search API] Failed to parse/create event:", parseError);
          // Fall back to regular vision response
          const response = await queryGeminiVision(query, image, false);
          return NextResponse.json({
            response: response + "\n\n⚠️ *I found the event details but couldn't automatically create the event. You can manually add it to your calendar.*"
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
