"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CreatorAvatar } from "./CreatorAvatar";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import { formatDistanceToNow } from "date-fns";

interface TaskItemProps {
  task: Task;
  creatorName?: string;
  completerName?: string;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
}

export function TaskItem({
  task,
  creatorName,
  completerName,
  onComplete,
  onUncomplete,
  onDelete,
  canComplete,
}: TaskItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isCompleted = task.status === "completed";

  const handleCheckChange = (checked: boolean) => {
    if (!canComplete) return;
    if (checked) {
      onComplete(task.id);
    } else {
      onUncomplete(task.id);
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

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
        isCompleted && "opacity-60",
        showDeleteConfirm && "ring-2 ring-destructive"
      )}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onContextMenu={handleContextMenu}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleCheckChange}
        disabled={!canComplete}
        className="h-5 w-5"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", isCompleted && "line-through")}>
            {task.title}
          </span>
          {task.priority === "urgent" && (
            <Badge variant="destructive" className="text-xs">
              Urgent
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {creatorName && (
            <div className="flex items-center gap-1">
              <CreatorAvatar name={creatorName} size="sm" />
              <span>Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
            </div>
          )}

          {isCompleted && completerName && task.completedAt && (
            <div className="flex items-center gap-1 ml-2">
              <span>&#8226;</span>
              <CreatorAvatar name={completerName} size="sm" />
              <span>Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="flex gap-2">
          <button
            onClick={() => onDelete(task.id)}
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
