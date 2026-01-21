import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SearchResult {
  id: string;
  query: string;
  response: string;
  timestamp: string;
}

interface SearchState {
  results: SearchResult[];
  addResult: (query: string, response: string) => void;
  deleteResult: (id: string) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      results: [],
      addResult: (query, response) =>
        set((state) => ({
          results: [
            {
              id: crypto.randomUUID(),
              query,
              response,
              timestamp: new Date().toISOString(),
            },
            ...state.results,
          ],
        })),
      deleteResult: (id) =>
        set((state) => ({
          results: state.results.filter((r) => r.id !== id),
        })),
      clearResults: () => set({ results: [] }),
    }),
    {
      name: "search-results",
    }
  )
);
