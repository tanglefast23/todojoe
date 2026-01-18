"use client";

import { ReactNode } from "react";
import { useCurrencyInit } from "@/hooks/useCurrency";

/**
 * Provider that initializes currency exchange rate fetch.
 * Fetches USD/CAD rate once per session.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Initialize currency rate fetch
  useCurrencyInit();

  return <>{children}</>;
}
