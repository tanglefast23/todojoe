/**
 * Hook for undo/redo functionality with keyboard shortcuts
 * Cmd+Z for undo, Cmd+Shift+Z for redo (Mac)
 * Ctrl+Z for undo, Ctrl+Shift+Z for redo (Windows/Linux)
 */

import { useEffect, useCallback, useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";

export function useUndoRedo() {
  const temporal = usePortfolioStore.temporal;

  const undo = useCallback(() => {
    const temporalState = temporal.getState();
    console.log("[Undo] temporal state:", {
      pastStatesLength: temporalState.pastStates.length,
      futureStatesLength: temporalState.futureStates.length,
    });
    if (temporalState.pastStates.length > 0) {
      console.log("[Undo] Calling undo...");
      temporalState.undo();
    } else {
      console.log("[Undo] No past states to undo");
    }
  }, [temporal]);

  const redo = useCallback(() => {
    const { futureStates, redo: doRedo } = temporal.getState();
    if (futureStates.length > 0) {
      doRedo();
    }
  }, [temporal]);

  const canUndo = useCallback(() => {
    return temporal.getState().pastStates.length > 0;
  }, [temporal]);

  const canRedo = useCallback(() => {
    return temporal.getState().futureStates.length > 0;
  }, [temporal]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modifierKey || e.key.toLowerCase() !== "z") {
        return;
      }

      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) {
        return;
      }

      e.preventDefault();

      if (e.shiftKey) {
        // Cmd+Shift+Z = Redo
        redo();
      } else {
        // Cmd+Z = Undo
        undo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return { undo, redo, canUndo, canRedo };
}

/**
 * Hook to subscribe to undo/redo state changes
 * Returns reactive canUndo and canRedo values
 */
export function useUndoRedoState() {
  const [state, setState] = useState({
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
  });

  useEffect(() => {
    // Subscribe to temporal state changes
    const unsubscribe = usePortfolioStore.temporal.subscribe((temporalState) => {
      setState({
        canUndo: temporalState.pastStates.length > 0,
        canRedo: temporalState.futureStates.length > 0,
        undoCount: temporalState.pastStates.length,
        redoCount: temporalState.futureStates.length,
      });
    });

    // Initial state
    const initialState = usePortfolioStore.temporal.getState();
    setState({
      canUndo: initialState.pastStates.length > 0,
      canRedo: initialState.futureStates.length > 0,
      undoCount: initialState.pastStates.length,
      redoCount: initialState.futureStates.length,
    });

    return unsubscribe;
  }, []);

  return state;
}
