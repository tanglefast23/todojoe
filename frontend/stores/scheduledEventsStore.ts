/**
 * Scheduled Events Zustand store with localStorage persistence
 * Manages scheduled events creation, completion, and deletion
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScheduledEvent } from "@/types/scheduled-events";
import {
  upsertScheduledEvents,
  updateScheduledEvent,
  deleteScheduledEvent as deleteScheduledEventFromSupabase,
} from "@/lib/supabase/queries/scheduled-events";

const SCHEDULED_EVENTS_STORAGE_KEY = "scheduled-events-storage";

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

interface ScheduledEventsState {
  events: ScheduledEvent[];

  // Bulk setter for Supabase sync
  setEvents: (events: ScheduledEvent[]) => void;

  // Event CRUD
  addEvent: (title: string, scheduledAt: string, createdBy: string | null) => string;
  completeEvent: (id: string, completedBy: string | null) => void;
  uncompleteEvent: (id: string) => void;
  deleteEvent: (id: string) => void;

  // Getters
  getPendingEvents: () => ScheduledEvent[];
  getCompletedEvents: () => ScheduledEvent[];
  getEventById: (id: string) => ScheduledEvent | undefined;
  getUpcomingEvents: () => ScheduledEvent[];
}

export const useScheduledEventsStore = create<ScheduledEventsState>()(
  persist(
    (set, get) => ({
      events: [],

      setEvents: (events) => set({ events }),

      addEvent: (title, scheduledAt, createdBy) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newEvent: ScheduledEvent = {
          id,
          title,
          scheduledAt,
          createdBy,
          createdAt: now,
          completedBy: null,
          completedAt: null,
          status: "pending",
          updatedAt: now,
        };

        set((state) => ({
          events: [...state.events, newEvent].sort(
            (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
          ),
        }));

        // Sync to Supabase for cross-device sync
        upsertScheduledEvents([newEvent]).catch((error) => {
          console.error("[Store] Failed to sync new scheduled event to Supabase:", error);
        });

        return id;
      },

      completeEvent: (id, completedBy) => {
        const now = new Date().toISOString();
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id
              ? {
                  ...event,
                  status: "completed" as const,
                  completedBy,
                  completedAt: now,
                  updatedAt: now,
                }
              : event
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateScheduledEvent(id, {
          status: "completed",
          completedBy,
          completedAt: now,
          updatedAt: now,
        }).catch((error) => {
          console.error("[Store] Failed to sync scheduled event completion to Supabase:", error);
        });
      },

      uncompleteEvent: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id
              ? {
                  ...event,
                  status: "pending" as const,
                  completedBy: null,
                  completedAt: null,
                  updatedAt: now,
                }
              : event
          ),
        }));

        // Sync to Supabase for cross-device sync
        updateScheduledEvent(id, {
          status: "pending",
          completedBy: null,
          completedAt: null,
          updatedAt: now,
        }).catch((error) => {
          console.error("[Store] Failed to sync scheduled event uncompletion to Supabase:", error);
        });
      },

      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter((event) => event.id !== id),
        }));

        // Sync to Supabase for cross-device sync
        deleteScheduledEventFromSupabase(id).catch((error) => {
          console.error("[Store] Failed to sync scheduled event deletion to Supabase:", error);
        });
      },

      getPendingEvents: () => {
        return get().events.filter((event) => event.status === "pending");
      },

      getCompletedEvents: () => {
        return get().events.filter((event) => event.status === "completed");
      },

      getEventById: (id) => {
        return get().events.find((event) => event.id === id);
      },

      // Get pending events sorted by scheduled time (soonest first)
      getUpcomingEvents: () => {
        return get()
          .events.filter((event) => event.status === "pending")
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      },
    }),
    {
      name: SCHEDULED_EVENTS_STORAGE_KEY,
    }
  )
);
