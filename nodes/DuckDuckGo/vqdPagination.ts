/**
 * Enhanced Pagination with VQD Token Management
 * Provides improved pagination capabilities for DuckDuckGo searches with 2025 API compatibility
 */

import { search, SearchOptions } from 'duck-duck-scrape';
import { createLogEntry, LogLevel } from './utils';
import { DuckDuckGoError, DuckDuckGoErrorType } from './errors';

/**
 * VQD token manager interface
 */
export interface IVqdTokenManager {
  token: string | undefined;
  lastUpdated: number;
  query: string;
  usageCount: number;
  maxUsage: number;
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
  useBackupStrategy?: boolean;
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
  strategy: 'primary' | 'fallback' | 'hybrid';
  errors: string[];
}

/**
 * Default pagination configuration - updated for 2025 API changes
 */
export const DEFAULT_PAGINATION_CONFIG = {
  pageSize: 10,
  maxPages: 15, // Increased to handle more results
  delayBetweenRequests: 750, // Increased delay for better rate limiting
  maxConsecutiveErrors: 3,
  vqdTokenMaxUsage: 25, // Maximum times to reuse a VQD token
  vqdTokenLifetime: 4 * 60 * 1000, // 4 minutes (reduced from 5 for safety)
};

/**
 * VQD Token cache to reuse tokens for the same query
 */
const vqdTokenCache = new Map<string, IVqdTokenManager>();

/**
 * Get cached VQD token if still valid
 */
function getCachedVqdToken(query: string): IVqdTokenManager | undefined {
  const cached = vqdTokenCache.get(query);
  if (cached) {
    const tokenAge = Date.now() - cached.lastUpdated;
    const isExpired = tokenAge > DEFAULT_PAGINATION_CONFIG.vqdTokenLifetime;
    const isOverused = cached.usageCount >= cached.maxUsage;

    if (isExpired || isOverused) {
      vqdTokenCache.delete(query);
      return undefined;
    }

    return cached;
  }
  return undefined;
}

/**
 * Update VQD token cache
 */
function updateVqdTokenCache(query: string, token: string | undefined, incrementUsage = false): void {
  if (token) {
    const existing = vqdTokenCache.get(query);
    if (existing && incrementUsage) {
      existing.usageCount++;
      existing.lastUpdated = Date.now();
    } else {
    vqdTokenCache.set(query, {
      token,
      lastUpdated: Date.now(),
      query,
        usageCount: 1,
        maxUsage: DEFAULT_PAGINATION_CONFIG.vqdTokenMaxUsage,
    });
    }
  }
}

/**
 * Sleep function with jitter to avoid rate limiting patterns
 */
async function sleepWithJitter(baseDelay: number): Promise<void> {
  const jitter = Math.random() * 0.5 * baseDelay;
  const totalDelay = baseDelay + jitter;
  return new Promise(resolve => setTimeout(resolve, totalDelay));
}

/**
 * Enhanced pagination with VQD token management and fallback strategies
 */
