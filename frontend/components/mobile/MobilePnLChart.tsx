"use client";

/**
 * Mobile P&L Chart Component
 * Displays portfolio profit/loss over time with time range selection
 */

import { useMemo, memo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { usePortfolioPnL, type PnLTimeRange, type PnLDataPoint } from "@/hooks/usePortfolioPnL";
import { useFormatters } from "@/hooks/useFormatters";
import type { HoldingWithValue } from "@/types/portfolio";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

import type { ChangePeriod } from "@/hooks/useHoldingPeriodChanges";

// Period buttons with pastel colors matching MobilePortfolioView
const TIME_RANGES: { value: ChangePeriod; label: string; color: string }[] = [
  { value: "1H", label: "1H", color: "bg-pink-200 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300" },
  { value: "1D", label: "1D", color: "bg-orange-200 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300" },
  { value: "1W", label: "1W", color: "bg-yellow-200 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300" },
  { value: "1M", label: "1M", color: "bg-green-200 dark:bg-green-900/50 text-green-700 dark:text-green-300" },
  { value: "YTD", label: "YTD", color: "bg-teal-200 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300" },
  { value: "1Y", label: "1Y", color: "bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" },
  { value: "ALL", label: "ALL", color: "bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300" },
];

// Map ChangePeriod to PnLTimeRange (1H is not supported for P&L chart)
function toPnLRange(period: ChangePeriod): PnLTimeRange {
  if (period === "1H") return "1D"; // Fall back to 1D for chart data
  return period;
}

/** Custom tooltip for the P&L chart */
function PnLTooltip({
  active,
  payload,
  formatCurrency,
}: {
  active?: boolean;
  payload?: Array<{ payload: PnLDataPoint }>;
  formatCurrency: (value: number) => string;
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.pnl >= 0;

    return (
      <div className="rounded-lg border border-border bg-popover px-4 py-2.5 shadow-lg">
        <p className="text-sm text-muted-foreground">{data.date}</p>
        <p
          className={cn(
            "text-base font-semibold tabular-nums",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {isPositive ? "+" : ""}
          {formatCurrency(data.pnl)}
        </p>
        <p className="text-sm text-muted-foreground">
          Value: {formatCurrency(data.value)}
        </p>
      </div>
    );
  }
  return null;
}

interface MobilePnLChartProps {
  holdings: HoldingWithValue[];
  compact?: boolean;
  selectedPeriod?: ChangePeriod;
  onPeriodChange?: (period: ChangePeriod) => void;
}

export const MobilePnLChart = memo(function MobilePnLChart({
  holdings,
  compact = false,
  selectedPeriod = "1D",
  onPeriodChange,
}: MobilePnLChartProps) {
  const { formatCurrency } = useFormatters();

  // Convert ChangePeriod to PnLTimeRange for the chart data hook
  const chartRange = toPnLRange(selectedPeriod);

  const { data, isLoading, hasData, summary, totalCostBasis } = usePortfolioPnL(
    holdings,
    chartRange,
    holdings.length > 0
  );

  // Handle period button click
  const handlePeriodClick = (period: ChangePeriod) => {
    if (onPeriodChange) {
      onPeriodChange(period);
    }
  };

  // Determine chart color based on current P&L trend
  const isPositive = useMemo(() => {
    if (data.length === 0) return true;
    return data[data.length - 1].pnl >= 0;
  }, [data]);

  // Format Y-axis values
  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${value >= 0 ? "+" : ""}${(value / 1000).toFixed(1)}k`;
    }
    return `${value >= 0 ? "+" : ""}${value.toFixed(0)}`;
  };

  // Calculate Y-axis domain with some padding
  const yDomain = useMemo(() => {
    if (data.length === 0) return [-100, 100];

    const pnlValues = data.map((d) => d.pnl);
    const min = Math.min(...pnlValues, 0); // Include 0 in range
    const max = Math.max(...pnlValues, 0);
    const padding = Math.max(Math.abs(max - min) * 0.1, 10);

    return [min - padding, max + padding];
  }, [data]);

  if (holdings.length === 0) {
    return null;
  }

  // Compact version for header inline display
  if (compact) {
    return (
      <div className="flex flex-col h-full">
        {/* Compact Chart */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
              >
                <defs>
                  <linearGradient id="pnlGradientPositiveCompact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="pnlGradientNegativeCompact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={<PnLTooltip formatCurrency={formatCurrency} />}
                  cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                  strokeWidth={2}
                  fill={isPositive ? "url(#pnlGradientPositiveCompact)" : "url(#pnlGradientNegativeCompact)"}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground">No data</p>
            </div>
          )}
        </div>

        {/* Compact Time Range Selector - colorful circular buttons */}
        <div className="flex justify-center gap-1.5 mt-1.5">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => handlePeriodClick(range.value)}
              className={cn(
                "w-6 h-6 rounded-full text-[11px] font-semibold transition-all",
                selectedPeriod === range.value
                  ? cn(range.color, "ring-1 ring-offset-1 ring-offset-background ring-primary")
                  : cn(range.color, "opacity-60 hover:opacity-100")
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Full version (original)
  return (
    <div className="px-4 py-5">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground font-medium">P&L</p>
          {isLoading ? (
            <Skeleton className="h-7 w-28 mt-1" />
          ) : hasData ? (
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  isPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {isPositive ? "+" : ""}
                {formatCurrency(summary.endPnL)}
              </span>
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
          ) : (
            <span className="text-base text-muted-foreground">N/A</span>
          )}
        </div>

        {/* Period Change */}
        {hasData && !isLoading && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {selectedPeriod} Change
            </p>
            <p
              className={cn(
                "text-base font-medium tabular-nums",
                summary.change >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {summary.change >= 0 ? "+" : ""}
              {formatCurrency(summary.change)}
            </p>
          </div>
        )}
      </div>

      {/* Chart Area */}
      <div className="h-[216px] w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-lg" />
        ) : hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="pnlGradientPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="pnlGradientNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
                minTickGap={48}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                domain={yDomain}
                width={54}
              />
              <ReferenceLine
                y={0}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <Tooltip
                content={<PnLTooltip formatCurrency={formatCurrency} />}
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                strokeWidth={2.5}
                fill={isPositive ? "url(#pnlGradientPositive)" : "url(#pnlGradientNegative)"}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-base text-muted-foreground">
              No data for {selectedPeriod}
            </p>
          </div>
        )}
      </div>

      {/* Time Range Selector - colorful circular buttons */}
      <div className="flex justify-center gap-2 mt-4">
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => handlePeriodClick(range.value)}
            className={cn(
              "w-8 h-8 rounded-full text-xs font-semibold transition-all",
              selectedPeriod === range.value
                ? cn(range.color, "ring-1 ring-offset-1 ring-offset-background ring-primary")
                : cn(range.color, "opacity-60 hover:opacity-100")
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Cost Basis Info */}
      {hasData && (
        <p className="text-center text-xs text-muted-foreground mt-3">
          Cost basis: {formatCurrency(totalCostBasis)}
        </p>
      )}
    </div>
  );
});
