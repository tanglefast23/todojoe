/**
 * Tag utility functions for parsing and managing investment tags
 */

import { MUTED_CHART_COLORS } from "@/hooks/useChartColors";

// Hoisted RegExp patterns to module level for better performance
const TAG_SPLIT_REGEX = /[\s,]+/;
const HSL_REGEX = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/;

// Module-level cache for tag colors to avoid recomputing hashes
const tagColorCache = new Map<string, string>();

/**
 * Parse a string of space or comma-separated tags into an array of normalized tags
 * @param input - Raw input string (e.g., "tech, growth dividend")
 * @returns Array of unique, lowercase, trimmed tags
 */
export function parseTagInput(input: string): string[] {
  if (!input) return []; // Early return for empty input

  const tags = input
    .split(TAG_SPLIT_REGEX) // Use hoisted regex
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 20); // Validate length

  // Use Set for O(1) deduplication instead of O(n²) indexOf
  return [...new Set(tags)];
}

/**
 * Format tags for display (capitalize first letter)
 * @param tag - Lowercase tag
 * @returns Formatted tag for display
 */
export function formatTagForDisplay(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/**
 * Tag colors - using the same MUTED_CHART_COLORS palette but offset by 6 positions
 * so tags don't have the same colors as portfolio allocation chart segments
 */
const TAG_COLOR_OFFSET = 6;
const TAG_COLORS = MUTED_CHART_COLORS.map((_, i, arr) =>
  arr[(i + TAG_COLOR_OFFSET) % arr.length]
);

/**
 * Simple hash function for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Get the HSL color string for a tag
 * Uses a hash to assign colors deterministically
 * Results are cached for O(1) repeated lookups
 */
export function getTagHslColor(tag: string): string {
  // Check cache first for O(1) lookup
  const cached = tagColorCache.get(tag);
  if (cached) return cached;

  const index = hashString(tag) % TAG_COLORS.length;
  const color = TAG_COLORS[index];

  // Cache the result
  tagColorCache.set(tag, color);
  return color;
}

/**
 * Parse HSL color string and return components
 * Uses hoisted regex for better performance
 */
function parseHsl(hslColor: string): { h: number; s: number; l: number } | null {
  const match = hslColor.match(HSL_REGEX);
  if (match) {
    return {
      h: parseInt(match[1]),
      s: parseInt(match[2]),
      l: parseInt(match[3]),
    };
  }
  return null;
}

/**
 * Get contrasting text color based on background lightness
 */
export function getTagTextColor(hslColor: string): string {
  const hsl = parseHsl(hslColor);
  if (hsl) {
    return hsl.l > 50 ? "hsl(0, 0%, 15%)" : "hsl(0, 0%, 100%)";
  }
  return "hsl(0, 0%, 100%)";
}

/**
 * Get a lightened version of an HSL color for backgrounds
 */
export function lightenTagColor(hslColor: string, amount: number = 30): string {
  const hsl = parseHsl(hslColor);
  if (hsl) {
    const newSaturation = Math.max(10, hsl.s - 25);
    const newLightness = Math.min(88, hsl.l + amount);
    return `hsl(${hsl.h}, ${newSaturation}%, ${newLightness}%)`;
  }
  return hslColor;
}

/**
 * Get Tailwind-compatible CSS classes for a tag (for backward compatibility)
 * Returns inline style object instead of Tailwind classes for precise color control
 */
export function getTagColor(tag: string): string {
  // Return empty string - components should use getTagStyles() instead
  // Keeping for backward compatibility but it won't apply colors
  return "";
}

/**
 * Get inline styles for a tag badge
 * Returns an object with backgroundColor and color properties
 */
export function getTagStyles(tag: string): { backgroundColor: string; color: string } {
  const hslColor = getTagHslColor(tag);
  const hsl = parseHsl(hslColor);

  if (hsl) {
    // Create a semi-transparent background version
    const bgColor = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.2)`;
    // Use the full color for text but adjust for readability
    const textColor = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 70)}%, ${Math.max(hsl.l - 15, 30)}%)`;
    return {
      backgroundColor: bgColor,
      color: textColor,
    };
  }

  return {
    backgroundColor: "hsla(220, 50%, 55%, 0.2)",
    color: "hsl(220, 60%, 40%)",
  };
}

/**
 * Get the solid HSL color for a tag (for dots, pills in groupings, etc.)
 */
export function getTagSolidColor(tag: string): string {
  return getTagHslColor(tag);
}
