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
  calendarId: string = "primary"
): Promise<ScheduledEvent> {
  const calendar = await getCalendarClient();

  // If no end time provided, default to 1 hour after start
  const eventEndTime = endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

  const event: calendar_v3.Schema$Event = {
    summary: title,
    description,
    start: {
      dateTime: startTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: eventEndTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  calendarId: string = "primary"
): Promise<ScheduledEvent> {
  const calendar = await getCalendarClient();

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
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  if (updates.endTime) {
    event.end = {
      dateTime: updates.endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
export async function getCalendarList(): Promise<{ id: string; name: string; primary: boolean }[]> {
  const calendar = await getCalendarClient();

  const response = await calendar.calendarList.list();
  const calendars = response.data.items || [];

  return calendars.map((cal) => ({
    id: cal.id || "",
    name: cal.summary || "Unnamed Calendar",
    primary: cal.primary || false,
  }));
}
