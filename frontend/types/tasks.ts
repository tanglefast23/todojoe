export type TaskPriority = 'regular' | 'urgent';
export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  createdBy: string | null;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
  status: TaskStatus;
  updatedAt: string;
}

export interface TaskWithOwner extends Task {
  creatorName?: string;
  completerName?: string;
}