export async function paginateWithVqd(
  query: string,
  baseOptions: SearchOptions,
  paginationOptions: IPaginationOptions
): Promise<IPaginationResult> {
  const results: any[] = [];
  const errors: string[] = [];
  let strategy: 'primary' | 'fallback' | 'hybrid' = 'primary';
  let vqdManager = getCachedVqdToken(query);
  let currentPage = 0;
  let hasMore = true;
  let consecutiveErrors = 0;

  const {
    maxResults,
    pageSize,
    maxPages,
    delayBetweenRequests,
    debugMode,
    useBackupStrategy = true
  } = paginationOptions;

  try {
    // First, try to get initial results and VQD token if not cached
    if (!vqdManager?.token) {
      const initialResult = await getInitialResults(query, baseOptions, debugMode);

      if (initialResult.success && initialResult.data) {
        results.push(...initialResult.data.results);
        if (initialResult.data.vqd) {
          updateVqdTokenCache(query, initialResult.data.vqd);
          vqdManager = getCachedVqdToken(query);
        }
        currentPage++;
        consecutiveErrors = 0;
      } else {
        errors.push(initialResult.error || 'Failed to get initial results');
        if (!useBackupStrategy) {
        hasMore = false;
        }
      }

      await sleepWithJitter(delayBetweenRequests);
  }

  // Continue pagination with VQD token
  while (
    results.length < maxResults &&
    hasMore &&
    currentPage < maxPages &&
    consecutiveErrors < DEFAULT_PAGINATION_CONFIG.maxConsecutiveErrors
  ) {
      let pageResult: any = null;
      let pageSuccess = false;

      // Strategy 1: Try with VQD token if available
      if (vqdManager?.token) {
        try {
          pageResult = await getPageWithVqd(query, baseOptions, vqdManager, currentPage, pageSize, debugMode);
          if (pageResult?.results?.length > 0) {
            results.push(...pageResult.results);
            pageSuccess = true;
            consecutiveErrors = 0;

            // Update VQD token if provided
            if (pageResult.vqd && pageResult.vqd !== vqdManager.token) {
              updateVqdTokenCache(query, pageResult.vqd);
              vqdManager = getCachedVqdToken(query);
                         } else if (vqdManager.token) {
               updateVqdTokenCache(query, vqdManager.token, true);
               vqdManager = getCachedVqdToken(query);
             }
          }
        } catch (vqdError) {
          errors.push(`VQD pagination error on page ${currentPage + 1}: ${vqdError.message}`);
      if (debugMode) {
            console.error(JSON.stringify(createLogEntry(
              LogLevel.ERROR,
              `VQD pagination failed: ${vqdError.message}`,
          'paginateWithVqd',
              { query, page: currentPage + 1, error: vqdError.message }
            )));
          }

          // Invalidate the VQD token if it's clearly expired
          if (vqdError.message.includes('VQD') || vqdError.message.includes('token')) {
            vqdTokenCache.delete(query);
            vqdManager = undefined;
          }
        }
      }

      // Strategy 2: Fallback to direct search if VQD failed and backup is enabled
      if (!pageSuccess && useBackupStrategy) {
        try {
          strategy = vqdManager ? 'hybrid' : 'fallback';
          pageResult = await getFallbackResults(query, baseOptions, currentPage, pageSize, debugMode);

          if (pageResult?.results?.length > 0) {
        results.push(...pageResult.results);
            pageSuccess = true;
            consecutiveErrors = 0;
          }
        } catch (fallbackError) {
          errors.push(`Fallback strategy failed on page ${currentPage + 1}: ${fallbackError.message}`);
          if (debugMode) {
            console.error(JSON.stringify(createLogEntry(
              LogLevel.ERROR,
              `Fallback pagination failed: ${fallbackError.message}`,
              'paginateWithVqd',
              { query, page: currentPage + 1, error: fallbackError.message }
            )));
          }
        }
      }

      if (!pageSuccess) {
        consecutiveErrors++;
        if (consecutiveErrors >= DEFAULT_PAGINATION_CONFIG.maxConsecutiveErrors) {
          hasMore = false;
          errors.push(`Maximum consecutive errors reached (${consecutiveErrors})`);
          break;
        }
      } else {
        // Check if we should continue (less results than expected might mean end of results)
        const expectedMinResults = Math.min(pageSize * 0.5, 3); // At least 50% of page size or 3 results
        if (pageResult?.results?.length < expectedMinResults) {
        hasMore = false;
      if (debugMode) {
            console.log(JSON.stringify(createLogEntry(
              LogLevel.INFO,
              `Received fewer results than expected, assuming end of results`,
          'paginateWithVqd',
          {
            query,
            page: currentPage + 1,
                received: pageResult?.results?.length,
                expected: pageSize
          }
        )));
      }
        }
      }

      currentPage++;

      if (hasMore && currentPage < maxPages) {
        await sleepWithJitter(delayBetweenRequests);
      }
    }

  } catch (error) {
    errors.push(`Pagination error: ${error.message}`);
    throw new DuckDuckGoError(
      `Pagination failed: ${error.message}`,
      DuckDuckGoErrorType.PAGINATION_ERROR,
      {
        technicalDetails: { query, currentPage, errors },
      }
    );
  }

  return {
    results: results.slice(0, maxResults), // Ensure we don't exceed maxResults
    totalFetched: results.length,
    pagesProcessed: currentPage,
    vqdToken: vqdManager?.token,
    hasMore: hasMore && results.length >= maxResults,
    strategy,
    errors,
  };
}

