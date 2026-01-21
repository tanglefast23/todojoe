/**
 * Google Gemini AI utilities for intelligent search
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  error?: {
    message: string;
  };
}

/**
 * Query Gemini with context from calendar and emails
 */
export async function queryGemini(
  query: string,
  calendarEvents: { title: string; scheduledAt: string; description?: string | null }[],
  emails: { subject: string | null; fromName: string | null; fromEmail: string | null; snippet: string | null; receivedAt: string }[]
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  // Format calendar events for context
  const calendarContext = calendarEvents.slice(0, 50).map((e) =>
    `- ${e.title} on ${new Date(e.scheduledAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })}${e.description ? ` (${e.description.slice(0, 100)})` : ""}`
  ).join("\n");

  // Format emails for context
  const emailContext = emails.slice(0, 30).map((e) =>
    `- From: ${e.fromName || e.fromEmail || "Unknown"} | Subject: ${e.subject || "(No subject)"} | ${new Date(e.receivedAt).toLocaleDateString()} | Preview: ${e.snippet?.slice(0, 150) || ""}`
  ).join("\n");

  const systemPrompt = `You are a helpful personal assistant with access to the user's Google Calendar and Gmail.
Answer questions based on the provided data. Be concise and helpful.
If the information isn't available in the data, say so politely.
Format dates in a friendly way (e.g., "Tomorrow at 2pm", "Next Monday").
Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.

CALENDAR EVENTS (upcoming):
${calendarContext || "No calendar events found."}

RECENT EMAILS (Primary inbox):
${emailContext || "No emails found."}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: `\n\nUser question: ${query}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to query Gemini");
  }

  const data: GeminiResponse = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  return text;
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}
