"use client";

import { useCallback, useState, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { ScheduleTaskForm } from "@/components/tasks/ScheduleTaskForm";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2, X, CheckCircle2, Sparkles, Calendar } from "lucide-react";
import type { TaskPriority } from "@/types/tasks";

interface ParsedEventResult {
  title: string;
  date: string;
  time: string;
  endTime?: string;
  description?: string;
}

export default function EntryPage() {
  // Task store actions
  const addTask = useTasksStore((state) => state.addTask);

  // Scheduled events store actions
  const addEvent = useScheduledEventsStore((state) => state.addEvent);

  // Natural language event state
  const [nlEventText, setNlEventText] = useState("");
  const [nlEventLoading, setNlEventLoading] = useState(false);
  const [nlEventError, setNlEventError] = useState<string | null>(null);
  const [nlEventSuccess, setNlEventSuccess] = useState<string | null>(null);
  const [parsedEvent, setParsedEvent] = useState<ParsedEventResult | null>(null);
  const nlEventInputRef = useRef<HTMLInputElement>(null);

  // Calendar image upload state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const calendarFileInputRef = useRef<HTMLInputElement>(null);

  // Handle natural language event creation
  const handleNlEventSubmit = useCallback(async () => {
    if (!nlEventText.trim()) return;

    setNlEventLoading(true);
    setNlEventError(null);
    setNlEventSuccess(null);
    setParsedEvent(null);

    try {
      const res = await fetch("/api/events/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: nlEventText.trim(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }

      setParsedEvent(data.parsed);
      setNlEventSuccess(data.message);
      setNlEventText("");
    } catch (err) {
      setNlEventError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setNlEventLoading(false);
    }
  }, [nlEventText]);

  // Handle Enter key for natural language input
  const handleNlEventKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNlEventSubmit();
      }
    },
    [handleNlEventSubmit]
  );

  // Handle calendar image upload and process
  const handleCalendarImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setSuccess(null);

    // Check file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be less than 4MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Read file and show preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setIsLoading(true);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "Create all calendar events from this image",
            image: base64,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to process image");
        }

        setSuccess(data.response);
        // Clear preview after success
        setTimeout(() => {
          setImagePreview(null);
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process image");
      } finally {
        setIsLoading(false);
        // Reset file input
        if (calendarFileInputRef.current) {
          calendarFileInputRef.current.value = "";
        }
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // Remove image preview
  const removeImage = useCallback(() => {
    setImagePreview(null);
    setError(null);
    setSuccess(null);
    if (calendarFileInputRef.current) {
      calendarFileInputRef.current.value = "";
    }
  }, []);

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
          {/* Task Section */}
          <section className="space-y-4">
            <span className="inline-block px-3 py-1 bg-violet-600 text-white text-sm font-medium rounded-full">
              Task
            </span>
            <AddTaskForm onAddTask={handleAddTask} />
          </section>

          {/* Calendar Section */}
          <section className="space-y-4">
            <span className="inline-block px-3 py-1 bg-violet-600 text-white text-sm font-medium rounded-full">
              Calendar
            </span>
            <ScheduleTaskForm onScheduleTask={handleScheduleEvent} />
          </section>

          {/* Calendar from Language Section */}
          <section className="space-y-4">
            <span className="inline-block px-3 py-1 bg-violet-600 text-white text-sm font-medium rounded-full">
              Calendar from Language
            </span>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-violet-400 flex-shrink-0" />
                <input
                  ref={nlEventInputRef}
                  type="text"
                  value={nlEventText}
                  onChange={(e) => setNlEventText(e.target.value)}
                  onKeyDown={handleNlEventKeyDown}
                  placeholder="Dentist tomorrow at 3pm at 123 Main St..."
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  disabled={nlEventLoading}
                />
                {nlEventText && !nlEventLoading && (
                  <button
                    onClick={() => setNlEventText("")}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <Button
                  onClick={handleNlEventSubmit}
                  disabled={!nlEventText.trim() || nlEventLoading}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {nlEventLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Add
                    </>
                  )}
                </Button>
              </div>

              {/* Error */}
              {nlEventError && (
                <div className="mt-3 p-3 text-red-400 bg-red-500/10 rounded-lg text-sm">
                  {nlEventError}
                </div>
              )}

              {/* Success */}
              {nlEventSuccess && parsedEvent && (
                <div className="mt-3 p-3 text-green-400 bg-green-500/10 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{nlEventSuccess}</div>
                      {parsedEvent.description && (
                        <div className="text-green-400/70 text-xs mt-1">
                          Description: {parsedEvent.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Calendar from Image Section */}
          <section className="space-y-4">
            <span className="inline-block px-3 py-1 bg-violet-600 text-white text-sm font-medium rounded-full">
              Calendar from Image
            </span>
            <div className="bg-card border border-border rounded-xl p-4">
              {/* Image Preview */}
              {imagePreview && (
                <div className="mb-4 relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="max-h-40 rounded-lg border border-border"
                  />
                  {!isLoading && (
                    <button
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Upload Button */}
              <input
                ref={calendarFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCalendarImageUpload}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => calendarFileInputRef.current?.click()}
                  disabled={isLoading}
                  variant="outline"
                  className="flex items-center gap-2 text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="h-4 w-4" />
                      Upload Image
                    </>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Upload a flyer, screenshot, or photo to extract calendar events
                </span>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-3 p-3 text-red-400 bg-red-500/10 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="mt-3 p-3 text-green-400 bg-green-500/10 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="whitespace-pre-wrap">{success}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