/**
 * Get initial search results
 */
async function getInitialResults(
  query: string,
  baseOptions: SearchOptions,
  debugMode?: boolean
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (debugMode) {
      console.log(JSON.stringify(createLogEntry(
        LogLevel.INFO,
        `Fetching initial results for: ${query}`,
        'getInitialResults',
        { query, options: baseOptions }
      )));
    }

    const result = await search(query, baseOptions);

    if (result?.results?.length > 0) {
      return { success: true, data: result };
    } else {
      return { success: false, error: 'No initial results found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get page results using VQD token
 */
async function getPageWithVqd(
  query: string,
  baseOptions: SearchOptions,
  vqdManager: IVqdTokenManager,
  currentPage: number,
  pageSize: number,
  debugMode?: boolean
): Promise<any> {
  const offset = currentPage * pageSize;

  const paginationOptions: any = {
    ...baseOptions,
    vqd: vqdManager.token,
    offset: offset,
  };

  if (debugMode) {
    console.log(JSON.stringify(createLogEntry(
      LogLevel.INFO,
      `Fetching page ${currentPage + 1} with VQD token`,
      'getPageWithVqd',
      {
        query,
        page: currentPage + 1,
        offset,
        vqdUsage: vqdManager.usageCount,
        vqdToken: vqdManager.token ? vqdManager.token.substring(0, 10) + '...' : 'undefined'
      }
    )));
  }

  return await search(query, paginationOptions);
}

/**
 * Fallback results using alternative methods
 */
async function getFallbackResults(
  query: string,
  baseOptions: SearchOptions,
  currentPage: number,
  pageSize: number,
  debugMode?: boolean
): Promise<any> {
  if (debugMode) {
    console.log(JSON.stringify(createLogEntry(
      LogLevel.INFO,
      `Using fallback strategy for page ${currentPage + 1}`,
      'getFallbackResults',
      { query, page: currentPage + 1 }
    )));
  }

  // Try basic search without VQD for this page
  const basicOptions = { ...baseOptions };
  delete (basicOptions as any).vqd;
  delete (basicOptions as any).offset;

  return await search(query, basicOptions);
}

/**
 * Clear all VQD token cache
 */
export function clearVqdTokenCache(): void {
  vqdTokenCache.clear();
}

/**
 * Get current VQD cache size
 */
export function getVqdTokenCacheSize(): number {
  return vqdTokenCache.size;
}

/**
 * Get VQD cache statistics
 */
export function getVqdCacheStats(): { totalTokens: number; activeTokens: number; expiredTokens: number } {
  const now = Date.now();
  let activeTokens = 0;
  let expiredTokens = 0;

  for (const [, manager] of vqdTokenCache.entries()) {
    const age = now - manager.lastUpdated;
    const isExpired = age > DEFAULT_PAGINATION_CONFIG.vqdTokenLifetime ||
                     manager.usageCount >= manager.maxUsage;

    if (isExpired) {
      expiredTokens++;
    } else {
      activeTokens++;
    }
  }

  return {
    totalTokens: vqdTokenCache.size,
    activeTokens,
    expiredTokens,
  };
}

/**
 * Cleanup expired VQD tokens
 */
export function cleanupExpiredVqdTokens(): number {
  const now = Date.now();
  let removedCount = 0;

  for (const [query, manager] of vqdTokenCache.entries()) {
    const age = now - manager.lastUpdated;
    const isExpired = age > DEFAULT_PAGINATION_CONFIG.vqdTokenLifetime ||
                     manager.usageCount >= manager.maxUsage;

    if (isExpired) {
      vqdTokenCache.delete(query);
      removedCount++;
    }
  }

  return removedCount;
}


