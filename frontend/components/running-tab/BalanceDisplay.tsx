"use client";

import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  amount: number;
  className?: string;
}

export function formatVND(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function BalanceDisplay({ amount, className }: BalanceDisplayProps) {
  const isPositive = amount >= 0;

  return (
    <div className={cn("text-center py-8", className)}>
      <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
      <p
        className={cn(
          "text-4xl md:text-5xl font-bold tracking-tight",
          isPositive ? "text-green-500" : "text-red-500"
        )}
      >
        {formatVND(amount)}
      </p>
    </div>
  );
}
