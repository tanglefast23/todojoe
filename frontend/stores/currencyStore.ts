"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = "USD" | "CAD";

interface CurrencyState {
  // Current display currency
  currency: Currency;

  // Exchange rate: 1 USD = X CAD
  usdToCadRate: number;

  // Last time rate was fetched
  lastFetchedAt: string | null;

  // Loading state
  isLoadingRate: boolean;

  // Error state
  rateError: string | null;

  // Actions
  setCurrency: (currency: Currency) => void;
  toggleCurrency: () => void;
  setExchangeRate: (rate: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Convert USD to display currency
  convertToDisplayCurrency: (usdAmount: number) => number;

  // Get currency symbol
  getCurrencySymbol: () => string;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: "CAD", // Default to CAD
      usdToCadRate: 1.36, // Default fallback rate
      lastFetchedAt: null,
      isLoadingRate: false,
      rateError: null,

      setCurrency: (currency) => set({ currency }),

      toggleCurrency: () => set((state) => ({
        currency: state.currency === "CAD" ? "USD" : "CAD"
      })),

      setExchangeRate: (rate) => set({
        usdToCadRate: rate,
        lastFetchedAt: new Date().toISOString(),
        rateError: null
      }),

      setLoading: (isLoadingRate) => set({ isLoadingRate }),

      setError: (rateError) => set({ rateError }),

      convertToDisplayCurrency: (usdAmount) => {
        const { currency, usdToCadRate } = get();
        if (currency === "USD") {
          return usdAmount;
        }
        return usdAmount * usdToCadRate;
      },

      getCurrencySymbol: () => {
        // Always return $ (no CA prefix)
        return "$";
      },
    }),
    {
      name: "currency-storage",
      // Only persist currency preference, not the rate (fetch fresh on load)
      partialize: (state) => ({
        currency: state.currency,
        usdToCadRate: state.usdToCadRate,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);
