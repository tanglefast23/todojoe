"use client";

import { useMemo } from "react";
import { ScheduledEventItem } from "./ScheduledEventItem";
import type { ScheduledEvent } from "@/types/scheduled-events";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
} from "date-fns";

interface ScheduledEventListProps {
  events: ScheduledEvent[];
  getOwnerName: (ownerId: string | null) => string | undefined;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

interface EventsByDay {
  dateKey: string;
  displayDate: string;
  events: ScheduledEvent[];
}

function getDayTitle(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

function groupEventsByDay(events: ScheduledEvent[], dateField: "scheduledAt" | "completedAt"): EventsByDay[] {
  const groups = new Map<string, ScheduledEvent[]>();

  events.forEach((event) => {
    const dateValue = dateField === "completedAt" ? event.completedAt || event.scheduledAt : event.scheduledAt;
    const date = new Date(dateValue);
    const dateKey = startOfDay(date).toISOString();

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  });

  return Array.from(groups.entries()).map(([dateKey, events]) => ({
    dateKey,
    displayDate: getDayTitle(new Date(dateKey)),
    events,
  }));
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
  // Separate, sort, and group events by day
  const { pendingByDay, completedByDay } = useMemo(() => {
    const pending = events
      .filter((e) => e.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const completed = events
      .filter((e) => e.status === "completed")
      .sort((a, b) => new Date(b.completedAt || b.scheduledAt).getTime() - new Date(a.completedAt || a.scheduledAt).getTime());

    return {
      pendingByDay: groupEventsByDay(pending, "scheduledAt"),
      completedByDay: groupEventsByDay(completed, "completedAt"),
    };
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
    <div className="space-y-10">
      {/* Upcoming Events */}
      {pendingByDay.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-violet-400 flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming
          </h2>

          {pendingByDay.map((dayGroup) => (
            <div key={dayGroup.dateKey} className="space-y-3">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">
                {dayGroup.displayDate}
              </h3>
              <div className="space-y-3 pl-1">
                {dayGroup.events.map((event) => (
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
          ))}
        </div>
      )}

      {/* Completed Events */}
      {completedByDay.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Completed
          </h2>

          {completedByDay.map((dayGroup) => (
            <div key={dayGroup.dateKey} className="space-y-3">
              <h3 className="text-3xl font-bold tracking-tight text-foreground/70">
                {dayGroup.displayDate}
              </h3>
              <div className="space-y-3 pl-1">
                {dayGroup.events.map((event) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
