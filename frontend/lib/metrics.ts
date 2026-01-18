/**
 * Financial metrics calculation utilities
 */

import type { HoldingWithValue, AllocationItem } from "@/types/portfolio";
import { percentage } from "@/lib/decimal";

/**
 * Calculate Compound Annual Growth Rate (CAGR)
 * @param startValue - Initial investment value
 * @param endValue - Final value
 * @param years - Number of years
 * @returns CAGR as a percentage
 */
export function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number
): number {
  if (years <= 0 || startValue <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/**
 * Calculate portfolio volatility (annualized standard deviation of returns)
 * @param dailyReturns - Array of daily return percentages
 * @returns Annualized volatility as a percentage
 */
export function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  // Calculate mean return
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // Calculate variance
  const squaredDiffs = dailyReturns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (dailyReturns.length - 1);

  // Calculate daily standard deviation
  const dailyStdDev = Math.sqrt(variance);

  // Annualize (assuming 252 trading days)
  return dailyStdDev * Math.sqrt(252);
}

/**
 * Calculate Sharpe Ratio
 * @param portfolioReturn - Annualized portfolio return (percentage)
 * @param riskFreeRate - Risk-free rate (percentage, default 4.5%)
 * @param volatility - Annualized volatility (percentage)
 * @returns Sharpe ratio
 */
export function calculateSharpeRatio(
  portfolioReturn: number,
  riskFreeRate: number = 4.5,
  volatility: number
): number {
  if (volatility === 0) return 0;
  return (portfolioReturn - riskFreeRate) / volatility;
}

/**
 * Calculate daily returns from price history
 * @param prices - Array of closing prices
 * @returns Array of daily return percentages
 */
export function calculateDailyReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
    returns.push(dailyReturn);
  }
  return returns;
}

/**
 * Calculate allocation breakdown by category/tag
 * @param holdings - Array of holdings with current values
 * @returns Allocation breakdown
 */
export function calculateAllocation(
  holdings: HoldingWithValue[]
): AllocationItem[] {
  if (holdings.length === 0) return [];

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (totalValue === 0) return [];

  // Group by asset type (could be extended to use tags)
  const byType = holdings.reduce(
    (acc, holding) => {
      const type = holding.assetType === "stock" ? "Stocks" : "Crypto";
      acc[type] = (acc[type] || 0) + holding.currentValue;
      return acc;
    },
    {} as Record<string, number>
  );

  const colors: Record<string, string> = {
    Stocks: "#3b82f6",
    Crypto: "#f59e0b",
  };

  return Object.entries(byType).map(([name, value]) => ({
    name,
    value,
    percentage: percentage(value, totalValue),
    color: colors[name] || "#6b7280",
  }));
}

/**
 * Calculate total portfolio gain/loss
 * @param holdings - Array of holdings with values
 * @returns Object with total gain and percentage
 */
export function calculateTotalGain(holdings: HoldingWithValue[]): {
  totalGain: number;
  totalGainPercent: number;
} {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return { totalGain, totalGainPercent };
}

/**
 * Calculate time-weighted return
 * @param values - Array of portfolio values over time
 * @returns Time-weighted return as a percentage
 */
export function calculateTimeWeightedReturn(values: number[]): number {
  if (values.length < 2) return 0;

  let twr = 1;
  for (let i = 1; i < values.length; i++) {
    const periodReturn = values[i] / values[i - 1];
    twr *= periodReturn;
  }

  return (twr - 1) * 100;
}

/**
 * Get years between two dates
 * @param startDate - Start date string
 * @param endDate - End date string (defaults to now)
 * @returns Number of years as a decimal
 */
export function getYearsBetween(startDate: string, endDate?: string): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}
