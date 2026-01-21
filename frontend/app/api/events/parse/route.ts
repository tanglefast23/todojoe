import { NextRequest, NextResponse } from "next/server";
import { parseNaturalLanguageEvent } from "@/lib/groq";
import { createCalendarEvent } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Parse natural language to extract event details
    const parsed = await parseNaturalLanguageEvent(text.trim());

    // Build datetime strings
    const startDateTime = `${parsed.date}T${parsed.time}:00`;
    let endDateTime: string | undefined;

    if (parsed.endTime) {
      endDateTime = `${parsed.date}T${parsed.endTime}:00`;
    }

    // Check if Google is configured before attempting to create event
    if (!isGoogleConfigured()) {
      // Return parsed data without creating event
      return NextResponse.json({
        parsed,
        event: null,
        message: "Event parsed but Google Calendar not configured. Event was not created.",
      });
    }

    // Create the calendar event
    const event = await createCalendarEvent(
      parsed.title,
      startDateTime,
      endDateTime,
      parsed.description,
      "primary"
    );

    return NextResponse.json({
      parsed,
      event,
      message: `Created "${parsed.title}" on ${parsed.date} at ${parsed.time}`,
    });
  } catch (error) {
    console.error("[Events Parse API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse event" },
      { status: 500 }
    );
  }
}
