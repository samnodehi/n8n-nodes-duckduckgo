/**
 * Rate limiter implementation for DuckDuckGo API calls
 *
 * This module provides rate limiting functionality to prevent hitting
 * DuckDuckGo's rate limits and ensure stable operation.
 */

import { IExecuteFunctions } from 'n8n-workflow';

/**
 * Rate limit configuration interface
 */
export interface IRateLimitConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  delayMs?: number;         // Delay between requests in milliseconds
  retryAfterMs?: number;    // Wait time after hitting rate limit
  burstAllowance?: number;  // Extra requests allowed for bursts
}

/**
 * Default rate limit configurations for different operations
 */
export const DEFAULT_RATE_LIMITS: Record<string, IRateLimitConfig> = {
  search: {
    maxRequests: 30,
    windowMs: 60000,        // 1 minute
    delayMs: 1000,          // 1 second between requests
    retryAfterMs: 30000,    // 30 seconds retry after limit
    burstAllowance: 5,
  },
  instantAnswer: {
    maxRequests: 100,
    windowMs: 60000,        // 1 minute
    delayMs: 500,           // 0.5 seconds between requests
    retryAfterMs: 15000,    // 15 seconds retry after limit
    burstAllowance: 10,
  },
  dictionary: {
    maxRequests: 60,
    windowMs: 60000,        // 1 minute
    delayMs: 500,           // 0.5 seconds between requests
    retryAfterMs: 15000,    // 15 seconds retry after limit
    burstAllowance: 5,
  },
  stocks: {
    maxRequests: 20,
    windowMs: 60000,        // 1 minute
    delayMs: 2000,          // 2 seconds between requests
    retryAfterMs: 60000,    // 60 seconds retry after limit
    burstAllowance: 3,
  },
  currency: {
    maxRequests: 50,
    windowMs: 60000,        // 1 minute
    delayMs: 500,           // 0.5 seconds between requests
    retryAfterMs: 20000,    // 20 seconds retry after limit
    burstAllowance: 5,
  },
};

/**
 * Request tracking interface
 */
interface IRequestTracker {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
  isRateLimited: boolean;
  rateLimitedUntil?: number;
}

/**
 * Rate limiter class for managing API request rates
 */
export class RateLimiter {
  private trackers: Map<string, IRequestTracker> = new Map();
  private globalTracker: IRequestTracker = {
    count: 0,
    firstRequestTime: 0,
    lastRequestTime: 0,
    isRateLimited: false,
  };

  constructor(
    private config: IRateLimitConfig = DEFAULT_RATE_LIMITS.search
  ) {}

  /**
   * Check if request can be made and update tracking
   */
  async checkAndWait(
    operation: string,
    context?: IExecuteFunctions,
    itemIndex?: number
  ): Promise<boolean> {
    const now = Date.now();
    const operationConfig = DEFAULT_RATE_LIMITS[operation] || this.config;

    // Get or create tracker for operation
    let tracker = this.trackers.get(operation);
    if (!tracker) {
      tracker = {
        count: 0,
        firstRequestTime: now,
        lastRequestTime: now,
        isRateLimited: false,
      };
      this.trackers.set(operation, tracker);
    }

    // Check if currently rate limited
    if (tracker.isRateLimited && tracker.rateLimitedUntil) {
      if (now < tracker.rateLimitedUntil) {
        const waitTime = tracker.rateLimitedUntil - now;
        if (context) {
          context.logger.warn(
            `Rate limited for ${operation}. Waiting ${waitTime}ms before retry.`
          );
        }
        await this.sleep(waitTime);
        tracker.isRateLimited = false;
        tracker.rateLimitedUntil = undefined;
      }
    }

    // Reset counter if window has passed
    if (now - tracker.firstRequestTime > operationConfig.windowMs) {
      tracker.count = 0;
      tracker.firstRequestTime = now;
    }

    // Check if we're at the limit
    const effectiveLimit = operationConfig.maxRequests + (operationConfig.burstAllowance || 0);
    if (tracker.count >= effectiveLimit) {
      tracker.isRateLimited = true;
      tracker.rateLimitedUntil = now + (operationConfig.retryAfterMs || 30000);

      if (context) {
        context.logger.error(
          `Rate limit exceeded for ${operation}. Max ${effectiveLimit} requests per ${operationConfig.windowMs}ms.`
        );
      }

      return false;
    }

    // Apply delay between requests
    const timeSinceLastRequest = now - tracker.lastRequestTime;
    const requiredDelay = operationConfig.delayMs || 1000;

    if (timeSinceLastRequest < requiredDelay && tracker.count > 0) {
      const waitTime = requiredDelay - timeSinceLastRequest;
      if (context) {
        context.logger.info(
          `Applying rate limit delay of ${waitTime}ms for ${operation}`
        );
      }
      await this.sleep(waitTime);
    }

    // Update tracking
    tracker.count++;
    tracker.lastRequestTime = Date.now();

    // Also update global tracking
    this.updateGlobalTracking();

    return true;
  }

  /**
   * Update global request tracking across all operations
   */
  private updateGlobalTracking(): void {
    const now = Date.now();

    // Reset global counter if window has passed
    if (now - this.globalTracker.firstRequestTime > 60000) { // 1 minute window
      this.globalTracker.count = 0;
      this.globalTracker.firstRequestTime = now;
    }

    this.globalTracker.count++;
    this.globalTracker.lastRequestTime = now;

    // Global rate limit check (max 100 requests per minute across all operations)
    if (this.globalTracker.count > 100) {
      this.globalTracker.isRateLimited = true;
      this.globalTracker.rateLimitedUntil = now + 30000; // 30 seconds
    }
  }

  /**
   * Get current rate limit status for an operation
   */
  getStatus(operation: string): {
    remaining: number;
    resetTime: number;
    isLimited: boolean;
  } {
    const tracker = this.trackers.get(operation);
    const config = DEFAULT_RATE_LIMITS[operation] || this.config;

    if (!tracker) {
      return {
        remaining: config.maxRequests,
        resetTime: 0,
        isLimited: false,
      };
    }

    const now = Date.now();
    const windowEnd = tracker.firstRequestTime + config.windowMs;
    const remaining = Math.max(0, config.maxRequests - tracker.count);

    return {
      remaining,
      resetTime: windowEnd > now ? windowEnd : 0,
      isLimited: tracker.isRateLimited || false,
    };
  }

  /**
   * Reset rate limit tracking for an operation
   */
  reset(operation?: string): void {
    if (operation) {
      this.trackers.delete(operation);
    } else {
      this.trackers.clear();
      this.globalTracker = {
        count: 0,
        firstRequestTime: 0,
        lastRequestTime: 0,
        isRateLimited: false,
      };
    }
  }

  /**
   * Apply exponential backoff for repeated failures
   */
  async applyBackoff(
    attemptNumber: number,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 30000
  ): Promise<void> {
    const delay = Math.min(baseDelayMs * Math.pow(2, attemptNumber), maxDelayMs);
    await this.sleep(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global rate limiter instance
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create global rate limiter instance
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Rate limit decorator for async functions
 */
export function rateLimited(operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const rateLimiter = getGlobalRateLimiter();
      const context = args.find(arg => arg && typeof arg.logger === 'object') as IExecuteFunctions | undefined;

      const canProceed = await rateLimiter.checkAndWait(operation, context);
      if (!canProceed) {
        throw new Error(`Rate limit exceeded for ${operation}. Please try again later.`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}