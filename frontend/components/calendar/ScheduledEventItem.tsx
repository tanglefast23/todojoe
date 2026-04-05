"use client";

import { memo, useState, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
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

const SWIPE_THRESHOLD = 96;
const DRAG_ACTIVATE_THRESHOLD = 8;

export const ScheduledEventItem = memo(function ScheduledEventItem({
  event,
  onDelete,
  canDelete = true,
}: ScheduledEventItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartX = useRef<number | null>(null);
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
    didDrag.current = false;
    setIsAnimating(false);
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  }, [canDelete]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    // Only track left swipes for delete
    const clamped = dx > 0 ? 0 : dx;
    if (Math.abs(clamped) > DRAG_ACTIVATE_THRESHOLD) didDrag.current = true;
    setTranslateX(clamped);
  }, []);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Capture may have already been released
    }
    setIsAnimating(true);

    if (dx <= -SWIPE_THRESHOLD) {
      setTranslateX(-window.innerWidth);
      setTimeout(() => onDelete(event.id), 200);
    } else {
      setTranslateX(0);
    }
  }, [event.id, onDelete]);

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
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete zone revealed on left swipe — fades in with drag distance */}
      {canDelete && (
        <div
          className="absolute inset-0 flex items-center justify-end bg-red-500 rounded-xl pr-6 pointer-events-none"
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
          "relative flex flex-col gap-2 p-4 rounded-xl border-2 select-none",
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
