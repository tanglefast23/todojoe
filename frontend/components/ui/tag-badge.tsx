"use client";

import { memo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagStyles, getTagSolidColor } from "@/lib/tagUtils";

export type TagBadgeSize = "xs" | "sm" | "md" | "lg";

interface TagBadgeProps {
  /** The tag text to display */
  tag: string;
  /** Size variant */
  size?: TagBadgeSize;
  /** Optional remove handler - shows X button when provided */
  onRemove?: () => void;
  /** Additional class names */
  className?: string;
  /** Use solid background color (for dark/colored card backgrounds) */
  solid?: boolean;
  /** Custom solid color override for the dot and solid mode */
  solidColor?: string;
  /** Custom text color override for solid mode */
  textColor?: string;
}

/**
 * Unified tag badge component with consistent dot style across the app.
 *
 * Visual style: Pill shape with colored dot on left + tag text
 *
 * Sizes:
 * - xs: 9px text, tiny dot - for compact displays
 * - sm: 10px text, small dot - default, for tables and lists
 * - md: 11px text, medium dot - for cards and widgets
 * - lg: 12px text, larger dot - for prominent displays
 */
export const TagBadge = memo(function TagBadge({
  tag,
  size = "sm",
  onRemove,
  className,
  solid = false,
  solidColor,
  textColor,
}: TagBadgeProps) {
  const tagStyles = getTagStyles(tag);
  const dotColor = solidColor || getTagSolidColor(tag);

  // Size configurations
  const sizeConfig = {
    xs: {
      pill: "px-1.5 py-0.5 text-[9px] gap-1",
      dot: "h-1.5 w-1.5",
      x: "w-2.5 h-2.5",
    },
    sm: {
      pill: "px-2 py-0.5 text-[10px] gap-1",
      dot: "h-1.5 w-1.5",
      x: "w-3 h-3",
    },
    md: {
      pill: "px-2 py-0.5 text-[11px] gap-1.5",
      dot: "h-2 w-2",
      x: "w-3 h-3",
    },
    lg: {
      pill: "px-3 py-1 text-xs gap-1.5 whitespace-nowrap",
      dot: "h-2 w-2",
      x: "w-3.5 h-3.5",
    },
  };

  const config = sizeConfig[size];

  // For solid mode (used on colored card backgrounds)
  if (solid) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full font-medium",
          config.pill,
          className
        )}
        style={{
          backgroundColor: dotColor,
          color: textColor || "white",
        }}
      >
        <span
          className={cn("rounded-full flex-shrink-0 bg-white/30", config.dot)}
          aria-hidden="true"
        />
        {tag}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
            aria-label={`Remove ${tag} tag`}
          >
            <X className={config.x} />
          </button>
        )}
      </span>
    );
  }

  // Default: semi-transparent background with colored dot
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.pill,
        className
      )}
      style={tagStyles}
    >
      <span
        className={cn("rounded-full flex-shrink-0", config.dot)}
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      {tag}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
          aria-label={`Remove ${tag} tag`}
        >
          <X className={config.x} />
        </button>
      )}
    </span>
  );
});

/**
 * Display a list of tags with overflow handling
 */
interface TagBadgeListProps {
  tags: string[];
  size?: TagBadgeSize;
  maxDisplay?: number;
  onRemove?: (tag: string) => void;
  className?: string;
}

export const TagBadgeList = memo(function TagBadgeList({
  tags,
  size = "sm",
  maxDisplay = 5,
  onRemove,
  className,
}: TagBadgeListProps) {
  if (tags.length === 0) return null;

  const displayTags = tags.slice(0, maxDisplay);
  const remaining = tags.length - maxDisplay;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayTags.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          size={size}
          onRemove={onRemove ? () => onRemove(tag) : undefined}
        />
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center text-[10px] text-muted-foreground px-1">
          +{remaining}
        </span>
      )}
    </div>
  );
});
