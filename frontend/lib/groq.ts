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

/**
 * Query Gemini Vision model with an image
 * Used for analyzing images to extract event details, etc.
 * Uses Gemini because Groq's vision models were deprecated
 */
export async function queryGeminiVision(
  query: string,
  imageBase64: string,
  returnJson: boolean = false
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured for vision. Please add GEMINI_API_KEY to environment variables.");
  }

  const jsonInstructions = returnJson ? `
IMPORTANT: You MUST respond with ONLY a valid JSON array of ALL events found, no other text:
[
  {
    "title": "Event name here",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "location": "Location or null if not found",
    "description": "Brief description or null"
  }
]
If there are multiple events (like multiple flights, sessions, etc.), include ALL of them as separate objects in the array.
Do NOT include any markdown formatting, code blocks, or explanatory text. ONLY the JSON array.` : `
Format your response clearly. If you're extracting event details, present them in a structured way that's easy to read.`;

  const systemPrompt = `You are a helpful assistant that analyzes images.
When the user asks you to create a calendar event from an image, extract the following details:
- Event title/name
- Date (in YYYY-MM-DD format)
- Time (in HH:MM format, 24-hour)
- Location (if visible)
- Description/details
${jsonInstructions}
Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`;

  // Extract the base64 data and mime type from the data URL
  const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image format. Expected base64 data URL.");
  }
  const mimeType = matches[1];
  const base64Data = matches[2];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + "\n\nUser request: " + query },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to analyze image with Gemini");
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini Vision");
  }

  return text;
}

/**
 * Extract search terms from a user query
 * Uses a fast model to quickly identify names, topics, or keywords to search for
 */
export async function extractSearchTerms(query: string): Promise<string[]> {
  if (!GROQ_API_KEY) {
    return [];
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant", // Fast model for quick extraction
      messages: [
        {
          role: "system",
          content: `Extract search terms from the user's question that should be used to search their email inbox.
Return ONLY a JSON array of search terms (names, companies, topics, keywords).
If the query is general (like "what do I have this week" or "show recent emails"), return an empty array [].
Examples:
- "find emails from David Vu" → ["David Vu"]
- "what did John Smith say about the project" → ["John Smith", "project"]
- "any emails about Tesla earnings" → ["Tesla", "earnings"]
- "show me flight confirmations" → ["flight", "confirmation", "booking"]
- "what do I have this week" → []
- "summarize my recent emails" → []
Return ONLY the JSON array, no other text.`
        },
        { role: "user", content: query }
      ],
      temperature: 0,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    console.error("Failed to extract search terms");
    return [];
  }

  const data: GroqResponse = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    return [];
  }

  try {
    // Parse the JSON array
    const terms = JSON.parse(text);
    if (Array.isArray(terms)) {
      return terms.filter((t): t is string => typeof t === "string" && t.length > 0);
    }
  } catch {
    // If parsing fails, try to extract quoted strings
    const matches = text.match(/"([^"]+)"/g);
    if (matches) {
      return matches.map((m) => m.replace(/"/g, ""));
    }
  }

  return [];
}
