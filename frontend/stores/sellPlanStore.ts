import { create } from "zustand";
import { persist } from "zustand/middleware";

// Buy allocation for each symbol in the plan
export interface BuyAllocation {
  symbol: string;
  percentage: number; // Percentage of sell proceeds to use (0-100)
  dollarAmount: number; // Calculated from sell proceeds * percentage
  assetType: "stock" | "crypto";
}

// Account allocation now includes buy allocations for that account
export interface AccountAllocation {
  accountId: string;
  accountName: string;
  available: number;
  toSell: number;
  buyAllocations: BuyAllocation[]; // Per-account buys
}

export interface SellPlan {
  id: string;
  symbol: string;
  percentage: number;
  dollarAmount: number;
  sharesToSell: number;
  currentPrice: number;
  totalShares: number;
  portfolioAllocation: number;
  percentOfHolding: number;
  accountAllocations: AccountAllocation[]; // Now includes buyAllocations per account
  portfolioId?: string;
  assetType?: "stock" | "crypto";
  ownerId?: string; // Track who created the plan (for sync)
  // REMOVED: buyAllocations moved into AccountAllocation
}

interface SellPlanStore {
  sellPlans: SellPlan[];
  completedSellIds: Set<string>; // Format: "planId:accountId"
  completedBuyIds: Set<string>; // Format: "planId:accountId:buySymbol"
  addPlan: (plan: SellPlan) => void;
  removePlan: (planId: string) => void;
  removePlanBySymbol: (symbol: string) => void;
  markPlanDone: (planId: string) => void;
  markSellCompleted: (planId: string, accountId: string) => void;
  markBuyCompleted: (planId: string, accountId: string, buySymbol: string) => void;
  isSellCompleted: (planId: string, accountId: string) => boolean;
  isBuyCompleted: (planId: string, accountId: string, buySymbol: string) => boolean;
  clearPlans: () => void;
  // Setter for Supabase sync - completely replaces sell plans state
  setSellPlans: (plans: SellPlan[], completedSellIds?: string[], completedBuyIds?: string[]) => void;
}

export const useSellPlanStore = create<SellPlanStore>()(
  persist(
    (set, get) => ({
      sellPlans: [],
      completedSellIds: new Set(),
      completedBuyIds: new Set(),
      addPlan: (plan) =>
        set((state) => ({
          sellPlans: [plan, ...state.sellPlans],
        })),
      removePlan: (planId) =>
        set((state) => ({
          sellPlans: state.sellPlans.filter((p) => p.id !== planId),
          completedSellIds: new Set([...state.completedSellIds].filter((id) => !id.startsWith(`${planId}:`))),
          completedBuyIds: new Set([...state.completedBuyIds].filter((id) => !id.startsWith(`${planId}:`))),
        })),
      removePlanBySymbol: (symbol) =>
        set((state) => {
          const planIds = state.sellPlans.filter((p) => p.symbol === symbol).map((p) => p.id);
          return {
            sellPlans: state.sellPlans.filter((p) => p.symbol !== symbol),
            completedSellIds: new Set([...state.completedSellIds].filter((id) => !planIds.some((pid) => id.startsWith(`${pid}:`)))),
            completedBuyIds: new Set([...state.completedBuyIds].filter((id) => !planIds.some((pid) => id.startsWith(`${pid}:`)))),
          };
        }),
      markPlanDone: (planId) =>
        set((state) => ({
          sellPlans: state.sellPlans.filter((p) => p.id !== planId),
          completedSellIds: new Set([...state.completedSellIds].filter((id) => !id.startsWith(`${planId}:`))),
          completedBuyIds: new Set([...state.completedBuyIds].filter((id) => !id.startsWith(`${planId}:`))),
        })),
      markSellCompleted: (planId, accountId) =>
        set((state) => ({
          completedSellIds: new Set([...state.completedSellIds, `${planId}:${accountId}`]),
        })),
      markBuyCompleted: (planId, accountId, buySymbol) =>
        set((state) => ({
          completedBuyIds: new Set([...state.completedBuyIds, `${planId}:${accountId}:${buySymbol}`]),
        })),
      isSellCompleted: (planId, accountId) => get().completedSellIds.has(`${planId}:${accountId}`),
      isBuyCompleted: (planId, accountId, buySymbol) => get().completedBuyIds.has(`${planId}:${accountId}:${buySymbol}`),
      clearPlans: () => set({ sellPlans: [], completedSellIds: new Set(), completedBuyIds: new Set() }),
      setSellPlans: (plans, completedSellIds = [], completedBuyIds = []) =>
        set({
          sellPlans: plans,
          completedSellIds: new Set(completedSellIds),
          completedBuyIds: new Set(completedBuyIds),
        }),
    }),
    {
      name: "sell-plans-storage",
      // Custom serialization to handle Set objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              completedSellIds: new Set(data.state.completedSellIds || []),
              completedBuyIds: new Set(data.state.completedBuyIds || []),
            },
          };
        },
        setItem: (name, value) => {
          const data = {
            ...value,
            state: {
              ...value.state,
              completedSellIds: [...value.state.completedSellIds],
              completedBuyIds: [...value.state.completedBuyIds],
            },
          };
          localStorage.setItem(name, JSON.stringify(data));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

// Play a satisfying ding sound
export function playDingSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Create oscillator for the main tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Pleasant bell-like frequency
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    oscillator.type = "sine";

    // Quick attack, medium decay for a "ding" effect
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Add a higher harmonic for richness
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();

    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);

    oscillator2.frequency.setValueAtTime(1760, audioContext.currentTime); // A6 note
    oscillator2.type = "sine";

    gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator2.start(audioContext.currentTime);
    oscillator2.stop(audioContext.currentTime + 0.3);
  } catch {
    // Audio not supported or blocked
    console.log("Audio playback not available");
  }
}
