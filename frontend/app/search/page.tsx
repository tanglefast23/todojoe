"use client";

import { useState, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Search, Sparkles, Loader2, X, Trash2, ImagePlus, Image as ImageIcon, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchStore, type SearchResult } from "@/stores/searchStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function SearchPage() {
  // Calendar/email search state
  const [calendarQuery, setCalendarQuery] = useState("");
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const calendarInputRef = useRef<HTMLInputElement>(null);

  // Attachment search state
  const [attachmentQuery, setAttachmentQuery] = useState("");
  const [isAttachmentLoading, setIsAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const results = useSearchStore((state) => state.results);
  const addResult = useSearchStore((state) => state.addResult);
  const deleteResult = useSearchStore((state) => state.deleteResult);
  const clearResults = useSearchStore((state) => state.clearResults);

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 4MB for Groq)
    if (file.size > 4 * 1024 * 1024) {
      setAttachmentError("Image must be less than 4MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setAttachmentError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImage(base64);
      setImagePreview(base64);
      setAttachmentError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // Remove image
  const removeImage = useCallback(() => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handle calendar/email search
  const handleCalendarSearch = useCallback(async () => {
    if (!calendarQuery.trim()) return;

    setIsCalendarLoading(true);
    setCalendarError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: calendarQuery.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      addResult(calendarQuery.trim(), data.response);
      setCalendarQuery("");
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsCalendarLoading(false);
    }
  }, [calendarQuery, addResult]);

  // Handle attachment search
  const handleAttachmentSearch = useCallback(async () => {
    if (!image) return;

    setIsAttachmentLoading(true);
    setAttachmentError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: attachmentQuery.trim() || "What is in this image?",
          image: image,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      const displayQuery = `📷 ${attachmentQuery.trim() || "Analyze this image"}`;
      addResult(displayQuery, data.response);
      setAttachmentQuery("");
      removeImage();
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsAttachmentLoading(false);
    }
  }, [attachmentQuery, image, addResult, removeImage]);

  // Handle keyboard events for calendar search
  const handleCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleCalendarSearch();
      }
    },
    [handleCalendarSearch]
  );

  // Handle keyboard events for attachment search
  const handleAttachmentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAttachmentSearch();
      }
    },
    [handleAttachmentSearch]
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-violet-400" />
              AI Search
            </h1>
            {results.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearResults}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Calendar/Email Search Input */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-violet-400 flex-shrink-0" />
              <input
                ref={calendarInputRef}
                type="text"
                value={calendarQuery}
                onChange={(e) => setCalendarQuery(e.target.value)}
                onKeyDown={handleCalendarKeyDown}
                placeholder="Ask about your calendar or emails..."
                className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                disabled={isCalendarLoading}
              />
              {calendarQuery && !isCalendarLoading && (
                <button
                  onClick={() => setCalendarQuery("")}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              <Button
                onClick={handleCalendarSearch}
                disabled={!calendarQuery.trim() || isCalendarLoading}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isCalendarLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {isCalendarLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Calendar Error */}
            {calendarError && (
              <div className="mt-3 p-3 text-red-400 bg-red-500/10 rounded-lg text-sm">
                {calendarError}
              </div>
            )}

            {/* Suggestions */}
            {!calendarQuery && results.length === 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "When is my next flight?",
                    "Show emails from today",
                    "What do I have this week?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setCalendarQuery(suggestion)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-full",
                        "bg-muted hover:bg-muted/80 transition-colors"
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attachment Search Input */}
          <div className="bg-card border border-border rounded-xl p-4">
            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="max-h-32 rounded-lg border border-border"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Paperclip className="h-5 w-5 text-violet-400 flex-shrink-0" />
              <input
                ref={attachmentInputRef}
                type="text"
                value={attachmentQuery}
                onChange={(e) => setAttachmentQuery(e.target.value)}
                onKeyDown={handleAttachmentKeyDown}
                placeholder={image ? "Ask about this image..." : "Ask about an attachment..."}
                className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                disabled={isAttachmentLoading}
              />
              {attachmentQuery && !isAttachmentLoading && (
                <button
                  onClick={() => setAttachmentQuery("")}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              {/* Image Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAttachmentLoading}
                className={cn(
                  "flex-shrink-0 min-w-[44px] min-h-[44px]",
                  image && "text-violet-400"
                )}
                title="Attach image"
                aria-label="Attach image"
              >
                {image ? (
                  <ImageIcon className="h-5 w-5" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </Button>

              <Button
                onClick={handleAttachmentSearch}
                disabled={!image || isAttachmentLoading}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isAttachmentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {isAttachmentLoading ? "Analyzing..." : "Analyze"}
              </Button>
            </div>

            {/* Attachment Error */}
            {attachmentError && (
              <div className="mt-3 p-3 text-red-400 bg-red-500/10 rounded-lg text-sm">
                {attachmentError}
              </div>
            )}

            {/* Helper text when no image */}
            {!image && (
              <div className="mt-3 text-sm text-muted-foreground">
                Upload an image to ask questions about it
              </div>
            )}
          </div>

          {/* Loading State */}
          {(isCalendarLoading || isAttachmentLoading) && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>{isAttachmentLoading ? "Analyzing image..." : "Searching your calendar and emails..."}</span>
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                Search History
              </h2>
              {results.map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  onDelete={() => deleteResult(result.id)}
                />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function SearchResultCard({
  result,
  onDelete,
}: {
  result: SearchResult;
  onDelete: () => void;
}) {
  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden">
      {/* Query Header */}
      <div className="flex items-start justify-between gap-3 p-4 bg-muted/30 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium truncate">{result.query}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(result.timestamp), { addSuffix: true })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-2 rounded-full hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Response */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 prose prose-invert prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-foreground leading-relaxed text-sm">
              {result.response}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
