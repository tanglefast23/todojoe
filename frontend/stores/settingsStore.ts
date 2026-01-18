/**
 * Settings Zustand store with localStorage persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

type MetricsMode = "simple" | "pro";
type MobileMode = "auto" | "mobile" | "desktop";
export type ActiveView = "home" | "add" | "watchlist";

interface SettingsState {
  // Refresh settings
  autoRefreshEnabled: boolean;
  refreshIntervalSeconds: number;

  // Display settings
  metricsMode: MetricsMode;
  currency: string;
  mobileMode: MobileMode;
  activeView: ActiveView;

  // Risk-free rate for Sharpe ratio (fixed at 4.5%)
  riskFreeRate: number;

  // Actions
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (seconds: number) => void;
  setMetricsMode: (mode: MetricsMode) => void;
  setCurrency: (currency: string) => void;
  setMobileMode: (mode: MobileMode) => void;
  setActiveView: (view: ActiveView) => void;
  // Setter for Supabase sync - completely replaces settings state
  setSettings: (settings: Partial<Omit<SettingsState, "setAutoRefresh" | "setRefreshInterval" | "setMetricsMode" | "setCurrency" | "setMobileMode" | "setActiveView" | "setSettings">>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      autoRefreshEnabled: true,
      refreshIntervalSeconds: 30,
      metricsMode: "simple",
      currency: "USD",
      mobileMode: "desktop",
      activeView: "home",
      riskFreeRate: 4.5, // Fixed at 4.5% as per requirements

      // Actions
      setAutoRefresh: (enabled) => set({ autoRefreshEnabled: enabled }),
      setRefreshInterval: (seconds) => set({ refreshIntervalSeconds: seconds }),
      setMetricsMode: (mode) => set({ metricsMode: mode }),
      setCurrency: (currency) => set({ currency }),
      setMobileMode: (mode) => set({ mobileMode: mode }),
      setActiveView: (view) => set({ activeView: view }),
      setSettings: (settings) => set(settings),
    }),
    {
      name: "settings-storage",
    }
  )
);
