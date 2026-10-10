/**
 * Utilities and helper functions for the DuckDuckGo node
 */

import type { Logger, LogMetadata } from 'n8n-workflow';

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
 * Sink for the node's debug entries.
 *
 * Present only while Debug Mode is on, so a call site can emit unconditionally
 * with `debugLog?.(...)` rather than guarding on the flag itself.
 */
export type DebugLogger = (entry: ILogEntry) => void;

/**
 * Builds the debug sink for one execution.
 *
 * Entries go to n8n's own logger rather than to stdout: the instance log then
 * carries them with the execution's context, a user who has not asked for
 * debugging sees nothing, and n8n Cloud does not permit console output at all.
 *
 * @param logger - `this.logger` from the execution context
 * @param enabled - the node's Debug Mode parameter
 * @returns a sink, or undefined when debugging is off
 */
export function makeDebugLogger(logger: Logger, enabled: boolean): DebugLogger | undefined {
  if (!enabled) return undefined;

  return ({ message, ...meta }) => {
    const metadata = meta as LogMetadata;
    switch (meta.level) {
      case LogLevel.ERROR:
        logger.error(message, metadata);
        break;
      case LogLevel.WARN:
        logger.warn(message, metadata);
        break;
      default:
        logger.debug(message, metadata);
    }
  };
}

/**
 * True when the message names `status` as an HTTP status: "status code 403",
 * "status 403", "statusCode=403", "HTTP 403", "403 Forbidden".
 *
 * A bare `includes('403')` also matched a number that is part of something
 * else - an OpenSSL thread id, a port, a longer code - and gave an unrelated
 * failure the "access denied" message, which callers read as a block. Only the
 * forms this node and axios write are recognised; any other wording of a
 * status falls through to the generic message.
 */
function mentionsHttpStatus(message: string, status: number): boolean {
  // The gaps are bounded: the message can echo text a user or a model wrote, and
  // an unbounded `\s*` pair backtracks quadratically on a long run of spaces.
  const named = new RegExp(`\\b(?:status(?:\\s{0,3}code)?|http)[\\s:=]{0,8}${status}(?!\\w|\\.\\d)`, 'i');
  const withReason = new RegExp(`(?<!\\w)${status}\\s{1,8}(?:forbidden|too many requests|bad request)`, 'i');
  return named.test(message) || withReason.test(message);
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
  if (mentionsHttpStatus(error.message, 429) || error.message.includes('too many requests')) {
    return `DuckDuckGo rate limit reached. Please wait before making more requests.`;
  }

  // Handle specific API errors for different operations
  if (operation.includes('search')) {
    if (mentionsHttpStatus(error.message, 400)) {
      return `Invalid search query or parameters. Please check your input and try again.`;
    }

    if (mentionsHttpStatus(error.message, 403)) {
      return `Access denied. DuckDuckGo may have detected unusual search patterns.`;
    }
  }

  // Return a more generic message if no specific pattern is matched
  return `Error during ${operation}: ${error.message}`;
}
