import { NextResponse } from "next/server";

// Cache the exchange rate for 1 hour (in seconds)
const CACHE_DURATION = 3600;

// In-memory cache for the exchange rate
let cachedRate: { rate: number; fetchedAt: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();

    // Check if we have a valid cached rate
    if (cachedRate && now - cachedRate.fetchedAt < CACHE_DURATION * 1000) {
      return NextResponse.json({
        rate: cachedRate.rate,
        source: "cache",
        updatedAt: new Date(cachedRate.fetchedAt).toISOString(),
      });
    }

    // Fetch from Frankfurter API (free, no API key needed)
    // Uses ECB (European Central Bank) data, updates daily on weekdays
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=CAD",
      {
        next: { revalidate: CACHE_DURATION }, // Next.js cache
      }
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates?.CAD;

    if (!rate || typeof rate !== "number") {
      throw new Error("Invalid rate data from API");
    }

    // Update cache
    cachedRate = { rate, fetchedAt: now };

    return NextResponse.json({
      rate,
      source: "frankfurter",
      updatedAt: new Date().toISOString(),
      date: data.date, // ECB date
    });
  } catch (error) {
    console.error("Currency API error:", error);

    // Return cached rate if available, even if stale
    if (cachedRate) {
      return NextResponse.json({
        rate: cachedRate.rate,
        source: "stale-cache",
        updatedAt: new Date(cachedRate.fetchedAt).toISOString(),
        error: "Using cached rate due to API error",
      });
    }

    // Return fallback rate if no cache
    return NextResponse.json({
      rate: 1.36, // Reasonable fallback
      source: "fallback",
      updatedAt: new Date().toISOString(),
      error: "Using fallback rate",
    });
  }
}
