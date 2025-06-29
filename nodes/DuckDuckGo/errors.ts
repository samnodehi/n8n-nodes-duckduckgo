/**
 * Custom error handling for DuckDuckGo node
 *
 * This module provides custom error classes and error handling utilities
 * for better error management and user experience.
 */

import { NodeOperationError, INode } from 'n8n-workflow';

/**
 * DuckDuckGo Error Types
 */
export enum DuckDuckGoErrorType {
  // Network related
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  DNS_ERROR = 'DNS_ERROR',

  // API related
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  SERVER_ERROR = 'SERVER_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',

  // Search related
  SEARCH_ERROR = 'SEARCH_ERROR',
  VQD_TOKEN_ERROR = 'VQD_TOKEN_ERROR',
  PAGINATION_ERROR = 'PAGINATION_ERROR',
  RESULTS_PARSING_ERROR = 'RESULTS_PARSING_ERROR',

  // Input validation
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * DuckDuckGo Error Interface
 */
export interface IDuckDuckGoErrorOptions {
  severity?: ErrorSeverity;
  isRetryable?: boolean;
  userMessage?: string;
  technicalDetails?: any;
  retryAfter?: number;
  statusCode?: number;
}

/**
 * Base DuckDuckGo Error Class
 */
export class DuckDuckGoError extends Error {
  public readonly errorType: DuckDuckGoErrorType;
  public readonly severity: ErrorSeverity;
  public readonly isRetryable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: any;
  public readonly retryAfter?: number;
  public readonly statusCode?: number;

  constructor(
    message: string,
    errorType: DuckDuckGoErrorType = DuckDuckGoErrorType.UNKNOWN_ERROR,
    options: IDuckDuckGoErrorOptions = {}
  ) {
    super(message);
    this.name = 'DuckDuckGoError';
    this.errorType = errorType;
    this.severity = options.severity || this.determineSeverity(errorType);
    this.isRetryable = options.isRetryable !== undefined ? options.isRetryable : this.determineRetryability(errorType);
    this.userMessage = options.userMessage || this.generateUserMessage(errorType, message);
    this.technicalDetails = options.technicalDetails;
    this.retryAfter = options.retryAfter;
    this.statusCode = options.statusCode;
    }

