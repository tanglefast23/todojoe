import { NextRequest, NextResponse } from "next/server";
import { getCalendarList } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured" },
        { status: 401 }
      );
    }

    const all = await getCalendarList();

    // ?writable=true filters to only owner/writer calendars (for event creation)
    const writableOnly = request.nextUrl.searchParams.get("writable") === "true";
    const calendars = writableOnly
      ? all.filter((cal) => cal.accessRole === "owner" || cal.accessRole === "writer")
      : all;

    return NextResponse.json({ calendars });
  } catch (error) {
    console.error("[Calendar API] Error fetching calendar list:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}
