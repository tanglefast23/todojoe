"use client";

import { useRef, useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav, type MobileView } from "./MobileBottomNav";
import { MobilePortfolioView } from "./MobilePortfolioView";
import { MobileWatchlistView } from "./MobileWatchlistView";
import { MobileQuickEntry } from "./MobileQuickEntry";
import { MobileErrorBoundary } from "./MobileErrorBoundary";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useSettingsStore, type ActiveView } from "@/stores/settingsStore";
import { playClickSound } from "@/lib/audio";
import { cn } from "@/lib/utils";

// View order for swipe navigation (circular) - matches bottom nav order
const VIEW_ORDER: ActiveView[] = ["home", "add", "watchlist"];

// Animation direction type
type SlideDirection = "left" | "right" | null;

/** Main mobile app container with bottom navigation */
export function MobileApp() {
  // Use store for activeView so it persists across mobile/desktop toggles
  const activeView = useSettingsStore((state) => state.activeView);
  const setActiveView = useSettingsStore((state) => state.setActiveView);

  const [slideDirection, setSlideDirection] = useState<SlideDirection>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { refetch, isLoading } = usePortfolio();

  // Swipe navigation state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 80; // Minimum horizontal swipe distance in pixels
  const MAX_SWIPE_TIME = 500; // Maximum time for a swipe gesture in ms
  const ANIMATION_DURATION = 250; // Animation duration in ms

  // Navigate to next/previous view with animation
  const navigateView = useCallback((direction: "next" | "prev") => {
    if (isAnimating) return; // Prevent double navigation

    const currentIndex = VIEW_ORDER.indexOf(activeView);
    let newIndex: number;

    if (direction === "next") {
      // Swipe left = next view (right in the list)
      newIndex = (currentIndex + 1) % VIEW_ORDER.length;
      setSlideDirection("left");
    } else {
      // Swipe right = previous view (left in the list)
      newIndex = (currentIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
      setSlideDirection("right");
    }

    playClickSound();
    setIsAnimating(true);

    // Change view after half the animation (when current view is off-screen)
    setTimeout(() => {
      setActiveView(VIEW_ORDER[newIndex]);
    }, ANIMATION_DURATION / 2);

    // Reset animation state after full animation
    setTimeout(() => {
      setSlideDirection(null);
      setIsAnimating(false);
    }, ANIMATION_DURATION);
  }, [activeView, isAnimating]);

  // Track if we're in a horizontal swipe to prevent scroll interference
  const isSwipingHorizontally = useRef(false);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isSwipingHorizontally.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = Math.abs(currentX - touchStartX.current);
    const deltaY = Math.abs(currentY - touchStartY.current);

    // If horizontal movement is dominant and significant, mark as horizontal swipe
    if (deltaX > 20 && deltaX > deltaY * 2) {
      isSwipingHorizontally.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || touchStartTime.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = Math.abs(touchEndY - touchStartY.current);
    const deltaTime = Date.now() - touchStartTime.current;

    // Swipe detection:
    // 1. Horizontal distance must exceed threshold
    // 2. Horizontal distance must be greater than vertical (primarily horizontal swipe)
    // 3. Must be a quick gesture (not a slow drag)
    const isHorizontalSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD;
    const isPrimarilyHorizontal = Math.abs(deltaX) > deltaY * 1.5;
    const isQuickGesture = deltaTime < MAX_SWIPE_TIME;

    if (isHorizontalSwipe && isPrimarilyHorizontal && isQuickGesture) {
      if (deltaX > 0) {
        // Swipe right = go to previous view (backward)
        navigateView("prev");
      } else {
        // Swipe left = go to next view (forward)
        navigateView("next");
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = null;
    isSwipingHorizontally.current = false;
  }, [navigateView]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <MobileHeader onRefresh={refetch} isRefreshing={isLoading} />

      {/* Main Content Area - with swipe navigation */}
      {/* min-h-0 is critical for nested flex containers to properly constrain scroll */}
      <main
        className="flex-1 flex flex-col overflow-hidden touch-pan-y min-h-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            "flex-1 flex flex-col min-h-0",
            "transition-transform duration-[250ms] ease-out",
            slideDirection === "left" && "translate-x-[-100%]",
            slideDirection === "right" && "translate-x-[100%]"
          )}
        >
          {activeView === "home" && (
            <MobileErrorBoundary>
              <MobilePortfolioView />
            </MobileErrorBoundary>
          )}
          {activeView === "add" && (
            <MobileErrorBoundary>
              <MobileQuickEntry />
            </MobileErrorBoundary>
          )}
          {activeView === "watchlist" && (
            <MobileErrorBoundary>
              <MobileWatchlistView />
            </MobileErrorBoundary>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav
        activeView={activeView}
        onViewChange={setActiveView}
      />
    </div>
  );
}
