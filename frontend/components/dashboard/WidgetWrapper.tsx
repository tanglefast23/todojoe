"use client";

import { memo, useState, useRef, useEffect } from "react";
import { X, GripVertical, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle
import { cn } from "@/lib/utils";

interface WidgetWrapperProps {
  id: string;
  title: string;
  subtitle?: string;
  badge?: { text: string; type: "stock" | "crypto" };
  children: React.ReactNode;
  onRemove: (id: string) => void;
  onSettings?: () => void;
  onTitleChange?: (newTitle: string) => void;
  headerAction?: React.ReactNode;
  className?: string;
}

/** Memoized widget wrapper - prevents re-renders when sibling widgets update */
export const WidgetWrapper = memo(function WidgetWrapper({
  id,
  title,
  subtitle,
  badge,
  children,
  onRemove,
  onSettings,
  onTitleChange,
  headerAction,
  className,
}: WidgetWrapperProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync editValue with title prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(title);
    }
  }, [title, isEditing]);

  const handleDoubleClick = () => {
    if (onTitleChange) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setEditValue(title); // Reset if empty or unchanged
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex h-full flex-col rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        className
      )}
    >
        {/* Header with drag handle */}
        <div className="widget-handle flex cursor-move items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="h-6 text-sm font-medium py-0 px-1 w-32"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={cn(
                  "text-sm font-medium",
                  onTitleChange && "cursor-text hover:bg-muted/50 px-1 py-0.5 rounded -mx-1"
                )}
                onDoubleClick={handleDoubleClick}
                title={onTitleChange ? "Double-click to rename" : undefined}
              >
                {title}
              </span>
            )}
            {subtitle && (
              <span className="text-sm text-muted-foreground truncate">{subtitle}</span>
            )}
            {badge && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  badge.type === "stock"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                )}
              >
                {badge.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Custom header action (e.g., Add button for watchlist) */}
            {headerAction}
            {onSettings && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 touch-target focus-ring"
                aria-label={`Settings for ${title}`}
                title="Widget settings"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings();
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="widget-close-btn h-8 w-8 touch-target text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-ring"
              aria-label={`Remove ${title} widget`}
              title="Remove widget"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove(id);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove(id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden p-3">{children}</div>
      </div>
  );
});
