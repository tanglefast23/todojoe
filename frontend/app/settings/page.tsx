"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Download, Upload, Trash2, Loader2 } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { useCalendarPrefsStore } from "@/stores/calendarPrefsStore";
import { PICKER_COLORS } from "@/lib/google/event-colors";
import { apiHeaders } from "@/lib/api-key";
import type { Task } from "@/types/tasks";
import type { ScheduledEvent } from "@/types/scheduled-events";
import type { CalendarInfo } from "@/lib/google/calendar";

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

// Long-press duration to open color picker (ms)
const COLOR_LONG_PRESS_MS = 500;

export default function SettingsPage() {
  const tasksStore = useTasksStore();
  const scheduledEventsStore = useScheduledEventsStore();
  const calendarPrefs = useCalendarPrefsStore();

  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Google Calendars state
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [calendarsError, setCalendarsError] = useState<string | null>(null);
  const [colorPickerCalId, setColorPickerCalId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch Google Calendar list
  const fetchCalendars = useCallback(async () => {
    setCalendarsLoading(true);
    setCalendarsError(null);
    try {
      const res = await fetch("/api/google/calendar/list", { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to fetch calendars");
      const data = await res.json();
      setCalendars(data.calendars || []);
    } catch (err) {
      setCalendarsError(err instanceof Error ? err.message : "Failed to load calendars");
    } finally {
      setCalendarsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  const handleColorDotPointerDown = useCallback((calId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setColorPickerCalId(calId);
    }, COLOR_LONG_PRESS_MS);
  }, []);

  const handleColorDotPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePickColor = useCallback((calId: string, hex: string) => {
    calendarPrefs.setColorOverride(calId, hex);
    setColorPickerCalId(null);
  }, [calendarPrefs]);

  const handleClearColorOverride = useCallback((calId: string) => {
    calendarPrefs.setColorOverride(calId, null);
    setColorPickerCalId(null);
  }, [calendarPrefs]);

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

          {/* Google Calendars */}
          <Card>
            <CardHeader>
              <CardTitle>Google Calendars</CardTitle>
              <CardDescription>
                Choose which calendars show on the Calendar page. Long-press a color to change it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendarsLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading calendars...
                </div>
              )}
              {calendarsError && (
                <div className="text-red-400 text-sm py-2">{calendarsError}</div>
              )}
              {!calendarsLoading && calendars.length > 0 && (
                <div className="space-y-1">
                  {calendars.map((cal) => {
                    const pref = calendarPrefs.getPref(cal.id);
                    const displayColor = pref.colorOverride || cal.backgroundColor;
                    return (
                      <div key={cal.id} className="relative">
                        <div className="flex items-center gap-3 py-2.5 px-1">
                          {/* Color dot — long press to open picker */}
                          <button
                            onPointerDown={() => handleColorDotPointerDown(cal.id)}
                            onPointerUp={handleColorDotPointerUp}
                            onPointerCancel={handleColorDotPointerUp}
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-background shadow-sm transition-transform active:scale-110"
                            style={{ backgroundColor: displayColor }}
                            aria-label={`Change color for ${cal.name}`}
                          />

                          {/* Calendar name */}
                          <span className="flex-1 text-sm font-medium truncate">
                            {cal.name}
                            {cal.primary && (
                              <span className="ml-1.5 text-xs text-muted-foreground">(Primary)</span>
                            )}
                          </span>

                          {/* Visibility toggle */}
                          <Switch
                            checked={pref.visible}
                            onCheckedChange={() => calendarPrefs.toggleVisibility(cal.id)}
                            aria-label={`Toggle ${cal.name} visibility`}
                          />
                        </div>

                        {/* Color picker — shown on long-press */}
                        {colorPickerCalId === cal.id && (
                          <div
                            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
                            onClick={() => setColorPickerCalId(null)}
                          >
                            <div
                              className="bg-background border-t sm:border sm:rounded-xl rounded-t-2xl w-full sm:max-w-sm sm:mx-4 p-4 pb-6 sm:pb-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h3 className="font-semibold mb-3 text-sm">
                                Color for {cal.name}
                              </h3>
                              <div className="grid grid-cols-6 gap-3">
                                {PICKER_COLORS.map((color) => (
                                  <button
                                    key={color.hex}
                                    onClick={() => handlePickColor(cal.id, color.hex)}
                                    className="w-10 h-10 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400"
                                    style={{
                                      backgroundColor: color.hex,
                                      boxShadow: displayColor === color.hex ? `0 0 0 3px ${color.hex}44, 0 0 0 5px var(--foreground)` : undefined,
                                    }}
                                    aria-label={color.name}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                              {pref.colorOverride && (
                                <button
                                  onClick={() => handleClearColorOverride(cal.id)}
                                  className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Reset to default
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!calendarsLoading && calendars.length === 0 && !calendarsError && (
                <p className="text-sm text-muted-foreground py-2">
                  No Google calendars found. Make sure Google Calendar is connected.
                </p>
              )}
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
