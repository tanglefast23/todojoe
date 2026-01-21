"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Applies the font size class to the HTML element based on settings.
 * This component should be rendered once in the app layout.
 */
export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const fontSize = useSettingsStore((state) => state.fontSize);

  useEffect(() => {
    const html = document.documentElement;

    // Remove all font size classes
    html.classList.remove("font-small", "font-medium", "font-large", "font-xlarge");

    // Add the current font size class
    html.classList.add(`font-${fontSize}`);
  }, [fontSize]);

  return <>{children}</>;
}
