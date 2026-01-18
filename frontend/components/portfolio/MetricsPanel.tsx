"use client";

import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle
import type { PortfolioMetrics } from "@/types/portfolio";

interface MetricsPanelProps {
  metrics: PortfolioMetrics;
  isLoading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  tooltip: string;
  isLoading?: boolean;
}

function MetricCard({ title, value, description, tooltip, isLoading }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1">
          {title}
          <span title={tooltip}>
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? (
            <span className="text-muted-foreground">--</span>
          ) : (
            value
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MetricsPanel({ metrics, isLoading }: MetricsPanelProps) {
  const formatMetric = (value: number, suffix: string = "%", decimals: number = 2): string => {
    if (!isFinite(value) || isNaN(value)) return "--";
    return `${value.toFixed(decimals)}${suffix}`;
  };

  const formatSharpe = (value: number): string => {
    if (!isFinite(value) || isNaN(value)) return "--";
    return value.toFixed(2);
  };

  // Interpret Sharpe Ratio
  const getSharpeDescription = (sharpe: number): string => {
    if (!isFinite(sharpe) || isNaN(sharpe)) return "Insufficient data";
    if (sharpe >= 2) return "Excellent risk-adjusted return";
    if (sharpe >= 1) return "Good risk-adjusted return";
    if (sharpe >= 0) return "Positive excess return";
    return "Underperforming risk-free rate";
  };

  // Interpret Volatility
  const getVolatilityDescription = (vol: number): string => {
    if (!isFinite(vol) || isNaN(vol)) return "Insufficient data";
    if (vol < 10) return "Low volatility";
    if (vol < 20) return "Moderate volatility";
    if (vol < 30) return "High volatility";
    return "Very high volatility";
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="CAGR"
        value={formatMetric(metrics.cagr)}
        description="Compound Annual Growth Rate"
        tooltip="The mean annual growth rate of your portfolio over a specified time period longer than one year. Accounts for compounding."
        isLoading={isLoading}
      />

      <MetricCard
        title="Volatility"
        value={formatMetric(metrics.volatility)}
        description={getVolatilityDescription(metrics.volatility)}
        tooltip="Annualized standard deviation of returns. Measures how much your portfolio value fluctuates. Lower is generally better for risk-averse investors."
        isLoading={isLoading}
      />

      <MetricCard
        title="Sharpe Ratio"
        value={formatSharpe(metrics.sharpeRatio)}
        description={getSharpeDescription(metrics.sharpeRatio)}
        tooltip="Risk-adjusted return calculated as (Portfolio Return - Risk Free Rate) / Volatility. Uses 4.5% risk-free rate. Higher is better; >1 is good, >2 is excellent."
        isLoading={isLoading}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-2xl font-bold text-muted-foreground">--</div>
          ) : metrics.allocation.length === 0 ? (
            <div className="text-2xl font-bold text-muted-foreground">--</div>
          ) : (
            <div className="space-y-2">
              {metrics.allocation.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
