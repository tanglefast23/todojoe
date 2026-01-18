"use client";

import { useCallback } from "react";
import { useCurrencyStore, type Currency } from "@/stores/currencyStore";

/**
 * Hook that provides currency-aware formatting functions.
 * All USD values are automatically converted to the selected display currency.
 */
export function useFormatters() {
  const { currency, usdToCadRate, convertToDisplayCurrency } = useCurrencyStore();

  /**
   * Format a USD value in the current display currency.
   * Always uses $ symbol regardless of currency (no CA prefix).
   */
  const formatCurrency = useCallback(
    (usdValue: number, minDecimals = 2, maxDecimals = 2): string => {
      const displayValue = convertToDisplayCurrency(usdValue);
      // Always format as USD to avoid "CA$" prefix - user knows their currency from toggle
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      }).format(displayValue);
    },
    [convertToDisplayCurrency]
  );

  /**
   * Format a crypto price with appropriate decimal places.
   */
  const formatCryptoPrice = useCallback(
    (usdValue: number): string => {
      const displayValue = convertToDisplayCurrency(usdValue);

      if (displayValue < 0.0001) {
        return `$${displayValue.toFixed(8)}`;
      }
      if (displayValue < 0.01) {
        return `$${displayValue.toFixed(6)}`;
      }
      if (displayValue < 1) {
        return `$${displayValue.toFixed(4)}`;
      }
      return formatCurrency(usdValue);
    },
    [convertToDisplayCurrency, formatCurrency]
  );

  /**
   * Format a price change (with sign).
   */
  const formatChange = useCallback(
    (usdValue: number, includeSign = true): string => {
      const formatted = formatCurrency(Math.abs(usdValue));
      if (includeSign) {
        return usdValue >= 0 ? `+${formatted}` : `-${formatted}`;
      }
      return formatted;
    },
    [formatCurrency]
  );

  /**
   * Format large numbers with K/M/B/T suffixes.
   */
  const formatLargeNumber = useCallback(
    (usdValue: number): string => {
      const displayValue = convertToDisplayCurrency(usdValue);

      if (displayValue >= 1_000_000_000_000) {
        return `$${(displayValue / 1_000_000_000_000).toFixed(2)}T`;
      }
      if (displayValue >= 1_000_000_000) {
        return `$${(displayValue / 1_000_000_000).toFixed(2)}B`;
      }
      if (displayValue >= 1_000_000) {
        return `$${(displayValue / 1_000_000).toFixed(2)}M`;
      }
      if (displayValue >= 1_000) {
        return `$${(displayValue / 1_000).toFixed(2)}K`;
      }
      return formatCurrency(usdValue);
    },
    [convertToDisplayCurrency, formatCurrency]
  );

  /**
   * Get the current currency code.
   */
  const getCurrency = useCallback((): Currency => currency, [currency]);

  /**
   * Get the current currency symbol (always $).
   */
  const getSymbol = useCallback((): string => {
    return "$";
  }, []);

  return {
    formatCurrency,
    formatCryptoPrice,
    formatChange,
    formatLargeNumber,
    getCurrency,
    getSymbol,
    currency,
    rate: usdToCadRate,
  };
}
