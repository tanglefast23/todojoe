"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { TaskList } from "@/components/tasks/TaskList";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useTasksStore } from "@/stores/tasksStore";
import { useOwnerStore } from "@/stores/ownerStore";
import type { TaskPriority } from "@/types/tasks";

export default function TasksPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Tasks state
  const tasks = useTasksStore((state) => state.tasks);
  const addTask = useTasksStore((state) => state.addTask);
  const completeTask = useTasksStore((state) => state.completeTask);
  const uncompleteTask = useTasksStore((state) => state.uncompleteTask);
  const deleteTask = useTasksStore((state) => state.deleteTask);

  // Owner state
  const owners = useOwnerStore((state) => state.owners);
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);

  // Hydration-safe
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeOwnerId = isMounted ? getActiveOwnerId() : null;

  // Get owner name by ID
  const getOwnerName = useCallback((ownerId: string | null): string | undefined => {
    if (!ownerId) return undefined;
    const owner = owners.find((o) => o.id === ownerId);
    return owner?.name;
  }, [owners]);

  // Handle adding a new task
  const handleAddTask = useCallback((title: string, priority: TaskPriority) => {
    if (!activeOwnerId) return;
    addTask(title, priority, activeOwnerId);
  }, [activeOwnerId, addTask]);

  // Handle completing a task
  const handleComplete = useCallback((id: string) => {
    if (!activeOwnerId) return;
    completeTask(id, activeOwnerId);
  }, [activeOwnerId, completeTask]);

  // Handle uncompleting a task
  const handleUncomplete = useCallback((id: string) => {
    uncompleteTask(id);
  }, [uncompleteTask]);

  // Handle deleting a task
  const handleDelete = useCallback((id: string) => {
    deleteTask(id);
  }, [deleteTask]);

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
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
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">
              Manage your to-do items and track progress
            </p>
          </div>

          {/* Add Task Form */}
          <AddTaskForm
            onAddTask={handleAddTask}
            disabled={!isMounted || !activeOwnerId}
          />

          {/* Task List */}
          <TaskList
            tasks={tasks}
            getOwnerName={getOwnerName}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onDelete={handleDelete}
            canComplete={true}
          />
        </div>
      </main>
    </div>
  );
}
