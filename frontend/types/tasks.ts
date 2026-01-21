export type TaskPriority = 'regular' | 'urgent';
export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  createdAt: string;
  completedAt: string | null;
  status: TaskStatus;
  attachmentUrl: string | null;
  updatedAt: string;
}
