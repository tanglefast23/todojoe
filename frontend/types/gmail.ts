export interface GmailMessage {
  id: string;
  gmailId: string;
  threadId: string;
  subject: string | null;
  snippet: string | null;
  bodyPreview: string | null;
  fromEmail: string | null;
  fromName: string | null;
  receivedAt: string;
  isUnread: boolean;
  labels: string[];
  cachedAt: string;
}

export interface GmailMessageFull extends GmailMessage {
  bodyHtml: string | null;
  bodyText: string | null;
}
