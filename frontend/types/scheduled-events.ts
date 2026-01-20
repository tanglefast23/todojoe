export type ScheduledEventStatus = 'pending' | 'completed';

export interface ScheduledEvent {
  id: string;
  title: string;
  scheduledAt: string; // ISO timestamp for when the event is scheduled
  createdBy: string | null;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
  status: ScheduledEventStatus;
  updatedAt: string;
}

export interface ScheduledEventWithOwner extends ScheduledEvent {
  creatorName?: string;
  completerName?: string;
}
