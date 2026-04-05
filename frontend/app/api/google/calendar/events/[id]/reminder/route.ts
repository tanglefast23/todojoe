import { NextRequest, NextResponse } from "next/server";
import { setEventReminder } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/auth";

/**
 * POST /api/google/calendar/events/[id]/reminder
 * Body: { minutes: number | null, calendarId?: string }
 *
 * Sets a popup reminder on the Google Calendar event. `minutes` is the
 * offset before event start (60 = fire one hour before). Pass null to
 * clear all reminders.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json({ error: "Google API not configured" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { minutes, calendarId } = body;

    // Validate: minutes must be a non-negative integer or null
    if (minutes !== null && (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 0)) {
      return NextResponse.json(
        { error: "`minutes` must be a non-negative integer or null" },
        { status: 400 }
      );
    }

    const event = await setEventReminder(id, minutes, calendarId || "primary");
    return NextResponse.json({ event });
  } catch (error) {
    console.error("[Calendar API] Error setting reminder:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set reminder" },
      { status: 500 }
    );
  }
}
