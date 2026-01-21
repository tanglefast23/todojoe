"use client";

import { useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { ScheduleTaskForm } from "@/components/tasks/ScheduleTaskForm";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import type { TaskPriority } from "@/types/tasks";

export default function EntryPage() {
  // Task store actions
  const addTask = useTasksStore((state) => state.addTask);

  // Scheduled events store actions
  const addEvent = useScheduledEventsStore((state) => state.addEvent);

  // Handle adding a new task
  const handleAddTask = useCallback(
    (title: string, priority: TaskPriority) => {
      addTask(title, priority);
    },
    [addTask]
  );

  // Handle scheduling a new event
  const handleScheduleEvent = useCallback(
    (title: string, scheduledAt: string) => {
      addEvent(title, scheduledAt);
    },
    [addEvent]
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold">Quick Entry</h1>

          {/* Add Task Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-muted-foreground">Add Task</h2>
              <span className="text-xs text-muted-foreground/60">(Normal or Urgent)</span>
            </div>
            <AddTaskForm onAddTask={handleAddTask} />
          </section>

          {/* Schedule Event Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-muted-foreground">Schedule Event</h2>
              <span className="text-xs text-muted-foreground/60">(Pick date & time)</span>
            </div>
            <ScheduleTaskForm onScheduleTask={handleScheduleEvent} />
          </section>
        </div>
      </main>
    </div>
  );
}
