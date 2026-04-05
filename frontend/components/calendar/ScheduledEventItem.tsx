"use client";

import { memo, useState, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduledEvent } from "@/types/scheduled-events";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";

interface ScheduledEventItemProps {
  event: ScheduledEvent;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

// Swipe thresholds
const SWIPE_REVEAL_WIDTH = 88;      // how far the delete zone shows when fully revealed
const SWIPE_DELETE_THRESHOLD = 120; // drag past this to auto-delete

export const ScheduledEventItem = memo(function ScheduledEventItem({
  event,
  onDelete,
  canDelete = true,
}: ScheduledEventItemProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const startXRef = useRef(0);
  const pointerActiveRef = useRef(false);

  const isCompleted = event.status === "completed";
  const scheduledDate = new Date(event.scheduledAt);
  const isOverdue = isPast(scheduledDate) && !isCompleted;

  // Tap the card body to open the event in Google Calendar (if it has a link).
  const handleCardClick = useCallback(() => {
    // Ignore taps that are actually the end of a swipe
    if (Math.abs(dragX) > 6) return;
    if (event.htmlLink) {
      window.open(event.htmlLink, "_blank", "noopener,noreferrer");
    }
  }, [dragX, event.htmlLink]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDelete) return;
    // Only track primary button / single touch
    if (e.button !== undefined && e.button !== 0) return;
    startXRef.current = e.clientX;
    pointerActiveRef.current = true;
    setIsDragging(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  }, [canDelete]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    const delta = e.clientX - startXRef.current;
    // Only allow left swipe (negative)
    if (delta > 0) {
      setDragX(0);
      return;
    }
    // Add a soft resistance past the reveal width
    const resistance = delta < -SWIPE_REVEAL_WIDTH
      ? -SWIPE_REVEAL_WIDTH + (delta + SWIPE_REVEAL_WIDTH) * 0.5
      : delta;
    setDragX(resistance);
  }, []);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    setIsDragging(false);
    (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);

    // Past delete threshold → animate out + delete
    if (dragX <= -SWIPE_DELETE_THRESHOLD) {
      setIsRemoving(true);
      setTimeout(() => onDelete(event.id), 220);
      return;
    }
    // Past reveal threshold → snap open
    if (dragX <= -SWIPE_REVEAL_WIDTH * 0.6) {
      setDragX(-SWIPE_REVEAL_WIDTH);
      return;
    }
    // Otherwise snap closed
    setDragX(0);
  }, [dragX, event.id, onDelete]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRemoving(true);
    setTimeout(() => onDelete(event.id), 220);
  }, [event.id, onDelete]);

  // Determine if this is a Google Calendar event or a local (app-created) event
  const isGoogleEvent = event.source === "google";

  // Determine card style based on completion, timing, and source
  const getCardStyle = () => {
    if (isCompleted) {
      return "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30";
    }
    if (isOverdue) {
      return "bg-gradient-to-r from-red-500/15 to-orange-500/15 border-red-400/40 hover:border-red-400/60";
    }
    if (isToday(scheduledDate)) {
      return "bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border-amber-400/40 hover:border-amber-400/60";
    }
    // Google Calendar events: Purple
    if (isGoogleEvent) {
      return "bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 border-indigo-400/30 hover:border-indigo-400/50";
    }
    // Local (app-created) events: Blue
    return "bg-gradient-to-r from-blue-500/10 to-sky-500/10 border-blue-400/30 hover:border-blue-400/50";
  };

  const getTextAccentColor = () => {
    if (isCompleted) return "text-muted-foreground";
    if (isOverdue) return "text-red-400";
    if (isGoogleEvent) return "text-indigo-400";
    return "text-blue-400";
  };

  const isInteractive = Boolean(event.htmlLink);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        isRemoving && "task-collapse"
      )}
    >
      {/* Delete zone revealed by swipe */}
      {canDelete && (
        <div className="absolute inset-0 flex items-center justify-end bg-destructive rounded-xl pr-5">
          <button
            onClick={handleDeleteClick}
            className="flex items-center gap-2 text-destructive-foreground icon-tactile"
            aria-label={`Delete event: ${event.title}`}
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-sm font-medium">Delete</span>
          </button>
        </div>
      )}

      {/* Card content — translates on swipe */}
      <div
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={isInteractive ? `Open event in Google Calendar: ${event.title}` : undefined}
        className={cn(
          "relative flex flex-col gap-2 p-4 rounded-xl border-2 card-tactile task-mount",
          getCardStyle(),
          isCompleted && "opacity-70",
          isInteractive && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "touch-pan-y select-none"
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
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
      >
        {/* Top row: Created time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Created {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
            {isCompleted && event.completedAt && (
              <span className="ml-2">
                &#8226; Completed {formatDistanceToNow(new Date(event.completedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {/* Main content row: event title */}
        <div className="flex items-start gap-2 flex-wrap">
          <span className={cn("font-medium", isCompleted && "line-through")}>
            {event.title}
          </span>
        </div>

        {/* Scheduled time row */}
        <div className="flex items-center gap-4 text-sm">
          <div className={cn(
            "flex items-center gap-1.5",
            getTextAccentColor()
          )}>
            <Clock className="h-4 w-4" />
            <span className="font-medium">{format(scheduledDate, "h:mm a")}</span>
          </div>
          {isOverdue && !isCompleted && (
            <span className="text-xs text-red-400 font-medium">Overdue</span>
          )}
        </div>
      </div>
    </div>
  );
});
