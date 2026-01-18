/**
 * Asset Detail Statistics Calculation Utility
 * Computes comprehensive stats for individual asset positions
 */

import type {
  Transaction,
  Account,
  AssetType,
  AssetDetailStats,
  AccountHolding,
  TransactionStats,
  FunStats,
  TaxLot,
} from "@/types/portfolio";
import Decimal from "decimal.js";
import {
  multiply,
  divide,
  add,
  subtract,
  sum,
  percentage,
  round,
} from "@/lib/decimal";
import { calculateCAGR, getYearsBetween } from "@/lib/metrics";

/**
 * Decimal-safe minimum of two numbers
 * Avoids floating-point comparison issues in FIFO calculations
 */
function decimalMin(a: number, b: number): number {
  return new Decimal(a).lessThanOrEqualTo(b) ? a : b;
}

const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Calculate days between two dates
 */
function daysBetween(startDate: string, endDate?: string): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a transaction is held long-term (>= 1 year)
 */
function isLongTerm(purchaseDate: string): boolean {
  const purchase = new Date(purchaseDate);
  const now = new Date();
  return now.getTime() - purchase.getTime() >= ONE_YEAR_MS;
}

/**
 * Calculate FIFO tax lots from transactions
 * Returns remaining lots after matching sells to buys
 */
function calculateTaxLots(
  transactions: Transaction[],
  currentPrice: number
): TaxLot[] {
  // Sort by date ascending for FIFO
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Build buy lots
  const lots: Array<{
    date: string;
    quantity: number;
    price: number;
    remaining: number;
  }> = [];

  for (const tx of sorted) {
    if (tx.type === "buy") {
      lots.push({
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        remaining: tx.quantity,
      });
    } else {
      // Sell - reduce from earliest lots (FIFO)
      let toSell = tx.quantity;
      for (const lot of lots) {
        if (toSell <= 0) break;
        if (lot.remaining <= 0) continue;

        const sellFromLot = decimalMin(lot.remaining, toSell);
        lot.remaining = subtract(lot.remaining, sellFromLot);
        toSell = subtract(toSell, sellFromLot);
      }
    }
  }

  // Convert remaining lots to TaxLot format
  return lots
    .filter((lot) => lot.remaining > 0)
    .map((lot) => {
      const costBasis = multiply(lot.remaining, lot.price);
      const currentValue = multiply(lot.remaining, currentPrice);
      const gain = subtract(currentValue, costBasis);
      const daysHeld = daysBetween(lot.date);

      return {
        purchaseDate: lot.date,
        quantity: round(lot.remaining, 8),
        purchasePrice: lot.price,
        costBasis: round(costBasis, 2),
        currentValue: round(currentValue, 2),
        gain: round(gain, 2),
        gainPercent: costBasis > 0 ? round(percentage(gain, costBasis), 2) : 0,
        holdingPeriod: isLongTerm(lot.date) ? "long" : "short",
        daysHeld,
      };
    });
}

/**
 * Calculate account breakdown for a symbol
 */
