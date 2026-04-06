"use client";

import { useMemo } from "react";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/types/tasks";

interface TaskListProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onAttachment?: (taskId: string, url: string) => void;
  onClearAttachment?: (taskId: string) => void;
  canComplete: boolean;
  canDelete?: boolean;
}

export function TaskList({
  tasks,
  onComplete,
  onUncomplete,
  onDelete,
  onUpdateTitle,
  onAttachment,
  onClearAttachment,
  canComplete,
  canDelete = true,
}: TaskListProps) {
  // Separate tasks by status and priority
  const { normalTasks, urgentTasks, completedTasks } = useMemo(() => {
    const normal: Task[] = [];
    const urgent: Task[] = [];
    const completed: Task[] = [];

    for (const task of tasks) {
      if (task.status === "completed") {
        completed.push(task);
      } else if (task.priority === "urgent") {
        urgent.push(task);
      } else {
        normal.push(task);
      }
    }

    // Sort by creation date (newest first)
    normal.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    urgent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Sort completed by completion date (most recent first)
    completed.sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });

    return { normalTasks: normal, urgentTasks: urgent, completedTasks: completed };
  }, [tasks]);

  const hasPendingTasks = normalTasks.length > 0 || urgentTasks.length > 0;

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No tasks yet.</p>
        <p className="text-sm mt-1">Add your first task above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Tasks - Side by Side Columns */}
      {hasPendingTasks && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Urgent Tasks Column - First (top on mobile, left on desktop) */}
          <div className="rounded-2xl bg-card/50 p-4">
            <h3 className="text-sm font-semibold text-orange-400 mb-3">
              Urgent ({urgentTasks.length})
            </h3>
            {urgentTasks.length > 0 ? (
              <div className="space-y-3 stagger-snap">
                {urgentTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onComplete={onComplete}
                    onUncomplete={onUncomplete}
                    onDelete={onDelete}
                    onUpdateTitle={onUpdateTitle}
                    onAttachment={onAttachment}
                    onClearAttachment={onClearAttachment}
                    canComplete={canComplete}
                    canDelete={canDelete}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No urgent tasks</p>
            )}
          </div>

          {/* Normal Tasks Column - Second (bottom on mobile, right on desktop) */}
          <div className="rounded-2xl bg-card/50 p-4">
            <h3 className="text-sm font-semibold text-blue-400 mb-3">
              Normal ({normalTasks.length})
            </h3>
            {normalTasks.length > 0 ? (
              <div className="space-y-3 stagger-snap">
                {normalTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onComplete={onComplete}
                    onUncomplete={onUncomplete}
                    onDelete={onDelete}
                    onUpdateTitle={onUpdateTitle}
                    onAttachment={onAttachment}
                    onClearAttachment={onClearAttachment}
                    canComplete={canComplete}
                    canDelete={canDelete}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No normal tasks</p>
            )}
          </div>
        </div>
      )}

      {/* Hairline Separator */}
      {completedTasks.length > 0 && (
        <div className="border-t border-muted-foreground/20" />
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-3 stagger-snap">
            {completedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                onAttachment={onAttachment}
                onClearAttachment={onClearAttachment}
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
