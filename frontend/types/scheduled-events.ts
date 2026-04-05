export type ScheduledEventStatus = 'pending' | 'completed';
export type ScheduledEventSource = 'local' | 'google';

export interface ScheduledEvent {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: string; // ISO timestamp for when the event is scheduled
  endAt?: string | null; // ISO timestamp for when the event ends
  createdAt: string;
  completedAt: string | null;
  status: ScheduledEventStatus;
  source: ScheduledEventSource;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  htmlLink?: string | null; // URL to open the event in Google Calendar
  lastSyncedAt?: string | null;
  updatedAt: string;
}
