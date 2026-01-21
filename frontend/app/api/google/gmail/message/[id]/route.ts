import { NextRequest, NextResponse } from "next/server";
import { getEmailById, trashEmail, markAsRead } from "@/lib/google/gmail";
import { isGoogleConfigured } from "@/lib/google/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured" },
        { status: 401 }
      );
    }

    const email = await getEmailById(id);
    if (!email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Mark as read when viewing
    await markAsRead(id).catch(console.error);

    return NextResponse.json(email);
  } catch (error) {
    console.error("[Gmail API] Error fetching email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch email" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isGoogleConfigured()) {
      return NextResponse.json(
        { error: "Google API not configured" },
        { status: 401 }
      );
    }

    await trashEmail(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Gmail API] Error deleting email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete email" },
      { status: 500 }
    );
  }
}
