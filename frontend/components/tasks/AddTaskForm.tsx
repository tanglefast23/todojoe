"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/tasks";

interface AddTaskFormProps {
  onAddTask: (title: string, priority: TaskPriority) => void;
  disabled?: boolean;
}

export function AddTaskForm({ onAddTask, disabled = false }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [pressedButton, setPressedButton] = useState<TaskPriority | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Create task with specified priority
  const createTask = (priority: TaskPriority) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    // Haptic feedback (if supported)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(priority === "urgent" ? [15, 30, 15] : 20);
    }

    // Visual press cue
    setPressedButton(priority);
    setTimeout(() => setPressedButton(null), 180);

    onAddTask(trimmedTitle, priority);
    setTitle("");

    // Dismiss keyboard popup by blurring the textarea
    textareaRef.current?.blur();
  };

  return (
    <div className="space-y-3">
      {/* Card-style input container - matches Pencil design */}
      <div className="bg-card border border-border rounded-xl p-4">
        <textarea
          ref={textareaRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          aria-label="New task"
          disabled={disabled}
          rows={2}
          maxLength={500}
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/50 placeholder:italic placeholder:font-light resize-none leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.innerWidth >= 768) {
              e.preventDefault();
              createTask("regular");
            } else if (e.key === "Tab" && title.trim()) {
              e.preventDefault();
              createTask("urgent");
            }
          }}
        />
      </div>

      {/* Priority Action Buttons - outline style matching Pencil design */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => createTask("regular")}
          disabled={disabled || !title.trim()}
          className={cn(
            "flex-1 py-3 text-[15px] font-medium rounded-xl border-[1.5px] transition-all duration-150 bg-card",
            "border-blue-500 text-blue-500",
            "active:scale-95 active:bg-blue-500/20",
            !title.trim() && "opacity-60 cursor-not-allowed",
            title.trim() && "hover:bg-blue-500/10",
            pressedButton === "regular" && "scale-95 bg-blue-500/25 shadow-inner"
          )}
        >
          Normal
        </button>
        <button
          type="button"
          onClick={() => createTask("urgent")}
          disabled={disabled || !title.trim()}
          className={cn(
            "flex-1 py-3 text-[15px] font-medium rounded-xl border-[1.5px] transition-all duration-150 bg-card",
            "border-orange-500 text-orange-500",
            "active:scale-95 active:bg-orange-500/20",
            !title.trim() && "opacity-60 cursor-not-allowed",
            title.trim() && "hover:bg-orange-500/10",
            pressedButton === "urgent" && "scale-95 bg-orange-500/25 shadow-inner"
          )}
        >
          Urgent
        </button>
      </div>
    </div>
  );
}
