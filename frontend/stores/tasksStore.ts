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
import { deleteAttachment } from "@/lib/supabase/queries/storage";

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
  addTask: (title: string, priority: TaskPriority) => string;
  completeTask: (id: string, completedBy?: string | null) => void;
  uncompleteTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // Attachment management
  setTaskAttachment: (taskId: string, url: string) => void;
  clearTaskAttachment: (taskId: string) => void;

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

      addTask: (title, priority) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newTask: Task = {
          id,
          title,
          priority,
          createdAt: now,
          completedAt: null,
          status: "pending",
          attachmentUrl: null,
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

      completeTask: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "completed" as const,
                  completedAt: now,
                  updatedAt: now,
                }
              : task
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateTask(id, {
          status: "completed",
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
                  completedAt: null,
                  updatedAt: now,
                }
              : task
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateTask(id, {
          status: "pending",
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

      setTaskAttachment: (taskId, url) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? { ...task, attachmentUrl: url, updatedAt: now }
              : task
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateTask(taskId, {
          attachmentUrl: url,
          updatedAt: now,
        }).catch((error) => {
          console.error("[Store] Failed to sync task attachment to Supabase:", error);
        });
      },

      clearTaskAttachment: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task?.attachmentUrl) return;

        const oldUrl = task.attachmentUrl;
        const now = new Date().toISOString();

        // Update local state
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachmentUrl: null, updatedAt: now }
              : t
          ),
        }));

        // Delete from Supabase Storage
        deleteAttachment(oldUrl).catch((error) => {
          console.error("[Store] Failed to delete task attachment from Storage:", error);
        });

        // Sync to Supabase for cross-device sync
        updateTask(taskId, {
          attachmentUrl: null,
          updatedAt: now,
        }).catch((error) => {
          console.error("[Store] Failed to sync task attachment removal to Supabase:", error);
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
