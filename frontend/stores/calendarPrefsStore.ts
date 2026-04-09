/**
 * Calendar Preferences Zustand store with localStorage persistence.
 * Stores per-calendar visibility and local color overrides.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const CALENDAR_PREFS_STORAGE_KEY = "calendar-prefs-storage";

interface CalendarPref {
  visible: boolean;
  colorOverride: string | null;
}

interface CalendarPrefsState {
  prefs: Record<string, CalendarPref>;

  /** Get pref for a calendar, defaulting to visible with no override */
  getPref: (calendarId: string) => CalendarPref;

  /** Toggle visibility for a calendar */
  toggleVisibility: (calendarId: string) => void;

  /** Set a local color override (null to clear) */
  setColorOverride: (calendarId: string, color: string | null) => void;

  /** Check if a calendar is visible */
  isVisible: (calendarId: string) => boolean;

  /** Get color override for a calendar (null if none) */
  getColorOverride: (calendarId: string) => string | null;
}

const DEFAULT_PREF: CalendarPref = { visible: true, colorOverride: null };

export const useCalendarPrefsStore = create<CalendarPrefsState>()(
  persist(
    (set, get) => ({
      prefs: {},

      getPref: (calendarId) => {
        return get().prefs[calendarId] ?? DEFAULT_PREF;
      },

      toggleVisibility: (calendarId) => {
        set((state) => {
          const current = state.prefs[calendarId] ?? DEFAULT_PREF;
          return {
            prefs: {
              ...state.prefs,
              [calendarId]: { ...current, visible: !current.visible },
            },
          };
        });
      },

      setColorOverride: (calendarId, color) => {
        set((state) => {
          const current = state.prefs[calendarId] ?? DEFAULT_PREF;
          return {
            prefs: {
              ...state.prefs,
              [calendarId]: { ...current, colorOverride: color },
            },
          };
        });
      },

      isVisible: (calendarId) => {
        return (get().prefs[calendarId] ?? DEFAULT_PREF).visible;
      },

      getColorOverride: (calendarId) => {
        return (get().prefs[calendarId] ?? DEFAULT_PREF).colorOverride;
      },
    }),
    {
      name: CALENDAR_PREFS_STORAGE_KEY,
      version: 1,
    }
  )
);
