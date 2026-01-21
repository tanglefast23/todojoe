"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { TaskAttachmentUpload } from "./TaskAttachmentUpload";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import { formatDistanceToNow } from "date-fns";

interface TaskItemProps {
  task: Task;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onAttachment?: (taskId: string, url: string) => void;
  onClearAttachment?: (taskId: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

export function TaskItem({
  task,
  onComplete,
  onUncomplete,
  onDelete,
  onAttachment,
  onClearAttachment,
  canComplete,
  canDelete = true,
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

  // Determine card style based on priority and completion status
  const getCardStyle = () => {
    if (isCompleted) {
      return "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30";
    }
    if (task.priority === "urgent") {
      return "bg-gradient-to-r from-orange-500/15 to-red-500/15 border-orange-400/40 hover:border-orange-400/60";
    }
    return "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-400/30 hover:border-cyan-400/50";
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
      {/* Delete X button for completed tasks - admin only */}
      {isCompleted && canDelete && !showDeleteConfirm && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
          title="Remove completed task"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Top row: Time info and attachment */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
          {isCompleted && task.completedAt && (
            <span className="ml-2">
              &#8226; Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Attachment Section */}
        {!showDeleteConfirm && (
          <div className="flex items-center gap-2">
            {/* Show thumbnail if attachment exists */}
            {task.attachmentUrl && (
              <div className="relative group">
                <a
                  href={task.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="block"
                >
                  <img
                    src={task.attachmentUrl}
                    alt="Task attachment"
                    className="h-10 w-10 rounded-lg object-cover border border-border/50 hover:border-pink-400 transition-colors"
                  />
                </a>
                {/* Delete X for attachment */}
                {onClearAttachment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAttachment(task.id);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Show upload button if no attachment */}
            {!task.attachmentUrl && onAttachment && (
              <TaskAttachmentUpload
                taskId={task.id}
                onUpload={(url) => onAttachment(task.id, url)}
              />
            )}
          </div>
        )}
      </div>

      {/* Main content row: Checkbox and task description */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleCheckChange}
          disabled={!canComplete}
          className={cn(
            "h-5 w-5 border-2 mt-0.5 flex-shrink-0",
            isCompleted
              ? "border-emerald-500 data-[state=checked]:bg-emerald-500"
              : task.priority === "urgent"
                ? "border-orange-400"
                : "border-cyan-400"
          )}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className={cn("font-medium", isCompleted && "line-through")}>
              {task.title}
            </span>
            {task.priority === "urgent" && (
              <Badge className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-sm flex-shrink-0">
                Urgent
              </Badge>
            )}
          </div>
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
