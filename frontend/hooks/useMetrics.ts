/**
 * Hook for calculating portfolio metrics (CAGR, Volatility, Sharpe Ratio)
 */

import { useMemo } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  calculateCAGR,
  calculateVolatility,
  calculateSharpeRatio,
  calculateAllocation,
  getYearsBetween,
} from "@/lib/metrics";
import type { HoldingWithValue, PortfolioMetrics } from "@/types/portfolio";

interface UseMetricsResult {
  metrics: PortfolioMetrics;
  isCalculating: boolean;
}

export function useMetrics(holdings: HoldingWithValue[]): UseMetricsResult {
  const { transactions } = usePortfolioStore();
  const { riskFreeRate } = useSettingsStore();

  const metrics = useMemo<PortfolioMetrics>(() => {
    // Default empty metrics
    const emptyMetrics: PortfolioMetrics = {
      cagr: 0,
      volatility: 0,
      sharpeRatio: 0,
      allocation: [],
    };

    if (holdings.length === 0 || transactions.length === 0) {
      return emptyMetrics;
    }

    // Calculate allocation
    const allocation = calculateAllocation(holdings);

    // Find the earliest transaction date
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const earliestDate = sortedTransactions[0]?.date;

    if (!earliestDate) {
      return { ...emptyMetrics, allocation };
    }

    // Calculate years since first investment
    const years = getYearsBetween(earliestDate);

    // If less than a week, not enough data for meaningful metrics
    if (years < 0.02) {
      return { ...emptyMetrics, allocation };
    }

    // Calculate total cost and current value
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    // Calculate CAGR
    const cagr = calculateCAGR(totalCost, totalValue, years);

    // For volatility, we'd need historical daily returns
    // Since we don't have that data readily available, we'll estimate
    // based on the current day's portfolio change as a proxy
    const dailyReturns = holdings.map((h) => h.dayChangePercent);
    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

    // Estimate volatility (this is simplified - real volatility needs historical data)
    // We'll use the spread of daily returns as a rough estimate
    const returnVariance = dailyReturns.reduce(
      (sum, r) => sum + Math.pow(r - avgDailyReturn, 2),
      0
    ) / Math.max(dailyReturns.length - 1, 1);
    const estimatedDailyVol = Math.sqrt(returnVariance);
    const volatility = estimatedDailyVol * Math.sqrt(252); // Annualize

    // Calculate Sharpe Ratio
    const annualizedReturn = cagr;
    const sharpeRatio = calculateSharpeRatio(annualizedReturn, riskFreeRate, volatility);

    return {
      cagr,
      volatility,
      sharpeRatio,
      allocation,
    };
  }, [holdings, transactions, riskFreeRate]);

  return {
    metrics,
    isCalculating: false,
  };
}
