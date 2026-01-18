"use client";

import { AlertCircle, RefreshCw, WifiOff, ServerOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorType = "network" | "timeout" | "server" | "not_found" | "rate_limit" | "unknown";

interface ErrorDisplayProps {
  error?: Error | null;
  message?: string;
  type?: ErrorType;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

function getErrorInfo(error?: Error | null, type?: ErrorType) {
  // Determine error type from error message if not provided
  let errorType = type;
  if (!errorType && error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("econnrefused")) {
      errorType = "network";
    } else if (msg.includes("timeout")) {
      errorType = "timeout";
    } else if (msg.includes("404") || msg.includes("not found")) {
      errorType = "not_found";
    } else if (msg.includes("429") || msg.includes("rate limit")) {
      errorType = "rate_limit";
    } else if (msg.includes("500") || msg.includes("server")) {
      errorType = "server";
    }
  }

  switch (errorType) {
    case "network":
      return {
        icon: WifiOff,
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your internet connection.",
        color: "text-orange-500",
      };
    case "timeout":
      return {
        icon: Clock,
        title: "Request Timeout",
        description: "The request took too long. The server may be busy.",
        color: "text-amber-500",
      };
    case "server":
      return {
        icon: ServerOff,
        title: "Server Error",
        description: "Something went wrong on our end. Please try again later.",
        color: "text-red-500",
      };
    case "not_found":
      return {
        icon: AlertCircle,
        title: "Not Found",
        description: "The requested data could not be found.",
        color: "text-yellow-500",
      };
    case "rate_limit":
      return {
        icon: Clock,
        title: "Rate Limited",
        description: "Too many requests. Please wait a moment before trying again.",
        color: "text-purple-500",
      };
    default:
      return {
        icon: AlertCircle,
        title: "Error",
        description: error?.message || "An unexpected error occurred.",
        color: "text-red-500",
      };
  }
}

export function ErrorDisplay({
  error,
  message,
  type,
  onRetry,
  className,
  compact = false,
}: ErrorDisplayProps) {
  const errorInfo = getErrorInfo(error, type);
  const Icon = errorInfo.icon;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Icon className={cn("h-4 w-4", errorInfo.color)} />
        <span className="text-muted-foreground">
          {message || errorInfo.description}
        </span>
        {onRetry && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
    >
      <div className={cn("rounded-full bg-muted p-3", errorInfo.color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{errorInfo.title}</p>
        <p className="text-sm text-muted-foreground max-w-[300px]">
          {message || errorInfo.description}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
