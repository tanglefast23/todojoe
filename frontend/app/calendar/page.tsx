"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ScheduledEventList } from "@/components/calendar/ScheduledEventList";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { Button } from "@/components/ui/button";
import type { ScheduledEvent } from "@/types/scheduled-events";

export default function CalendarPage() {
  // Local scheduled events state
  const localEvents = useScheduledEventsStore((state) => state.events);
  const completeEvent = useScheduledEventsStore((state) => state.completeEvent);
  const uncompleteEvent = useScheduledEventsStore((state) => state.uncompleteEvent);
  const deleteEvent = useScheduledEventsStore((state) => state.deleteEvent);

  // Google Calendar events state
  const [googleEvents, setGoogleEvents] = useState<ScheduledEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Google Calendar events
  const fetchGoogleEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/google/calendar/events");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch calendar events");
      }
      const data = await response.json();
      setGoogleEvents(data.events || []);
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

  // Combine local and Google events, sorted by date
  const allEvents = [...localEvents, ...googleEvents].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

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

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Calendar</h1>
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
          />
        </div>
      </main>
    </div>
  );
}
