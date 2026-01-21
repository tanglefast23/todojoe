"use client";

import { useState } from "react";
import { Download, Upload, Trash2 } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";

export default function SettingsPage() {
  const tasksStore = useTasksStore();
  const scheduledEventsStore = useScheduledEventsStore();

  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleExport = () => {
    // Export all data
    const data = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      tasks: tasksStore.tasks,
      scheduledEvents: scheduledEventsStore.events,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jv-todo-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data structure
        if (!data.version) {
          alert("Invalid backup file format");
          return;
        }

        // Import tasks
        if (data.tasks) {
          tasksStore.setTasks(data.tasks);
        }

        // Import scheduled events
        if (data.scheduledEvents) {
          scheduledEventsStore.setEvents(data.scheduledEvents);
        }

        alert("Data imported successfully! Page will reload to apply changes.");
        window.location.reload();
      } catch (error) {
        console.error("Import error:", error);
        alert("Failed to import data. Please check the file format.");
      }
    };
    input.click();
  };

  const handleClearAllData = () => {
    setClearDataOpen(true);
  };

  const confirmClearAllData = async () => {
    setIsClearing(true);

    try {
      // Clear local stores
      tasksStore.setTasks([]);
      scheduledEventsStore.setEvents([]);

      // Clear localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      setIsClearing(false);
      window.location.reload();
    } catch (error) {
      console.error("Error clearing data:", error);
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Settings</h1>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or import your tasks and calendar events as JSON backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={handleExport} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
                <Button onClick={handleImport} variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions - proceed with caution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleClearAllData} disabled={isClearing}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isClearing ? "Clearing..." : "Clear All Data"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <ConfirmDialog
        open={clearDataOpen}
        onOpenChange={setClearDataOpen}
        title="Clear All Data"
        description="Are you sure you want to clear all data? This will permanently delete all tasks and calendar events. This action cannot be undone."
        confirmLabel="Clear All Data"
        cancelLabel="Cancel"
        onConfirm={confirmClearAllData}
        variant="destructive"
      />
    </div>
  );
}
