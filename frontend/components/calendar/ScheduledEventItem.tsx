"use client";

import { useState } from "react";
import { X, Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

export function ScheduledEventItem({
  event,
  onComplete,
  onUncomplete,
  onDelete,
  canComplete,
  canDelete = true,
}: ScheduledEventItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isCompleted = event.status === "completed";
  const scheduledDate = new Date(event.scheduledAt);
  const isOverdue = isPast(scheduledDate) && !isCompleted;

  const handleCheckChange = (checked: boolean) => {
    if (!canComplete) return;
    if (checked) {
      onComplete(event.id);
    } else {
      onUncomplete(event.id);
    }
  };

  // Long press handler for delete (mobile)
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handlePressStart = () => {
    if (!isCompleted) return;
    const timer = setTimeout(() => {
      setShowDeleteConfirm(true);
    }, 500); // 500ms long press
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isCompleted) return;
    e.preventDefault();
    setShowDeleteConfirm(true);
  };

  // Determine card style based on completion and timing
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
    // Default purple style
    return "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-400/30 hover:border-violet-400/50";
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 p-4 rounded-xl border-2 transition-all",
        getCardStyle(),
        isCompleted && "opacity-70",
        showDeleteConfirm && "ring-2 ring-destructive"
      )}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Delete X button for completed events - admin only */}
      {isCompleted && canDelete && !showDeleteConfirm && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event.id);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
          title="Remove completed event"
        >
          <X className="w-4 h-4" />
        </button>
      )}

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

      {/* Main content row: Checkbox and event description */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleCheckChange}
          disabled={!canComplete}
          className={cn(
            "h-5 w-5 border-2 mt-0.5 flex-shrink-0",
            isCompleted
              ? "border-emerald-500 data-[state=checked]:bg-emerald-500"
              : isOverdue
                ? "border-red-400"
                : isToday(scheduledDate)
                  ? "border-amber-400"
                  : "border-violet-400"
          )}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={cn("font-medium", isCompleted && "line-through")}>
              {event.title}
            </span>
          </div>
        </div>
      </div>

      {/* Scheduled time row */}
      <div className="flex items-center gap-4 text-sm pl-8">
        <div className={cn(
          "flex items-center gap-1.5",
          isCompleted
            ? "text-muted-foreground"
            : isOverdue
              ? "text-red-400"
              : "text-violet-400"
        )}>
          <Clock className="h-4 w-4" />
          <span className="font-medium">{format(scheduledDate, "h:mm a")}</span>
        </div>
        {isOverdue && !isCompleted && (
          <span className="text-xs text-red-400 font-medium">Overdue</span>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="flex gap-2">
          <button
            onClick={() => onDelete(event.id)}
            className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded"
          >
            Delete
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-2 py-1 text-xs bg-secondary rounded"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
