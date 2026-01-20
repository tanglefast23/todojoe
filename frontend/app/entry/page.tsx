"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { ScheduleTaskForm } from "@/components/tasks/ScheduleTaskForm";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { useOwnerStore } from "@/stores/ownerStore";
import type { TaskPriority } from "@/types/tasks";

export default function EntryPage() {
  const router = useRouter();

  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Tasks state
  const addTask = useTasksStore((state) => state.addTask);

  // Scheduled events state
  const addEvent = useScheduledEventsStore((state) => state.addEvent);

  // Owner state
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);
  const isMasterLoggedIn = useOwnerStore((state) => state.isMasterLoggedIn);

  // Hydration-safe
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeOwnerId = isMounted ? getActiveOwnerId() : null;
  const isMaster = isMounted ? isMasterLoggedIn() : false;

  // Redirect non-master users to tasks page
  useEffect(() => {
    if (isMounted && !isMaster) {
      router.replace("/tasks");
    }
  }, [isMounted, isMaster, router]);

  // Handle adding a new task
  const handleAddTask = useCallback((title: string, priority: TaskPriority) => {
    if (!activeOwnerId) return;
    addTask(title, priority, activeOwnerId);
  }, [activeOwnerId, addTask]);

  // Handle scheduling a new event
  const handleScheduleEvent = useCallback((title: string, scheduledAt: string) => {
    if (!activeOwnerId) return;
    addEvent(title, scheduledAt, activeOwnerId);
  }, [activeOwnerId, addEvent]);

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show loading while checking master status
  if (!isMounted || !isMaster) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Entry</h1>

          {/* Add Task Form - Master only */}
          <AddTaskForm
            onAddTask={handleAddTask}
            disabled={!isMounted || !activeOwnerId}
          />

          {/* Schedule Event Form - Master only */}
          <ScheduleTaskForm
            onScheduleTask={handleScheduleEvent}
            disabled={!isMounted || !activeOwnerId}
          />
        </div>
      </main>
    </div>
  );
}
