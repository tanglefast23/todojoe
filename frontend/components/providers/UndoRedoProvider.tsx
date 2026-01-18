"use client";

import { useUndoRedo, useUndoRedoState } from "@/hooks/useUndoRedo";
import { useEffect, useState } from "react";

/**
 * Provider that enables global undo/redo keyboard shortcuts
 * Also shows a toast notification when undo/redo is triggered
 */
export function UndoRedoProvider({ children }: { children: React.ReactNode }) {
  const { undo, redo } = useUndoRedo();
  const { canUndo, canRedo } = useUndoRedoState();
  const [notification, setNotification] = useState<string | null>(null);

  // Show notification when undo/redo happens
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modifierKey || e.key.toLowerCase() !== "z") return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      // Show notification
      if (e.shiftKey && canRedo) {
        setNotification("Redo");
      } else if (!e.shiftKey && canUndo) {
        setNotification("Undo");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo]);

  // Clear notification after delay
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <>
      {children}
      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
            {notification}
          </div>
        </div>
      )}
    </>
  );
}
