/**
 * Hook to calculate P&L (profit/loss) over time for a single asset
 * Properly accounts for:
 * - Only showing data from first purchase date
 * - Tracking actual quantity owned at each point in time
 * - Adjusting cost basis for buys/sells over time
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { AssetType, Transaction } from "@/types/portfolio";
import { add, subtract, multiply, divide } from "@/lib/decimal";

export type PnLTimeRange = "1W" | "1M" | "3M" | "1Y" | "ALL";

export interface AssetPnLDataPoint {
  timestamp: string;
  date: string; // Formatted date for display
  pnl: number; // P&L in dollars
  value: number; // Total value at this point
  quantity: number; // Quantity owned at this point
  costBasis: number; // Cost basis at this point
}

// Map our time ranges to API ranges
function getApiRange(range: PnLTimeRange): string {
  switch (range) {
    case "1W": return "1W";
    case "1M": return "1M";
    case "3M": return "3M";
    case "1Y": return "1Y";
    case "ALL": return "1Y"; // Max we can get from most APIs
    default: return "1M";
  }
}

// Format date for display based on time range
function formatDateForRange(date: Date, range: PnLTimeRange): string {
  if (range === "1W") {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface HistoryPoint {
  timestamp: string;
  price?: number;
  close?: number;
}

/**
 * Builds a position timeline from transactions
 * Returns a map of date -> { quantity, costBasis }
 */
function buildPositionTimeline(
  transactions: Transaction[],
  symbol: string,
  assetType: AssetType
): Map<string, { quantity: number; costBasis: number }> {
  // Filter transactions for this asset and sort by date
  const assetTxs = transactions
    .filter((t) => t.symbol === symbol && t.assetType === assetType)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const timeline = new Map<string, { quantity: number; costBasis: number }>();

  let runningQuantity = 0;
  let runningCostBasis = 0;

  for (const tx of assetTxs) {
    const dateKey = tx.date.split("T")[0]; // YYYY-MM-DD

    if (tx.type === "buy") {
      runningQuantity = add(runningQuantity, tx.quantity);
      runningCostBasis = add(runningCostBasis, multiply(tx.quantity, tx.price));
    } else if (tx.type === "sell") {
      // For sells, reduce cost basis proportionally
      if (runningQuantity > 0) {
        const avgCost = divide(runningCostBasis, runningQuantity);
        runningQuantity = subtract(runningQuantity, tx.quantity);
        runningCostBasis = multiply(runningQuantity, avgCost);
      }
    }

    timeline.set(dateKey, {
      quantity: Math.max(0, runningQuantity),
      costBasis: Math.max(0, runningCostBasis),
    });
  }

  return timeline;
}

/**
 * Gets the position (quantity, costBasis) for a given date
 * Returns the most recent position on or before that date
 */
function getPositionAtDate(
  timeline: Map<string, { quantity: number; costBasis: number }>,
  firstDate: string,
  targetDate: string
): { quantity: number; costBasis: number } | null {
  // If target date is before first purchase, return null
  if (targetDate < firstDate) {
    return null;
  }

  // Find the most recent position on or before targetDate
  let lastPosition: { quantity: number; costBasis: number } | null = null;

  for (const [date, position] of timeline) {
    if (date <= targetDate) {
      lastPosition = position;
    } else {
      break; // Timeline is sorted, so we can stop
    }
  }

  return lastPosition;
}

export function useAssetPnL(
  symbol: string,
  assetType: AssetType,
  transactions: Transaction[],
  range: PnLTimeRange,
  enabled: boolean = true
) {
  const apiRange = getApiRange(range);

  // Build position timeline from transactions
  const { positionTimeline, firstPurchaseDate } = useMemo(() => {
    const timeline = buildPositionTimeline(transactions, symbol, assetType);
    const dates = Array.from(timeline.keys()).sort();
    return {
      positionTimeline: timeline,
      firstPurchaseDate: dates.length > 0 ? dates[0] : null,
    };
  }, [transactions, symbol, assetType]);

  // Fetch history for the asset
  const historyQuery = useQuery<HistoryPoint[]>({
    queryKey: [assetType, "history", symbol, apiRange],
    queryFn: async () => {
      const data = assetType === "stock"
        ? await api.getStockHistory(symbol, apiRange)
        : await api.getCryptoHistory(symbol, apiRange);
      // Normalize the response to HistoryPoint format
      return data.map((item) => ({
        timestamp: item.timestamp,
        price: "price" in item ? (item as { price: number }).price : undefined,
        close: "close" in item ? (item as { close: number }).close : undefined,
      }));
    },
    enabled: enabled && !!symbol && !!firstPurchaseDate,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Process the data - only include dates from first purchase onward
  const { data, isLoading, hasData } = useMemo(() => {
    if (historyQuery.isLoading || !firstPurchaseDate) {
      return { data: [], isLoading: historyQuery.isLoading, hasData: false };
    }

    if (!historyQuery.data || historyQuery.data.length === 0) {
      return { data: [], isLoading: false, hasData: false };
    }

    // Convert history to P&L data points, only including dates from first purchase
    const pnlData: AssetPnLDataPoint[] = [];

    for (const point of historyQuery.data) {
      const pointDate = new Date(point.timestamp);
      const dateKey = pointDate.toISOString().split("T")[0];

      // Skip dates before first purchase
      const position = getPositionAtDate(positionTimeline, firstPurchaseDate, dateKey);
      if (!position || position.quantity === 0) {
        continue;
      }

      const price = point.price ?? point.close ?? 0;
      const value = position.quantity * price;
      const pnl = value - position.costBasis;

      pnlData.push({
        timestamp: point.timestamp,
        date: formatDateForRange(pointDate, range),
        pnl,
        value,
        quantity: position.quantity,
        costBasis: position.costBasis,
      });
    }

    // Sort chronologically
    pnlData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      data: pnlData,
      isLoading: false,
      hasData: pnlData.length > 0,
    };
  }, [historyQuery.isLoading, historyQuery.data, positionTimeline, firstPurchaseDate, range]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (data.length < 2) {
      return {
        startPnL: 0,
        endPnL: data.length === 1 ? data[0].pnl : 0,
        change: 0,
        high: 0,
        low: 0,
      };
    }

    const startPnL = data[0].pnl;
    const endPnL = data[data.length - 1].pnl;
    const change = endPnL - startPnL;
    const pnlValues = data.map((d) => d.pnl);
    const high = Math.max(...pnlValues);
    const low = Math.min(...pnlValues);

    return { startPnL, endPnL, change, high, low };
  }, [data]);

  return {
    data,
    isLoading,
    hasData,
    summary,
    firstPurchaseDate,
  };
}
