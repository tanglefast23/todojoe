"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountSelector } from "@/components/auth/AccountSelector";
import { useOwnerStore } from "@/stores/ownerStore";

export default function Home() {
  const router = useRouter();
  const isLoggedIn = useOwnerStore((state) => state.isLoggedIn);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only check after mount to avoid hydration issues
    if (isMounted && isLoggedIn()) {
      router.replace("/tasks");
    }
  }, [isMounted, isLoggedIn, router]);

  const handleLoginSuccess = () => {
    router.push("/tasks");
  };

  // Show nothing during SSR to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If already logged in, show loading while redirecting
  if (isLoggedIn()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <AccountSelector onLoginSuccess={handleLoginSuccess} />;
}
