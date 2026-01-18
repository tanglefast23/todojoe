/**
 * Hook to detect document visibility state.
 * Returns true when the document is visible (tab is active), false when hidden.
 * Useful for pausing expensive operations (like polling) when the user isn't looking.
 */

import { useState, useEffect } from "react";

export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => {
    // SSR-safe: assume visible on server
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
