"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOwnerStore } from "@/stores/ownerStore";

/**
 * Hook to protect pages that require authentication.
 * Redirects to login page (/) if not logged in.
 * Returns { isLoading, isAuthenticated } for conditional rendering.
 */
export function useAuthGuard() {
  const router = useRouter();
  const isLoggedIn = useOwnerStore((state) => state.isLoggedIn);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isLoggedIn()) {
      router.replace("/");
    }
  }, [isMounted, isLoggedIn, router]);

  return {
    isLoading: !isMounted,
    isAuthenticated: isMounted && isLoggedIn(),
  };
}
