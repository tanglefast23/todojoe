"use client";

import { memo, useState, useMemo, CSSProperties } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { MUTED_CHART_COLORS, getChartColor } from "@/hooks/useChartColors";
import type { AllocationItem } from "@/types/portfolio";

/** Extracted tooltip component to prevent recreation on every render */
function HoldingsTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AllocationItem }>;
}) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-lg">
        <p className="font-medium text-slate-900">{item.name}</p>
        <p className="text-sm text-slate-600">
          {formatCurrency(item.value)}
        </p>
        <p className="text-sm font-medium text-slate-800">{item.percentage.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}

interface HoldingsPieChartProps {
  data: AllocationItem[];
}

// Custom label renderer for all pie slices
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  name?: string;
}) => {
  // Guard against undefined values from PieLabelRenderProps
  if (cx === undefined || cy === undefined || midAngle === undefined ||
      innerRadius === undefined || outerRadius === undefined) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-bold pointer-events-none"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
    >
      {name}
    </text>
  );
};

export const HoldingsPieChart = memo(function HoldingsPieChart({
  data,
}: HoldingsPieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isCenterHovered, setIsCenterHovered] = useState(false);

  // Sort data by value descending and assign colors
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        color: item.color || getChartColor(index, MUTED_CHART_COLORS),
      }));
  }, [data]);

  // Calculate total value
  const totalValue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  // Memoize cell styles to avoid creating new objects on every render
  const getCellStyle = useMemo(() => {
    return (index: number): CSSProperties => ({
      transition: "opacity 0.2s ease-out",
      opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
    });
  }, [hoveredIndex]);

  if (data.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No data to display</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] flex items-center justify-center">
      <PieChart width={400} height={400}>
        <Pie
          data={chartData}
          cx={200}
          cy={200}
          innerRadius={85}
          outerRadius={170}
          paddingAngle={1}
          dataKey="value"
          stroke="none"
          onMouseEnter={(_, index) => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          label={renderCustomLabel}
          labelLine={false}
          isAnimationActive={false}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              style={getCellStyle(index)}
            />
          ))}
        </Pie>
        <Tooltip content={<HoldingsTooltipContent />} />
      </PieChart>

      {/* Center hover area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-[170px] h-[170px] rounded-full cursor-pointer"
          onMouseEnter={() => setIsCenterHovered(true)}
          onMouseLeave={() => setIsCenterHovered(false)}
        />
      </div>

      {/* Center tooltip on hover */}
      {isCenterHovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-lg">
            <p className="text-sm text-slate-600">Total Value</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      )}
    </div>
  );
});
