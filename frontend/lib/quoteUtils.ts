/**
 * Quote fetching utilities
 * Shared logic for fetching stock/crypto quotes with fallback handling
 */

import { api } from "@/lib/api";
import type { AssetType } from "@/types/portfolio";
import { detectAssetType } from "@/lib/assetUtils";

export interface QuoteResult {
  price: number;
  name: string | null;
  assetType: AssetType;
}

/**
 * Fetch a quote for a symbol, trying the detected type first with fallback
 *
 * @param symbol - The ticker symbol (e.g., "AAPL", "BTC")
 * @param preferredType - Optional preferred asset type. If "auto", will auto-detect.
 * @returns Quote result with price, name, and resolved asset type
 * @throws If symbol not found in either stock or crypto APIs
 */
export async function fetchQuote(
  symbol: string,
  preferredType: AssetType | "auto" = "auto"
): Promise<QuoteResult> {
  const upperSymbol = symbol.toUpperCase();
  const detectedType = preferredType === "auto" ? detectAssetType(upperSymbol) : preferredType;

  // Try preferred/detected type first, then fallback to the other
  if (detectedType === "crypto") {
    try {
      const quote = await api.getCryptoQuote(upperSymbol);
      return {
        price: quote.price,
        name: quote.name,
        assetType: "crypto",
      };
    } catch {
      // Fallback to stock
      const quote = await api.getStockQuote(upperSymbol);
      return {
        price: quote.price,
        name: quote.name || null,
        assetType: "stock",
      };
    }
  } else {
    try {
      const quote = await api.getStockQuote(upperSymbol);
      return {
        price: quote.price,
        name: quote.name || null,
        assetType: "stock",
      };
    } catch {
      // Fallback to crypto
      const quote = await api.getCryptoQuote(upperSymbol);
      return {
        price: quote.price,
        name: quote.name,
        assetType: "crypto",
      };
    }
  }
}

/**
 * Validate a symbol by attempting to fetch its quote
 * Returns null if symbol is not found
 *
 * @param symbol - The ticker symbol
 * @param preferredType - Optional preferred asset type
 * @returns Quote result or null if not found
 */
export async function validateSymbol(
  symbol: string,
  preferredType: AssetType | "auto" = "auto"
): Promise<QuoteResult | null> {
  if (!symbol || symbol.length < 1) {
    return null;
  }

  try {
    return await fetchQuote(symbol, preferredType);
  } catch {
    return null;
  }
}

/**
 * Hook-friendly debounced symbol validation
 * Use this with useState and useEffect for debounced input validation
 */
export function createDebouncedValidator(delayMs: number = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    validate: (
      symbol: string,
      preferredType: AssetType | "auto",
      onResult: (result: QuoteResult | null) => void,
      onLoading: (isLoading: boolean) => void
    ) => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!symbol || symbol.length < 1) {
        onResult(null);
        onLoading(false);
        return;
      }

      onLoading(true);

      timeoutId = setTimeout(async () => {
        try {
          const result = await validateSymbol(symbol, preferredType);
          onResult(result);
        } catch {
          onResult(null);
        } finally {
          onLoading(false);
        }
      }, delayMs);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
