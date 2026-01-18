"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagBadge, TagBadgeList } from "@/components/ui/tag-badge";
import { parseTagInput } from "@/lib/tagUtils";

interface TagInputPopoverProps {
  existingTags: string[];
  onAddTags: (tags: string[]) => void;
  onRemoveTag: (tag: string) => void;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
}

export function TagInputPopover({
  existingTags,
  onAddTags,
  onRemoveTag,
  trigger,
  open,
  onOpenChange,
  align = "center",
}: TagInputPopoverProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = useCallback(() => {
    const newTags = parseTagInput(inputValue);
    if (newTags.length > 0) {
      onAddTags(newTags);
      setInputValue("");
    }
  }, [inputValue, onAddTags]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align={align}
        onOpenAutoFocus={(e) => {
          // Prevent the default focus behavior which can cause issues
          // when opening from a context menu
          e.preventDefault();
          // Focus the input after a brief delay
          const content = e.currentTarget as HTMLElement | null;
          setTimeout(() => {
            const input = content?.querySelector('input');
            input?.focus();
          }, 10);
        }}
      >
        <div className="space-y-3">
          <p className="text-xs font-medium">Add Tags</p>

          {/* Existing tags */}
          {existingTags.length > 0 && (
            <TagBadgeList
              tags={existingTags}
              size="sm"
              onRemove={onRemoveTag}
            />
          )}

          {/* Input field */}
          <Input
            placeholder="tech growth dividend"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSubmit}
            className="h-8 text-xs"
          />

          <p className="text-[10px] text-muted-foreground">
            Separate with spaces or commas. Press Enter to add.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Standalone tag chip component for display - re-exports TagBadge for compatibility */
export { TagBadge as TagChip, TagBadgeList as TagChipsDisplay } from "@/components/ui/tag-badge";
