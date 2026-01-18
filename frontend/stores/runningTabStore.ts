/**
 * Running Tab Zustand store with localStorage persistence
 * Manages the running tab balance, expenses, and history
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RunningTab,
  Expense,
  TabHistoryEntry,
  ExpenseStatus,
} from "@/types/runningTab";

const RUNNING_TAB_STORAGE_KEY = "running-tab-storage";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface RunningTabState {
  tab: RunningTab | null;
  expenses: Expense[];
  history: TabHistoryEntry[];

  // Bulk setters for Supabase sync
  setTab: (tab: RunningTab | null) => void;
  setExpenses: (expenses: Expense[]) => void;
  setHistory: (history: TabHistoryEntry[]) => void;

  // Tab management
  initializeBalance: (amount: number, initializedBy: string | null) => void;

  // Expense CRUD
  addExpense: (name: string, amount: number, createdBy: string | null) => string;
  addBulkExpenses: (
    entries: { name: string; amount: number }[],
    createdBy: string | null
  ) => string[];
  approveExpense: (id: string, approvedBy: string | null) => void;
  rejectExpense: (id: string, approvedBy: string | null) => void;
  setAttachment: (expenseId: string, url: string) => void;
  deleteExpense: (id: string) => void;

  // Getters
  getTabBalance: () => number;
  getPendingExpenses: () => Expense[];
  getApprovedExpenses: () => Expense[];
  getRejectedExpenses: () => Expense[];
}

export const useRunningTabStore = create<RunningTabState>()(
  persist(
    (set, get) => ({
      tab: null,
      expenses: [],
      history: [],

      setTab: (tab) => set({ tab }),
      setExpenses: (expenses) => set({ expenses }),
      setHistory: (history) => set({ history }),

      initializeBalance: (amount, initializedBy) => {
        const now = new Date().toISOString();
        const tabId = generateId();
        const historyId = generateId();

        const newTab: RunningTab = {
          id: tabId,
          initialBalance: amount,
          currentBalance: amount,
          initializedBy,
          initializedAt: now,
          updatedAt: now,
        };

        const historyEntry: TabHistoryEntry = {
          id: historyId,
          type: "initial",
          amount,
          description: "Initial balance set",
          relatedExpenseId: null,
          createdBy: initializedBy,
          createdAt: now,
        };

        set((state) => ({
          tab: newTab,
          history: [historyEntry, ...state.history],
        }));
      },

      addExpense: (name, amount, createdBy) => {
        const id = generateId();
        const now = new Date().toISOString();

        const newExpense: Expense = {
          id,
          name,
          amount,
          createdBy,
          createdAt: now,
          approvedBy: null,
          approvedAt: null,
          status: "pending",
          attachmentUrl: null,
          updatedAt: now,
        };

        set((state) => ({
          expenses: [newExpense, ...state.expenses],
        }));

        return id;
      },

      addBulkExpenses: (entries, createdBy) => {
        const now = new Date().toISOString();
        const newExpenses: Expense[] = entries.map((entry) => ({
          id: generateId(),
          name: entry.name,
          amount: entry.amount,
          createdBy,
          createdAt: now,
          approvedBy: null,
          approvedAt: null,
          status: "pending" as ExpenseStatus,
          attachmentUrl: null,
          updatedAt: now,
        }));

        set((state) => ({
          expenses: [...newExpenses, ...state.expenses],
        }));

        return newExpenses.map((e) => e.id);
      },

      approveExpense: (id, approvedBy) => {
        const expense = get().expenses.find((e) => e.id === id);
        if (!expense || expense.status !== "pending") return;

        const now = new Date().toISOString();
        const historyId = generateId();

        // Update expense status
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: "approved" as const,
                  approvedBy,
                  approvedAt: now,
                  updatedAt: now,
                }
              : e
          ),
        }));

        // Subtract from balance
        set((state) => {
          if (!state.tab) return state;
          return {
            tab: {
              ...state.tab,
              currentBalance: state.tab.currentBalance - expense.amount,
              updatedAt: now,
            },
          };
        });

        // Add history entry
        const historyEntry: TabHistoryEntry = {
          id: historyId,
          type: "expense_approved",
          amount: -expense.amount,
          description: expense.name,
          relatedExpenseId: id,
          createdBy: approvedBy,
          createdAt: now,
        };

        set((state) => ({
          history: [historyEntry, ...state.history],
        }));
      },

      rejectExpense: (id, approvedBy) => {
        const expense = get().expenses.find((e) => e.id === id);
        if (!expense || expense.status !== "pending") return;

        const now = new Date().toISOString();
        const historyId = generateId();

        // Update expense status
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: "rejected" as const,
                  approvedBy,
                  approvedAt: now,
                  updatedAt: now,
                }
              : e
          ),
        }));

        // Add history entry
        const historyEntry: TabHistoryEntry = {
          id: historyId,
          type: "expense_rejected",
          amount: 0,
          description: `Rejected: ${expense.name}`,
          relatedExpenseId: id,
          createdBy: approvedBy,
          createdAt: now,
        };

        set((state) => ({
          history: [historyEntry, ...state.history],
        }));
      },

      setAttachment: (expenseId, url) => {
        const now = new Date().toISOString();
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === expenseId
              ? {
                  ...e,
                  attachmentUrl: url,
                  updatedAt: now,
                }
              : e
          ),
        }));
      },

      deleteExpense: (id) => {
        const expense = get().expenses.find((e) => e.id === id);
        // Only allow deletion of pending or rejected expenses
        if (!expense || expense.status === "approved") return;

        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }));
      },

      getTabBalance: () => {
        return get().tab?.currentBalance ?? 0;
      },

      getPendingExpenses: () => {
        return get().expenses.filter((e) => e.status === "pending");
      },

      getApprovedExpenses: () => {
        return get().expenses.filter((e) => e.status === "approved");
      },

      getRejectedExpenses: () => {
        return get().expenses.filter((e) => e.status === "rejected");
      },
    }),
    {
      name: RUNNING_TAB_STORAGE_KEY,
    }
  )
);
