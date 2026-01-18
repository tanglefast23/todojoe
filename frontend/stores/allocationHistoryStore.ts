import { create } from "zustand";
import { persist } from "zustand/middleware";

// A snapshot of allocations at a point in time
export interface AllocationSnapshot {
  timestamp: number;
  allocations: Record<string, number>; // symbol -> percentage
  portfolioId: string | null;
}

interface AllocationHistoryStore {
  snapshots: AllocationSnapshot[];
  // Save a snapshot when a plan is completed
  saveSnapshot: (allocations: Record<string, number>, portfolioId: string | null) => void;
  // Get allocation for a symbol from N completions ago (0 = most recent)
  getAllocationFromCompletion: (symbol: string, completionsAgo: number, portfolioId: string | null) => number | null;
  // Get all allocations from N completions ago
  getAllocationsFromCompletion: (completionsAgo: number, portfolioId: string | null) => Record<string, number> | null;
  // Clear history
  clearHistory: () => void;
  // Setter for Supabase sync
  setSnapshots: (snapshots: AllocationSnapshot[]) => void;
}

export const useAllocationHistoryStore = create<AllocationHistoryStore>()(
  persist(
    (set, get) => ({
      snapshots: [],

      saveSnapshot: (allocations, portfolioId) =>
        set((state) => ({
          snapshots: [
            { timestamp: Date.now(), allocations, portfolioId },
            ...state.snapshots,
          ].slice(0, 50), // Keep last 50 snapshots
        })),

      getAllocationFromCompletion: (symbol, completionsAgo, portfolioId) => {
        const snapshots = get().snapshots.filter(
          (s) => s.portfolioId === portfolioId || portfolioId === null
        );
        if (completionsAgo >= snapshots.length) return null;
        return snapshots[completionsAgo]?.allocations[symbol] ?? null;
      },

      getAllocationsFromCompletion: (completionsAgo, portfolioId) => {
        const snapshots = get().snapshots.filter(
          (s) => s.portfolioId === portfolioId || portfolioId === null
        );
        if (completionsAgo >= snapshots.length) return null;
        return snapshots[completionsAgo]?.allocations ?? null;
      },

      clearHistory: () => set({ snapshots: [] }),

      setSnapshots: (snapshots) => set({ snapshots }),
    }),
    {
      name: "allocation-history-storage",
    }
  )
);
