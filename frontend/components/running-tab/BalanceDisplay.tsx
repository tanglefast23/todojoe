"use client";

import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  amount: number;
  className?: string;
  canEdit?: boolean;
  onEdit?: () => void;
}

export function formatVND(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function BalanceDisplay({ amount, className, canEdit, onEdit }: BalanceDisplayProps) {
  const isPositive = amount >= 0;

  const handleDoubleClick = () => {
    if (canEdit && onEdit) {
      onEdit();
    }
  };

  return (
    <div className={cn("text-center py-2", className)}>
      <p
        className={cn(
          "text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight select-none",
          isPositive ? "text-emerald-400" : "text-red-400",
          canEdit && "cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity"
        )}
        onDoubleClick={handleDoubleClick}
        title={canEdit ? "Double-tap to edit" : undefined}
      >
        {formatVND(amount)}
      </p>
    </div>
  );
}
