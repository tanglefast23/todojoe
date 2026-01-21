/**
 * Settings Zustand store with localStorage persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

type MetricsMode = "simple" | "pro";
type MobileMode = "auto" | "mobile" | "desktop";
export type ActiveView = "home" | "add" | "watchlist";
export type FontSize = "small" | "medium" | "large" | "xlarge";

interface SettingsState {
  // Refresh settings
  autoRefreshEnabled: boolean;
  refreshIntervalSeconds: number;

  // Display settings
  metricsMode: MetricsMode;
  currency: string;
  mobileMode: MobileMode;
  activeView: ActiveView;
  fontSize: FontSize;

  // Risk-free rate for Sharpe ratio (fixed at 4.5%)
  riskFreeRate: number;

  // Actions
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (seconds: number) => void;
  setMetricsMode: (mode: MetricsMode) => void;
  setCurrency: (currency: string) => void;
  setMobileMode: (mode: MobileMode) => void;
  setActiveView: (view: ActiveView) => void;
  setFontSize: (size: FontSize) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  // Setter for Supabase sync - completely replaces settings state
  setSettings: (settings: Partial<Omit<SettingsState, "setAutoRefresh" | "setRefreshInterval" | "setMetricsMode" | "setCurrency" | "setMobileMode" | "setActiveView" | "setFontSize" | "increaseFontSize" | "decreaseFontSize" | "setSettings">>) => void;
}

const FONT_SIZE_ORDER: FontSize[] = ["small", "medium", "large", "xlarge"];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Defaults
      autoRefreshEnabled: true,
      refreshIntervalSeconds: 30,
      metricsMode: "simple",
      currency: "USD",
      mobileMode: "auto",
      activeView: "home",
      fontSize: "medium",
      riskFreeRate: 4.5, // Fixed at 4.5% as per requirements

      // Actions
      setAutoRefresh: (enabled) => set({ autoRefreshEnabled: enabled }),
      setRefreshInterval: (seconds) => set({ refreshIntervalSeconds: seconds }),
      setMetricsMode: (mode) => set({ metricsMode: mode }),
      setCurrency: (currency) => set({ currency }),
      setMobileMode: (mode) => set({ mobileMode: mode }),
      setActiveView: (view) => set({ activeView: view }),
      setFontSize: (size) => set({ fontSize: size }),
      increaseFontSize: () => {
        const currentIndex = FONT_SIZE_ORDER.indexOf(get().fontSize);
        if (currentIndex < FONT_SIZE_ORDER.length - 1) {
          set({ fontSize: FONT_SIZE_ORDER[currentIndex + 1] });
        }
      },
      decreaseFontSize: () => {
        const currentIndex = FONT_SIZE_ORDER.indexOf(get().fontSize);
        if (currentIndex > 0) {
          set({ fontSize: FONT_SIZE_ORDER[currentIndex - 1] });
        }
      },
      setSettings: (settings) => set(settings),
    }),
    {
      name: "settings-storage",
    }
  )
);
