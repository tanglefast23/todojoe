/**
 * Centralized logging utility
 * - Provides consistent log formatting with namespaces
 * - Can be disabled in production
 * - Supports log levels: debug, info, warn, error
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  /** Minimum log level to output (default: "info" in prod, "debug" in dev) */
  minLevel: LogLevel;
  /** Whether logging is enabled */
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default config based on environment
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === "production" ? "warn" : "debug",
  enabled: true,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

/**
 * Format log message with optional namespace
 */
function formatMessage(namespace: string | undefined, message: string): string {
  return namespace ? `[${namespace}] ${message}` : message;
}

/**
 * Create a namespaced logger
 */
export function createLogger(namespace: string) {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.log(formatMessage(namespace, message), ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog("info")) {
        console.log(formatMessage(namespace, message), ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog("warn")) {
        console.warn(formatMessage(namespace, message), ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog("error")) {
        console.error(formatMessage(namespace, message), ...args);
      }
    },
  };
}

// Pre-configured loggers for common namespaces
export const syncLogger = createLogger("Sync");
export const apiLogger = createLogger("API");
export const storeLogger = createLogger("Store");
export const authLogger = createLogger("Auth");

// Default logger (no namespace)
export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog("debug")) {
      console.log(message, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog("info")) {
      console.log(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog("warn")) {
      console.warn(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog("error")) {
      console.error(message, ...args);
    }
  },
};

export default logger;
