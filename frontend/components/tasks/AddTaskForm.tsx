"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/tasks";

interface AddTaskFormProps {
  onAddTask: (title: string, priority: TaskPriority) => void;
  disabled?: boolean;
}

export function AddTaskForm({ onAddTask, disabled = false }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input on mount (desktop only - textarea handles mobile)
  useEffect(() => {
    // Focus desktop input on larger screens
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, []);

  // Create task with specified priority
  const createTask = (priority: TaskPriority) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAddTask(trimmedTitle, priority);
    setTitle("");
    // Refocus input for quick consecutive entries
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="space-y-3 md:space-y-0">
      {/* Desktop Layout - Single Row */}
      <div className="hidden md:flex gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a new task..."
          disabled={disabled}
          className="flex-1 rounded-full px-5 border-2 border-violet-400/30 focus:border-violet-400 focus-visible:ring-violet-400/30"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createTask("regular"); // Default to regular on Enter
            }
          }}
        />

        {/* Priority Action Buttons - clicking creates task */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => createTask("regular")}
            disabled={disabled || !title.trim()}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full border-2 transition-all",
              title.trim()
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                : "bg-transparent border-cyan-400/40 text-cyan-400/50 cursor-not-allowed"
            )}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => createTask("urgent")}
            disabled={disabled || !title.trim()}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full border-2 transition-all",
              title.trim()
                ? "bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50"
                : "bg-transparent border-orange-400/40 text-orange-400/50 cursor-not-allowed"
            )}
          >
            Urgent
          </button>
        </div>
      </div>

      {/* Mobile Layout - Stacked with Large Input */}
      <div className="md:hidden space-y-3">
        {/* Large text input area for mobile */}
        <textarea
          ref={textareaRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          disabled={disabled}
          rows={3}
          className="w-full rounded-2xl px-4 py-3 text-base border-2 border-violet-400/30 focus:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400/30 focus:outline-none bg-background resize-none"
        />

        {/* Priority Action Buttons - clicking creates task */}
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => createTask("regular")}
            disabled={disabled || !title.trim()}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium rounded-full border-2 transition-all",
              title.trim()
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
                : "bg-transparent border-cyan-400/40 text-cyan-400/50 cursor-not-allowed"
            )}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => createTask("urgent")}
            disabled={disabled || !title.trim()}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium rounded-full border-2 transition-all",
              title.trim()
                ? "bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/30"
                : "bg-transparent border-orange-400/40 text-orange-400/50 cursor-not-allowed"
            )}
          >
            Urgent
          </button>
        </div>
      </div>
    </div>
  );
}
