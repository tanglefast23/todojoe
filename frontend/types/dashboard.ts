/**
 * Dashboard widget TypeScript types
 */

export type WidgetType =
  | "asset-card"
  | "watchlist"
  | "chart"
  | "quick-stats"
  | "allocation-pie";

export interface WidgetConfig {
  symbol?: string;
  symbols?: string[];
  timeRange?: string;
  title?: string;
  assetType?: "stock" | "crypto";
}

export interface Widget {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
}

// Custom layout item interface matching react-grid-layout
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export interface DashboardLayout {
  lg: LayoutItem[];
  md: LayoutItem[];
  sm: LayoutItem[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type SortField =
  | "symbol"
  | "name"
  | "price"
  | "hourChangePercent"
  | "change"
  | "changePercent"
  | "value"
  | "quantity"
  | "allocation"
  | "gain"
  | "gainPercent";

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export const WIDGET_DEFAULTS: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  "asset-card": { w: 3, h: 2, minW: 2, minH: 2 },
  "watchlist": { w: 6, h: 4, minW: 4, minH: 3 },
  "chart": { w: 6, h: 4, minW: 4, minH: 3 },
  "quick-stats": { w: 4, h: 2, minW: 3, minH: 2 },
  "allocation-pie": { w: 4, h: 4, minW: 3, minH: 3 },
};

export const TAG_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];
