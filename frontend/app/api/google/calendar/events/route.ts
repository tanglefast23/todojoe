import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents, createCalendarEvent } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured. Please run the OAuth setup script." },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const calendarId = searchParams.get("calendarId") || "primary";
    const maxEvents = parseInt(searchParams.get("maxEvents") || "15", 10);

    const events = await getCalendarEvents(calendarId, maxEvents);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("[Calendar API] Error fetching events:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, startTime, endTime, description, calendarId, timeZone } = body;

    if (!title || !startTime) {
      return NextResponse.json(
        { error: "Title and startTime are required" },
        { status: 400 }
      );
    }

    const event = await createCalendarEvent(
      title,
      startTime,
      endTime,
      description,
      calendarId || "primary",
      timeZone
    );

    return NextResponse.json({ event });
  } catch (error) {
    console.error("[Calendar API] Error creating event:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
