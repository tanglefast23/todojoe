"use client";

import { memo, useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduledEvent } from "@/types/scheduled-events";
import { getEventColor } from "@/lib/google/event-colors";
import { format, formatDistanceToNow, isPast } from "date-fns";

interface ScheduledEventItemProps {
  event: ScheduledEvent;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

// Distance (px) before we commit to a gesture direction.
const DRAG_ACTIVATE_THRESHOLD = 10;
// Horizontal distance (px) required to trigger delete on release.
const SWIPE_THRESHOLD = 96;
// Horizontal must dominate vertical by this ratio to count as a left-swipe.
const DIRECTION_LOCK_RATIO = 1.5;
// A fast leftward flick can also trigger delete even without full distance (px/ms).
const FLICK_VELOCITY = 0.6;
// If the card is left partially open (shouldn't normally happen), auto-snap back.
const AUTO_RESET_MS = 1500;

type GestureMode = "idle" | "swipe" | "scroll";

export const ScheduledEventItem = memo(function ScheduledEventItem({
  event,
  onDelete,
  canDelete = true,
}: ScheduledEventItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartTime = useRef(0);
  const gestureMode = useRef<GestureMode>("idle");
  const didDrag = useRef(false);

  const isCompleted = event.status === "completed";
  const scheduledDate = new Date(event.scheduledAt);
  const isOverdue = isPast(scheduledDate) && !isCompleted;

  // Event color — matches Google Calendar event color (falls back for local/default)
  const eventColor = getEventColor(event.source, event.colorId);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDelete) return;
    if (e.button !== undefined && e.button !== 0) return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartTime.current = e.timeStamp;
    gestureMode.current = "idle";
    didDrag.current = false;
    setIsAnimating(false);
    // Note: don't capture the pointer yet — we wait until we know this is a
    // horizontal swipe, so vertical scrolling still works on the ancestor.
  }, [canDelete]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null || dragStartY.current === null) return;
    if (gestureMode.current === "scroll") return;

    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;

    if (gestureMode.current === "idle") {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      // Wait until the user has moved enough to infer intent.
      if (absX < DRAG_ACTIVATE_THRESHOLD && absY < DRAG_ACTIVATE_THRESHOLD) return;
      // Anything that looks like a scroll (vertical, right-ward, or ambiguous)
      // must not hijack the card. Require a clearly dominant leftward motion.
      if (dx >= 0 || absX < absY * DIRECTION_LOCK_RATIO) {
        gestureMode.current = "scroll";
        return;
      }
      gestureMode.current = "swipe";
      didDrag.current = true;
      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore — capture is a best-effort optimization.
      }
    }

    // In swipe mode: translate the card with the finger (left only).
    const clamped = dx > 0 ? 0 : dx;
    setTranslateX(clamped);
  }, []);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    const dt = e.timeStamp - dragStartTime.current;
    const velocity = dt > 0 ? dx / dt : 0; // negative = leftward
    const wasSwipe = gestureMode.current === "swipe";

    dragStartX.current = null;
    dragStartY.current = null;
    gestureMode.current = "idle";

    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Capture may have already been released
    }

    if (!wasSwipe) {
      // Tap or scroll — nothing to animate.
      return;
    }

    setIsAnimating(true);

    // Strong swipe = past distance threshold OR fast leftward flick.
    const strongEnough = dx <= -SWIPE_THRESHOLD || velocity <= -FLICK_VELOCITY;
    if (strongEnough) {
      setTranslateX(-window.innerWidth);
      setTimeout(() => onDelete(event.id), 200);
    } else {
      setTranslateX(0);
    }
  }, [event.id, onDelete]);

  // Safety net: if the card somehow ends up partially offset without an active
  // gesture (e.g., interrupted pointer sequence), snap it back after a moment.
  useEffect(() => {
    if (translateX === 0) return;
    if (gestureMode.current !== "idle") return;
    const id = setTimeout(() => {
      setIsAnimating(true);
      setTranslateX(0);
    }, AUTO_RESET_MS);
    return () => clearTimeout(id);
  }, [translateX]);

  const handleCardClick = useCallback(() => {
    if (didDrag.current) return;
    if (event.htmlLink) {
      window.open(event.htmlLink, "_blank", "noopener,noreferrer");
    }
  }, [event.htmlLink]);

  const handleDeleteButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    setTranslateX(-window.innerWidth);
    setTimeout(() => onDelete(event.id), 200);
  }, [event.id, onDelete]);

  const deleteBgOpacity = Math.min(Math.max(-translateX / SWIPE_THRESHOLD, 0), 1);
  const isInteractive = Boolean(event.htmlLink);

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete zone revealed on left swipe — fades in with drag distance */}
      {canDelete && (
        <div
          className="absolute inset-0 flex items-center justify-end bg-red-500 rounded-lg pr-6 pointer-events-none"
          style={{ opacity: deleteBgOpacity }}
        >
          <button
            onClick={handleDeleteButtonClick}
            className="flex items-center gap-2 text-white font-semibold pointer-events-auto"
            aria-label={`Delete event: ${event.title}`}
          >
            <Trash2 className="h-5 w-5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Card foreground — opaque card tinted by event color, translates on swipe */}
      <div
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={isInteractive ? `Open event in Google Calendar: ${event.title}` : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCardClick}
        onKeyDown={
          isInteractive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick();
                }
              }
            : undefined
        }
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
          backgroundColor: "hsl(var(--card))",
          backgroundImage: `linear-gradient(to right, ${eventColor.hex}26, ${eventColor.hex}0d)`,
          borderColor: `${eventColor.hex}66`,
        }}
        className={cn(
          "relative flex flex-col gap-1 p-2.5 rounded-lg border-2 select-none",
          isCompleted && "opacity-60",
          isInteractive && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/* Completed indicator (only when completed) */}
        {isCompleted && event.completedAt && (
          <div className="text-xs text-muted-foreground">
            Completed {formatDistanceToNow(new Date(event.completedAt), { addSuffix: true })}
          </div>
        )}

        {/* Main content row: event title */}
        <div className="flex items-start gap-2 flex-wrap">
          <span className={cn("font-medium", isCompleted && "line-through")}>
            {event.title}
          </span>
        </div>

        {/* Scheduled time row */}
        <div className="flex items-center gap-4 text-sm">
          <div
            className="flex items-center gap-1.5 font-medium"
            style={{ color: eventColor.hex }}
          >
            <Clock className="h-4 w-4" />
            <span>{format(scheduledDate, "h:mm a")}</span>
          </div>
          {isOverdue && (
            <span className="text-xs text-red-400 font-medium">Overdue</span>
          )}
        </div>
      </div>
    </div>
  );
});
