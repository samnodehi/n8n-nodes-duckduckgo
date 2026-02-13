/**
 * Error handler for duck-duck-scrape compatibility issues
 */

export interface ErrorResult {
  success: false;
  error: string;
  results: any[];
  count: 0;
  noResults: true;
  libraryIssue: boolean;
  recommendedAction?: string;
}

/**
 * Checks if error is the known duck-duck-scrape regex issue
 */
export function isDuckDuckScrapeRegexError(error: any): boolean {
  const errorMessage = error?.message || '';
  return (
    errorMessage.includes("Cannot read properties of null") ||
    errorMessage.includes("reading '1'") ||
    errorMessage.includes("SEARCH_REGEX") ||
    errorMessage.includes("TypeError: Cannot read properties of null")
  );
}

/**
 * Creates a user-friendly error result for duck-duck-scrape failures
 */
export function createLibraryErrorResult(operation: string, query: string, originalError: any): ErrorResult {
  const isRegexError = isDuckDuckScrapeRegexError(originalError);

  if (isRegexError) {
    return {
      success: false,
      error: `DuckDuckGo search is temporarily unavailable due to changes in their website structure. The underlying library (duck-duck-scrape) needs to be updated to handle the new format. This is a known issue affecting many users.`,
      results: [],
      count: 0,
      noResults: true,
      libraryIssue: true,
      recommendedAction: `Try again later, or consider using alternative search engines. You can also report this issue to the n8n-nodes-duckduckgo maintainers.`
    };
  }

  return {
    success: false,
    error: `Search failed: ${originalError?.message || 'Unknown error occurred'}`,
    results: [],
    count: 0,
    noResults: true,
    libraryIssue: false,
    recommendedAction: `Check your query and try again. If the problem persists, there may be a temporary issue with the search service.`
  };
}

/**
 * Parse API errors to user-friendly messages
 */
export function parseApiError(error: any, context: string): string {
  const errorMessage = error?.message || '';

  // Check for specific error types first
  if (error.name === 'FetchError' || errorMessage.includes('API request failed')) {
    return 'API request failed';
  }

  if (error.name === 'TimeoutError' || errorMessage.includes('Network request timed out')) {
    return 'Network request timed out';
  }

  if (error.name === 'RateLimitError' || error.httpCode === 429 || errorMessage.includes('Rate limit exceeded')) {
    return 'Rate limit exceeded';
  }

  // Check for regex/library issues
  if (isDuckDuckScrapeRegexError(error)) {
    return 'DuckDuckGo search is temporarily unavailable due to changes in their website structure. The underlying library (duck-duck-scrape) needs to be updated to handle the new format. This is a known issue affecting many users.';
  }

  return `Error during ${context}: ${errorMessage}`;
}

/**
 * Wraps duck-duck-scrape function calls with proper error handling
 */
export async function safeExecute<T>(
  operation: string,
  query: string,
  searchFunction: () => Promise<T>,
  debugMode: boolean = false
): Promise<T | ErrorResult> {
  try {
    const result = await searchFunction();

    // Validate result structure
    if (!result || typeof result !== 'object') {
      return createLibraryErrorResult(operation, query, new Error('Invalid search result structure'));
    }

    return result;

  } catch (error) {
    if (debugMode) {
      console.error(`[${operation}] Error:`, {
        query,
        error: error?.message,
        stack: error?.stack,
        isRegexError: isDuckDuckScrapeRegexError(error)
      });
    }

    return createLibraryErrorResult(operation, query, error);
  }
}
