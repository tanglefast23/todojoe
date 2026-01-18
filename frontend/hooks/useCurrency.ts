"use client";

import { useEffect, useRef } from "react";
import { useCurrencyStore } from "@/stores/currencyStore";

interface CurrencyResponse {
  rate: number;
  source: string;
  updatedAt: string;
  error?: string;
}

async function fetchExchangeRate(): Promise<CurrencyResponse> {
  const response = await fetch("/api/currency");
  if (!response.ok) {
    throw new Error("Failed to fetch exchange rate");
  }
  return response.json();
}

/**
 * Hook to fetch exchange rate once per session.
 * Should be called once at the app level to initialize the rate.
 */
export function useCurrencyInit() {
  const { setExchangeRate, setLoading, setError } = useCurrencyStore();
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once per session
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    async function fetchRate() {
      setLoading(true);
      try {
        const data = await fetchExchangeRate();
        if (data?.rate) {
          setExchangeRate(data.rate);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch rate");
      } finally {
        setLoading(false);
      }
    }

    fetchRate();
  }, [setExchangeRate, setLoading, setError]);
}

/**
 * Hook to use currency conversion in components.
 * Returns current currency, conversion function, and toggle.
 */
export function useCurrency() {
  const {
    currency,
    toggleCurrency,
    convertToDisplayCurrency,
    getCurrencySymbol,
    usdToCadRate,
  } = useCurrencyStore();

  return {
    currency,
    toggleCurrency,
    convert: convertToDisplayCurrency,
    symbol: getCurrencySymbol(),
    rate: usdToCadRate,
  };
}
