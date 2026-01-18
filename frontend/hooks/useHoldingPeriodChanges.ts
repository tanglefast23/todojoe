/**
 * Hook to calculate holding changes over different time periods
 * Fetches historical prices and calculates % and $ change from period start
 * Dollar changes are calculated from actual purchase date, not period start
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { usePortfolioStore } from "@/stores/portfolioStore";
import type { HoldingWithValue } from "@/types/portfolio";

export type ChangePeriod = "1H" | "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

export interface PeriodChange {
  percent: number;
  dollars: number;
}

export interface HoldingPeriodChanges {
  [symbol: string]: {
    [period in ChangePeriod]?: PeriodChange;
  };
}

// Map our periods to API range parameters
function getApiRange(period: ChangePeriod): string {
  switch (period) {
    case "1H": return "1D"; // Fetch 1D data, take last hour
    case "1D": return "1D";
    case "1W": return "1W";
    case "1M": return "1M";
    case "YTD": return "1Y"; // Fetch 1Y data, filter to YTD
    case "1Y": return "1Y";
    case "ALL": return "5Y"; // Fetch max available data
    default: return "1D";
  }
}

// Get period start date from now
function getPeriodStartDate(period: ChangePeriod): Date {
  const now = new Date();
  switch (period) {
    case "1H":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "1D":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "1W":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1M":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "YTD":
      // Start of current year
      return new Date(now.getFullYear(), 0, 1);
    case "1Y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "ALL":
      // Very old date to capture all history
      return new Date(1970, 0, 1);
    default:
      return now;
  }
}

interface HistoryPoint {
  timestamp: string;
  price?: number;
  close?: number;
}

export function useHoldingPeriodChanges(
  holdings: HoldingWithValue[],
  selectedPeriod: ChangePeriod,
  enabled: boolean = true
) {
  const apiRange = getApiRange(selectedPeriod);

  // Get transactions to find earliest purchase date and price per symbol
  const getActiveTransactions = usePortfolioStore((state) => state.getActiveTransactions);
  const transactions = getActiveTransactions();

  // Build a map of symbol -> earliest buy transaction info (date + price)
  const earliestPurchaseInfo = useMemo(() => {
    const info: Record<string, { date: Date; price: number }> = {};

    transactions.forEach((t) => {
      if (t.type === "buy") {
        const txDate = new Date(t.date);
        if (!info[t.symbol] || txDate < info[t.symbol].date) {
          info[t.symbol] = { date: txDate, price: t.price };
        }
      }
    });

    return info;
  }, [transactions]);

  // Only fetch history for non-1D periods (we already have 1D and 1H data)
  const shouldFetchHistory = selectedPeriod !== "1D" && selectedPeriod !== "1H";

  // Fetch history for each holding when needed
  const historyQueries = useQueries({
    queries: holdings.map((holding) => ({
      queryKey: [holding.assetType, "history", holding.symbol, apiRange, "period-change"],
      queryFn: () =>
        holding.assetType === "stock"
          ? api.getStockHistory(holding.symbol, apiRange)
          : api.getCryptoHistory(holding.symbol, apiRange),
      enabled: enabled && shouldFetchHistory && !!holding.symbol,
      staleTime: 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
    })),
  });

  // Calculate changes for each holding
  const periodChanges = useMemo<HoldingPeriodChanges>(() => {
    const result: HoldingPeriodChanges = {};
    const periodStartDate = getPeriodStartDate(selectedPeriod);

    holdings.forEach((holding, index) => {
      result[holding.symbol] = {};

      const purchaseInfo = earliestPurchaseInfo[holding.symbol];
      const firstPurchaseDate = purchaseInfo?.date;
      const firstPurchasePrice = purchaseInfo?.price;

      // 1H - use hourChangePercent if available, otherwise estimate
      if (selectedPeriod === "1H") {
        if (holding.hourChangePercent !== null) {
          const percentChange = holding.hourChangePercent;
          const dollarsChange = holding.currentValue * (percentChange / 100);
          result[holding.symbol]["1H"] = {
            percent: percentChange,
            dollars: dollarsChange,
          };
        } else {
          // For stocks, hourly change not available
          result[holding.symbol]["1H"] = {
            percent: 0,
            dollars: 0,
          };
        }
      }

      // 1D - use existing dayChange data, but use actual purchase price for dollar calculation
      if (selectedPeriod === "1D") {
        // Calculate dollar change based on actual ownership
        let dollarsChange: number;

        if (firstPurchaseDate && firstPurchasePrice && firstPurchasePrice > 0) {
          // User has a purchase record - use actual purchase price for accurate gain
          dollarsChange = holding.quantity * (holding.currentPrice - firstPurchasePrice);
        } else {
          // No purchase record - fall back to day change
          dollarsChange = holding.dayChange;
        }

        result[holding.symbol]["1D"] = {
          percent: holding.dayChangePercent,
          dollars: dollarsChange,
        };
      }

      // For 1W, 1M, 1Y - calculate from historical data
      if (shouldFetchHistory) {
        const query = historyQueries[index];

        if (query.data && Array.isArray(query.data) && query.data.length > 0) {
          const history = query.data as HistoryPoint[];

          // Sort history chronologically (oldest first)
          const sortedHistory = [...history].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // Check if user bought during this period (after period start)
          const boughtDuringPeriod = firstPurchaseDate && firstPurchaseDate > periodStartDate;

          // Find price at period start (for percentage - market performance)
          let periodStartPrice: number | null = null;
          for (const point of sortedHistory) {
            const price = point.price ?? point.close ?? null;
            if (price !== null && price > 0) {
              periodStartPrice = price;
              break;
            }
          }

          if (periodStartPrice !== null && periodStartPrice > 0) {
            // Percentage shows market movement for the full period
            const percentChange = ((holding.currentPrice - periodStartPrice) / periodStartPrice) * 100;

            // Dollar change is based on when they actually owned the stock
            let dollarsChange: number;

            if (boughtDuringPeriod && firstPurchasePrice && firstPurchasePrice > 0) {
              // User bought during this period - use their ACTUAL purchase price
              // This is more accurate than looking up historical data
              dollarsChange = holding.quantity * (holding.currentPrice - firstPurchasePrice);
            } else {
              // User owned before period start - use price from period start
              dollarsChange = holding.quantity * (holding.currentPrice - periodStartPrice);
            }

            result[holding.symbol][selectedPeriod] = {
              percent: percentChange,
              dollars: dollarsChange,
            };
          }
        }
      }
    });

    return result;
  }, [holdings, historyQueries, selectedPeriod, shouldFetchHistory, earliestPurchaseInfo]);

  const isLoading = shouldFetchHistory && historyQueries.some((q) => q.isLoading);

  return {
    periodChanges,
    isLoading,
    selectedPeriod,
  };
}
