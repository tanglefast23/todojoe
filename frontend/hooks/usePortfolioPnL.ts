/**
 * Hook to calculate portfolio P&L (profit/loss) over time
 * Fetches historical prices for all holdings and calculates daily P&L
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { HoldingWithValue } from "@/types/portfolio";

export type PnLTimeRange = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

export interface PnLDataPoint {
  timestamp: string;
  date: string; // Formatted date for display
  pnl: number; // P&L in dollars
  value: number; // Total portfolio value at this point
}

interface HistoryPoint {
  timestamp: string;
  price: number;
}

// Map our time ranges to API ranges
function getApiRange(range: PnLTimeRange): string {
  switch (range) {
    case "1D": return "1D";
    case "1W": return "1W";
    case "1M": return "1M";
    case "YTD": return "1Y"; // Fetch 1Y and filter to YTD
    case "1Y": return "1Y";
    case "ALL": return "1Y"; // Max we can get from most APIs
    default: return "1M";
  }
}

// Filter data points to match the requested time range
function filterToRange(data: PnLDataPoint[], range: PnLTimeRange): PnLDataPoint[] {
  if (data.length === 0) return data;

  const now = new Date();
  let cutoffDate: Date;

  switch (range) {
    case "1D":
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "1W":
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1M":
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "YTD":
      cutoffDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      break;
    case "1Y":
      cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "ALL":
    default:
      return data; // Return all data
  }

  return data.filter(point => new Date(point.timestamp) >= cutoffDate);
}

// Format date for display based on time range
function formatDateForRange(date: Date, range: PnLTimeRange): string {
  if (range === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (range === "1W") {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function usePortfolioPnL(
  holdings: HoldingWithValue[],
  range: PnLTimeRange,
  enabled: boolean = true
) {
  const apiRange = getApiRange(range);

  // Fetch history for each holding
  const historyQueries = useQueries({
    queries: holdings.map((holding) => ({
      queryKey: [holding.assetType, "history", holding.symbol, apiRange],
      queryFn: () =>
        holding.assetType === "stock"
          ? api.getStockHistory(holding.symbol, apiRange)
          : api.getCryptoHistory(holding.symbol, apiRange),
      enabled: enabled && !!holding.symbol,
      staleTime: 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
    })),
  });

  // Calculate total cost basis (this is fixed)
  const totalCostBasis = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0);
  }, [holdings]);

  // Process the data
  const { data, isLoading, hasData } = useMemo(() => {
    const isLoading = historyQueries.some((q) => q.isLoading);
    const allSettled = historyQueries.every((q) => !q.isLoading);

    if (!allSettled || holdings.length === 0) {
      return { data: [], isLoading, hasData: false };
    }

    // Collect all history data
    const holdingHistories: { holding: HoldingWithValue; history: HistoryPoint[] }[] = [];

    for (let i = 0; i < holdings.length; i++) {
      const result = historyQueries[i];
      if (result.data && Array.isArray(result.data)) {
        holdingHistories.push({
          holding: holdings[i],
          history: result.data.map((point: { timestamp: string; price?: number; close?: number }) => ({
            timestamp: point.timestamp,
            price: point.price ?? point.close ?? 0,
          })),
        });
      }
    }

    if (holdingHistories.length === 0) {
      return { data: [], isLoading: false, hasData: false };
    }

    // Find all unique timestamps across all holdings
    const timestampSet = new Set<string>();
    holdingHistories.forEach(({ history }) => {
      history.forEach((point) => timestampSet.add(point.timestamp));
    });

    // Sort timestamps chronologically
    const timestamps = Array.from(timestampSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    // For each timestamp, calculate total portfolio value and P&L
    const pnlData: PnLDataPoint[] = timestamps.map((timestamp) => {
      let totalValue = 0;

      holdingHistories.forEach(({ holding, history }) => {
        // Find the closest price for this timestamp (or earlier)
        const ts = new Date(timestamp).getTime();
        let closestPrice = holding.currentPrice; // Default to current

        for (let i = history.length - 1; i >= 0; i--) {
          if (new Date(history[i].timestamp).getTime() <= ts) {
            closestPrice = history[i].price;
            break;
          }
        }

        // If no earlier price found, use first available
        if (closestPrice === holding.currentPrice && history.length > 0) {
          closestPrice = history[0].price;
        }

        totalValue += holding.quantity * closestPrice;
      });

      const pnl = totalValue - totalCostBasis;
      const date = new Date(timestamp);

      return {
        timestamp,
        date: formatDateForRange(date, range),
        pnl,
        value: totalValue,
      };
    });

    // Filter to the requested range
    const filteredData = filterToRange(pnlData, range);

    return {
      data: filteredData,
      isLoading: false,
      hasData: filteredData.length > 0,
    };
  }, [historyQueries, holdings, totalCostBasis, range]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (data.length < 2) {
      return {
        startPnL: 0,
        endPnL: 0,
        change: 0,
        changePercent: null,
        high: 0,
        low: 0,
      };
    }

    const startPnL = data[0].pnl;
    const endPnL = data[data.length - 1].pnl;
    const change = endPnL - startPnL;
    // Use cost basis as denominator for meaningful percentage
    // If totalCostBasis is 0, percentage is undefined (return null)
    const changePercent = totalCostBasis > 0 ? (change / totalCostBasis) * 100 : null;
    const pnlValues = data.map((d) => d.pnl);
    const high = Math.max(...pnlValues);
    const low = Math.min(...pnlValues);

    return { startPnL, endPnL, change, changePercent, high, low };
  }, [data]);

  return {
    data,
    isLoading,
    hasData,
    summary,
    totalCostBasis,
  };
}
