/**
 * Portfolio hook that combines holdings with live price data
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useBatchStockQuotes, useBatchCryptoQuotes } from "@/hooks/useAssetData";
import type { Holding, HoldingWithValue, PortfolioSummary } from "@/types/portfolio";
import {
  multiply,
  subtract,
  sum,
  percentage,
} from "@/lib/decimal";

interface UsePortfolioResult {
  holdings: HoldingWithValue[];
  summary: PortfolioSummary;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function usePortfolio(): UsePortfolioResult {
  // Subscribe to transactions to trigger re-render when they change
  // (getActiveHoldings is a function that derives from transactions)
  const transactions = usePortfolioStore((state) => state.transactions);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const getActiveHoldings = usePortfolioStore((state) => state.getActiveHoldings);

  // Memoize holdings calculation - only recalculate when transactions or portfolio changes
  const holdings = useMemo(
    () => getActiveHoldings(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, activePortfolioId]
  );

  // Get symbol tags function - stable reference from store
  const getSymbolTags = usePortfolioStore((state) => state.getSymbolTags);

  // Subscribe to symbolTags to trigger re-render when tags change
  const symbolTags = usePortfolioStore((state) => state.symbolTags);

  // Separate stocks and crypto symbols (memoized to prevent unnecessary refetches)
  const stockSymbols = useMemo(
    () => holdings.filter((h) => h.assetType === "stock").map((h) => h.symbol),
    [holdings]
  );
  const cryptoSymbols = useMemo(
    () => holdings.filter((h) => h.assetType === "crypto").map((h) => h.symbol),
    [holdings]
  );

  // Use centralized batch hooks - TanStack Query will deduplicate across components
  const stockBatchQuery = useBatchStockQuotes(stockSymbols, stockSymbols.length > 0);
  const cryptoBatchQuery = useBatchCryptoQuotes(cryptoSymbols, cryptoSymbols.length > 0);

  // Build price map from batch responses
  const priceMap = useMemo(() => {
    const map = new Map<string, { price: number; change: number; changePercent: number; changePercent1h: number | null; name?: string }>();

    // Process batch stock quotes (no 1h data available for stocks)
    if (stockBatchQuery.data) {
      for (const quote of stockBatchQuery.data) {
        map.set(quote.symbol, {
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          changePercent1h: null, // Not available for stocks
          name: quote.name || undefined,
        });
      }
    }

    // Process batch crypto quotes (1h data available from CoinGecko)
    if (cryptoBatchQuery.data) {
      for (const quote of cryptoBatchQuery.data) {
        map.set(quote.symbol, {
          price: quote.price,
          change: quote.change24h,
          changePercent: quote.changePercent24h,
          changePercent1h: quote.changePercent1h,
          name: quote.name,
        });
      }
    }

    return map;
  }, [stockBatchQuery.data, cryptoBatchQuery.data]);

  // Calculate holdings with values
  const holdingsWithValues: HoldingWithValue[] = useMemo(() => {
    // Calculate total value using decimal precision
    const totalValue = sum(
      holdings.map((h) => {
        const priceData = priceMap.get(h.symbol);
        const price = priceData?.price || 0;
        return multiply(h.quantity, price);
      })
    );

    return holdings.map((holding) => {
      const priceData = priceMap.get(holding.symbol);
      // Track if price is actually available vs defaulting to 0 on API failure
      const priceAvailable = priceData !== undefined && priceData.price !== undefined;
      const currentPrice = priceData?.price || 0;
      // Use decimal.js for precise calculations
      const currentValue = multiply(holding.quantity, currentPrice);
      const costBasis = multiply(holding.quantity, holding.avgCost);
      const gain = subtract(currentValue, costBasis);
      const gainPercent = percentage(gain, costBasis);
      const hourChangePercent = priceData?.changePercent1h ?? null;
      const dayChange = multiply(priceData?.change || 0, holding.quantity);
      const dayChangePercent = priceData?.changePercent || 0;
      const allocation = percentage(currentValue, totalValue);

      // Get tags from symbolTags store
      const tags = getSymbolTags(holding.symbol, holding.assetType);

      return {
        ...holding,
        name: priceData?.name || holding.name,
        currentPrice,
        currentValue,
        costBasis,
        gain,
        gainPercent,
        hourChangePercent,
        dayChange,
        dayChangePercent,
        allocation,
        priceAvailable,
        tags: tags.length > 0 ? tags : undefined,
      };
    });
  }, [holdings, priceMap, getSymbolTags, symbolTags]);

  // Get cost basis override for current portfolio
  const getCostBasisOverride = usePortfolioStore((state) => state.getCostBasisOverride);
  const costBasisOverride = getCostBasisOverride(activePortfolioId);

  // Calculate summary using decimal.js for precision
  const summary: PortfolioSummary = useMemo(() => {
    const totalValue = sum(holdingsWithValues.map((h) => h.currentValue));
    const calculatedCost = sum(holdingsWithValues.map((h) => h.costBasis));
    // Use override if set, otherwise use calculated cost
    const totalCost = costBasisOverride !== null ? costBasisOverride : calculatedCost;
    const totalGain = subtract(totalValue, totalCost);
    const totalGainPercent = percentage(totalGain, totalCost);
    const dayChange = sum(holdingsWithValues.map((h) => h.dayChange));
    // Calculate day change percent based on previous day's value (totalValue - dayChange)
    // Guard against division by zero when dayChange equals totalValue
    const previousValue = subtract(totalValue, dayChange);
    const dayChangePercent = percentage(dayChange, previousValue);

    return {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      dayChange,
      dayChangePercent,
      holdings: holdingsWithValues,
      costBasisOverridden: costBasisOverride !== null,
    };
  }, [holdingsWithValues, costBasisOverride]);

  const isLoading = stockBatchQuery.isLoading || cryptoBatchQuery.isLoading;
  const isError = stockBatchQuery.isError || cryptoBatchQuery.isError;

  const refetch = () => {
    stockBatchQuery.refetch();
    cryptoBatchQuery.refetch();
  };

  return {
    holdings: holdingsWithValues,
    summary,
    isLoading,
    isError,
    refetch,
  };
}
