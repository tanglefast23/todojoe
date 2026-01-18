"use client";

import { useState, memo, useCallback } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTagsStore } from "@/stores/tagsStore";
import { TAG_COLORS } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

/** Memoized filter bar - prevents unnecessary re-renders during widget interactions */
export const FilterBar = memo(function FilterBar({ selectedTags, onTagsChange }: FilterBarProps) {
  const { tags, addTag, removeTag } = useTagsStore();
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isAddingTag, setIsAddingTag] = useState(false);

  const handleToggleTag = useCallback((tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  }, [selectedTags, onTagsChange]);

  const handleAddTag = useCallback(() => {
    if (!newTagName.trim()) return;

    addTag(newTagName.trim(), selectedColor);
    setNewTagName("");
    setIsAddingTag(false);
  }, [newTagName, selectedColor, addTag]);

  const handleRemoveTag = useCallback((e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    // Remove from selection if selected
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((id) => id !== tagId));
    }
    removeTag(tagId);
  }, [selectedTags, onTagsChange, removeTag]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground flex items-center gap-1">
        <TagIcon className="h-4 w-4" />
        Filter:
      </span>

      {/* Tag chips */}
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        // Check for default tags (both old string IDs and new UUID IDs)
        const isDefault = tag.id.startsWith("tag-stocks") || tag.id.startsWith("tag-crypto") ||
                          tag.id === "00000000-0000-0000-0000-000000000001" ||
                          tag.id === "00000000-0000-0000-0000-000000000002";

        return (
          <button
            key={tag.id}
            onClick={() => handleToggleTag(tag.id)}
            className={cn(
              "group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95",
              isSelected
                ? "text-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
                : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:shadow-sm"
            )}
            style={{
              backgroundColor: isSelected ? tag.color : undefined,
            }}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-transform",
                isSelected ? "bg-white/40 scale-110" : ""
              )}
              style={{
                backgroundColor: isSelected ? undefined : tag.color,
              }}
            />
            <span>{tag.name}</span>
            {!isDefault && (
              <X
                className={cn(
                  "h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity",
                  isSelected ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={(e) => handleRemoveTag(e, tag.id)}
              />
            )}
          </button>
        );
      })}

      {/* Add tag button */}
      <Popover open={isAddingTag} onOpenChange={setIsAddingTag}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-full text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tag Name</label>
              <Input
                placeholder="e.g., Long-term, Tech"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all duration-150 hover:scale-110 active:scale-95",
                      selectedColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAddTag} disabled={!newTagName.trim()} className="w-full">
              Create Tag
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear filters */}
      {selectedTags.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => onTagsChange([])}
        >
          Clear all
        </Button>
      )}
    </div>
  );
});
