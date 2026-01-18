/**
 * Dashboard Zustand store with localStorage persistence
 * Per-portfolio dashboard structure - each portfolio has its own widgets and layout
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Widget,
  WidgetType,
  WidgetConfig,
  DashboardLayout,
  LayoutItem,
} from "@/types/dashboard";

const WIDGET_SIZE_DEFAULTS: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  "asset-card": { w: 3, h: 2, minW: 2, minH: 2 },
  "watchlist": { w: 6, h: 4, minW: 4, minH: 3 },
  "chart": { w: 6, h: 4, minW: 4, minH: 3 },
  "quick-stats": { w: 4, h: 2, minW: 3, minH: 2 },
  "allocation-pie": { w: 4, h: 4, minW: 3, minH: 3 },
};

interface PortfolioDashboard {
  widgets: Widget[];
  layouts: DashboardLayout;
}

interface DashboardState {
  // Per-portfolio dashboards keyed by portfolio ID
  dashboards: Record<string, PortfolioDashboard>;

  // Actions (all require portfolioId)
  addWidget: (portfolioId: string, type: WidgetType, config?: WidgetConfig) => void;
  removeWidget: (portfolioId: string, widgetId: string) => void;
  updateWidgetConfig: (portfolioId: string, widgetId: string, config: Partial<WidgetConfig>) => void;
  updateLayouts: (portfolioId: string, layouts: DashboardLayout) => void;
  resetDashboard: (portfolioId: string) => void;

  // Getters
  getDashboard: (portfolioId: string) => PortfolioDashboard;

  // For clearing all data
  clearAllDashboards: () => void;

  // For Supabase sync compatibility
  setDashboard: (portfolioId: string, widgets: Widget[], layouts: DashboardLayout) => void;
  setAllDashboards: (dashboards: Record<string, PortfolioDashboard>) => void;

  // Legacy compatibility - get/set all widgets (for migration)
  widgets: Widget[];
  layouts: DashboardLayout;
}

function generateId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createLayoutItem(id: string, type: WidgetType, existingLayouts: LayoutItem[]): LayoutItem {
  const defaults = WIDGET_SIZE_DEFAULTS[type];

  // Find the next available position
  let y = 0;
  if (existingLayouts.length > 0) {
    const maxY = Math.max(...existingLayouts.map((l) => l.y + l.h));
    y = maxY;
  }

  return {
    i: id,
    x: 0,
    y,
    w: defaults.w,
    h: defaults.h,
    minW: defaults.minW,
    minH: defaults.minH,
  };
}

const DEFAULT_DASHBOARD: PortfolioDashboard = {
  widgets: [],
  layouts: { lg: [], md: [], sm: [] },
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      dashboards: {},

      // Legacy compatibility - these now return empty/default
      widgets: [],
      layouts: { lg: [], md: [], sm: [] },

      getDashboard: (portfolioId: string) => {
        const state = get();
        return state.dashboards[portfolioId] || DEFAULT_DASHBOARD;
      },

      addWidget: (portfolioId, type, config = {}) => {
        const id = generateId();
        const newWidget: Widget = {
          id,
          type,
          config,
        };

        set((state) => {
          const dashboard = state.dashboards[portfolioId] || DEFAULT_DASHBOARD;
          const lgLayouts = Array.isArray(dashboard.layouts?.lg) ? dashboard.layouts.lg : [];
          const mdLayouts = Array.isArray(dashboard.layouts?.md) ? dashboard.layouts.md : [];
          const smLayouts = Array.isArray(dashboard.layouts?.sm) ? dashboard.layouts.sm : [];
          const newLayoutItem = createLayoutItem(id, type, lgLayouts);

          return {
            dashboards: {
              ...state.dashboards,
              [portfolioId]: {
                widgets: [...(Array.isArray(dashboard.widgets) ? dashboard.widgets : []), newWidget],
                layouts: {
                  lg: [...lgLayouts, newLayoutItem],
                  md: [...mdLayouts, { ...newLayoutItem, w: Math.min(newLayoutItem.w, 8) }],
                  sm: [...smLayouts, { ...newLayoutItem, w: Math.min(newLayoutItem.w, 4) }],
                },
              },
            },
          };
        });
      },

      removeWidget: (portfolioId, widgetId) => {
        set((state) => {
          const dashboard = state.dashboards[portfolioId] || DEFAULT_DASHBOARD;
          const widgets = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];
          const lg = Array.isArray(dashboard.layouts?.lg) ? dashboard.layouts.lg : [];
          const md = Array.isArray(dashboard.layouts?.md) ? dashboard.layouts.md : [];
          const sm = Array.isArray(dashboard.layouts?.sm) ? dashboard.layouts.sm : [];

          return {
            dashboards: {
              ...state.dashboards,
              [portfolioId]: {
                widgets: widgets.filter((w) => w.id !== widgetId),
                layouts: {
                  lg: lg.filter((l) => l.i !== widgetId),
                  md: md.filter((l) => l.i !== widgetId),
                  sm: sm.filter((l) => l.i !== widgetId),
                },
              },
            },
          };
        });
      },

      updateWidgetConfig: (portfolioId, widgetId, config) => {
        // Debug logging to trace watchlist sync issues
        console.log("[DashboardStore] updateWidgetConfig called:", {
          portfolioId,
          widgetId,
          config,
          timestamp: new Date().toISOString(),
        });

        set((state) => {
          const dashboard = state.dashboards[portfolioId] || DEFAULT_DASHBOARD;
          const widgets = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];

          // Log the before/after state for the specific widget
          const targetWidget = widgets.find((w) => w.id === widgetId);
          console.log("[DashboardStore] Widget before update:", targetWidget?.config);

          const newDashboards = {
            dashboards: {
              ...state.dashboards,
              [portfolioId]: {
                ...dashboard,
                widgets: widgets.map((w) =>
                  w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
                ),
              },
            },
          };

          console.log("[DashboardStore] Widget after update:", newDashboards.dashboards[portfolioId].widgets.find((w) => w.id === widgetId)?.config);

          return newDashboards;
        });
      },

      updateLayouts: (portfolioId, layouts) => {
        set((state) => {
          const dashboard = state.dashboards[portfolioId] || DEFAULT_DASHBOARD;
          return {
            dashboards: {
              ...state.dashboards,
              [portfolioId]: {
                ...dashboard,
                layouts,
              },
            },
          };
        });
      },

      resetDashboard: (portfolioId) => {
        set((state) => ({
          dashboards: {
            ...state.dashboards,
            [portfolioId]: DEFAULT_DASHBOARD,
          },
        }));
      },

      clearAllDashboards: () => {
        set({ dashboards: {} });
      },

      // For Supabase sync - set a single portfolio's dashboard
      setDashboard: (portfolioId, widgets, layouts) => {
        set((state) => ({
          dashboards: {
            ...state.dashboards,
            [portfolioId]: {
              widgets: Array.isArray(widgets) ? widgets : [],
              layouts: {
                lg: Array.isArray(layouts?.lg) ? layouts.lg : [],
                md: Array.isArray(layouts?.md) ? layouts.md : [],
                sm: Array.isArray(layouts?.sm) ? layouts.sm : [],
              },
            },
          },
        }));
      },

      // For Supabase sync - set all dashboards at once
      setAllDashboards: (dashboards) => {
        set({ dashboards: dashboards || {} });
      },
    }),
    {
      name: "dashboard-storage",
    }
  )
);
