/**
 * Asset type utilities
 * Centralized crypto symbol detection and asset type helpers
 */

import type { AssetType } from "@/types/portfolio";

/**
 * Common cryptocurrency symbols for auto-detection
 * When user enters a symbol without specifying type, we check this list
 */
export const CRYPTO_SYMBOLS = new Set([
  // Major cryptocurrencies
  "BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "DOT",
  "MATIC", "LINK", "UNI", "ATOM", "LTC", "BCH", "SHIB", "BNB",
  // Layer 2 & Alt L1s
  "ARB", "OP", "APT", "SUI", "SEI", "INJ", "TIA", "NEAR", "FTM",
  // Other majors
  "ALGO", "XLM", "VET", "HBAR", "ICP", "FIL", "TRX", "ENA", "ZEC",
  // DeFi
  "AAVE", "MKR", "SNX", "CRV", "COMP", "YFI", "SUSHI", "CAKE",
  "1INCH", "BAL", "LDO", "RPL", "GMX", "AERO",
  // Meme coins
  "PEPE", "WIF", "BONK", "FLOKI",
  // AI & Metaverse
  "WLD", "RENDER", "FET", "RNDR", "GRT", "SAND", "MANA", "AXS", "ENS",
]);

/**
 * Check if a symbol is a known cryptocurrency
 */
export function isCryptoSymbol(symbol: string): boolean {
  return CRYPTO_SYMBOLS.has(symbol.toUpperCase());
}

/**
 * Detect asset type from symbol
 * Returns "crypto" if symbol is in known crypto list, otherwise "stock"
 */
export function detectAssetType(symbol: string): AssetType {
  return isCryptoSymbol(symbol) ? "crypto" : "stock";
}

/**
 * Parse a composite symbol key like "BTC-crypto" or "AAPL-stock"
 * Returns { symbol, assetType }
 * Falls back to auto-detection if no valid suffix (matches desktop behavior)
 */
export function parseSymbolKey(symbolKey: string): { symbol: string; assetType: AssetType } {
  const upper = symbolKey.toUpperCase();
  const lastDashIndex = upper.lastIndexOf("-");

  if (lastDashIndex > 0) {
    const suffix = upper.substring(lastDashIndex + 1);
    if (suffix === "STOCK" || suffix === "CRYPTO") {
      return {
        symbol: upper.substring(0, lastDashIndex),
        assetType: suffix.toLowerCase() as AssetType,
      };
    }
  }

  // Auto-detect based on known crypto symbols (matches desktop WatchlistWidget behavior)
  return { symbol: upper, assetType: isCryptoSymbol(upper) ? "crypto" : "stock" };
}

/**
 * Create a composite symbol key like "BTC-crypto"
 */
export function createSymbolKey(symbol: string, assetType: AssetType): string {
  return `${symbol.toUpperCase()}-${assetType}`;
}

/**
 * Separate an array of symbol keys into stocks and crypto
 * Useful for batch API calls
 */
export function separateByAssetType(
  symbolKeys: string[],
  symbolTypes: Record<string, AssetType | "both">
): { stockSymbols: string[]; cryptoSymbols: string[] } {
  const stocks: string[] = [];
  const crypto: string[] = [];

  for (const key of symbolKeys) {
    const { symbol } = parseSymbolKey(key);
    const assetType = symbolTypes[key];

    if (assetType === "crypto") {
      crypto.push(symbol);
    } else {
      stocks.push(symbol);
    }
  }

  return { stockSymbols: stocks, cryptoSymbols: crypto };
}

/**
 * Format quantity based on asset type
 * Crypto uses more decimal places
 */
export function formatQuantityStep(assetType: AssetType): string {
  return assetType === "crypto" ? "0.00000001" : "1";
}

/**
 * Get display label for asset type
 */
export function getAssetTypeLabel(assetType: AssetType): string {
  return assetType === "crypto" ? "Crypto" : "Stock";
}
