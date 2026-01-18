/**
 * Lazy-loaded chart components for better initial bundle size.
 * Charts are heavy (~200-300KB) and not needed on initial render.
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for chart components.
 * Shows a skeleton that matches the chart dimensions.
 */
function ChartSkeleton() {
  return (
    <div className="flex h-[400px] w-full items-center justify-center">
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  );
}

/**
 * Lazy-loaded AllocationPieChart - only loads when rendered.
 * Saves ~100KB from initial bundle when charts aren't immediately visible.
 */
export const LazyAllocationPieChart = dynamic(
  () =>
    import("@/components/charts/AllocationPieChart").then(
      (m) => m.AllocationPieChart
    ),
  {
    ssr: false,
    loading: ChartSkeleton,
  }
);

/**
 * Lazy-loaded HoldingsPieChart - only loads when rendered.
 * Similar savings to AllocationPieChart.
 */
export const LazyHoldingsPieChart = dynamic(
  () =>
    import("@/components/charts/HoldingsPieChart").then(
      (m) => m.HoldingsPieChart
    ),
  {
    ssr: false,
    loading: ChartSkeleton,
  }
);

/**
 * Lazy-loaded Sparkline - smaller but still benefits from lazy loading.
 */
export const LazySparkline = dynamic(
  () => import("@/components/charts/Sparkline").then((m) => m.Sparkline),
  {
    ssr: false,
    loading: () => <Skeleton className="h-8 w-24" />,
  }
);
