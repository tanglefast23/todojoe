"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LongPressButtonProps {
  onLongPress: () => void;
  duration?: number; // milliseconds
  className?: string;
  activeClassName?: string;
  title?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
}

export function LongPressButton({
  onLongPress,
  duration = 1000,
  className,
  activeClassName,
  title,
  children,
  onClick,
}: LongPressButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handlePressStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setIsPressed(true);
      setProgress(0);
      startTimeRef.current = Date.now();

      // Update progress every 50ms for smooth animation
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
      }, 50);

      // Trigger action after duration
      timerRef.current = setTimeout(() => {
        clearTimers();
        setIsPressed(false);
        setProgress(0);
        onLongPress();
      }, duration);
    },
    [duration, onLongPress, clearTimers]
  );

  const handlePressEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      clearTimers();
      setIsPressed(false);
      setProgress(0);
    },
    [clearTimers]
  );

  // Calculate SVG circle properties for progress ring
  const size = 32; // matches w-8 h-8
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <button
      className={cn(
        "relative",
        className,
        isPressed && activeClassName
      )}
      title={title}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {/* Progress ring overlay */}
      {isPressed && (
        <svg
          className="absolute inset-0 -rotate-90 pointer-events-none"
          width={size}
          height={size}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="opacity-80"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
