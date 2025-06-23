/**
 * Custom error handling for DuckDuckGo node
 *
 * This module provides custom error classes and error handling utilities
 * for better error management and user experience.
 */

import { NodeOperationError } from 'n8n-workflow';

/**
 * Error types enum for categorizing errors
 */
export enum DuckDuckGoErrorType {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  DNS_ERROR = 'DNS_ERROR',

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // API errors
  API_ERROR = 'API_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  PARSING_ERROR = 'PARSING_ERROR',

  // Input validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_PARAMETER = 'INVALID_PARAMETER',

  // Operation errors
  OPERATION_FAILED = 'OPERATION_FAILED',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',

  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Base custom error class for DuckDuckGo operations
 */
export class DuckDuckGoError extends Error {
  public readonly errorType: DuckDuckGoErrorType;
  public readonly severity: ErrorSeverity;
  public readonly isRetryable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    errorType: DuckDuckGoErrorType = DuckDuckGoErrorType.UNKNOWN_ERROR,
    options?: {
      severity?: ErrorSeverity;
      isRetryable?: boolean;
      userMessage?: string;
      technicalDetails?: any;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'DuckDuckGoError';
    this.errorType = errorType;
    this.severity = options?.severity || ErrorSeverity.MEDIUM;
    this.isRetryable = options?.isRetryable ?? this.determineRetryability(errorType);
    this.userMessage = options?.userMessage || this.generateUserMessage(errorType, message);
    this.technicalDetails = options?.technicalDetails;
    this.timestamp = new Date();

    // Set cause if provided (for error chaining)
    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DuckDuckGoError);
    }
  }

  /**
   * Determine if error is retryable based on type
   */
  private determineRetryability(errorType: DuckDuckGoErrorType): boolean {
    const retryableErrors = [
      DuckDuckGoErrorType.NETWORK_ERROR,
      DuckDuckGoErrorType.TIMEOUT,
      DuckDuckGoErrorType.CONNECTION_REFUSED,
      DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED,
      DuckDuckGoErrorType.TOO_MANY_REQUESTS,
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(errorType: DuckDuckGoErrorType, originalMessage: string): string {
    const userMessages: Record<DuckDuckGoErrorType, string> = {
      [DuckDuckGoErrorType.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection and try again.',
      [DuckDuckGoErrorType.TIMEOUT]: 'The request took too long to complete. Please try again.',
      [DuckDuckGoErrorType.CONNECTION_REFUSED]: 'Unable to connect to DuckDuckGo servers. The service might be temporarily unavailable.',
      [DuckDuckGoErrorType.DNS_ERROR]: 'Could not resolve DuckDuckGo server address. Please check your network settings.',
      [DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED]: 'Too many requests sent. Please wait a moment before trying again.',
      [DuckDuckGoErrorType.TOO_MANY_REQUESTS]: 'Request limit reached. Please reduce the frequency of your requests.',
      [DuckDuckGoErrorType.QUOTA_EXCEEDED]: 'Daily quota exceeded. Please try again tomorrow.',
      [DuckDuckGoErrorType.API_ERROR]: 'DuckDuckGo API returned an error. Please try again later.',
      [DuckDuckGoErrorType.INVALID_RESPONSE]: 'Received an invalid response from DuckDuckGo. Please try again.',
      [DuckDuckGoErrorType.EMPTY_RESPONSE]: 'No results found for your query.',
      [DuckDuckGoErrorType.PARSING_ERROR]: 'Could not process the response. The format might have changed.',
      [DuckDuckGoErrorType.INVALID_INPUT]: 'Invalid input provided. Please check your parameters.',
      [DuckDuckGoErrorType.MISSING_PARAMETER]: 'Required parameter is missing. Please provide all required fields.',
      [DuckDuckGoErrorType.INVALID_PARAMETER]: 'Invalid parameter value. Please check the documentation for valid values.',
      [DuckDuckGoErrorType.OPERATION_FAILED]: 'The operation could not be completed. Please try again.',
      [DuckDuckGoErrorType.UNSUPPORTED_OPERATION]: 'This operation is not supported.',
      [DuckDuckGoErrorType.AUTH_FAILED]: 'Authentication failed. Please check your credentials.',
      [DuckDuckGoErrorType.INVALID_API_KEY]: 'Invalid API key provided. Please check your API key configuration.',
      [DuckDuckGoErrorType.UNKNOWN_ERROR]: originalMessage || 'An unexpected error occurred. Please try again.',
    };

    return userMessages[errorType] || originalMessage;
  }

  /**
   * Convert to NodeOperationError for n8n
   */
  toNodeOperationError(node: any, itemIndex?: number): NodeOperationError {
    const nodeError = new NodeOperationError(
      node,
      this.userMessage,
      {
        message: this.message,
        description: this.userMessage,
        itemIndex,
      }
    );

    // Add custom properties
    (nodeError as any).errorType = this.errorType;
    (nodeError as any).severity = this.severity;
    (nodeError as any).isRetryable = this.isRetryable;
    (nodeError as any).technicalDetails = this.technicalDetails;

    return nodeError;
  }
}

/**
 * Specific error classes for different scenarios
 */

export class RateLimitError extends DuckDuckGoError {
  public readonly retryAfter?: number;
  public readonly remaining?: number;
  public readonly limit?: number;

  constructor(
    message: string,
    options?: {
      retryAfter?: number;
      remaining?: number;
      limit?: number;
      technicalDetails?: any;
    }
  ) {
    super(message, DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED, {
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      userMessage: options?.retryAfter
        ? `Rate limit exceeded. Please wait ${Math.ceil(options.retryAfter / 1000)} seconds before trying again.`
        : 'Rate limit exceeded. Please wait before making more requests.',
      technicalDetails: options?.technicalDetails,
    });

    this.name = 'RateLimitError';
    this.retryAfter = options?.retryAfter;
    this.remaining = options?.remaining;
    this.limit = options?.limit;
  }
}

export class NetworkError extends DuckDuckGoError {
  constructor(
    message: string,
    originalError?: Error,
    options?: {
      technicalDetails?: any;
    }
  ) {
    const errorType = NetworkError.determineNetworkErrorType(originalError);

    super(message, errorType, {
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      cause: originalError,
      technicalDetails: options?.technicalDetails,
    });

    this.name = 'NetworkError';
  }

  private static determineNetworkErrorType(error?: Error): DuckDuckGoErrorType {
    if (!error) return DuckDuckGoErrorType.NETWORK_ERROR;

    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('etimedout')) {
      return DuckDuckGoErrorType.TIMEOUT;
    } else if (message.includes('econnrefused')) {
      return DuckDuckGoErrorType.CONNECTION_REFUSED;
    } else if (message.includes('enotfound') || message.includes('getaddrinfo')) {
      return DuckDuckGoErrorType.DNS_ERROR;
    }

    return DuckDuckGoErrorType.NETWORK_ERROR;
  }
}

export class ValidationError extends DuckDuckGoError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly validationRule?: string;

  constructor(
    message: string,
    options?: {
      field?: string;
      value?: any;
      validationRule?: string;
      technicalDetails?: any;
    }
  ) {
    super(message, DuckDuckGoErrorType.INVALID_INPUT, {
      severity: ErrorSeverity.LOW,
      isRetryable: false,
      userMessage: options?.field
        ? `Invalid value for field "${options.field}": ${message}`
        : message,
      technicalDetails: options?.technicalDetails,
    });

    this.name = 'ValidationError';
    this.field = options?.field;
    this.value = options?.value;
    this.validationRule = options?.validationRule;
  }
}

