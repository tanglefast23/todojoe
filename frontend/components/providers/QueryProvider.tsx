"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useBfcacheRehydration } from "@/hooks/useBfcacheRehydration";

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Inner component that handles bfcache rehydration
 * Must be inside QueryClientProvider to access queryClient
 */
function BfcacheHandler({ children }: { children: ReactNode }) {
  // Handle iOS Safari and mobile browser back-forward cache
  // This ensures Zustand stores are rehydrated when page is restored from bfcache
  useBfcacheRehydration();
  return <>{children}</>;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000, // 10 seconds
            refetchInterval: 30 * 1000, // 30 seconds auto-refresh
            refetchOnWindowFocus: true,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BfcacheHandler>{children}</BfcacheHandler>
    </QueryClientProvider>
  );
}
