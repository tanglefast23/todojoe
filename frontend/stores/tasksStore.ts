/**
 * Tasks Zustand store with localStorage persistence
 * Manages task list, creation, completion, and deletion
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Task, TaskPriority } from "@/types/tasks";
import {
  upsertTasks,
  updateTask,
  deleteTask as deleteTaskFromSupabase,
} from "@/lib/supabase/queries/tasks";

const TASKS_STORAGE_KEY = "tasks-storage";

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

interface TasksState {
  tasks: Task[];

  // Bulk setter for Supabase sync
  setTasks: (tasks: Task[]) => void;

  // Task CRUD
  addTask: (title: string, priority: TaskPriority, createdBy: string | null) => string;
  completeTask: (id: string, completedBy: string | null) => void;
  uncompleteTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // Getters
  getPendingTasks: () => Task[];
  getCompletedTasks: () => Task[];
  getTaskById: (id: string) => Task | undefined;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],

      setTasks: (tasks) => set({ tasks }),

      addTask: (title, priority, createdBy) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newTask: Task = {
          id,
          title,
          priority,
          createdBy,
          createdAt: now,
          completedBy: null,
          completedAt: null,
          status: "pending",
          updatedAt: now,
        };

        set((state) => ({
          tasks: [newTask, ...state.tasks],
        }));

        // Sync to Supabase for cross-device sync
        upsertTasks([newTask]).catch((error) => {
          console.error("[Store] Failed to sync new task to Supabase:", error);
        });

        return id;
      },

      completeTask: (id, completedBy) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "completed" as const,
                  completedBy,
                  completedAt: now,
                  updatedAt: now,
                }
              : task
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateTask(id, {
          status: "completed",
          completedBy,
          completedAt: now,
          updatedAt: now,
        }).catch((error) => {
          console.error("[Store] Failed to sync task completion to Supabase:", error);
        });
      },

      uncompleteTask: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "pending" as const,
                  completedBy: null,
                  completedAt: null,
                  updatedAt: now,
                }
              : task
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateTask(id, {
          status: "pending",
          completedBy: null,
          completedAt: null,
          updatedAt: now,
        }).catch((error) => {
          console.error("[Store] Failed to sync task uncompletion to Supabase:", error);
        });
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));

        // Sync to Supabase for cross-device sync
        deleteTaskFromSupabase(id).catch((error) => {
          console.error("[Store] Failed to sync task deletion to Supabase:", error);
        });
      },

      getPendingTasks: () => {
        return get().tasks.filter((task) => task.status === "pending");
      },

      getCompletedTasks: () => {
        return get().tasks.filter((task) => task.status === "completed");
      },

      getTaskById: (id) => {
        return get().tasks.find((task) => task.id === id);
      },
    }),
    {
      name: TASKS_STORAGE_KEY,
    }
  )
);