export class APIError extends DuckDuckGoError {
  public readonly statusCode?: number;
  public readonly responseBody?: any;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      responseBody?: any;
      technicalDetails?: any;
    }
  ) {
    const errorType = options?.statusCode === 429
      ? DuckDuckGoErrorType.TOO_MANY_REQUESTS
      : DuckDuckGoErrorType.API_ERROR;

    super(message, errorType, {
      severity: options?.statusCode && options.statusCode >= 500
        ? ErrorSeverity.HIGH
        : ErrorSeverity.MEDIUM,
      isRetryable: options?.statusCode ? options.statusCode >= 500 || options.statusCode === 429 : false,
      technicalDetails: options?.technicalDetails,
    });

    this.name = 'APIError';
    this.statusCode = options?.statusCode;
    this.responseBody = options?.responseBody;
  }
}

/**
 * Error handler utility function
 */
export function handleDuckDuckGoError(
  error: any,
  operation: string,
  context?: {
    node?: any;
    itemIndex?: number;
    debugMode?: boolean;
  }
): NodeOperationError {
  // If already a DuckDuckGoError, convert to NodeOperationError
  if (error instanceof DuckDuckGoError) {
    return error.toNodeOperationError(context?.node, context?.itemIndex);
  }

  // If already a NodeOperationError, return as is
  if (error instanceof NodeOperationError) {
    return error;
  }

  // Analyze error and create appropriate DuckDuckGoError
  let duckError: DuckDuckGoError;

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    duckError = new NetworkError(
      `Network error during ${operation}: ${error.message}`,
      error
    );
  } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
    duckError = new RateLimitError(
      `Rate limit hit during ${operation}: ${error.message}`
    );
  } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
    duckError = new ValidationError(
      `Validation error during ${operation}: ${error.message}`
    );
  } else {
    duckError = new DuckDuckGoError(
      `Error during ${operation}: ${error.message || 'Unknown error'}`,
      DuckDuckGoErrorType.UNKNOWN_ERROR,
      {
        cause: error,
        technicalDetails: context?.debugMode ? {
          stack: error.stack,
          code: error.code,
          originalError: error,
        } : undefined,
      }
    );
  }

  return duckError.toNodeOperationError(context?.node, context?.itemIndex);
}
