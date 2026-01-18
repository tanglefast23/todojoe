"use client";

import { useMemo } from "react";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/types/tasks";

interface TaskListProps {
  tasks: Task[];
  getOwnerName: (ownerId: string | null) => string | undefined;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  canComplete: boolean;
}

export function TaskList({
  tasks,
  getOwnerName,
  onComplete,
  onUncomplete,
  onDelete,
  canComplete,
}: TaskListProps) {
  // Separate pending and completed tasks
  const { pendingTasks, completedTasks } = useMemo(() => {
    const pending: Task[] = [];
    const completed: Task[] = [];

    for (const task of tasks) {
      if (task.status === "completed") {
        completed.push(task);
      } else {
        pending.push(task);
      }
    }

    // Sort pending: urgent first, then by creation date (newest first)
    pending.sort((a, b) => {
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (a.priority !== "urgent" && b.priority === "urgent") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Sort completed by completion date (most recent first)
    completed.sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });

    return { pendingTasks: pending, completedTasks: completed };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks yet. Add your first task above.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending ({pendingTasks.length})
          </h3>
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                creatorName={getOwnerName(task.createdBy)}
                completerName={undefined}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                canComplete={canComplete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                creatorName={getOwnerName(task.createdBy)}
                completerName={getOwnerName(task.completedBy)}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                canComplete={canComplete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