  private determineSeverity(errorType: DuckDuckGoErrorType): ErrorSeverity {
    switch (errorType) {
      case DuckDuckGoErrorType.SERVER_ERROR:
      case DuckDuckGoErrorType.SERVICE_UNAVAILABLE:
        return ErrorSeverity.HIGH;
      case DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED:
      case DuckDuckGoErrorType.TOO_MANY_REQUESTS:
      case DuckDuckGoErrorType.TIMEOUT:
        return ErrorSeverity.MEDIUM;
      case DuckDuckGoErrorType.INVALID_INPUT:
      case DuckDuckGoErrorType.VQD_TOKEN_ERROR:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private determineRetryability(errorType: DuckDuckGoErrorType): boolean {
    switch (errorType) {
      case DuckDuckGoErrorType.NETWORK_ERROR:
      case DuckDuckGoErrorType.TIMEOUT:
      case DuckDuckGoErrorType.CONNECTION_REFUSED:
      case DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED:
      case DuckDuckGoErrorType.TOO_MANY_REQUESTS:
      case DuckDuckGoErrorType.SERVER_ERROR:
      case DuckDuckGoErrorType.BAD_GATEWAY:
      case DuckDuckGoErrorType.SERVICE_UNAVAILABLE:
      case DuckDuckGoErrorType.GATEWAY_TIMEOUT:
      case DuckDuckGoErrorType.VQD_TOKEN_ERROR:
        return true;
      default:
        return false;
    }
  }

  private generateUserMessage(errorType: DuckDuckGoErrorType, originalMessage: string): string {
    switch (errorType) {
      case DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED:
      case DuckDuckGoErrorType.TOO_MANY_REQUESTS:
        return this.retryAfter
          ? `Too many requests. Please wait ${Math.ceil(this.retryAfter / 1000)} seconds before trying again.`
          : 'Too many requests. Please wait before making more requests.';
      case DuckDuckGoErrorType.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection and try again.';
      case DuckDuckGoErrorType.TIMEOUT:
        return 'Request timed out. DuckDuckGo servers may be slow. Please try again.';
      case DuckDuckGoErrorType.SERVER_ERROR:
      case DuckDuckGoErrorType.SERVICE_UNAVAILABLE:
        return 'DuckDuckGo servers are temporarily unavailable. Please try again later.';
      case DuckDuckGoErrorType.VQD_TOKEN_ERROR:
        return 'Search session expired. The search will be retried automatically.';
      case DuckDuckGoErrorType.INVALID_INPUT:
        return `Invalid input: ${originalMessage}`;
      case DuckDuckGoErrorType.RESULTS_PARSING_ERROR:
        return 'Unable to parse search results. DuckDuckGo may have changed their format.';
      default:
        return originalMessage;
  }
  }

  public toNodeOperationError(node: INode, itemIndex?: number): NodeOperationError {
    const nodeError = new NodeOperationError(node, this.userMessage, { itemIndex });
    // Attach additional metadata
    (nodeError as any).errorType = this.errorType;
    (nodeError as any).severity = this.severity;
    (nodeError as any).isRetryable = this.isRetryable;
    (nodeError as any).technicalDetails = this.technicalDetails;
    return nodeError;
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends DuckDuckGoError {
  constructor(message: string, options: { retryAfter?: number; remaining?: number; limit?: number } = {}) {
    super(message, DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED, {
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      retryAfter: options.retryAfter,
      technicalDetails: options,
    });
  }
}

/**
 * Network Error
 */
export class NetworkError extends DuckDuckGoError {
  constructor(message: string, originalError?: Error) {
    const errorType = NetworkError.categorizeNetworkError(originalError);
    super(message, errorType, {
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      technicalDetails: originalError ? { originalMessage: originalError.message, stack: originalError.stack } : undefined,
    });
  }

  private static categorizeNetworkError(error?: Error): DuckDuckGoErrorType {
    if (!error) return DuckDuckGoErrorType.NETWORK_ERROR;

    const message = error.message.toLowerCase();
    if (message.includes('timeout') || message.includes('etimedout')) {
      return DuckDuckGoErrorType.TIMEOUT;
    }
    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return DuckDuckGoErrorType.CONNECTION_REFUSED;
    }
    if (message.includes('enotfound') || message.includes('dns')) {
      return DuckDuckGoErrorType.DNS_ERROR;
    }
    return DuckDuckGoErrorType.NETWORK_ERROR;
  }
}

/**
 * Validation Error
 */
export class ValidationError extends DuckDuckGoError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, options: { field?: string; value?: any; validationRule?: string } = {}) {
    const userMessage = options.field
      ? `Invalid value for field "${options.field}": ${message}`
      : message;

    super(message, DuckDuckGoErrorType.INVALID_INPUT, {
      severity: ErrorSeverity.LOW,
      isRetryable: false,
      userMessage,
      technicalDetails: options,
    });

    this.field = options.field;
    this.value = options.value;
  }
}

/**
 * API Error
 */
export class APIError extends DuckDuckGoError {
  constructor(message: string, options: { statusCode?: number; responseBody?: any; headers?: any } = {}) {
    const errorType = APIError.categorizeAPIError(options.statusCode);
    const severity = APIError.determineSeverityFromStatus(options.statusCode);
    const isRetryable = APIError.determineRetryabilityFromStatus(options.statusCode);

    super(message, errorType, {
      severity,
      isRetryable,
      statusCode: options.statusCode,
      technicalDetails: options,
    });
  }

  private static categorizeAPIError(statusCode?: number): DuckDuckGoErrorType {
    if (!statusCode) return DuckDuckGoErrorType.API_ERROR;

    switch (statusCode) {
      case 429:
        return DuckDuckGoErrorType.TOO_MANY_REQUESTS;
      case 500:
        return DuckDuckGoErrorType.SERVER_ERROR;
      case 502:
        return DuckDuckGoErrorType.BAD_GATEWAY;
      case 503:
        return DuckDuckGoErrorType.SERVICE_UNAVAILABLE;
      case 504:
        return DuckDuckGoErrorType.GATEWAY_TIMEOUT;
      default:
        return DuckDuckGoErrorType.API_ERROR;
    }
  }

