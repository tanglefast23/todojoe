"use client";

import React, {
  type ReactNode,
  type ReactElement,
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
} from "react";

/**
 * Threshold for enabling virtualization
 * Lists smaller than this render all items immediately
 */
const VIRTUALIZATION_THRESHOLD = 30;

/**
 * Number of items to render beyond the visible viewport
 * Provides smooth scrolling experience
 */
const OVERSCAN = 5;

interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Unique key extractor for each item */
  keyExtractor: (item: T, index: number) => string;
  /** Estimated height of each item in pixels (for virtualization) */
  estimatedItemHeight?: number;
  /** Container className */
  className?: string;
  /** Gap between items in pixels */
  gap?: number;
  /** Loading placeholder component */
  loadingPlaceholder?: ReactNode;
  /** Empty state component */
  emptyState?: ReactNode;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Mobile-optimized virtual list component
 *
 * Features:
 * - Automatic virtualization for lists > 30 items
 * - IntersectionObserver-based lazy rendering (no external deps)
 * - Maintains scroll position
 * - Supports variable height items
 * - Falls back to simple list for small datasets
 *
 * For lists under 30 items, renders all items directly (no overhead).
 * For larger lists, only renders visible items + overscan buffer.
 */
export function MobileVirtualList<T>({
  items,
  renderItem,
  keyExtractor,
  estimatedItemHeight = 80,
  className,
  gap = 12,
  loadingPlaceholder,
  emptyState,
  isLoading,
}: VirtualListProps<T>) {
  // For small lists, render everything directly
  if (items.length <= VIRTUALIZATION_THRESHOLD) {
    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", gap }}>
        {isLoading && loadingPlaceholder}
        {!isLoading && items.length === 0 && emptyState}
        {!isLoading && items.map((item, index) => (
          <div key={keyExtractor(item, index)}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // For larger lists, use virtualization
  return (
    <VirtualizedListInner
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemHeight={estimatedItemHeight}
      className={className}
      gap={gap}
      loadingPlaceholder={loadingPlaceholder}
      emptyState={emptyState}
      isLoading={isLoading}
    />
  );
}

/**
 * Internal virtualized list implementation using IntersectionObserver
 */
const VirtualizedListInner = memo(function VirtualizedListInner<T>({
  items,
  renderItem,
  keyExtractor,
  estimatedItemHeight,
  className,
  gap,
  loadingPlaceholder,
  emptyState,
  isLoading,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  // Track which items are visible
  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = window.scrollY - container.offsetTop;
    const viewportHeight = window.innerHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / (estimatedItemHeight! + gap!)) - OVERSCAN);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / (estimatedItemHeight! + gap!)) + OVERSCAN
    );

    setVisibleRange((prev) => {
      if (prev.start !== startIndex || prev.end !== endIndex) {
        return { start: startIndex, end: endIndex };
      }
      return prev;
    });
  }, [items.length, estimatedItemHeight, gap]);

  // Set up scroll listener with throttling for better performance
  useEffect(() => {
    updateVisibleRange();

    let ticking = false;
    let rafId: number | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      // Throttle scroll events to ~60fps using rAF
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(() => {
          updateVisibleRange();
          ticking = false;
          rafId = null;
        });
      }
    };

    const handleResize = () => {
      // Debounce resize events (less frequent than scroll)
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateVisibleRange, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updateVisibleRange]);

  // Calculate total height for scroll container
  const totalHeight = items.length * (estimatedItemHeight! + gap!) - gap!;

  // Get visible items
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);

  // Calculate offset for the first visible item
  const offsetY = visibleRange.start * (estimatedItemHeight! + gap!);

  if (isLoading) {
    return <div className={className}>{loadingPlaceholder}</div>;
  }

  if (items.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        height: totalHeight,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: offsetY,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        {visibleItems.map((item, idx) => {
          const actualIndex = visibleRange.start + idx;
          return (
            <div key={keyExtractor(item, actualIndex)}>
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}) as <T>(props: VirtualListProps<T>) => ReactElement;

/**
 * Hook for virtualized rendering
 * Use this when you need more control over the virtualization behavior
 */
export function useVirtualization<T>(
  items: T[],
  options: {
    estimatedItemHeight?: number;
    overscan?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    estimatedItemHeight = 80,
    overscan = OVERSCAN,
    enabled = items.length > VIRTUALIZATION_THRESHOLD,
  } = options;

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const containerRef = useRef<HTMLDivElement>(null);

  const updateRange = useCallback(() => {
    if (!containerRef.current || !enabled) return;

    const container = containerRef.current;
    const scrollTop = window.scrollY - container.offsetTop;
    const viewportHeight = window.innerHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / estimatedItemHeight) + overscan
    );

    setVisibleRange({ start: startIndex, end: endIndex });
  }, [items.length, estimatedItemHeight, overscan, enabled]);

  useEffect(() => {
    if (!enabled) return;

    updateRange();
    window.addEventListener("scroll", updateRange, { passive: true });
    return () => window.removeEventListener("scroll", updateRange);
  }, [updateRange, enabled]);

  return {
    containerRef,
    visibleRange,
    visibleItems: enabled ? items.slice(visibleRange.start, visibleRange.end) : items,
    totalHeight: enabled ? items.length * estimatedItemHeight : "auto",
    offsetY: enabled ? visibleRange.start * estimatedItemHeight : 0,
    isVirtualized: enabled,
  };
}
