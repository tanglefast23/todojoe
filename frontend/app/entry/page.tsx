"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { apiHeaders } from "@/lib/api-key";
import { Header } from "@/components/layout/Header";
import { AddTaskForm } from "@/components/tasks/AddTaskForm";
import { ScheduleTaskForm } from "@/components/tasks/ScheduleTaskForm";
import { useTasksStore } from "@/stores/tasksStore";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2, X, CheckCircle2, Zap, Calendar } from "lucide-react";
import type { TaskPriority } from "@/types/tasks";

interface ParsedEventResult {
  title: string;
  date: string;
  time: string;
  endTime?: string;
  description?: string;
}

interface CreatedEventResult {
  htmlLink?: string | null;
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
  const [createdEvent, setCreatedEvent] = useState<CreatedEventResult | null>(null);
  const nlEventInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss the Quick Add success card 5s after it appears.
  // Tied to the success state (not the submit handler) so it runs correctly
  // under React Strict Mode, survives re-renders, and cleans up on a new
  // submit or unmount without manual ref management.
  useEffect(() => {
    if (!nlEventSuccess) return;
    const id = setTimeout(() => {
      setNlEventSuccess(null);
      setParsedEvent(null);
      setCreatedEvent(null);
    }, 5000);
    return () => clearTimeout(id);
  }, [nlEventSuccess]);

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
    setCreatedEvent(null);

    try {
      const res = await fetch("/api/events/parse", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
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
      setCreatedEvent(data.event ?? null);
      setNlEventSuccess(data.message);
      setNlEventText("");

      // Return focus to the input so the user can immediately type the
      // next event without hunting for it (esp. on mobile where the
      // soft keyboard may have been dismissed on submit).
      nlEventInputRef.current?.focus();
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
          headers: apiHeaders({ "Content-Type": "application/json" }),
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

      <main className="flex-1 p-3 sm:p-4 page-mount">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Task Section */}
          <section className="space-y-2">
            <span className="text-[13px] font-semibold tracking-wide text-blue-400">
              Task
            </span>
            <AddTaskForm onAddTask={handleAddTask} />
          </section>

          {/* Calendar Section */}
          <section className="space-y-2">
            <span className="text-[13px] font-semibold tracking-wide text-blue-400">
              Calendar
            </span>
            <ScheduleTaskForm onScheduleTask={handleScheduleEvent} />
          </section>

          {/* Quick Add Section */}
          <section className="space-y-2">
            <span className="text-[13px] font-semibold tracking-wide text-blue-400">
              Quick Add
            </span>
            <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <Zap className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <input
                    ref={nlEventInputRef}
                    type="text"
                    value={nlEventText}
                    onChange={(e) => setNlEventText(e.target.value)}
                    onKeyDown={handleNlEventKeyDown}
                    placeholder="Dentist tomorrow at 3pm..."
                    aria-label="Describe a calendar event in natural language"
                    className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-muted-foreground/50 placeholder:italic placeholder:font-light"
                    disabled={nlEventLoading}
                  />
                  {nlEventText && !nlEventLoading && (
                    <button
                      onClick={() => setNlEventText("")}
                      aria-label="Clear input"
                      className="p-2 -m-1 hover:bg-muted rounded flex items-center justify-center flex-shrink-0"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleNlEventSubmit}
                  disabled={!nlEventText.trim() || nlEventLoading}
                  aria-label={nlEventLoading ? "Creating event" : "Add event"}
                  className="flex items-center gap-1.5 h-11 px-3 sm:px-4 rounded-lg bg-blue-500 text-white text-sm font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {nlEventLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Creating...</span>
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error */}
              {nlEventError && (
                <div className="mt-3 p-3 text-red-400 bg-red-500/10 rounded-lg text-sm">
                  {nlEventError}
                </div>
              )}

              {/* Success */}
              {nlEventSuccess && parsedEvent && (
                (() => {
                  const htmlLink = createdEvent?.htmlLink;
                  const content = (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{nlEventSuccess}</div>
                        {parsedEvent.description && (
                          <div className="text-green-400/70 text-xs mt-1">
                            Description: {parsedEvent.description}
                          </div>
                        )}
                        {htmlLink && (
                          <div className="text-green-400/60 text-xs mt-1">
                            Tap to open in Google Calendar
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  return htmlLink ? (
                    <a
                      href={htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 p-3 text-green-400 bg-green-500/10 rounded-lg text-sm block transition-colors hover:bg-green-500/20"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="mt-3 p-3 text-green-400 bg-green-500/10 rounded-lg text-sm">
                      {content}
                    </div>
                  );
                })()
              )}
            </div>
          </section>

          {/* From Image Section */}
          <section className="space-y-2">
            <span className="text-[13px] font-semibold tracking-wide text-blue-400">
              From Image
            </span>
            <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
              {/* Image Preview */}
              {imagePreview && (
                <div className="mb-4 relative inline-block max-w-full">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="max-h-40 max-w-full rounded-lg border border-border"
                  />
                  {!isLoading && (
                    <button
                      onClick={removeImage}
                      aria-label="Remove image"
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <button
                  onClick={() => calendarFileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-lg bg-card border border-border text-blue-400 text-sm font-medium transition-all hover:bg-muted disabled:opacity-50 flex-shrink-0 self-start sm:self-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4" />
                      Upload
                    </>
                  )}
                </button>
                <span className="text-[13px] text-muted-foreground leading-snug">
                  Upload a flyer or screenshot to extract events
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