  private static determineSeverityFromStatus(statusCode?: number): ErrorSeverity {
    if (!statusCode) return ErrorSeverity.MEDIUM;

    if (statusCode >= 500) return ErrorSeverity.HIGH;
    if (statusCode >= 400) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private static determineRetryabilityFromStatus(statusCode?: number): boolean {
    if (!statusCode) return false;

    // 5xx errors are generally retryable
    if (statusCode >= 500) return true;
    // 429 (Too Many Requests) is retryable
    if (statusCode === 429) return true;
    // 4xx errors are generally not retryable
    return false;
  }
}

/**
 * Main error handler function
 */
export function handleDuckDuckGoError(
  error: any,
  operation: string,
  options: {
    node?: INode;
    itemIndex?: number;
    debugMode?: boolean;
  } = {}
): NodeOperationError {
  // If it's already a DuckDuckGo error, convert it to NodeOperationError
  if (error instanceof DuckDuckGoError) {
    if (options.node) {
      return error.toNodeOperationError(options.node, options.itemIndex);
    }
  }

  // If it's already a NodeOperationError, return as-is
  if (error instanceof NodeOperationError) {
    return error;
  }

  // Handle network errors
  if (error.code) {
    const networkError = new NetworkError(`Network error during ${operation}`, error);
    if (options.node) {
      return networkError.toNodeOperationError(options.node, options.itemIndex);
    }
  }

  // Handle HTTP errors
  if (error.response?.status) {
    const apiError = new APIError(`API error during ${operation}`, {
      statusCode: error.response.status,
      responseBody: error.response.data,
      headers: error.response.headers,
    });
    if (options.node) {
      return apiError.toNodeOperationError(options.node, options.itemIndex);
    }
  }

  // Handle duck-duck-scrape specific errors
  if (error.message) {
    let errorType = DuckDuckGoErrorType.UNKNOWN_ERROR;

    if (error.message.includes('VQD')) {
      errorType = DuckDuckGoErrorType.VQD_TOKEN_ERROR;
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorType = DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED;
    } else if (error.message.includes('parse') || error.message.includes('parsing')) {
      errorType = DuckDuckGoErrorType.RESULTS_PARSING_ERROR;
    } else if (error.message.includes('timeout')) {
      errorType = DuckDuckGoErrorType.TIMEOUT;
    }

    const duckError = new DuckDuckGoError(error.message, errorType, {
      technicalDetails: {
        operation,
        stack: error.stack,
        ...(options.debugMode && { originalError: error }),
      },
    });

    if (options.node) {
      return duckError.toNodeOperationError(options.node, options.itemIndex);
    }
  }

  // Fallback: create a generic error
  const fallbackError = new DuckDuckGoError(
    `Unexpected error during ${operation}: ${error.message || 'Unknown error'}`,
    DuckDuckGoErrorType.UNKNOWN_ERROR,
    {
      technicalDetails: {
        operation,
        originalError: options.debugMode ? error : error.message,
      },
    }
  );

  if (options.node) {
    return fallbackError.toNodeOperationError(options.node, options.itemIndex);
  }

  // Return as generic NodeOperationError if no node provided
    return new NodeOperationError(
    options.node || { name: 'DuckDuckGo', type: 'unknown' } as INode,
    fallbackError.userMessage,
    { itemIndex: options.itemIndex }
    );
}

/**
 * Parse API error from response
 */
export function parseApiError(response: any): DuckDuckGoError {
  const statusCode = response?.status || response?.statusCode;
  const responseBody = response?.data || response?.body;

  if (statusCode) {
    return new APIError('API request failed', {
      statusCode,
      responseBody,
      headers: response?.headers,
    });
  }

  return new DuckDuckGoError('Unknown API error', DuckDuckGoErrorType.API_ERROR, {
    technicalDetails: { response },
  });
}

/**
 * Create a retry-aware error wrapper
 */
export function createRetryableError(error: any, operation: string, attemptNumber: number, maxAttempts: number): DuckDuckGoError {
  const baseError = error instanceof DuckDuckGoError ? error : new DuckDuckGoError(error.message || 'Unknown error');

  if (baseError.isRetryable && attemptNumber < maxAttempts) {
    return new DuckDuckGoError(
      `${operation} failed (attempt ${attemptNumber}/${maxAttempts}): ${baseError.message}`,
      baseError.errorType,
      {
        ...baseError,
        technicalDetails: {
          ...baseError.technicalDetails,
          attemptNumber,
          maxAttempts,
          willRetry: attemptNumber < maxAttempts,
        },
      }
    );
  }

  return baseError;
}
