/**
 * Google Calendar event color mapping.
 * Google exposes 11 predefined event colors via the `colorId` field.
 * These hex values match Google Calendar's published palette.
 */

export interface EventColor {
  readonly name: string;
  readonly hex: string;
}

export const GOOGLE_EVENT_COLORS: Record<string, EventColor> = {
  "1": { name: "Lavender", hex: "#7986cb" },
  "2": { name: "Sage", hex: "#33b679" },
  "3": { name: "Grape", hex: "#8e24aa" },
  "4": { name: "Flamingo", hex: "#e67c73" },
  "5": { name: "Banana", hex: "#f6c026" },
  "6": { name: "Tangerine", hex: "#f5511d" },
  "7": { name: "Peacock", hex: "#039be5" },
  "8": { name: "Graphite", hex: "#616161" },
  "9": { name: "Blueberry", hex: "#3f51b5" },
  "10": { name: "Basil", hex: "#0b8043" },
  "11": { name: "Tomato", hex: "#d60000" },
};

/** Default Google Calendar event color when `colorId` is absent. */
export const DEFAULT_GOOGLE_EVENT_COLOR: EventColor = {
  name: "Google Blue",
  hex: "#1a73e8",
};

/** Default color for events created locally in the app (not from Google). */
export const LOCAL_EVENT_COLOR: EventColor = {
  name: "Blue",
  hex: "#3b82f6",
};

/** Resolve an event's color from its source + colorId. */
export function getEventColor(
  source: "google" | "local",
  colorId?: string | null,
): EventColor {
  if (source === "local") return LOCAL_EVENT_COLOR;
  if (colorId && GOOGLE_EVENT_COLORS[colorId]) return GOOGLE_EVENT_COLORS[colorId];
  return DEFAULT_GOOGLE_EVENT_COLOR;
}
