"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ScheduleTaskFormProps {
  onScheduleTask: (title: string, scheduledAt: string) => void;
  disabled?: boolean;
}

type ScheduleStep = "date" | "time";

export function ScheduleTaskForm({ onScheduleTask, disabled = false }: ScheduleTaskFormProps) {
  const [title, setTitle] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("PM");
  const [step, setStep] = useState<ScheduleStep>("date");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    onScheduleTask(trimmedTitle, scheduledDate.toISOString());

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
      <div className="space-y-3 md:space-y-0">
        {/* Desktop Layout - Single Row */}
        <div className="hidden md:flex gap-2">
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Schedule an event..."
            disabled={disabled}
            className="flex-1 rounded-full px-5 border-2 border-violet-400/30 focus:border-violet-400 focus-visible:ring-violet-400/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScheduleClick();
              }
            }}
          />

          {/* Schedule Button */}
          <button
            type="button"
            onClick={handleScheduleClick}
            disabled={disabled || !title.trim()}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full border-2 transition-all flex items-center gap-2",
              title.trim()
                ? "bg-gradient-to-r from-violet-500 to-purple-500 border-violet-400 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50"
                : "bg-transparent border-violet-400/40 text-violet-400/50 cursor-not-allowed"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            Schedule
          </button>
        </div>

        {/* Mobile Layout - Stacked with Large Input */}
        <div className="md:hidden space-y-3">
          {/* Large text input area for mobile */}
          <textarea
            ref={textareaRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Schedule an event..."
            disabled={disabled}
            rows={3}
            className="w-full rounded-2xl px-4 py-3 text-base border-2 border-violet-400/30 focus:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400/30 focus:outline-none bg-background resize-none"
          />

          {/* Schedule Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleScheduleClick}
              disabled={disabled || !title.trim()}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium rounded-full border-2 transition-all flex items-center justify-center gap-2",
                title.trim()
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 border-violet-400 text-white shadow-lg shadow-violet-500/30"
                  : "bg-transparent border-violet-400/40 text-violet-400/50 cursor-not-allowed"
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Date/Time Picker Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === "date" ? (
                <>
                  <CalendarIcon className="h-5 w-5 text-violet-400" />
                  Pick a Date
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-violet-400" />
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

              {/* Time Picker - Mobile Friendly */}
              <div className="space-y-4">
                {/* Hour Selection */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Hour</label>
                  <div className="grid grid-cols-6 gap-2">
                    {hours.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSelectedHour(hour)}
                        className={cn(
                          "p-3 rounded-lg text-sm font-medium transition-all",
                          selectedHour === hour
                            ? "bg-violet-500 text-white"
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
                          "p-3 rounded-lg text-sm font-medium transition-all",
                          selectedMinute === minute
                            ? "bg-violet-500 text-white"
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
                          "p-3 rounded-lg text-sm font-medium transition-all",
                          selectedPeriod === period
                            ? "bg-violet-500 text-white"
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
                  <p className="text-xl font-bold text-violet-400">
                    {selectedHour}:{selectedMinute} {selectedPeriod}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("date")}
                  className="flex-1 px-4 py-3 rounded-full border-2 border-muted-foreground/30 text-muted-foreground font-medium transition-all hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSchedule}
                  className="flex-1 px-4 py-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50"
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
