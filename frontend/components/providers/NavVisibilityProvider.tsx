"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

interface NavVisibilityContextType {
  isHeaderVisible: boolean;
  isBottomNavVisible: boolean;
  showHeader: () => void;
  showBottomNav: () => void;
  hideHeader: () => void;
  hideBottomNav: () => void;
}

const NavVisibilityContext = createContext<NavVisibilityContextType | null>(null);

interface NavVisibilityProviderProps {
  children: ReactNode;
}

/**
 * Provider for managing auto-hide behavior of navigation elements.
 * - Auto-hides both header and bottom nav after 2 seconds on page load
 * - Swipe down from top reveals header
 * - Swipe up from bottom reveals bottom nav
 * - Elements hide again after 2 seconds of inactivity
 */
export function NavVisibilityProvider({ children }: NavVisibilityProviderProps) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const headerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bottomNavTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timer helper
  const clearTimer = (timerRef: React.MutableRefObject<NodeJS.Timeout | null>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start auto-hide timer for header
  const startHeaderHideTimer = useCallback(() => {
    clearTimer(headerTimerRef);
    headerTimerRef.current = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 2000);
  }, []);

  // Start auto-hide timer for bottom nav
  const startBottomNavHideTimer = useCallback(() => {
    clearTimer(bottomNavTimerRef);
    bottomNavTimerRef.current = setTimeout(() => {
      setIsBottomNavVisible(false);
    }, 2000);
  }, []);

  // Show header and start hide timer
  const showHeader = useCallback(() => {
    setIsHeaderVisible(true);
    startHeaderHideTimer();
  }, [startHeaderHideTimer]);

  // Show bottom nav and start hide timer
  const showBottomNav = useCallback(() => {
    setIsBottomNavVisible(true);
    startBottomNavHideTimer();
  }, [startBottomNavHideTimer]);

  // Hide immediately
  const hideHeader = useCallback(() => {
    clearTimer(headerTimerRef);
    setIsHeaderVisible(false);
  }, []);

  const hideBottomNav = useCallback(() => {
    clearTimer(bottomNavTimerRef);
    setIsBottomNavVisible(false);
  }, []);

  // Set up swipe gesture detection
  useSwipeGesture({
    onSwipeDown: showHeader,
    onSwipeUp: showBottomNav,
  });

  // Initial auto-hide after 2 seconds on mount
  useEffect(() => {
    initialHideTimerRef.current = setTimeout(() => {
      setIsHeaderVisible(false);
      setIsBottomNavVisible(false);
    }, 2000);

    return () => {
      clearTimer(initialHideTimerRef);
      clearTimer(headerTimerRef);
      clearTimer(bottomNavTimerRef);
    };
  }, []);

  return (
    <NavVisibilityContext.Provider
      value={{
        isHeaderVisible,
        isBottomNavVisible,
        showHeader,
        showBottomNav,
        hideHeader,
        hideBottomNav,
      }}
    >
      {children}
    </NavVisibilityContext.Provider>
  );
}

/**
 * Hook to access nav visibility state and controls.
 */
export function useNavVisibility(): NavVisibilityContextType {
  const context = useContext(NavVisibilityContext);
  if (!context) {
    throw new Error("useNavVisibility must be used within a NavVisibilityProvider");
  }
  return context;
}
