/**
 * Portfolio utility functions
 * Extracted from portfolioStore.ts for better organization
 */

import type { Transaction, Holding, Account } from "@/types/portfolio";
import { weightedAverage, subtract } from "@/lib/decimal";

/**
 * Generate a UUID using crypto.randomUUID() with fallback
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if a string is a valid UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Calculate holdings from a list of transactions
 * Uses FIFO method for cost basis
 */
export function calculateHoldings(transactions: Transaction[]): Holding[] {
  // Key by symbol+assetType to keep stock and crypto versions of same symbol separate
  const holdingsMap = new Map<string, Holding>();

  // Sort transactions by date
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sortedTransactions) {
    // Use composite key: symbol-assetType (e.g., "BTC-stock" vs "BTC-crypto")
    const holdingKey = `${tx.symbol}-${tx.assetType}`;
    const existing = holdingsMap.get(holdingKey);

    if (!existing) {
      // Create new holding for buy transactions
      if (tx.type === "buy") {
        holdingsMap.set(holdingKey, {
          id: generateId(),
          symbol: tx.symbol,
          name: undefined,
          assetType: tx.assetType,
          quantity: tx.quantity,
          avgCost: tx.price,
          tags: tx.tags,
        });
      }
    } else {
      // Update existing holding
      if (tx.type === "buy") {
        const newQuantity = existing.quantity + tx.quantity;
        // Use decimal.js for precise weighted average cost calculation
        const newAvgCost = weightedAverage(
          existing.avgCost,
          existing.quantity,
          tx.price,
          tx.quantity
        );
        holdingsMap.set(holdingKey, {
          ...existing,
          quantity: newQuantity,
          avgCost: newAvgCost,
          tags: tx.tags || existing.tags,
        });
      } else {
        // Sell - use decimal.js for precise subtraction
        const newQuantity = subtract(existing.quantity, tx.quantity);
        if (newQuantity <= 0) {
          holdingsMap.delete(holdingKey);
        } else {
          holdingsMap.set(holdingKey, {
            ...existing,
            quantity: newQuantity,
          });
        }
      }
    }
  }

  return Array.from(holdingsMap.values());
}

/**
 * Create default accounts for a new portfolio
 */
export function createDefaultAccounts(portfolioId: string): Account[] {
  const now = new Date().toISOString();
  return [
    { id: generateId(), name: "TFSA", portfolioId, createdAt: now },
    { id: generateId(), name: "RRSP", portfolioId, createdAt: now },
    { id: generateId(), name: "Other", portfolioId, createdAt: now },
  ];
}
