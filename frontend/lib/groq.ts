/**
 * Groq AI utilities for intelligent search
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface GroqResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  error?: {
    message: string;
  };
}

/**
 * Query Groq with context from calendar and emails
 */
export async function queryGroq(
  query: string,
  calendarEvents: { title: string; scheduledAt: string; description?: string | null }[],
  emails: { subject: string | null; fromName: string | null; fromEmail: string | null; snippet: string | null; receivedAt: string }[]
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key not configured");
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

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to query Groq");
  }

  const data: GroqResponse = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("No response from Groq");
  }

  return text;
}

/**
 * Check if Groq is configured
 */
export function isGroqConfigured(): boolean {
  return !!GROQ_API_KEY;
}
