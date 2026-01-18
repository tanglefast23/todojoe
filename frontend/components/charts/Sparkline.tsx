"use client";

import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  positive?: boolean;
}

/** Memoized sparkline chart - only re-renders when data changes */
export const Sparkline = memo(function Sparkline({
  data,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  className,
  positive,
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (!data || data.length < 2) return "";

    // Single-pass min/max calculation (more efficient than Math.min/max spread)
    let min = data[0];
    let max = data[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [data, width, height]);

  // Determine color based on trend (first vs last value)
  const isPositive = positive ?? (data.length >= 2 ? data[data.length - 1] >= data[0] : true);

  if (!data || data.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center text-muted-foreground", className)}
        style={{ width, height }}
      >
        <span className="text-[10px]">—</span>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={pathD}
        fill="none"
        stroke={isPositive ? "var(--gain)" : "var(--loss)"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors"
      />
    </svg>
  );
});
