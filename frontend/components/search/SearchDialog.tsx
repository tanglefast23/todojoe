"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResponse(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResponse(data.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSearch, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Sparkles className="h-5 w-5 text-violet-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your calendar or emails..."
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          {query && !isLoading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Response Area */}
        <div className="min-h-[100px] max-h-[50vh] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Searching your calendar and emails...</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-red-400 bg-red-500/10 m-4 rounded-lg">
              {error}
            </div>
          )}

          {response && !isLoading && (
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {response}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && !response && (
            <div className="p-6 text-center text-muted-foreground">
              <p className="text-sm">Try asking:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {[
                  "When is my next flight?",
                  "Show emails from today",
                  "What do I have scheduled this week?",
                  "Any upcoming earnings reports?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
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
      </div>
    </div>
  );
}
