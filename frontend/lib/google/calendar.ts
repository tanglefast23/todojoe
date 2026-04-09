/**
 * Google Calendar API utilities
 */

import { google, calendar_v3 } from "googleapis";
import { getAuthClient } from "./auth";
import type { ScheduledEvent } from "@/types/scheduled-events";

/**
 * Get Google Calendar API client
 */
async function getCalendarClient() {
  const auth = await getAuthClient();
  if (!auth) {
    throw new Error("Not authenticated with Google");
  }
  return google.calendar({ version: "v3", auth });
}

/**
 * Convert Google Calendar event to ScheduledEvent format
 */
function googleEventToScheduledEvent(event: calendar_v3.Schema$Event, calendarId: string): ScheduledEvent {
  const startTime = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const endTime = event.end?.dateTime || event.end?.date || null;

  // Extract popup reminder offset (minutes before event) if present.
  // Google returns an array of overrides; we surface the smallest popup offset
  // since that's the one that would fire first.
  const popupOverrides = (event.reminders?.overrides || []).filter(
    (r) => r.method === "popup" && typeof r.minutes === "number"
  );
  const reminderMinutes = popupOverrides.length > 0
    ? Math.min(...popupOverrides.map((r) => r.minutes as number))
    : null;

  return {
    id: crypto.randomUUID(),
    title: event.summary || "Untitled Event",
    description: event.description || null,
    scheduledAt: startTime,
    endAt: endTime,
    createdAt: event.created || new Date().toISOString(),
    completedAt: null,
    status: "pending",
    source: "google",
    googleEventId: event.id || null,
    googleCalendarId: calendarId,
    htmlLink: event.htmlLink || null,
    colorId: event.colorId || null,
    reminderMinutes,
    lastSyncedAt: new Date().toISOString(),
    updatedAt: event.updated || new Date().toISOString(),
  };
}

/**
 * Fetch upcoming events from Google Calendar
 * @param calendarId - Calendar ID (default: "primary")
 * @param maxEvents - Maximum number of events to fetch (default: 15)
 */
export async function getCalendarEvents(
  calendarId: string = "primary",
  maxEvents: number = 15
): Promise<ScheduledEvent[]> {
  const calendar = await getCalendarClient();

  const now = new Date();

  // Fetch next N events from now, no end date limit
  // This is faster than date range queries because it stops after finding N events
  const response = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: maxEvents,
  });

  const events = response.data.items || [];
  return events.map((event) => googleEventToScheduledEvent(event, calendarId));
}

/**
 * Create a new event on Google Calendar
 */
export async function createCalendarEvent(
  title: string,
  startTime: string,
  endTime?: string,
  description?: string,
  calendarId: string = "primary",
  timeZone?: string
): Promise<ScheduledEvent> {
  const calendar = await getCalendarClient();

  // If no end time provided, default to 1 hour after start
  const eventEndTime = endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

  // Use provided timezone or fall back to UTC (server-side safe default)
  const eventTimeZone = timeZone || "UTC";

  const event: calendar_v3.Schema$Event = {
    summary: title,
    description,
    start: {
      dateTime: startTime,
      timeZone: eventTimeZone,
    },
    end: {
      dateTime: eventEndTime,
      timeZone: eventTimeZone,
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return googleEventToScheduledEvent(response.data, calendarId);
}

/**
 * Update an existing Google Calendar event
 */
export async function updateCalendarEvent(
  googleEventId: string,
  updates: {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
  },
  calendarId: string = "primary",
  timeZone?: string
): Promise<ScheduledEvent> {
  const calendar = await getCalendarClient();

  // Use provided timezone or fall back to UTC (server-side safe default)
  const eventTimeZone = timeZone || "UTC";

  // Get existing event
  const existing = await calendar.events.get({
    calendarId,
    eventId: googleEventId,
  });

  const event: calendar_v3.Schema$Event = {
    ...existing.data,
    summary: updates.title ?? existing.data.summary,
    description: updates.description ?? existing.data.description,
  };

  if (updates.startTime) {
    event.start = {
      dateTime: updates.startTime,
      timeZone: eventTimeZone,
    };
  }

  if (updates.endTime) {
    event.end = {
      dateTime: updates.endTime,
      timeZone: eventTimeZone,
    };
  }

  const response = await calendar.events.update({
    calendarId,
    eventId: googleEventId,
    requestBody: event,
  });

  return googleEventToScheduledEvent(response.data, calendarId);
}

/**
 * Set or clear a popup reminder on a Google Calendar event.
 *
 * Google reminders are offsets — pass 60 to mean "60 minutes before the
 * event start". Google computes the absolute fire time from the event's
 * scheduled start, so the reminder adjusts automatically if the event
 * moves. Pass null to clear all overrides (and opt out of default).
 */
export async function setEventReminder(
  googleEventId: string,
  minutes: number | null,
  calendarId: string = "primary"
): Promise<ScheduledEvent> {
  const calendar = await getCalendarClient();

  // PATCH is safer than update() here — it only sends the reminders field
  // and leaves every other field on the event alone.
  const response = await calendar.events.patch({
    calendarId,
    eventId: googleEventId,
    requestBody: {
      reminders: {
        useDefault: false,
        overrides: minutes === null
          ? []
          : [{ method: "popup", minutes }],
      },
    },
  });

  return googleEventToScheduledEvent(response.data, calendarId);
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(
  googleEventId: string,
  calendarId: string = "primary"
): Promise<void> {
  const calendar = await getCalendarClient();
  await calendar.events.delete({
    calendarId,
    eventId: googleEventId,
  });
}

/**
 * Get list of calendars
 */
export interface CalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  accessRole: string;
  backgroundColor: string;
}

export async function getCalendarList(): Promise<CalendarInfo[]> {
  const calendar = await getCalendarClient();

  const response = await calendar.calendarList.list();
  const calendars = response.data.items || [];

  return calendars.map((cal) => ({
    id: cal.id || "",
    name: cal.summary || "Unnamed Calendar",
    primary: cal.primary || false,
    accessRole: cal.accessRole || "reader",
    backgroundColor: cal.backgroundColor || "#1a73e8",
  }));
}
