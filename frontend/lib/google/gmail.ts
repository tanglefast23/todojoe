/**
 * Gmail API utilities
 */

import { google } from "googleapis";
import { getAuthClient } from "./auth";
import type { GmailMessage, GmailMessageFull } from "@/types/gmail";

/**
 * Get Gmail API client
 */
async function getGmailClient() {
  const auth = await getAuthClient();
  if (!auth) {
    throw new Error("Not authenticated with Google");
  }
  return google.gmail({ version: "v1", auth });
}

/**
 * Decode base64url encoded content
 */
function decodeBase64Url(data: string): string {
  // Replace URL-safe characters with standard base64
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Extract email address and name from a header value
 */
function parseEmailAddress(value: string): { email: string | null; name: string | null } {
  // Format: "Name <email@example.com>" or just "email@example.com"
  const match = value.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]?.trim() || null,
    };
  }
  return { email: value, name: null };
}

/**
 * Get header value from message headers
 */
function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string | null {
  if (!headers) return null;
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || null;
}

/**
 * Extract body content from message parts
 */
function extractBody(payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] | null } | undefined | null): { html: string | null; text: string | null } {
  const result = { html: null as string | null, text: null as string | null };

  if (!payload) return result;

  // Direct body
  if (payload.body?.data) {
    const content = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      result.html = content;
    } else if (payload.mimeType === "text/plain") {
      result.text = content;
    }
  }

  // Multipart
  if (payload.parts) {
    for (const part of payload.parts as { mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] | null }[]) {
      if (part.mimeType === "text/html" && part.body?.data) {
        result.html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        result.text = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        // Nested multipart
        const nested = extractBody(part);
        if (nested.html) result.html = nested.html;
        if (nested.text) result.text = nested.text;
      }
    }
  }

  return result;
}

/**
 * Get first N sentences from text
 */
function getFirstSentences(text: string, count: number = 2): string {
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  return sentences.slice(0, count).join(". ") + (sentences.length > 0 ? "." : "");
}

/**
 * Fetch unread emails from inbox
 * @deprecated Use getPrimaryInboxEmails instead
 */
export async function getUnreadEmails(maxResults: number = 20): Promise<GmailMessage[]> {
  return getPrimaryInboxEmails(maxResults);
}

/**
 * Fetch emails from Primary inbox (both read and unread)
 */
export async function getPrimaryInboxEmails(maxResults: number = 20): Promise<GmailMessage[]> {
  const gmail = await getGmailClient();

  // List messages from Primary inbox (both read and unread)
  // category:primary filters for Primary tab only (excludes Promotions, Social, Updates, Forums)
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: "category:primary",
    maxResults,
  });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) {
    return [];
  }

  // Fetch details for each message
  const emailPromises = messages.map(async (msg) => {
    if (!msg.id) return null;

    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = detail.data.payload?.headers;
    const fromHeader = getHeader(headers, "From") || "";
    const { email: fromEmail, name: fromName } = parseEmailAddress(fromHeader);

    return {
      id: crypto.randomUUID(),
      gmailId: msg.id,
      threadId: msg.threadId || "",
      subject: getHeader(headers, "Subject"),
      snippet: detail.data.snippet || null,
      bodyPreview: detail.data.snippet ? getFirstSentences(detail.data.snippet) : null,
      fromEmail,
      fromName,
      receivedAt: detail.data.internalDate
        ? new Date(parseInt(detail.data.internalDate)).toISOString()
        : new Date().toISOString(),
      isUnread: detail.data.labelIds?.includes("UNREAD") || false,
      labels: detail.data.labelIds || [],
      cachedAt: new Date().toISOString(),
    } satisfies GmailMessage;
  });

  const results = await Promise.all(emailPromises);
  return results.filter((r): r is GmailMessage => r !== null);
}

/**
 * Get full email content by ID
 */
export async function getEmailById(gmailId: string): Promise<GmailMessageFull | null> {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.get({
    userId: "me",
    id: gmailId,
    format: "full",
  });

  const message = response.data;
  if (!message) return null;

  const headers = message.payload?.headers;
  const fromHeader = getHeader(headers, "From") || "";
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromHeader);
  const body = extractBody(message.payload);

  return {
    id: crypto.randomUUID(),
    gmailId: message.id || gmailId,
    threadId: message.threadId || "",
    subject: getHeader(headers, "Subject"),
    snippet: message.snippet || null,
    bodyPreview: message.snippet ? getFirstSentences(message.snippet) : null,
    fromEmail,
    fromName,
    receivedAt: message.internalDate
      ? new Date(parseInt(message.internalDate)).toISOString()
      : new Date().toISOString(),
    isUnread: message.labelIds?.includes("UNREAD") || false,
    labels: message.labelIds || [],
    cachedAt: new Date().toISOString(),
    bodyHtml: body.html,
    bodyText: body.text,
  };
}

/**
 * Move email to trash
 */
export async function trashEmail(gmailId: string): Promise<void> {
  const gmail = await getGmailClient();
  await gmail.users.messages.trash({
    userId: "me",
    id: gmailId,
  });
}

/**
 * Mark email as read
 */
export async function markAsRead(gmailId: string): Promise<void> {
  const gmail = await getGmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

/**
 * Archive email (remove from inbox but keep in All Mail)
 */
export async function archiveEmail(gmailId: string): Promise<void> {
  const gmail = await getGmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailId,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });
}