function calculateAccountBreakdown(
  transactions: Transaction[],
  accounts: Account[],
  currentPrice: number
): AccountHolding[] {
  // Group by account
  const byAccount: Record<string, number> = {};

  for (const tx of transactions) {
    const qty = tx.type === "buy" ? tx.quantity : -tx.quantity;
    byAccount[tx.accountId] = add(byAccount[tx.accountId] || 0, qty);
  }

  // Convert to AccountHolding format
  return Object.entries(byAccount)
    .filter(([_, qty]) => qty > 0)
    .map(([accountId, quantity]) => {
      const account = accounts.find((a) => a.id === accountId);
      return {
        accountId,
        accountName: account?.name || "Unknown",
        quantity: round(quantity, 8),
        value: round(multiply(quantity, currentPrice), 2),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/**
 * Find the largest purchase transaction
 */
function findLargestPurchase(
  transactions: Transaction[]
): TransactionStats | null {
  const buys = transactions.filter((tx) => tx.type === "buy");
  if (buys.length === 0) return null;

  const largest = buys.reduce((max, tx) => {
    const value = multiply(tx.quantity, tx.price);
    const maxValue = multiply(max.quantity, max.price);
    return value > maxValue ? tx : max;
  });

  return {
    id: largest.id,
    date: largest.date,
    type: largest.type,
    quantity: largest.quantity,
    price: largest.price,
    value: round(multiply(largest.quantity, largest.price), 2),
  };
}

/**
 * Find best and worst trades based on current gain %
 */
function findBestWorstTrades(
  transactions: Transaction[],
  currentPrice: number
): { best: TransactionStats | null; worst: TransactionStats | null } {
  const buys = transactions.filter((tx) => tx.type === "buy");
  if (buys.length === 0) return { best: null, worst: null };

  const withGains = buys.map((tx) => {
    // Return undefined for free acquisitions (airdrops, gifts) where gain % is undefined
    const gainPercent =
      tx.price > 0 ? round(percentage(subtract(currentPrice, tx.price), tx.price), 2) : undefined;
    return {
      id: tx.id,
      date: tx.date,
      type: tx.type as "buy" | "sell",
      quantity: tx.quantity,
      price: tx.price,
      value: round(multiply(tx.quantity, tx.price), 2),
      gainPercent,
    };
  });

  const sorted = [...withGains].sort((a, b) => (b.gainPercent ?? 0) - (a.gainPercent ?? 0));

  return {
    best: sorted[0] || null,
    worst: sorted[sorted.length - 1] || null,
  };
}

/**
 * Calculate fun/motivational statistics
 */
function calculateFunStats(
  transactions: Transaction[],
  currentPrice: number,
  taxLots: TaxLot[]
): FunStats {
  const buys = transactions.filter((tx) => tx.type === "buy");

  // Win rate: % of buys currently in profit
  const profitableBuys = buys.filter((tx) => currentPrice > tx.price);
  const winRate = buys.length > 0 ? percentage(profitableBuys.length, buys.length) : 0;

  // Patience earned: total gain from long-term positions
  const longTermLots = taxLots.filter((lot) => lot.holdingPeriod === "long");
  const patienceEarned = sum(longTermLots.map((lot) => Math.max(0, lot.gain)));

  // Current streak: consecutive profitable trades (most recent first)
  const sortedBuys = [...buys].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  let currentStreak = 0;
  for (const tx of sortedBuys) {
    if (currentPrice > tx.price) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    patienceEarned: round(patienceEarned, 2),
    winRate: round(winRate, 1),
    winningTrades: profitableBuys.length,
    totalTrades: buys.length,
    currentStreak,
  };
}

/**
 * Calculate DCA effectiveness vs lump sum
 * Returns % difference (positive = DCA was better)
 */
function calculateDCAEffectiveness(
  transactions: Transaction[],
  currentPrice: number
): number | null {
  const buys = transactions.filter((tx) => tx.type === "buy");
  if (buys.length < 2) return null; // Need multiple purchases for DCA comparison

  // Actual DCA result
  const totalInvested = sum(buys.map((tx) => multiply(tx.quantity, tx.price)));
  const totalShares = sum(buys.map((tx) => tx.quantity));
  const avgCost = divide(totalInvested, totalShares);

  // Lump sum scenario: invested everything at first purchase price
  const firstBuyPrice = [...buys].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0].price;

  // If lump sum, how many shares could we have bought?
  const lumpSumShares = divide(totalInvested, firstBuyPrice);
  const lumpSumValue = multiply(lumpSumShares, currentPrice);
  const dcaValue = multiply(totalShares, currentPrice);

  // % difference (positive = DCA better)
  if (lumpSumValue === 0) return null;
  return round(percentage(subtract(dcaValue, lumpSumValue), lumpSumValue), 2);
}

/**
 * Main function: Calculate all asset detail statistics
 */
export function calculateAssetDetailStats(
  symbol: string,
  assetType: AssetType,
  transactions: Transaction[],
  accounts: Account[],
  currentPrice: number,
  totalPortfolioValue: number,
  assetName?: string
): AssetDetailStats {
  // Filter transactions for this symbol
  const symbolTxs = transactions.filter(
    (tx) => tx.symbol === symbol && tx.assetType === assetType
  );

  const buys = symbolTxs.filter((tx) => tx.type === "buy");
  const sells = symbolTxs.filter((tx) => tx.type === "sell");

  // Sort by date for date-related stats
  const sortedByDate = [...buys].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstPurchaseDate = sortedByDate[0]?.date || "";
  const mostRecentPurchaseDate = sortedByDate[sortedByDate.length - 1]?.date || "";

  // Calculate tax lots (FIFO)
  const taxLots = calculateTaxLots(symbolTxs, currentPrice);

  // Total shares from remaining lots
  const totalShares = sum(taxLots.map((lot) => lot.quantity));

  // Total invested (cost basis)
  const totalInvested = sum(taxLots.map((lot) => lot.costBasis));

  // Average buy-in price
  const avgBuyInPrice = totalShares > 0 ? divide(totalInvested, totalShares) : 0;

  // Current value
  const currentValue = multiply(totalShares, currentPrice);

  // Total gain
  const totalGain = subtract(currentValue, totalInvested);
  const totalGainPercent = totalInvested > 0 ? percentage(totalGain, totalInvested) : 0;

  // Days held
  const daysHeld = firstPurchaseDate ? daysBetween(firstPurchaseDate) : 0;

  // Account breakdown
  const accountBreakdown = calculateAccountBreakdown(symbolTxs, accounts, currentPrice);

  // Largest purchase
  const largestPurchase = findLargestPurchase(symbolTxs);

  // Best/worst trades
  const { best: bestTrade, worst: worstTrade } = findBestWorstTrades(symbolTxs, currentPrice);

  // Fun stats
  const funStats = calculateFunStats(symbolTxs, currentPrice, taxLots);

  // --- Pro Mode Stats ---

  // CAGR
  const years = firstPurchaseDate ? getYearsBetween(firstPurchaseDate) : 0;
  const cagr = years > 0 ? calculateCAGR(totalInvested, currentValue, years) : 0;

  // Volatility - simplified estimate based on price vs avg cost
  // (Real volatility would need historical price data)
  const volatility = avgBuyInPrice > 0
    ? Math.abs(percentage(subtract(currentPrice, avgBuyInPrice), avgBuyInPrice))
    : 0;

  // Short-term vs long-term gains
  const shortTermLots = taxLots.filter((lot) => lot.holdingPeriod === "short");
  const longTermLots = taxLots.filter((lot) => lot.holdingPeriod === "long");
  const unrealizedShortTermGain = sum(shortTermLots.map((lot) => lot.gain));
  const unrealizedLongTermGain = sum(longTermLots.map((lot) => lot.gain));

  // Break-even price (only if losing money)
  const breakEvenPrice = totalGain < 0 ? round(avgBuyInPrice, 2) : null;

  // Price to 2x
  const priceTo2x = round(multiply(avgBuyInPrice, 2), 2);

  // DCA effectiveness
  const dcaEffectiveness = calculateDCAEffectiveness(symbolTxs, currentPrice);

  // Position concentration
  const positionConcentration =
    totalPortfolioValue > 0 ? percentage(currentValue, totalPortfolioValue) : 0;

  return {
    // Basic info
    symbol,
    assetType,
    name: assetName,

    // Simple mode stats
    avgBuyInPrice: round(avgBuyInPrice, assetType === "crypto" ? 8 : 2),
    firstPurchaseDate,
    mostRecentPurchaseDate,
    daysHeld,
    totalShares: round(totalShares, 8),
    totalInvested: round(totalInvested, 2),
    currentPrice,
    currentValue: round(currentValue, 2),
    totalGain: round(totalGain, 2),
    totalGainPercent: round(totalGainPercent, 2),
    transactionCount: symbolTxs.length,
    buyCount: buys.length,
    sellCount: sells.length,
    accountBreakdown,
    largestPurchase,
    bestTrade,
    worstTrade,
    funStats,

    // Pro mode stats
    cagr: round(cagr, 2),
    volatility: round(volatility, 2),
    unrealizedShortTermGain: round(unrealizedShortTermGain, 2),
    unrealizedLongTermGain: round(unrealizedLongTermGain, 2),
    breakEvenPrice,
    priceTo2x,
    dcaEffectiveness,
    positionConcentration: round(positionConcentration, 2),
    taxLots,
  };
}
