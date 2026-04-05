"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Trash2 } from "lucide-react";
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
  onUpdateTitle?: (id: string, title: string) => void;
  onAttachment?: (taskId: string, url: string) => void;
  onClearAttachment?: (taskId: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

// Gmail-style swipe model — shared with ScheduledEventItem and SwipeableEmailCard
const SWIPE_THRESHOLD = 96;
const DRAG_ACTIVATE_THRESHOLD = 8;

export const TaskItem = memo(function TaskItem({
  task,
  onComplete,
  onUncomplete,
  onDelete,
  onUpdateTitle,
  onAttachment,
  onClearAttachment,
  canComplete,
  canDelete = true,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isCompleted = task.status === "completed";
  const canEdit = Boolean(onUpdateTitle) && !isCompleted;

  // Swipe-to-delete state
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const didDrag = useRef(false);

  // Reset the draft if the task title changes externally (e.g., Supabase sync)
  useEffect(() => {
    if (!isEditing) setDraftTitle(task.title);
  }, [task.title, isEditing]);

  // Focus, select-all, and auto-size the textarea when entering edit mode
  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.select();
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [isEditing]);

  const handleCheckChange = (checked: boolean) => {
    if (!canComplete) return;
    if (checked) {
      onComplete(task.id);
    } else {
      onUncomplete(task.id);
    }
  };

  const startEditing = () => {
    // Suppress the click if the user was actually swiping
    if (didDrag.current) return;
    if (!canEdit) return;
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDelete) return;
    // Never start a drag while inline-editing — let the textarea take input
    if (isEditing) return;
    // Don't start drag on checkboxes, attachment buttons, etc.
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-swipe="true"]')) return;
    if (e.button !== undefined && e.button !== 0) return;
    dragStartX.current = e.clientX;
    didDrag.current = false;
    setIsAnimating(false);
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  }, [canDelete, isEditing]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
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
      setTimeout(() => onDelete(task.id), 200);
    } else {
      setTranslateX(0);
    }
  }, [task.id, onDelete]);

  const handleDeleteButtonClick = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    setTranslateX(-window.innerWidth);
    setTimeout(() => onDelete(task.id), 200);
  }, [task.id, onDelete]);

  const commitEdit = () => {
    const trimmed = draftTitle.trim();
    // Revert to original if cleared or unchanged
    if (!trimmed || trimmed === task.title) {
      setDraftTitle(task.title);
      setIsEditing(false);
      return;
    }
    onUpdateTitle?.(task.id, trimmed);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setDraftTitle(task.title);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleEditInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftTitle(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
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

  const deleteBgOpacity = Math.min(Math.max(-translateX / SWIPE_THRESHOLD, 0), 1);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete zone revealed on left swipe */}
      {canDelete && (
        <div
          className="absolute inset-0 flex items-center justify-end bg-red-500 rounded-xl pr-6 pointer-events-none"
          style={{ opacity: deleteBgOpacity }}
        >
          <button
            onClick={handleDeleteButtonClick}
            className="flex items-center gap-2 text-white font-semibold pointer-events-auto"
            aria-label={`Delete task: ${task.title}`}
          >
            <Trash2 className="h-5 w-5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Card foreground — translates on swipe */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className={cn(
          "relative flex flex-col gap-2 p-4 rounded-xl border-2 card-tactile task-mount select-none",
          getCardStyle(),
          isCompleted && "opacity-70"
        )}
      >
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

          {/* Attachment Section — marked as non-swipeable */}
          <div className="flex items-center gap-2" data-no-swipe="true">
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
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 icon-tactile"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-3 h-3" />
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
        </div>

        {/* Main content row: Checkbox and task description */}
        <div className="flex items-start gap-3">
          <div data-no-swipe="true">
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
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              {isEditing ? (
                <textarea
                  ref={editRef}
                  value={draftTitle}
                  onChange={handleEditInput}
                  onKeyDown={handleEditKeyDown}
                  onBlur={commitEdit}
                  rows={1}
                  aria-label="Edit task title"
                  data-no-swipe="true"
                  className="flex-1 min-w-0 bg-transparent font-medium outline-none resize-none leading-snug border-b border-dashed border-foreground/40 focus:border-foreground"
                />
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={!canEdit}
                  className={cn(
                    "flex-1 min-w-0 text-left font-medium break-words whitespace-pre-wrap rounded",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    canEdit && "cursor-text",
                    !canEdit && "cursor-default",
                    isCompleted && "line-through"
                  )}
                  aria-label={canEdit ? `Edit task: ${task.title}` : task.title}
                >
                  {task.title}
                </button>
              )}
              {task.priority === "urgent" && (
                <Badge className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-sm flex-shrink-0">
                  Urgent
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
