/**
 * Virtual scrolling hook for large lists.
 *
 * Provides virtualization when row count exceeds threshold.
 * Requires @tanstack/react-virtual to be installed:
 *   pnpm add @tanstack/react-virtual
 *
 * Usage:
 *   const { virtualItems, totalSize, containerRef } = useVirtualScroll({
 *     count: items.length,
 *     estimateSize: () => 48, // row height in px
 *     threshold: 50, // only virtualize if > 50 items
 *   });
 */

import { useRef, useMemo } from "react";

// Threshold for enabling virtualization (don't virtualize small lists)
export const VIRTUALIZATION_THRESHOLD = 50;

export interface VirtualScrollOptions {
  /** Total number of items */
  count: number;
  /** Estimated size of each item in pixels */
  estimateSize: () => number;
  /** Only enable virtualization above this count (default: 50) */
  threshold?: number;
  /** Overscan - render extra items above/below viewport (default: 5) */
  overscan?: number;
}

export interface VirtualScrollResult {
  /** Whether virtualization is active */
  isVirtualized: boolean;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Virtual items to render (or null if not virtualized) */
  virtualItems: VirtualItem[] | null;
  /** Total size of the virtual list in pixels */
  totalSize: number;
  /** Get styles for positioning a virtual row */
  getItemStyle: (index: number) => React.CSSProperties;
}

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
  key: string | number;
}

/**
 * Hook for virtual scrolling large lists.
 *
 * When @tanstack/react-virtual is not installed, returns a no-op result
 * that renders all items normally.
 */
export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollResult {
  const { count, estimateSize, threshold = VIRTUALIZATION_THRESHOLD, overscan = 5 } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if we should virtualize
  const shouldVirtualize = count > threshold;

  // Try to use @tanstack/react-virtual if available
  // For now, return a passthrough that renders all items
  // TODO: Integrate with @tanstack/react-virtual when installed

  const result = useMemo((): VirtualScrollResult => {
    if (!shouldVirtualize) {
      // Below threshold - render all items normally
      return {
        isVirtualized: false,
        containerRef,
        virtualItems: null,
        totalSize: count * estimateSize(),
        getItemStyle: () => ({}),
      };
    }

    // Above threshold but @tanstack/react-virtual not integrated yet
    // Return virtual items for all rows (fallback behavior)
    const itemSize = estimateSize();
    const virtualItems: VirtualItem[] = Array.from({ length: count }, (_, index) => ({
      index,
      start: index * itemSize,
      size: itemSize,
      key: index,
    }));

    return {
      isVirtualized: true,
      containerRef,
      virtualItems,
      totalSize: count * itemSize,
      getItemStyle: (index: number) => ({
        position: "absolute" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: `${itemSize}px`,
        transform: `translateY(${index * itemSize}px)`,
      }),
    };
  }, [count, estimateSize, shouldVirtualize]);

  return result;
}

/**
 * Check if virtualization should be enabled for a given count.
 * Useful for conditional rendering decisions.
 */
export function shouldUseVirtualization(count: number, threshold = VIRTUALIZATION_THRESHOLD): boolean {
  return count > threshold;
}
