"use client";

import { useSupabaseSync } from "@/hooks/useSupabaseSync";

/**
 * Provider component that initializes Supabase sync
 * Place this high in the component tree to ensure data is synced on app load
 */
export function SupabaseSyncProvider({ children }: { children: React.ReactNode }) {
  // Initialize sync - loads from Supabase and syncs changes back
  useSupabaseSync();

  return <>{children}</>;
}
