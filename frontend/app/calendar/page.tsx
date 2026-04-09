"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiHeaders } from "@/lib/api-key";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ScheduledEventList } from "@/components/calendar/ScheduledEventList";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { useCalendarPrefsStore } from "@/stores/calendarPrefsStore";
import { Button } from "@/components/ui/button";
import type { ScheduledEvent } from "@/types/scheduled-events";
import type { CalendarInfo } from "@/lib/google/calendar";

export default function CalendarPage() {
  // Local scheduled events state
  const localEvents = useScheduledEventsStore((state) => state.events);
  const completeEvent = useScheduledEventsStore((state) => state.completeEvent);
  const uncompleteEvent = useScheduledEventsStore((state) => state.uncompleteEvent);
  const deleteEvent = useScheduledEventsStore((state) => state.deleteEvent);

  // Calendar visibility prefs
  const calendarPrefs = useCalendarPrefsStore();

  // Google Calendar events state
  const [googleEvents, setGoogleEvents] = useState<ScheduledEvent[]>([]);
  const [calendarMap, setCalendarMap] = useState<Record<string, CalendarInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Google Calendar events + calendar list (for colors)
  const fetchGoogleEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [eventsRes, listRes] = await Promise.all([
        fetch("/api/google/calendar/events", { headers: apiHeaders() }),
        fetch("/api/google/calendar/list", { headers: apiHeaders() }),
      ]);
      if (!eventsRes.ok) {
        const data = await eventsRes.json();
        throw new Error(data.error || "Failed to fetch calendar events");
      }
      const eventsData: { events?: ScheduledEvent[] } = await eventsRes.json();
      setGoogleEvents(eventsData.events || []);

      if (listRes.ok) {
        const listData: { calendars?: CalendarInfo[] } = await listRes.json();
        const map: Record<string, CalendarInfo> = {};
        for (const cal of listData.calendars || []) {
          map[cal.id] = cal;
        }
        setCalendarMap(map);
      }
    } catch (err) {
      console.error("Error fetching Google Calendar events:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchGoogleEvents();
  }, [fetchGoogleEvents]);

  // Combine local and Google events, filter to upcoming only, sorted by date.
  // An event counts as upcoming if it hasn't ended yet — prefer the event's
  // end time if present, otherwise fall back to the start time. This keeps
  // in-progress events visible until they actually finish.
  const allEvents = useMemo(() => {
    const now = Date.now();
    return [...localEvents, ...googleEvents]
      .filter((event) => {
        // Filter out events from hidden calendars
        if (event.source === "google" && event.googleCalendarId) {
          if (!calendarPrefs.isVisible(event.googleCalendarId)) return false;
        }
        const endMs = event.endAt ? new Date(event.endAt).getTime() : null;
        const startMs = new Date(event.scheduledAt).getTime();
        const effectiveEnd = endMs ?? startMs;
        return effectiveEnd >= now;
      })
      .sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
  }, [localEvents, googleEvents, calendarPrefs]);

  // Handle completing an event
  const handleComplete = useCallback((id: string) => {
    completeEvent(id);
  }, [completeEvent]);

  // Handle uncompleting an event
  const handleUncomplete = useCallback((id: string) => {
    uncompleteEvent(id);
  }, [uncompleteEvent]);

  // Handle deleting an event (only for local events)
  const handleDelete = useCallback((id: string) => {
    deleteEvent(id);
  }, [deleteEvent]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-4 page-mount">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Calendar</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGoogleEvents}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Syncing..." : "Sync Google Calendar"}
            </Button>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Scheduled Event List */}
          <ScheduledEventList
            events={allEvents}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onDelete={handleDelete}
            canComplete={true}
            calendarMap={calendarMap}
          />
        </div>
      </main>
    </div>
  );
}
