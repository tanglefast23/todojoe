"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyModeState {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (enabled: boolean) => void;
}

/**
 * Shared privacy mode state for blurring sensitive financial data.
 * Persists to localStorage and syncs across all components.
 */
export const usePrivacyMode = create<PrivacyModeState>()(
  persist(
    (set) => ({
      privacyMode: false,
      togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
      setPrivacyMode: (enabled) => set({ privacyMode: enabled }),
    }),
    {
      name: "portfolio-privacy-mode",
    }
  )
);

/**
 * Returns the CSS class to apply for blurring sensitive values.
 * Use this in components that display financial data.
 */
export function usePrivacyBlur(): string {
  const privacyMode = usePrivacyMode((state) => state.privacyMode);
  return privacyMode ? "blur-md select-none" : "";
}

/**
 * Returns stronger blur for large hero text (portfolio value).
 * Use blur-2xl (40px) for complete obscurity on big numbers.
 */
export function usePrivacyBlurStrong(): string {
  const privacyMode = usePrivacyMode((state) => state.privacyMode);
  return privacyMode ? "blur-2xl select-none" : "";
}
