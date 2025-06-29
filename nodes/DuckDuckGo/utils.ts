/**
 * Utilities and helper functions for the DuckDuckGo node
 */

/**
 * HTML entity mapping for decoding
 */
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
};

/**
 * Decodes HTML entities in a string
 *
 * @param text - The text that may contain HTML entities
 * @returns Decoded text or null if input is null/undefined
 */
export function decodeHtmlEntities(text: string | null | undefined): string | null {
  if (!text) return null;

  return text.replace(/&[#\w]+;/g, (entity) => {
    return HTML_ENTITIES[entity] || entity;
  });
}

/**
 * Formats a Unix timestamp into ISO string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO formatted date string or null if input is invalid
 */
export function formatDate(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;

  try {
    return new Date(timestamp * 1000).toISOString();
  } catch (error) {
    return null;
  }
}

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Interface for structured log entries
 */
export interface ILogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  operation?: string;
  data?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Creates a structured log entry
 *
 * @param level - Log level
 * @param message - Log message
 * @param operation - Operation being performed
 * @param data - Additional data to include
 * @param error - Error object if applicable
 * @returns Structured log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  operation?: string,
  data?: Record<string, any>,
  error?: Error,
): ILogEntry {
  const logEntry: ILogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (operation) {
    logEntry.operation = operation;
  }

  if (data) {
    logEntry.data = data;
  }

  if (error) {
    logEntry.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return logEntry;
}

/**
 * Parses an API error to provide more meaningful information
 *
 * @param error - The error object from API request
 * @param operation - The operation being performed
 * @returns A user-friendly error message
 */
export function parseApiError(error: Error, operation: string): string {
  // Handle network errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    return `Unable to connect to DuckDuckGo servers. Please check your internet connection and try again.`;
  }

  // Handle timeout errors
  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    return `The request to DuckDuckGo timed out. Please try again later.`;
  }

  // Handle rate limiting
  if (error.message.includes('429') || error.message.includes('too many requests')) {
    return `DuckDuckGo rate limit reached. Please wait before making more requests.`;
  }

  // Handle specific API errors for different operations
  if (operation.includes('search')) {
    if (error.message.includes('400')) {
      return `Invalid search query or parameters. Please check your input and try again.`;
    }

    if (error.message.includes('403')) {
      return `Access denied. DuckDuckGo may have detected unusual search patterns.`;
    }
  }

  // Return a more generic message if no specific pattern is matched
  return `Error during ${operation}: ${error.message}`;
}
