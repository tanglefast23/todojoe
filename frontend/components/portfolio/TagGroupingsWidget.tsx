"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Tag, Plus, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { TagBadge } from "@/components/ui/tag-badge";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useShallow } from "zustand/react/shallow";
import {
  getTagSolidColor,
  getTagTextColor,
  lightenTagColor,
} from "@/lib/tagUtils";
import type { HoldingWithValue } from "@/types/portfolio";

interface TagGroupingsWidgetProps {
  holdings: HoldingWithValue[];
  allTags: string[];
}

export function TagGroupingsWidget({ holdings, allTags }: TagGroupingsWidgetProps) {
  // Combine store subscriptions into single selector to reduce re-renders
  const { activePortfolioId, getTagGroupings, addTagGrouping, removeTagGrouping } = usePortfolioStore(
    useShallow((state) => ({
      activePortfolioId: state.activePortfolioId,
      getTagGroupings: state.getTagGroupings,
      addTagGrouping: state.addTagGrouping,
      removeTagGrouping: state.removeTagGrouping,
    }))
  );

  // Get groupings for this portfolio from the store
  const groupings = activePortfolioId ? getTagGroupings(activePortfolioId) : [];

  const [isCreating, setIsCreating] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showPulse, setShowPulse] = useState(false);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize tag values map to avoid recomputing for each tag
  const tagValuesMap = useMemo(() => {
    const map = new Map<string, number>();
    // Early return if no holdings
    if (holdings.length === 0) return map;

    for (const tag of allTags) {
      const value = holdings
        .filter((h) => h.tags?.includes(tag))
        .reduce((sum, h) => sum + h.currentValue, 0);
      map.set(tag, value);
    }
    return map;
  }, [holdings, allTags]);

  // Get the value of holdings with a specific tag - O(1) lookup from memoized map
  const getTagValue = useCallback((tag: string): number => {
    return tagValuesMap.get(tag) ?? 0;
  }, [tagValuesMap]);

  // Find dominant tag (highest value) in a grouping
  const getDominantTagColor = (tags: string[]): string => {
    let maxValue = 0;
    let dominantTag = tags[0];
    tags.forEach((tag) => {
      const value = getTagValue(tag);
      if (value > maxValue) {
        maxValue = value;
        dominantTag = tag;
      }
    });
    return getTagSolidColor(dominantTag);
  };

  // Calculate total portfolio value
  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  // Calculate value for a grouping (holdings with ANY of the tags)
  // Using Set for O(1) tag lookup instead of Array.includes O(n)
  const calculateGroupingValue = useCallback((groupingTags: string[]): number => {
    // Early return for empty inputs
    if (groupingTags.length === 0 || holdings.length === 0) return 0;

    const tagSet = new Set(groupingTags);
    return holdings
      .filter((h) => h.tags && h.tags.some((t) => tagSet.has(t)))
      .reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  // Toggle tag selection during creation
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Start creating a new grouping
  const startCreating = () => {
    setIsCreating(true);
    setSelectedTags([]);
    // Trigger pulse animation
    setShowPulse(true);
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
    }
    pulseTimeoutRef.current = setTimeout(() => {
      setShowPulse(false);
    }, 1500); // Animation duration
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  // Cancel creating
  const cancelCreating = () => {
    setIsCreating(false);
    setSelectedTags([]);
  };

  // Finish creating the grouping
  const finishCreating = () => {
    if (selectedTags.length > 0 && activePortfolioId) {
      addTagGrouping(activePortfolioId, selectedTags);
    }
    setIsCreating(false);
    setSelectedTags([]);
  };

  // Delete a grouping
  const deleteGrouping = (id: string) => {
    if (activePortfolioId) {
      removeTagGrouping(activePortfolioId, id);
    }
  };

  // Generate auto name for grouping
  const getGroupingName = (tags: string[]): string => {
    if (tags.length <= 3) {
      return tags.join(" + ");
    }
    return `${tags.slice(0, 2).join(" + ")} + ${tags.length - 2} more`;
  };

  // Sort groupings by value for display (largest first)
  const sortedGroupings = useMemo(() => {
    return [...groupings]
      .map((g) => ({
        ...g,
        value: calculateGroupingValue(g.tags),
        percentage: totalPortfolioValue > 0
          ? (calculateGroupingValue(g.tags) / totalPortfolioValue) * 100
          : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [groupings, totalPortfolioValue]);


  if (allTags.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Tags
        </h2>
        {!isCreating && (
          <Button onClick={startCreating}>
            <Plus className="mr-2 h-4 w-4" />
            Create Grouping
          </Button>
        )}
        {isCreating && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelCreating}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={finishCreating}
              disabled={selectedTags.length === 0}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        )}
      </div>

      {/* All Tags */}
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            const tagColor = getTagSolidColor(tag);
            return (
              <button
                key={tag}
                onClick={() => isCreating && toggleTag(tag)}
                disabled={!isCreating}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150",
                  isCreating && "cursor-pointer active:scale-95",
                  !isCreating && "cursor-default",
                  isSelected
                    ? "shadow-sm ring-2 ring-offset-2 ring-offset-background"
                    : "bg-secondary text-secondary-foreground",
                  isCreating && !isSelected && "hover:bg-secondary/80",
                  // Pulse animation when entering creation mode
                  showPulse && !isSelected && "animate-pulse-glow"
                )}
                style={isSelected ? {
                  backgroundColor: tagColor,
                  color: getTagTextColor(tagColor),
                  // Use CSS variable for ring color
                  "--tw-ring-color": tagColor,
                } as React.CSSProperties : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tagColor }}
                />
                {tag}
                {isSelected && (
                  <Check className="h-3 w-3 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
        {isCreating && (
          <p className="text-xs text-muted-foreground mt-3">
            Tap tags to add them to your grouping. Tap again to remove.
          </p>
        )}
      </div>

      {/* Bento Grid Groupings */}
      {sortedGroupings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Your Groupings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sortedGroupings.map((grouping) => {
              const isLarge = grouping.percentage > 30;
              const dominantColor = getDominantTagColor(grouping.tags);
              const bgColor = lightenTagColor(dominantColor, 30);
              const textColor = getTagTextColor(bgColor);
              return (
                <div
                  key={grouping.id}
                  className={cn(
                    "group relative rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
                    isLarge && "col-span-2"
                  )}
                  style={{
                    backgroundColor: bgColor,
                  }}
                >
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGrouping(grouping.id)}
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    style={{
                      color: textColor,
                    }}
                    aria-label={`Delete grouping: ${getGroupingName(grouping.tags)}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>

                  {/* Horizontal layout: Tags | Data */}
                  <div className="flex items-center gap-3">
                    {/* Tags - Left side (flexible width) */}
                    <div className="flex flex-col gap-1 min-w-0">
                      {grouping.tags.slice(0, isLarge ? 6 : 3).map((tag) => (
                        <TagBadge
                          key={tag}
                          tag={tag}
                          size="lg"
                          solid
                        />
                      ))}
                      {grouping.tags.length > (isLarge ? 6 : 3) && (
                        <span
                          className="text-xs"
                          style={{ color: textColor, opacity: 0.7 }}
                        >
                          +{grouping.tags.length - (isLarge ? 6 : 3)} more
                        </span>
                      )}
                    </div>

                    {/* Value and Percentage - Right side (flexible, takes remaining space) */}
                    <div className="flex-1 flex flex-col items-end justify-center">
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          isLarge ? "text-2xl" : "text-xl"
                        )}
                        style={{ color: textColor }}
                      >
                        {formatCurrency(grouping.value)}
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          isLarge ? "text-xl" : "text-base"
                        )}
                        style={{ color: textColor, opacity: 0.7 }}
                      >
                        {grouping.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
