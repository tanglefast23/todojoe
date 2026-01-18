/**
 * Mobile mode detection hook
 * Combines screen size detection with user override setting
 */
"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

const MOBILE_BREAKPOINT = 640; // Tailwind's 'sm' breakpoint

export function useMobileMode() {
  const mobileMode = useSettingsStore((state) => state.mobileMode);
  const setMobileMode = useSettingsStore((state) => state.setMobileMode);

  // Track actual screen size
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Check initial screen size
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkScreenSize();

    // Listen for resize events
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches);

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Determine if mobile mode should be active
  // - "auto": use screen size detection
  // - "mobile": force mobile mode
  // - "desktop": force desktop mode
  const isMobile = isMounted
    ? mobileMode === "auto"
      ? isSmallScreen
      : mobileMode === "mobile"
    : false; // Default to desktop during SSR to avoid hydration mismatch

  return {
    /** Whether mobile mode is currently active */
    isMobile,
    /** Whether the screen is physically small (regardless of override) */
    isSmallScreen,
    /** Current mode setting: "auto" | "mobile" | "desktop" */
    mobileMode,
    /** Update the mode setting */
    setMobileMode,
    /** Whether the component has mounted (for hydration safety) */
    isMounted,
  };
}
