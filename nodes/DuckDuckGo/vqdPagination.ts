/**
 * Enhanced Pagination with VQD Token Management
 * Provides improved pagination capabilities for DuckDuckGo searches
 */

import { search, SearchOptions } from 'duck-duck-scrape';
import { createLogEntry, LogLevel } from './utils';

/**
 * VQD token manager interface
 */
export interface IVqdTokenManager {
  token: string | undefined;
  lastUpdated: number;
  query: string;
}

/**
 * Pagination options
 */
export interface IPaginationOptions {
  maxResults: number;
  pageSize: number;
  maxPages: number;
  delayBetweenRequests: number;
  debugMode?: boolean;
}

/**
 * Pagination result
 */
export interface IPaginationResult {
  results: any[];
  totalFetched: number;
  pagesProcessed: number;
  vqdToken?: string;
  hasMore: boolean;
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION_CONFIG = {
  pageSize: 10,
  maxPages: 10, // Increased from 5 to allow more results
  delayBetweenRequests: 500, // Increased delay for better rate limiting
  maxConsecutiveErrors: 3,
};

/**
 * VQD Token cache to reuse tokens for the same query
 */
const vqdTokenCache = new Map<string, IVqdTokenManager>();

/**
 * Get cached VQD token if still valid
 */
function getCachedVqdToken(query: string): string | undefined {
  const cached = vqdTokenCache.get(query);
  if (cached) {
    // VQD tokens are valid for about 5 minutes
    const tokenAge = Date.now() - cached.lastUpdated;
    if (tokenAge < 5 * 60 * 1000) {
      return cached.token;
    } else {
      // Remove expired token
      vqdTokenCache.delete(query);
    }
  }
  return undefined;
}

/**
 * Update VQD token cache
 */
function updateVqdTokenCache(query: string, token: string | undefined): void {
  if (token) {
    vqdTokenCache.set(query, {
      token,
      lastUpdated: Date.now(),
      query,
    });
  }
}

/**
 * Sleep function with jitter to avoid rate limiting patterns
 */
async function sleepWithJitter(baseDelay: number): Promise<void> {
  // Add random jitter between 0-50% of base delay
  const jitter = Math.random() * 0.5 * baseDelay;
  const totalDelay = baseDelay + jitter;
  return new Promise(resolve => setTimeout(resolve, totalDelay));
}

/**
 * Enhanced pagination with VQD token management
 * @param query The search query
 * @param baseOptions Base search options
 * @param paginationOptions Pagination configuration
 * @returns Paginated results
 */
export async function paginateWithVqd(
  query: string,
  baseOptions: SearchOptions,
  paginationOptions: IPaginationOptions
): Promise<IPaginationResult> {
  const results: any[] = [];
  let vqdToken = getCachedVqdToken(query);
  let currentPage = 0;
  let hasMore = true;
  let consecutiveErrors = 0;

  const {
    maxResults,
    pageSize,
    maxPages,
    delayBetweenRequests,
    debugMode
  } = paginationOptions;

  // First, try to get initial results and VQD token
  if (!vqdToken) {
    try {
      const initialOptions = baseOptions;

      if (debugMode) {
        console.log(JSON.stringify(createLogEntry(
          LogLevel.INFO,
          `Fetching initial results and VQD token for: ${query}`,
          'paginateWithVqd',
          { query, options: initialOptions }
        )));
      }

      const initialResult = await search(query, initialOptions);

      if (initialResult.results && initialResult.results.length > 0) {
        results.push(...initialResult.results);
        vqdToken = initialResult.vqd;
        updateVqdTokenCache(query, vqdToken);
        currentPage++;
      } else {
        hasMore = false;
      }

      await sleepWithJitter(delayBetweenRequests);
    } catch (error) {
      if (debugMode) {
        console.error(JSON.stringify(createLogEntry(
          LogLevel.ERROR,
          `Failed to get initial results: ${error.message}`,
          'paginateWithVqd',
          { query, error: error.message }
        )));
      }
      hasMore = false;
    }
  }

  // Continue pagination with VQD token
  while (
    results.length < maxResults &&
    hasMore &&
    vqdToken &&
    currentPage < maxPages &&
    consecutiveErrors < DEFAULT_PAGINATION_CONFIG.maxConsecutiveErrors
  ) {
    try {
      // Calculate offset based on current page
      const offset = currentPage * pageSize;

      const paginationOptions: any = {
        ...baseOptions,
        vqd: vqdToken,
        offset: offset,
      };

      if (debugMode) {
        console.log(JSON.stringify(createLogEntry(
          LogLevel.INFO,
          `Fetching page ${currentPage + 1} (offset: ${offset}) for: ${query}`,
          'paginateWithVqd',
          { query, page: currentPage + 1, offset, vqdToken: vqdToken.substring(0, 10) + '...' }
        )));
      }

      const pageResult = await search(query, paginationOptions);

      if (pageResult.results && pageResult.results.length > 0) {
        results.push(...pageResult.results);

        // Update VQD token if a new one is provided
        if (pageResult.vqd && pageResult.vqd !== vqdToken) {
          vqdToken = pageResult.vqd;
          updateVqdTokenCache(query, vqdToken);
        }

        // Reset error counter on success
        consecutiveErrors = 0;
        currentPage++;

        // Check if we got fewer results than page size (indicates last page)
        if (pageResult.results.length < pageSize) {
          hasMore = false;
        }
      } else {
        // No more results
        hasMore = false;
      }

      // Dynamic delay based on page number (slower as we go deeper)
      const dynamicDelay = delayBetweenRequests * (1 + currentPage * 0.2);
      await sleepWithJitter(dynamicDelay);

    } catch (error) {
      consecutiveErrors++;

      if (debugMode) {
        console.error(JSON.stringify(createLogEntry(
          LogLevel.ERROR,
          `Pagination error on page ${currentPage + 1}: ${error.message}`,
          'paginateWithVqd',
          {
            query,
            page: currentPage + 1,
            consecutiveErrors,
            error: error.message
          }
        )));
      }

      // Wait longer after errors
      await sleepWithJitter(delayBetweenRequests * 2);

      // Check if error indicates VQD token is invalid
      if (error.message && error.message.includes('vqd')) {
        // Clear cached token and try to get a new one
        vqdTokenCache.delete(query);
        vqdToken = undefined;

        // Try to get new token
        try {
          const refreshResult = await search(query, baseOptions);

          if (refreshResult.vqd) {
            vqdToken = refreshResult.vqd;
            updateVqdTokenCache(query, vqdToken);
            consecutiveErrors = 0; // Reset error counter
          }
        } catch (refreshError) {
          // Failed to refresh token
          hasMore = false;
        }
      }
    }
  }

  return {
    results: results.slice(0, maxResults),
    totalFetched: results.length,
    pagesProcessed: currentPage,
    vqdToken,
    hasMore: hasMore && results.length >= maxResults,
  };
}

/**
 * Clear VQD token cache (useful for testing or when tokens become invalid)
 */
export function clearVqdTokenCache(): void {
  vqdTokenCache.clear();
}

/**
 * Get current VQD token cache size
 */
export function getVqdTokenCacheSize(): number {
  return vqdTokenCache.size;
}