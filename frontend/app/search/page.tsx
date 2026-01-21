"use client";

import { useState, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Search, Sparkles, Loader2, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchStore, type SearchResult } from "@/stores/searchStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useSearchStore((state) => state.results);
  const addResult = useSearchStore((state) => state.addResult);
  const deleteResult = useSearchStore((state) => state.deleteResult);
  const clearResults = useSearchStore((state) => state.clearResults);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

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

      // Save to store
      addResult(query.trim(), data.response);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, [query, addResult]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
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

          {/* Search Input */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
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
                onClick={handleSearch}
                disabled={!query.trim() || isLoading}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 p-3 text-red-400 bg-red-500/10 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Suggestions */}
            {!query && results.length === 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "When is my next flight?",
                    "Show emails from today",
                    "What do I have this week?",
                    "Any upcoming earnings?",
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

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Searching your calendar and emails...</span>
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

          {/* Empty State */}
          {!isLoading && results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Ask me anything</p>
              <p className="text-sm">
                Search your calendar events and emails using AI
              </p>
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
