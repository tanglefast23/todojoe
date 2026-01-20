"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { ScheduledEventList } from "@/components/calendar/ScheduledEventList";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useScheduledEventsStore } from "@/stores/scheduledEventsStore";
import { useOwnerStore } from "@/stores/ownerStore";

export default function CalendarPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Scheduled events state
  const events = useScheduledEventsStore((state) => state.events);
  const completeEvent = useScheduledEventsStore((state) => state.completeEvent);
  const uncompleteEvent = useScheduledEventsStore((state) => state.uncompleteEvent);
  const deleteEvent = useScheduledEventsStore((state) => state.deleteEvent);

  // Owner state
  const owners = useOwnerStore((state) => state.owners);
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);
  const isMasterLoggedIn = useOwnerStore((state) => state.isMasterLoggedIn);

  // Hydration-safe
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeOwnerId = isMounted ? getActiveOwnerId() : null;
  const isMaster = isMounted ? isMasterLoggedIn() : false;

  // Get owner name by ID
  const getOwnerName = useCallback((ownerId: string | null): string | undefined => {
    if (!ownerId) return undefined;
    const owner = owners.find((o) => o.id === ownerId);
    return owner?.name;
  }, [owners]);

  // Handle completing an event
  const handleComplete = useCallback((id: string) => {
    if (!activeOwnerId) return;
    completeEvent(id, activeOwnerId);
  }, [activeOwnerId, completeEvent]);

  // Handle uncompleting an event
  const handleUncomplete = useCallback((id: string) => {
    uncompleteEvent(id);
  }, [uncompleteEvent]);

  // Handle deleting an event
  const handleDelete = useCallback((id: string) => {
    deleteEvent(id);
  }, [deleteEvent]);

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Calendar</h1>

          {/* Scheduled Event List */}
          <ScheduledEventList
            events={events}
            getOwnerName={getOwnerName}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onDelete={handleDelete}
            canComplete={true}
            canDelete={isMaster}
          />
        </div>
      </main>
    </div>
  );
}
