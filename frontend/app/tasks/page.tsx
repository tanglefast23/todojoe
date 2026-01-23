"use client";

import { useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { TaskList } from "@/components/tasks/TaskList";
import { useTasksStore } from "@/stores/tasksStore";

export default function TasksPage() {
  // Tasks state
  const tasks = useTasksStore((state) => state.tasks);
  const completeTask = useTasksStore((state) => state.completeTask);
  const uncompleteTask = useTasksStore((state) => state.uncompleteTask);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const setTaskAttachment = useTasksStore((state) => state.setTaskAttachment);
  const clearTaskAttachment = useTasksStore((state) => state.clearTaskAttachment);

  // Handle completing a task
  const handleComplete = useCallback((id: string) => {
    completeTask(id);
  }, [completeTask]);

  // Handle uncompleting a task
  const handleUncomplete = useCallback((id: string) => {
    uncompleteTask(id);
  }, [uncompleteTask]);

  // Handle deleting a task
  const handleDelete = useCallback((id: string) => {
    deleteTask(id);
  }, [deleteTask]);

  // Handle adding attachment to a task
  const handleAttachment = useCallback((taskId: string, url: string) => {
    setTaskAttachment(taskId, url);
  }, [setTaskAttachment]);

  // Handle clearing attachment from a task
  const handleClearAttachment = useCallback((taskId: string) => {
    clearTaskAttachment(taskId);
  }, [clearTaskAttachment]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-5 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-[13px] font-semibold tracking-wide text-indigo-400">Tasks</h1>

          {/* Task List */}
          <TaskList
            tasks={tasks}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onDelete={handleDelete}
            onAttachment={handleAttachment}
            onClearAttachment={handleClearAttachment}
            canComplete={true}
            canDelete={true}
          />
        </div>
      </main>
    </div>
  );
}
