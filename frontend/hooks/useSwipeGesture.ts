"use client";

import { useEffect, useRef, useCallback } from "react";

interface SwipeConfig {
  /** Minimum distance in pixels to trigger swipe */
  threshold?: number;
  /** Maximum time in ms for the swipe gesture */
  maxTime?: number;
  /** Edge zone in pixels from screen edge to start detecting */
  edgeZone?: number;
}

interface SwipeCallbacks {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface TouchData {
  startX: number;
  startY: number;
  startTime: number;
  isEdgeSwipe: "top" | "bottom" | "left" | "right" | null;
}

/**
 * Hook for detecting swipe gestures, especially from screen edges.
 * Used for revealing hidden navigation elements.
 */
export function useSwipeGesture(
  callbacks: SwipeCallbacks,
  config: SwipeConfig = {}
) {
  const { threshold = 50, maxTime = 300, edgeZone = 30 } = config;
  const touchDataRef = useRef<TouchData | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      const { clientX, clientY } = touch;
      const { innerHeight, innerWidth } = window;

      // Determine if touch started from an edge
      let isEdgeSwipe: TouchData["isEdgeSwipe"] = null;
      if (clientY <= edgeZone) {
        isEdgeSwipe = "top";
      } else if (clientY >= innerHeight - edgeZone) {
        isEdgeSwipe = "bottom";
      } else if (clientX <= edgeZone) {
        isEdgeSwipe = "left";
      } else if (clientX >= innerWidth - edgeZone) {
        isEdgeSwipe = "right";
      }

      touchDataRef.current = {
        startX: clientX,
        startY: clientY,
        startTime: Date.now(),
        isEdgeSwipe,
      };
    },
    [edgeZone]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchDataRef.current) return;

      const touch = e.changedTouches[0];
      const { clientX, clientY } = touch;
      const { startX, startY, startTime, isEdgeSwipe } = touchDataRef.current;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      const deltaTime = Date.now() - startTime;

      // Only process if within time limit
      if (deltaTime > maxTime) {
        touchDataRef.current = null;
        return;
      }

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine swipe direction based on edge start
      if (isEdgeSwipe === "bottom" && deltaY < -threshold && absDeltaY > absDeltaX) {
        // Swipe up from bottom edge
        callbacks.onSwipeUp?.();
      } else if (isEdgeSwipe === "top" && deltaY > threshold && absDeltaY > absDeltaX) {
        // Swipe down from top edge
        callbacks.onSwipeDown?.();
      } else if (isEdgeSwipe === "left" && deltaX > threshold && absDeltaX > absDeltaY) {
        // Swipe right from left edge
        callbacks.onSwipeRight?.();
      } else if (isEdgeSwipe === "right" && deltaX < -threshold && absDeltaX > absDeltaY) {
        // Swipe left from right edge
        callbacks.onSwipeLeft?.();
      }

      touchDataRef.current = null;
    },
    [callbacks, threshold, maxTime]
  );

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}
