"use client";

import { useState } from "react";
import { Download, Upload, Trash2 } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import type { Task } from "@/types/tasks";
import type { ScheduledEvent } from "@/types/scheduled-events";

interface BackupFile {
  version: string;
  exportedAt?: string;
  tasks: Task[];
  scheduledEvents: ScheduledEvent[];
}

/**
 * Validate that imported JSON matches the backup file shape.
 * Returns a discriminated result so callers get a specific error message
 * instead of a generic "invalid format" alert.
 */
function validateBackup(data: unknown): { ok: true; data: BackupFile } | { ok: false; error: string } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Backup must be a JSON object." };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== "string") {
    return { ok: false, error: "Missing or invalid version field." };
  }

  if (!Array.isArray(obj.tasks)) {
    return { ok: false, error: "Missing or invalid 'tasks' array." };
  }

  if (!Array.isArray(obj.scheduledEvents)) {
    return { ok: false, error: "Missing or invalid 'scheduledEvents' array." };
  }

  // Validate minimum fields on each task entry (id + title required; status must be a string)
  for (let i = 0; i < obj.tasks.length; i++) {
    const t = obj.tasks[i] as Record<string, unknown> | null;
    if (!t || typeof t !== "object") {
      return { ok: false, error: `Task at index ${i} is not an object.` };
    }
    if (typeof t.id !== "string" || typeof t.title !== "string") {
      return { ok: false, error: `Task at index ${i} is missing id or title.` };
    }
  }

  // Validate minimum fields on each event entry
  for (let i = 0; i < obj.scheduledEvents.length; i++) {
    const ev = obj.scheduledEvents[i] as Record<string, unknown> | null;
    if (!ev || typeof ev !== "object") {
      return { ok: false, error: `Event at index ${i} is not an object.` };
    }
    if (typeof ev.id !== "string" || typeof ev.title !== "string" || typeof ev.scheduledAt !== "string") {
      return { ok: false, error: `Event at index ${i} is missing id, title, or scheduledAt.` };
    }
  }

  return { ok: true, data: obj as unknown as BackupFile };
}

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
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Cap at 10MB to prevent OOM on malicious/corrupt files
      if (file.size > 10 * 1024 * 1024) {
        alert("Backup file is too large (max 10MB).");
        return;
      }

      let parsed: unknown;
      try {
        const text = await file.text();
        parsed = JSON.parse(text);
      } catch {
        alert("Could not parse the file. Is it valid JSON?");
        return;
      }

      const result = validateBackup(parsed);
      if (!result.ok) {
        alert(`Invalid backup file: ${result.error}`);
        return;
      }

      try {
        tasksStore.setTasks(result.data.tasks);
        scheduledEventsStore.setEvents(result.data.scheduledEvents);
        alert(
          `Imported ${result.data.tasks.length} task(s) and ${result.data.scheduledEvents.length} event(s). Reloading to apply changes.`
        );
        window.location.reload();
      } catch (error) {
        console.error("Import error:", error);
        alert("Failed to apply imported data. Your existing data was not changed.");
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

      <main className="flex-1 p-6 page-mount">
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
