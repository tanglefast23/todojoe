"use client";

import { useRef, useState } from "react";
import { Trash2, Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { GmailMessage } from "@/types/gmail";

interface SwipeableEmailCardProps {
  readonly email: GmailMessage;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  readonly onArchive: () => void;
  readonly getPreview: (snippet: string | null) => string;
}

const SWIPE_THRESHOLD = 96;
const DRAG_ACTIVATE_THRESHOLD = 8;

/**
 * Email card with swipe gestures.
 * Swipe left → delete (red background reveal).
 * Swipe right → archive (amber background reveal).
 * Click still opens the detail modal; action buttons still work.
 */
export function SwipeableEmailCard({
  email,
  isSelected,
  onOpen,
  onDelete,
  onArchive,
  getPreview,
}: SwipeableEmailCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const didDrag = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragStartX.current = e.clientX;
    didDrag.current = false;
    setIsAnimating(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > DRAG_ACTIVATE_THRESHOLD) didDrag.current = true;
    setTranslateX(dx);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may have already been released
    }
    setIsAnimating(true);

    if (dx <= -SWIPE_THRESHOLD) {
      setTranslateX(-window.innerWidth);
      setTimeout(onDelete, 200);
    } else if (dx >= SWIPE_THRESHOLD) {
      setTranslateX(window.innerWidth);
      setTimeout(onArchive, 200);
    } else {
      setTranslateX(0);
    }
  };

  const onCardClick = () => {
    if (didDrag.current) return;
    onOpen();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  const leftBgOpacity = Math.min(Math.max(-translateX / SWIPE_THRESHOLD, 0), 1);
  const rightBgOpacity = Math.min(Math.max(translateX / SWIPE_THRESHOLD, 0), 1);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Archive background — revealed on right swipe */}
      <div
        className="absolute inset-0 flex items-center justify-start pl-6 bg-amber-500 rounded-xl pointer-events-none"
        style={{ opacity: rightBgOpacity }}
      >
        <Archive className="h-6 w-6 text-white" />
        <span className="ml-2 text-white font-semibold">Archive</span>
      </div>

      {/* Delete background — revealed on left swipe */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-6 bg-red-500 rounded-xl pointer-events-none"
        style={{ opacity: leftBgOpacity }}
      >
        <span className="mr-2 text-white font-semibold">Delete</span>
        <Trash2 className="h-6 w-6 text-white" />
      </div>

      {/* Draggable card foreground */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open email: ${email.subject || "No subject"} from ${email.fromName || email.fromEmail || "Unknown sender"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onCardClick}
        onKeyDown={onKeyDown}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className={cn(
          "group relative rounded-xl border-2 p-4 cursor-pointer select-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          email.isUnread
            ? "bg-gradient-to-r from-blue-500/15 to-sky-500/15 border-blue-400/40"
            : "bg-card border-border/50",
          "hover:border-blue-400/50",
          isSelected && "ring-2 ring-blue-400"
        )}
      >
        <div className="flex items-start gap-3">
          {email.isUnread && (
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "truncate",
                  email.isUnread ? "font-semibold" : "font-normal text-muted-foreground"
                )}
              >
                {email.fromName || email.fromEmail || "Unknown sender"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
              </span>
            </div>
            <p
              className={cn(
                "text-lg truncate",
                email.isUnread ? "font-semibold" : "font-normal"
              )}
            >
              {email.subject || "(No subject)"}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {getPreview(email.snippet)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
