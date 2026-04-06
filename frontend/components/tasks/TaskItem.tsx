"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Trash2, ImagePlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadAttachment } from "@/lib/supabase/queries/storage";
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

// Two-stage swipe model:
//  - Pull past REVEAL_THRESHOLD → the action button is parked open for the user
//    to tap (auto-collapses after REVEAL_HOLD_MS if they don't).
//  - Pull past AUTO_THRESHOLD → fire the action immediately on release.
// This makes accidental left-swipes much harder to turn into deletes.
const REVEAL_THRESHOLD = 64;
const AUTO_THRESHOLD = 220;
const REVEAL_OFFSET = 88; // how far the card parks when revealing an action
const REVEAL_HOLD_MS = 2000;
const DRAG_ACTIVATE_THRESHOLD = 8;
const LONG_PRESS_MS = 500;

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
  const [isUploading, setIsUploading] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCompleted = task.status === "completed";
  const canEdit = Boolean(onUpdateTitle) && !isCompleted;

  // Swipe state — partial pull reveals an action button; hard pull auto-fires
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealed, setRevealed] = useState<"none" | "delete" | "attach">("none");
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const didDrag = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const clearRevealTimer = useCallback(() => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  }, []);

  const collapseReveal = useCallback(() => {
    clearRevealTimer();
    setIsAnimating(true);
    setTranslateX(0);
    setRevealed("none");
  }, [clearRevealTimer]);

  const scheduleRevealAutoCollapse = useCallback(() => {
    clearRevealTimer();
    revealTimer.current = setTimeout(() => {
      collapseReveal();
    }, REVEAL_HOLD_MS);
  }, [clearRevealTimer, collapseReveal]);

  // Clean up any pending timers on unmount
  useEffect(() => {
    return () => {
      clearLongPress();
      clearRevealTimer();
    };
  }, [clearLongPress, clearRevealTimer]);

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

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload an image (JPEG, PNG, GIF, WebP) or PDF file.");
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size must be less than 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const publicUrl = await uploadAttachment(file, `task-${task.id}`);
      onAttachment?.(task.id, publicUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCheckChange = (checked: boolean) => {
    if (!canComplete) return;
    if (checked) {
      onComplete(task.id);
    } else {
      onUncomplete(task.id);
    }
  };

  const startEditing = useCallback(() => {
    if (!canEdit) return;
    setDraftTitle(task.title);
    setIsEditing(true);
  }, [canEdit, task.title]);

  const fireDelete = useCallback(() => {
    clearRevealTimer();
    setIsAnimating(true);
    setTranslateX(-window.innerWidth);
    setTimeout(() => onDelete(task.id), 200);
  }, [task.id, onDelete, clearRevealTimer]);

  const fireAttach = useCallback(() => {
    clearRevealTimer();
    setIsAnimating(true);
    setTranslateX(0);
    setRevealed("none");
    openFilePicker();
  }, [openFilePicker, clearRevealTimer]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Never start a drag while inline-editing — let the textarea take input
    if (isEditing) return;
    // Don't start drag on checkboxes, attachment buttons, etc.
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-swipe="true"]')) return;
    if (e.button !== undefined && e.button !== 0) return;

    // If the card is currently parked open and the user taps the card body
    // (not the action button, which has data-no-swipe), collapse it.
    if (revealed !== "none") {
      collapseReveal();
      return;
    }

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    didDrag.current = false;
    setIsAnimating(false);

    // Long press → edit. Only arm if editing is allowed and the pointer is on
    // the title area. We don't capture the pointer yet so vertical scrolling
    // still works until we know it's a horizontal swipe.
    if (canEdit) {
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        if (didDrag.current) return;
        startEditing();
      }, LONG_PRESS_MS);
    }
  }, [isEditing, revealed, collapseReveal, canEdit, clearLongPress, startEditing]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    const dy = dragStartY.current !== null ? e.clientY - dragStartY.current : 0;

    // If movement exceeds the activation threshold in any direction, cancel
    // any pending long-press — the user is gesturing, not holding.
    if (Math.abs(dx) > DRAG_ACTIVATE_THRESHOLD || Math.abs(dy) > DRAG_ACTIVATE_THRESHOLD) {
      clearLongPress();
    }

    // Only allow directions the user is authorized to trigger:
    // - left (negative) requires canDelete
    // - right (positive) requires onAttachment
    let clamped = dx;
    if (dx < 0 && !canDelete) clamped = 0;
    if (dx > 0 && !onAttachment) clamped = 0;

    // Commit to horizontal swipe only once it clearly dominates vertical motion.
    if (!didDrag.current) {
      if (Math.abs(clamped) <= DRAG_ACTIVATE_THRESHOLD) return;
      if (Math.abs(clamped) < Math.abs(dy)) return; // user is scrolling
      didDrag.current = true;
      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
      } catch {
        // best-effort
      }
    }

    // Light rubber-banding past the auto threshold so the user feels the limit
    setTranslateX(clamped);
  }, [canDelete, onAttachment, clearLongPress]);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    dragStartY.current = null;
    clearLongPress();
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Capture may have already been released
    }

    if (!didDrag.current) {
      // Wasn't a drag — let click/long-press handlers do their thing
      setIsAnimating(true);
      setTranslateX(0);
      return;
    }

    setIsAnimating(true);

    // Hard left swipe → auto delete
    if (dx <= -AUTO_THRESHOLD && canDelete) {
      fireDelete();
      return;
    }
    // Hard right swipe → auto attach
    if (dx >= AUTO_THRESHOLD && onAttachment) {
      fireAttach();
      return;
    }
    // Partial left → park open to reveal delete button for REVEAL_HOLD_MS
    if (dx <= -REVEAL_THRESHOLD && canDelete) {
      setTranslateX(-REVEAL_OFFSET);
      setRevealed("delete");
      scheduleRevealAutoCollapse();
      return;
    }
    // Partial right → park open to reveal attach button
    if (dx >= REVEAL_THRESHOLD && onAttachment) {
      setTranslateX(REVEAL_OFFSET);
      setRevealed("attach");
      scheduleRevealAutoCollapse();
      return;
    }
    // Not far enough — snap back
    setTranslateX(0);
    setRevealed("none");
  }, [canDelete, onAttachment, fireDelete, fireAttach, scheduleRevealAutoCollapse, clearLongPress]);

  const handleDeleteButtonClick = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    fireDelete();
  }, [fireDelete]);

  const handleAttachButtonClick = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    fireAttach();
  }, [fireAttach]);

  const commitEdit = () => {
    const trimmed = draftTitle.trim();
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
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Determine card style — consistent with Gmail card styling
  const getCardStyle = () => {
    if (isCompleted) {
      return "bg-card border-border/50";
    }
    if (task.priority === "urgent") {
      return "bg-orange-500/20 border-orange-400/50 hover:border-orange-400/70";
    }
    return "bg-gradient-to-r from-blue-500/15 to-sky-500/15 border-blue-400/40 hover:border-blue-400/50";
  };

  // Fade the action background in as the card is pulled; fully visible by the
  // reveal threshold so the button is obvious as soon as it parks open.
  const deleteBgOpacity = Math.min(Math.max(-translateX / REVEAL_THRESHOLD, 0), 1);
  const attachBgOpacity = Math.min(Math.max(translateX / REVEAL_THRESHOLD, 0), 1);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Hidden file input — triggered by swipe-right */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Delete zone revealed on left swipe */}
      {canDelete && (
        <div
          className="absolute inset-0 flex items-center justify-end bg-red-500 rounded-xl pr-6 pointer-events-none"
          style={{ opacity: deleteBgOpacity }}
        >
          <button
            type="button"
            data-no-swipe="true"
            onClick={handleDeleteButtonClick}
            className={cn(
              "flex items-center gap-2 text-white font-semibold",
              revealed === "delete" ? "pointer-events-auto" : "pointer-events-none"
            )}
            aria-label={`Delete task: ${task.title}`}
            aria-hidden={revealed !== "delete"}
            tabIndex={revealed === "delete" ? 0 : -1}
          >
            <Trash2 className="h-5 w-5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Attach zone revealed on right swipe */}
      {onAttachment && (
        <div
          className="absolute inset-0 flex items-center justify-start bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl pl-6 pointer-events-none"
          style={{ opacity: attachBgOpacity }}
        >
          <button
            type="button"
            data-no-swipe="true"
            onClick={handleAttachButtonClick}
            className={cn(
              "flex items-center gap-2 text-white font-semibold",
              revealed === "attach" ? "pointer-events-auto" : "pointer-events-none"
            )}
            aria-label={`Attach file to task: ${task.title}`}
            aria-hidden={revealed !== "attach"}
            tabIndex={revealed === "attach" ? 0 : -1}
          >
            <ImagePlus className="h-5 w-5" />
            <span>Attach</span>
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
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
        }}
        className={cn(
          "relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border-2 select-none",
          getCardStyle(),
          isCompleted && "opacity-70"
        )}
      >
        {/* Completed indicator — only when completed */}
        {isCompleted && task.completedAt && (
          <div className="text-xs text-muted-foreground">
            Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
          </div>
        )}

        {/* Upload indicator overlay */}
        {isUploading && (
          <div className="absolute top-2 right-2 text-xs text-muted-foreground">
            Uploading…
          </div>
        )}

        {/* Main content row: checkbox + title + (optional thumbnail) */}
        <div className="flex items-start gap-3">
          <div data-no-swipe="true">
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleCheckChange}
              disabled={!canComplete}
              className={cn(
                "h-5 w-5 border-2 mt-0.5 flex-shrink-0",
                isCompleted
                  ? task.priority === "urgent"
                    ? "border-orange-400 data-[state=checked]:bg-orange-400"
                    : "border-blue-400 data-[state=checked]:bg-blue-400"
                  : task.priority === "urgent"
                    ? "border-orange-400"
                    : "border-blue-400"
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
                <span
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!canEdit) return;
                    // Keyboard users still get a direct edit entrypoint
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      startEditing();
                    }
                  }}
                  className={cn(
                    "flex-1 min-w-0 text-left font-medium break-words whitespace-pre-wrap rounded",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    canEdit && "cursor-default",
                    !canEdit && "cursor-default",
                    isCompleted && "line-through"
                  )}
                  aria-label={canEdit ? `Hold to edit task: ${task.title}` : undefined}
                >
                  {task.title}
                </span>
              )}
            </div>
          </div>

          {/* Attachment thumbnail — only when present */}
          {task.attachmentUrl && (
            <div className="relative group flex-shrink-0" data-no-swipe="true">
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
                  className="h-14 w-14 rounded-lg object-cover border border-border/50 hover:border-pink-400 transition-colors"
                />
              </a>
              {onClearAttachment && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearAttachment(task.id);
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm icon-tactile"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
