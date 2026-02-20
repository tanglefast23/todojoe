import { NextRequest, NextResponse } from "next/server";
import { parseNaturalLanguageEvent } from "@/lib/groq";
import { createCalendarEvent } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/auth";

/**
 * Guard: if INTERNAL_API_KEY is set in env, require it via X-Api-Key header.
 * Add INTERNAL_API_KEY=<random> to .env.local to enable.
 */
function isAuthorized(request: NextRequest): boolean {
  const requiredKey = process.env.INTERNAL_API_KEY;
  if (!requiredKey) return true; // key not configured — allow (backward compat)
  return request.headers.get("x-api-key") === requiredKey;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text, timeZone } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Limit input size to prevent abuse
    if (text.length > 500) {
      return NextResponse.json(
        { error: "Text too long (max 500 chars)" },
        { status: 400 }
      );
    }

    const parsed = await parseNaturalLanguageEvent(text.trim());

    const startDateTime = `${parsed.date}T${parsed.time}:00`;
    let endDateTime: string | undefined;
    if (parsed.endTime) {
      endDateTime = `${parsed.date}T${parsed.endTime}:00`;
    }

    if (!isGoogleConfigured()) {
      return NextResponse.json({
        parsed,
        event: null,
        message: "Event parsed but Google Calendar not configured. Event was not created.",
      });
    }

    const event = await createCalendarEvent(
      parsed.title,
      startDateTime,
      endDateTime,
      parsed.description,
      "primary",
      timeZone
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
