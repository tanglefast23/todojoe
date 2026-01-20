"use client";

import { useMemo } from "react";
import { ScheduledEventItem } from "./ScheduledEventItem";
import type { ScheduledEvent } from "@/types/scheduled-events";
import { CalendarDays } from "lucide-react";

interface ScheduledEventListProps {
  events: ScheduledEvent[];
  getOwnerName: (ownerId: string | null) => string | undefined;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

export function ScheduledEventList({
  events,
  getOwnerName,
  onComplete,
  onUncomplete,
  onDelete,
  canComplete,
  canDelete = false,
}: ScheduledEventListProps) {
  // Separate and sort events
  const { pendingEvents, completedEvents } = useMemo(() => {
    const pending = events
      .filter((e) => e.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const completed = events
      .filter((e) => e.status === "completed")
      .sort((a, b) => new Date(b.completedAt || b.scheduledAt).getTime() - new Date(a.completedAt || a.scheduledAt).getTime());

    return { pendingEvents: pending, completedEvents: completed };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CalendarDays className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No scheduled events</p>
        <p className="text-sm">Schedule events from the Entry page</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upcoming Events */}
      {pendingEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-violet-400 flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming ({pendingEvents.length})
          </h2>
          <div className="space-y-3">
            {pendingEvents.map((event) => (
              <ScheduledEventItem
                key={event.id}
                event={event}
                creatorName={getOwnerName(event.createdBy)}
                completerName={getOwnerName(event.completedBy)}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                canComplete={canComplete}
                canDelete={canDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Events */}
      {completedEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Completed ({completedEvents.length})
          </h2>
          <div className="space-y-3">
            {completedEvents.map((event) => (
              <ScheduledEventItem
                key={event.id}
                event={event}
                creatorName={getOwnerName(event.createdBy)}
                completerName={getOwnerName(event.completedBy)}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                canComplete={canComplete}
                canDelete={canDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
