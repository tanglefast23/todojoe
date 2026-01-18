"use client";

import { TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3 } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function QuickStatsWidget() {
  const { summary, isLoading } = usePortfolio();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const holdingsCount = summary.holdings?.length || 0;

  const stats = [
    {
      label: "Total Value",
      value: formatCurrency(summary.totalValue),
      icon: Wallet,
      color: "text-blue-500",
    },
    {
      label: "Cost Basis",
      value: formatCurrency(summary.totalCost),
      icon: PiggyBank,
      color: "text-purple-500",
    },
    {
      label: "Total Gain",
      value: formatCurrency(summary.totalGain),
      icon: summary.totalGain >= 0 ? TrendingUp : TrendingDown,
      color: summary.totalGain >= 0 ? "text-green-500" : "text-red-500",
      subValue: formatPercent(summary.totalGainPercent),
    },
    {
      label: "Holdings",
      value: holdingsCount.toString(),
      icon: BarChart3,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Icon className={cn("h-3.5 w-3.5", stat.color)} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold">{stat.value}</span>
              {stat.subValue && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    summary.totalGain >= 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  ({stat.subValue})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
