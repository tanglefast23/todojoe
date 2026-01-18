/**
 * Utility functions for sell planning
 * Extracted from SellPlanningWidget for better organization
 */

import { CRYPTO_SYMBOLS, isCryptoSymbol } from "./assetUtils";

// Re-export for backwards compatibility
export { CRYPTO_SYMBOLS };

/**
 * Check if a symbol is crypto
 * @deprecated Use isCryptoSymbol from @/lib/assetUtils instead
 */
export function isCrypto(symbol: string): boolean {
  return isCryptoSymbol(symbol);
}

/**
 * Format shares based on asset type (whole numbers for stocks, 2 decimals for crypto)
 */
export function formatShares(shares: number, symbol: string): string {
  if (isCrypto(symbol)) {
    return shares.toFixed(2);
  }
  return Math.floor(shares).toString();
}

/**
 * Round shares based on asset type
 */
export function roundShares(shares: number, symbol: string): number {
  if (isCrypto(symbol)) {
    return Math.floor(shares * 100) / 100; // Round to 2 decimal places
  }
  return Math.floor(shares); // Whole numbers for stocks
}

/**
 * Extract plain symbol from composite key (e.g., "MU" from "MU-stock")
 */
export function getPlainSymbol(compositeKey: string): string {
  const lastDashIndex = compositeKey.lastIndexOf("-");
  return lastDashIndex > 0 ? compositeKey.substring(0, lastDashIndex) : compositeKey;
}

/**
 * Parse comma/space separated symbols into array
 */
export function parseSymbolInput(input: string): string[] {
  return input
    .toUpperCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
