"use client";

import { memo, useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { Trash2, Clock, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiHeaders } from "@/lib/api-key";
import type { ScheduledEvent } from "@/types/scheduled-events";
import { getEventColor } from "@/lib/google/event-colors";
import { useCalendarPrefsStore } from "@/stores/calendarPrefsStore";
import { format, formatDistanceToNow, isPast } from "date-fns";

interface ScheduledEventItemProps {
  event: ScheduledEvent;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
  /** Google Calendar default background color for this event's calendar */
  calendarBackgroundColor?: string | null;
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

// Long-press thresholds
const LONG_PRESS_MS = 500;        // 500-1500ms hold → toggle 1hr reminder on release
const EXTRA_LONG_PRESS_MS = 1500; // held past 1500ms → picker opens automatically

// Reminder presets (minutes before event)
const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "1 day", minutes: 1440 },
];

type GestureMode = "idle" | "swipe" | "scroll";

export const ScheduledEventItem = memo(function ScheduledEventItem({
  event,
  onDelete,
  canDelete = true,
  calendarBackgroundColor,
}: ScheduledEventItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartTime = useRef(0);
  const gestureMode = useRef<GestureMode>("idle");
  const didDrag = useRef(false);

  // Long-press state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Reminder state — optimistic mirror of event.reminderMinutes
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    event.reminderMinutes ?? null
  );
  const [showPicker, setShowPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setReminderMinutes(event.reminderMinutes ?? null);
  }, [event.reminderMinutes]);

  const isCompleted = event.status === "completed";
  const scheduledDate = new Date(event.scheduledAt);
  const isOverdue = isPast(scheduledDate) && !isCompleted;
  const isGoogleEvent = event.source === "google";
  const calendarId = event.googleCalendarId || "primary";
  const colorOverride = useCalendarPrefsStore((s) => s.getColorOverride(calendarId));
  const eventColor = getEventColor(event.source, event.colorId, colorOverride, calendarBackgroundColor);

  const clearPressTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (extraLongPressTimer.current) {
      clearTimeout(extraLongPressTimer.current);
      extraLongPressTimer.current = null;
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  // Call the backend to set/clear the reminder on the Google event.
  // Optimistically updates local state; reverts on failure.
  const updateReminder = useCallback(async (minutes: number | null) => {
    if (!isGoogleEvent || !event.googleEventId) {
      showToast("Reminders only work on Google events");
      return;
    }
    const prev = reminderMinutes;
    setReminderMinutes(minutes);
    try {
      const res = await fetch(
        `/api/google/calendar/events/${encodeURIComponent(event.googleEventId)}/reminder`,
        {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            minutes,
            calendarId: event.googleCalendarId || "primary",
          }),
        }
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      if (minutes === null) {
        showToast("Reminder cleared");
      } else if (minutes === 60) {
        showToast("Reminder set for 1 hour before");
      } else if (minutes < 60) {
        showToast(`Reminder set for ${minutes} min before`);
      } else if (minutes === 1440) {
        showToast("Reminder set for 1 day before");
      } else {
        showToast(`Reminder set for ${Math.round(minutes / 60)}h before`);
      }
    } catch (err) {
      console.error("Failed to update reminder:", err);
      setReminderMinutes(prev); // revert
      showToast("Failed to update reminder");
    }
  }, [isGoogleEvent, event.googleEventId, event.googleCalendarId, reminderMinutes, showToast]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartTime.current = e.timeStamp;
    gestureMode.current = "idle";
    didDrag.current = false;
    longPressFired.current = false;
    setIsAnimating(false);

    // Don't capture the pointer yet — we wait until we know this is a
    // horizontal swipe so vertical scrolling still works on the ancestor.

    // Start long-press timers only on Google events
    if (isGoogleEvent) {
      longPressTimer.current = setTimeout(() => {
        // Reaching 500ms marks short-long. The actual action (toggle 1hr)
        // fires on pointer release in handlePointerUp.
      }, LONG_PRESS_MS);

      extraLongPressTimer.current = setTimeout(() => {
        // Held past 1500ms without movement → open picker immediately
        if (gestureMode.current !== "idle") return;
        longPressFired.current = true;
        setShowPicker(true);
      }, EXTRA_LONG_PRESS_MS);
    }
  }, [isGoogleEvent]);

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

      // Any committed movement cancels a pending long-press.
      clearPressTimers();

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
        // Capture is best-effort.
      }
    }

    // In swipe mode: translate the card with the finger (left only).
    const clamped = dx > 0 ? 0 : dx;
    setTranslateX(clamped);
  }, [clearPressTimers]);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    const dt = e.timeStamp - dragStartTime.current;
    const velocity = dt > 0 ? dx / dt : 0; // negative = leftward
    const wasSwipe = gestureMode.current === "swipe";

    // Short long-press: idle mode (no gesture committed), held 500-1500ms,
    // and the extra-long-press timer hasn't already fired the picker.
    const wasLongPressHeld =
      gestureMode.current === "idle"
      && isGoogleEvent
      && !longPressFired.current
      && longPressTimer.current === null
      && dt >= LONG_PRESS_MS;

    clearPressTimers();
    dragStartX.current = null;
    dragStartY.current = null;
    gestureMode.current = "idle";

    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Capture may have already been released
    }

    if (!wasSwipe) {
      // Tap, scroll, or long-press — nothing to animate on the card itself
      if (wasLongPressHeld) {
        longPressFired.current = true; // suppress the upcoming click
        updateReminder(reminderMinutes === null ? 60 : null);
      }
      return;
    }

    setIsAnimating(true);

    // Strong swipe = past distance threshold OR fast leftward flick
    const strongEnough = dx <= -SWIPE_THRESHOLD || velocity <= -FLICK_VELOCITY;
    if (strongEnough) {
      setTranslateX(-window.innerWidth);
      setTimeout(() => onDelete(event.id), 200);
      return;
    }
    setTranslateX(0);
  }, [clearPressTimers, event.id, onDelete, isGoogleEvent, reminderMinutes, updateReminder]);

  // Safety net: if the card ends up partially offset without an active gesture,
  // snap it back after a moment.
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
    if (longPressFired.current) return;
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

  const handlePickerSelect = useCallback((minutes: number | null) => {
    setShowPicker(false);
    updateReminder(minutes);
  }, [updateReminder]);

  const deleteBgOpacity = Math.min(Math.max(-translateX / SWIPE_THRESHOLD, 0), 1);
  const isInteractive = Boolean(event.htmlLink);
  const hasReminder = reminderMinutes !== null;

  return (
    <>
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

        {/* Card foreground — tinted by event color, translates on swipe */}
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
          onContextMenu={(e) => e.preventDefault()}
          style={{
            transform: `translateX(${translateX}px)`,
            transition: isAnimating ? "transform 200ms ease-out" : "none",
            touchAction: "pan-y",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            ...(!isCompleted && {
              backgroundColor: `${eventColor.hex}15`,
              borderColor: `${eventColor.hex}66`,
            }),
          }}
          className={cn(
            "relative flex flex-col gap-1 px-3 py-2.5 rounded-xl border-2 select-none",
            isCompleted
              ? "bg-card border-border/50 opacity-60"
              : "hover:brightness-110",
            isInteractive && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          {/* Completed indicator */}
          {isCompleted && event.completedAt && (
            <div className="text-xs text-muted-foreground">
              Completed {formatDistanceToNow(new Date(event.completedAt), { addSuffix: true })}
            </div>
          )}

          {/* Title row with bell button */}
          <div className="flex items-start gap-2">
            <span className={cn("font-medium flex-1 min-w-0", isCompleted && "line-through")}>
              {event.title}
            </span>
            {isGoogleEvent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  updateReminder(hasReminder ? null : 60);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors",
                  hasReminder
                    ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
                aria-label={hasReminder ? "Remove reminder" : "Set 1hr reminder"}
                data-no-swipe="true"
              >
                <Bell className="h-3.5 w-3.5" />
                {hasReminder ? (
                  reminderMinutes! < 60 ? `${reminderMinutes}m` :
                  reminderMinutes === 60 ? "1h" :
                  reminderMinutes === 1440 ? "1d" :
                  `${Math.round(reminderMinutes! / 60)}h`
                ) : "Remind"}
              </button>
            )}
          </div>

          {/* Scheduled time */}
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

      {/* Reminder picker bottom sheet */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="bg-background border-t sm:border sm:rounded-xl rounded-t-2xl w-full sm:max-w-sm sm:mx-4 p-4 pb-6 sm:pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold">Remind me before</h3>
            </div>
            <div className="flex flex-col gap-1">
              {REMINDER_PRESETS.map((preset) => {
                const isActive = reminderMinutes === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    onClick={() => handlePickerSelect(preset.minutes)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg font-medium transition-colors",
                      isActive
                        ? "bg-amber-500/20 text-amber-500"
                        : "hover:bg-muted"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
              {hasReminder && (
                <button
                  onClick={() => handlePickerSelect(null)}
                  className="w-full text-left px-4 py-3 rounded-lg font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 mt-1"
                >
                  <BellOff className="h-4 w-4" />
                  Remove reminder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-fade-in-up pointer-events-none">
          {toast}
        </div>
      )}
    </>
  );
});
