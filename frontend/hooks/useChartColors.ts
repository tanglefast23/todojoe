"use client";

import { useState, useEffect } from "react";

const CHART_COLOR_COUNT = 8;

// Curated 12-color muted palette for professional charts
// Colors are spaced across the hue wheel with reduced saturation
export const MUTED_CHART_COLORS = [
  "hsl(220, 50%, 55%)",  // Muted blue
  "hsl(160, 45%, 45%)",  // Sage green
  "hsl(280, 40%, 55%)",  // Soft purple
  "hsl(35, 55%, 55%)",   // Warm amber
  "hsl(340, 45%, 55%)",  // Dusty rose
  "hsl(190, 50%, 45%)",  // Teal
  "hsl(60, 40%, 45%)",   // Olive
  "hsl(10, 50%, 55%)",   // Terracotta
  "hsl(250, 40%, 60%)",  // Periwinkle
  "hsl(140, 35%, 45%)",  // Forest
  "hsl(320, 40%, 55%)",  // Mauve
  "hsl(200, 45%, 50%)",  // Steel blue
];

/**
 * Generate additional colors by interpolating between existing palette colors
 * Uses HSL rotation to create harmonious new colors
 */
export function getChartColor(index: number, totalColors: string[] = MUTED_CHART_COLORS): string {
  if (index < totalColors.length) {
    return totalColors[index];
  }

  // For indices beyond the palette, generate via hue rotation
  const baseIndex = index % totalColors.length;
  const rotationStep = Math.floor(index / totalColors.length);

  // Parse the base HSL color and rotate hue
  const baseColor = totalColors[baseIndex];
  const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);

  if (hslMatch) {
    const [, h, s, l] = hslMatch.map(Number);
    const newHue = (h + rotationStep * 30) % 360;
    return `hsl(${newHue}, ${s}%, ${l}%)`;
  }

  return totalColors[baseIndex];
}

/**
 * Hook to read chart colors from CSS variables
 * Recharts needs actual color values, not CSS var() references
 */
export function useChartColors(): string[] {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const computeColors = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      const chartColors: string[] = [];

      for (let i = 1; i <= CHART_COLOR_COUNT; i++) {
        const color = computedStyle.getPropertyValue(`--chart-${i}`).trim();
        if (color) {
          // oklch values work directly in modern browsers
          chartColors.push(`oklch(${color.replace("oklch(", "").replace(")", "")})`);
        }
      }

      setColors(chartColors);
    };

    computeColors();

    // Re-compute when theme changes (observe class changes on html element)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          computeColors();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return colors;
}

/**
 * Calculate relative luminance of an oklch color string
 * Used to determine if text should be light or dark on a colored background
 */
export function getContrastColor(oklchColor: string): "white" | "black" {
  // Extract lightness from oklch color
  // Format: oklch(L C H) where L is lightness 0-1
  const match = oklchColor.match(/oklch\(([0-9.]+)/);
  if (match) {
    const lightness = parseFloat(match[1]);
    // If lightness > 0.6, use dark text; otherwise use light text
    return lightness > 0.6 ? "black" : "white";
  }
  // Default to white for unknown formats
  return "white";
}
