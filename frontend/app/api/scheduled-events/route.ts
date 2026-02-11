import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllScheduledEvents,
  createScheduledEvent,
  updateScheduledEvent,
  deleteScheduledEvent,
} from "@/lib/supabase/queries/scheduled-events";

export async function GET() {
  try {
    const events = await fetchAllScheduledEvents();
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: { title?: string; scheduledAt?: string; description?: string } = await request.json();

    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.scheduledAt || typeof body.scheduledAt !== "string") {
      return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });
    }

    const event = await createScheduledEvent({
      title: body.title,
      description: body.description ?? null,
      scheduledAt: body.scheduledAt,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: "pending",
      source: "local",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create event" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: { id?: string; status?: "pending" | "completed"; title?: string; scheduledAt?: string } = await request.json();

    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { id, ...updates } = body;
    const event = await updateScheduledEvent(id, updates);
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteScheduledEvent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete event" },
      { status: 500 }
    );
  }
}
