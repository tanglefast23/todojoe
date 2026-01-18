/**
 * Hook to handle iOS Safari (and other mobile browsers) Back-Forward Cache (bfcache)
 *
 * When a page is restored from bfcache, the entire JavaScript state is preserved,
 * including the in-memory Zustand store state. This can cause issues where:
 * 1. User makes a change (e.g., deletes a watchlist item)
 * 2. Change is persisted to localStorage
 * 3. User navigates away
 * 4. User navigates back - bfcache restores OLD in-memory state
 * 5. localStorage has new data but in-memory store has old data
 *
 * This hook listens for the `pageshow` event and forces all Zustand stores
 * to rehydrate from localStorage when the page is restored from bfcache.
 *
 * Also handles React Query cache invalidation to ensure fresh data.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Import all persisted stores for rehydration
import { useDashboardStore } from "@/stores/dashboardStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSellPlanStore } from "@/stores/sellPlanStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { useAllocationHistoryStore } from "@/stores/allocationHistoryStore";

/**
 * Force all Zustand persisted stores to rehydrate from localStorage
 * This is called when the page is restored from bfcache
 */
function rehydrateAllStores() {
  console.log("[bfcache] Page restored from cache, rehydrating all stores...");

  // Each persisted Zustand store has a persist API with rehydrate method
  // Access it via the store's persist property
  const stores = [
    { name: "dashboard", store: useDashboardStore },
    { name: "portfolio", store: usePortfolioStore },
    { name: "settings", store: useSettingsStore },
    { name: "sellPlan", store: useSellPlanStore },
    { name: "tags", store: useTagsStore },
    { name: "currency", store: useCurrencyStore },
    { name: "owner", store: useOwnerStore },
    { name: "allocationHistory", store: useAllocationHistoryStore },
  ];

  stores.forEach(({ name, store }) => {
    try {
      // Zustand persist middleware adds a persist object with rehydrate method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const persistApi = (store as any).persist;
      if (persistApi?.rehydrate) {
        persistApi.rehydrate();
        console.log(`[bfcache] Rehydrated ${name} store`);
      }
    } catch (error) {
      console.warn(`[bfcache] Failed to rehydrate ${name} store:`, error);
    }
  });
}

/**
 * Hook to handle bfcache restoration
 * Should be called once at the app level (e.g., in a layout or provider)
 */
export function useBfcacheRehydration() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // event.persisted is true when page is restored from bfcache
      if (event.persisted) {
        console.log("[bfcache] Page restored from back-forward cache");

        // Rehydrate all Zustand stores from localStorage
        rehydrateAllStores();

        // Invalidate React Query cache to ensure fresh data on next render
        // This will cause queries to refetch when components re-render
        queryClient.invalidateQueries();

        console.log("[bfcache] Invalidated React Query cache");
      }
    };

    // Also handle visibility change for when app comes back from background
    // This is important for PWAs and mobile apps
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Check if we've been hidden for more than 30 seconds
        // If so, rehydrate to catch any changes made in other tabs/windows
        const lastHiddenTime = sessionStorage.getItem("lastHiddenTime");
        if (lastHiddenTime) {
          const hiddenDuration = Date.now() - parseInt(lastHiddenTime, 10);
          // Rehydrate if hidden for more than 30 seconds (to catch cross-tab changes)
          if (hiddenDuration > 30000) {
            console.log("[bfcache] App was in background for >30s, rehydrating...");
            rehydrateAllStores();
          }
        }
        sessionStorage.removeItem("lastHiddenTime");
      } else if (document.visibilityState === "hidden") {
        sessionStorage.setItem("lastHiddenTime", Date.now().toString());
      }
    };

    // Add event listeners
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);
}

/**
 * Standalone function to manually trigger rehydration
 * Can be called from anywhere if needed
 */
export function forceRehydrateAllStores() {
  rehydrateAllStores();
}
