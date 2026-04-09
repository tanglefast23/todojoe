"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, Zap, Loader2 } from "lucide-react";
import { apiHeaders } from "@/lib/api-key";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CalendarOption {
  id: string;
  name: string;
  primary: boolean;
}

const PREFERRED_CALENDAR_KEY = "preferred-calendar-id";

interface ScheduleTaskFormProps {
  onScheduleTask: (title: string, scheduledAt: string, calendarId?: string) => void;
  onQuickAdd?: (title: string) => void;
  quickAddLoading?: boolean;
  disabled?: boolean;
}

type ScheduleStep = "date" | "time";

export function ScheduleTaskForm({ onScheduleTask, onQuickAdd, quickAddLoading = false, disabled = false }: ScheduleTaskFormProps) {
  const [title, setTitle] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("PM");
  const [step, setStep] = useState<ScheduleStep>("date");
  const [isFocused, setIsFocused] = useState(false);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch writable calendars when dialog opens
  const fetchCalendars = useCallback(async () => {
    if (calendars.length > 0) return; // already loaded
    setCalendarsLoading(true);
    try {
      const res = await fetch("/api/google/calendar/list", {
        headers: apiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: CalendarOption[] = data.calendars ?? [];
      setCalendars(list);

      // Restore last-used calendar, or fall back to primary
      const stored = localStorage.getItem(PREFERRED_CALENDAR_KEY);
      const match = list.find((c) => c.id === stored);
      if (match) {
        setSelectedCalendarId(match.id);
      } else {
        const primary = list.find((c) => c.primary);
        setSelectedCalendarId(primary?.id ?? list[0]?.id ?? null);
      }
    } catch {
      // Silently fail — calendar picker just won't show
    } finally {
      setCalendarsLoading(false);
    }
  }, [calendars.length]);

  // Fetch calendars when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      fetchCalendars();
    }
  }, [isDialogOpen, fetchCalendars]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setStep("date");
    }
  }, [isDialogOpen]);

  const handleScheduleClick = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setIsDialogOpen(true);
  };

  const handleQuickAddClick = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !onQuickAdd) return;
    onQuickAdd(trimmedTitle);
    setTitle("");
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setStep("time");
    }
  };

  const handleConfirmSchedule = () => {
    if (!selectedDate) return;

    // Convert 12-hour format to 24-hour format
    let hour = parseInt(selectedHour, 10);
    if (selectedPeriod === "PM" && hour !== 12) {
      hour += 12;
    } else if (selectedPeriod === "AM" && hour === 12) {
      hour = 0;
    }

    // Create the scheduled date with time
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hour, parseInt(selectedMinute, 10), 0, 0);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    // Persist calendar preference
    if (selectedCalendarId) {
      localStorage.setItem(PREFERRED_CALENDAR_KEY, selectedCalendarId);
    }

    onScheduleTask(trimmedTitle, scheduledDate.toISOString(), selectedCalendarId ?? undefined);

    // Reset form
    setTitle("");
    setSelectedDate(undefined);
    setSelectedHour("12");
    setSelectedMinute("00");
    setSelectedPeriod("PM");
    setStep("date");
    setIsDialogOpen(false);

    // Refocus input
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  };

  const hours = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
  const minutes = ["00", "15", "30", "45"];

  return (
    <>
      <div
        ref={containerRef}
        className="space-y-3"
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setIsFocused(false);
          }
        }}
      >
        {/* Card-style input container - matches Pencil design */}
        <div className="bg-card border-[3px] border-border rounded-xl p-4">
          <textarea
            ref={textareaRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Schedule an event..."
            disabled={disabled}
            rows={2}
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/50 placeholder:italic placeholder:font-light resize-none leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleScheduleClick();
              }
            }}
          />
        </div>

        {/* Action Buttons - only visible when the calendar field is focused */}
        {isFocused && (
          <div className="flex gap-2">
            {onQuickAdd && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleQuickAddClick}
                disabled={disabled || !title.trim() || quickAddLoading}
                className={cn(
                  "flex-1 py-3 text-[15px] font-medium rounded-xl border-[1.5px] transition-all flex items-center justify-center gap-2",
                  title.trim() && !quickAddLoading
                    ? "bg-card border-border text-muted-foreground hover:bg-muted"
                    : "bg-card border-border text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                {quickAddLoading ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Zap className="h-[18px] w-[18px]" />
                )}
                {quickAddLoading ? "Adding..." : "Quick Add"}
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleScheduleClick}
              disabled={disabled || !title.trim()}
              className={cn(
                "flex-1 py-3 text-[15px] font-medium rounded-xl border-[1.5px] transition-all flex items-center justify-center gap-2",
                title.trim()
                  ? "bg-card border-border text-muted-foreground hover:bg-muted"
                  : "bg-card border-border text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <CalendarIcon className="h-[18px] w-[18px]" />
              Schedule
            </button>
          </div>
        )}
      </div>

      {/* Date/Time Picker Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === "date" ? (
                <>
                  <CalendarIcon className="h-5 w-5 text-blue-400" />
                  Pick a Date
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-blue-400" />
                  Pick a Time
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {step === "date" ? (
            <div className="flex justify-center py-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </div>
          ) : (
            <div className="py-4 space-y-6">
              {/* Selected Date Display */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Selected date:</p>
                <p className="text-lg font-medium">
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : ""}
                </p>
              </div>

              {/* Calendar Picker */}
              {calendars.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Calendar</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {calendars.map((cal) => (
                      <button
                        key={cal.id}
                        type="button"
                        onClick={() => setSelectedCalendarId(cal.id)}
                        className={cn(
                          "min-h-9 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                          selectedCalendarId === cal.id
                            ? "bg-blue-500 text-white"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {cal.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {calendarsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading calendars...
                </div>
              )}

              {/* Time Picker - Mobile Friendly */}
              <div className="space-y-4">
                {/* Hour Selection */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Hour</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {hours.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSelectedHour(hour)}
                        className={cn(
                          "min-h-11 p-3 rounded-lg text-sm font-medium transition-all",
                          selectedHour === hour
                            ? "bg-blue-500 text-white"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minute Selection */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Minute</label>
                  <div className="grid grid-cols-4 gap-2">
                    {minutes.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => setSelectedMinute(minute)}
                        className={cn(
                          "min-h-11 p-3 rounded-lg text-sm font-medium transition-all",
                          selectedMinute === minute
                            ? "bg-blue-500 text-white"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        :{minute}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM/PM Selection */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["AM", "PM"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSelectedPeriod(period)}
                        className={cn(
                          "min-h-11 p-3 rounded-lg text-sm font-medium transition-all",
                          selectedPeriod === period
                            ? "bg-blue-500 text-white"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Preview */}
                <div className="text-center pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Scheduled for:</p>
                  <p className="text-xl font-bold text-blue-400">
                    {selectedHour}:{selectedMinute} {selectedPeriod}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("date")}
                  className="flex-1 px-4 py-3 rounded-xl border-[1.5px] border-border text-muted-foreground font-medium transition-all hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSchedule}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium transition-all hover:bg-blue-600"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
