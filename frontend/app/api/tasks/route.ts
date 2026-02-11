import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTasks,
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/supabase/queries/tasks";
import type { TaskPriority } from "@/types/tasks";

export async function GET() {
  try {
    const tasks = await fetchAllTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: { title?: string; priority?: TaskPriority } = await request.json();

    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const task = await createTask({
      title: body.title,
      priority: body.priority || "regular",
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: "pending",
      attachmentUrl: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: { id?: string; status?: "pending" | "completed"; title?: string; priority?: "regular" | "urgent" } = await request.json();

    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { id, ...updates } = body;
    const task = await updateTask(id, updates);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update task" },
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

    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete task" },
      { status: 500 }
    );
  }
}
