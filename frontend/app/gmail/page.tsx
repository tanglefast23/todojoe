"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Mail, RefreshCw, Trash2, Archive, ChevronRight, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { GmailMessage, GmailMessageFull } from "@/types/gmail";

export default function GmailPage() {
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<GmailMessageFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Primary inbox emails (both read and unread)
  const fetchEmails = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/google/gmail/messages");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch emails");
      }
      const data = await response.json();
      setEmails(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch emails");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch full email content
  const fetchEmailDetail = useCallback(async (gmailId: string) => {
    try {
      const response = await fetch(`/api/google/gmail/message/${gmailId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch email details");
      }
      const data = await response.json();
      setSelectedEmail(data);
    } catch (err) {
      console.error("Failed to fetch email detail:", err);
    }
  }, []);

  // Delete email
  const deleteEmail = useCallback(async (gmailId: string) => {
    try {
      const response = await fetch(`/api/google/gmail/message/${gmailId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete email");
      }
      // Remove from local state
      setEmails((prev) => prev.filter((e) => e.gmailId !== gmailId));
      if (selectedEmail?.gmailId === gmailId) {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error("Failed to delete email:", err);
    }
  }, [selectedEmail]);

  // Archive email
  const archiveEmail = useCallback(async (gmailId: string) => {
    try {
      const response = await fetch(`/api/google/gmail/message/${gmailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!response.ok) {
        throw new Error("Failed to archive email");
      }
      // Remove from local state (archived emails leave inbox)
      setEmails((prev) => prev.filter((e) => e.gmailId !== gmailId));
      if (selectedEmail?.gmailId === gmailId) {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error("Failed to archive email:", err);
    }
  }, [selectedEmail]);

  // Initial fetch
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Get first 2 sentences from snippet
  const getPreview = (snippet: string | null): string => {
    if (!snippet) return "";
    const sentences = snippet.split(/[.!?]+/).filter(Boolean);
    return sentences.slice(0, 2).join(". ") + (sentences.length > 0 ? "." : "");
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Gmail
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchEmails(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-500">Unable to fetch emails</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make sure you have run the Google OAuth setup script and have valid credentials.
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && emails.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No emails in Primary inbox</p>
              <p className="text-sm">Your Primary inbox is empty.</p>
            </div>
          )}

          {/* Email List */}
          {!isLoading && !error && emails.length > 0 && (
            <div className="space-y-3">
              {emails.map((email) => (
                <div
                  key={email.gmailId}
                  className={cn(
                    "group relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                    email.isUnread
                      ? "bg-gradient-to-r from-blue-500/15 to-sky-500/15 border-blue-400/40"
                      : "bg-card/50 border-border/50",
                    "hover:border-blue-400/50",
                    selectedEmail?.gmailId === email.gmailId && "ring-2 ring-blue-400"
                  )}
                  onClick={() => fetchEmailDetail(email.gmailId)}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator dot */}
                    {email.isUnread && (
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "truncate",
                          email.isUnread ? "font-semibold" : "font-normal text-muted-foreground"
                        )}>
                          {email.fromName || email.fromEmail || "Unknown sender"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={cn(
                        "text-lg truncate",
                        email.isUnread ? "font-semibold" : "font-normal"
                      )}>
                        {email.subject || "(No subject)"}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {getPreview(email.snippet)}
                      </p>
                    </div>
                    {/* Action buttons and chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEmail(email.gmailId);
                        }}
                        className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition-colors"
                        title="Move to trash"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveEmail(email.gmailId);
                        }}
                        className="w-8 h-8 rounded-full bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white flex items-center justify-center transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Email Detail Modal */}
          {selectedEmail && (
            <div
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setSelectedEmail(null)}
            >
              <div
                className="bg-background rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-xl font-bold truncate">{selectedEmail.subject || "(No subject)"}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      From: {selectedEmail.fromName || selectedEmail.fromEmail || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedEmail.receivedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        deleteEmail(selectedEmail.gmailId);
                        setSelectedEmail(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        archiveEmail(selectedEmail.gmailId);
                        setSelectedEmail(null);
                      }}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedEmail(null)}>
                      Close
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedEmail.bodyHtml ? (
                    <div
                      className="prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">
                      {selectedEmail.bodyText || selectedEmail.snippet || "No content"}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
