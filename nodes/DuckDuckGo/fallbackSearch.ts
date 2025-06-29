/**
 * Fallback search wrapper that uses SearchAPI.io when duck-duck-scrape fails
 * Updated to work without cheerio dependency - using regex-based parsing
 */

import {
  search as duckSearch,
  searchNews as duckSearchNews,
  searchVideos as duckSearchVideos,
  SearchOptions,
  NewsSearchOptions,
  VideoSearchOptions,
} from 'duck-duck-scrape';

import {
  searchWithAPI,
  searchNewsWithAPI,
  searchVideosWithAPI,
} from './apiClient';

import axios from 'axios';

export interface FallbackSearchResult {
  title: string;
  href: string;
  body: string;
}

export interface FallbackSearchResponse {
  success: boolean;
  noResults: boolean;
  results: FallbackSearchResult[];
  vqd?: string;
  error?: string;
}

/**
 * Enhanced search function with SearchAPI fallback
 */
export async function searchWithFallback(query: string, options: SearchOptions = {}): Promise<any> {
  try {
    // Try duck-duck-scrape first
    const result = await duckSearch(query, options);

    // If successful, return the result
    if (result && result.results && result.results.length > 0) {
      return result;
    }

    // If no results, fallback to SearchAPI
    console.warn('Duck-duck-scrape returned no results, falling back to SearchAPI');
    return await searchWithAPI(query, options);

  } catch (error) {
    // If duck-duck-scrape fails (especially with regex issues), use SearchAPI
    console.warn(`Duck-duck-scrape failed: ${error.message}, falling back to SearchAPI`);

    try {
      return await searchWithAPI(query, options);
    } catch (fallbackError) {
      // If both fail, throw the SearchAPI error as it's more reliable
      throw new Error(`Both search methods failed. SearchAPI error: ${fallbackError.message}`);
    }
  }
}



/**
 * Enhanced news search function with SearchAPI fallback
 */
export async function searchNewsWithFallback(query: string, options: NewsSearchOptions = {}): Promise<any> {
  try {
    // Try duck-duck-scrape first
    const result = await duckSearchNews(query, options);

    if (result && result.results && result.results.length > 0) {
      return result;
    }

    // If no results, fallback to SearchAPI
    console.warn('Duck-duck-scrape news returned no results, falling back to SearchAPI');
    return await searchNewsWithAPI(query, options);

  } catch (error) {
    console.warn(`Duck-duck-scrape news failed: ${error.message}, falling back to SearchAPI`);

    try {
      return await searchNewsWithAPI(query, options);
    } catch (fallbackError) {
      throw new Error(`Both news search methods failed. SearchAPI error: ${fallbackError.message}`);
    }
  }
}

/**
 * Enhanced video search function with SearchAPI fallback
 */
export async function searchVideosWithFallback(query: string, options: VideoSearchOptions = {}): Promise<any> {
  try {
    // Try duck-duck-scrape first
    const result = await duckSearchVideos(query, options);

    if (result && result.results && result.results.length > 0) {
      return result;
    }

    // If no results, fallback to SearchAPI
    console.warn('Duck-duck-scrape videos returned no results, falling back to SearchAPI');
    return await searchVideosWithAPI(query, options);

  } catch (error) {
    console.warn(`Duck-duck-scrape videos failed: ${error.message}, falling back to SearchAPI`);

    try {
      return await searchVideosWithAPI(query, options);
    } catch (fallbackError) {
      throw new Error(`Both video search methods failed. SearchAPI error: ${fallbackError.message}`);
    }
  }
}

/**
 * Simple regex-based HTML parser for extracting search results
 * No cheerio dependency required
 */
function parseSearchResultsFromHTML(html: string): FallbackSearchResult[] {
  const results: FallbackSearchResult[] = [];

  // Regex to match search result divs with title and link
  const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/i;
  const snippetRegex = /<[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/[^>]*>/i;

  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const resultHTML = match[1];

    const titleMatch = titleRegex.exec(resultHTML);
    const snippetMatch = snippetRegex.exec(resultHTML);

    if (titleMatch) {
      const href = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
      const body = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      if (title && href) {
        results.push({
          title: cleanText(title),
          href: href.startsWith('http') ? href : `https://${href}`,
          body: cleanText(body),
        });
      }
    }
  }

  return results;
}

/**
 * Clean text by removing HTML entities and normalizing whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fallback search using DuckDuckGo HTML Lite API
 * This is used when duck-duck-scrape fails - now using regex parsing
 */
export async function fallbackWebSearch(
  query: string,
  options: SearchOptions = {}
): Promise<FallbackSearchResponse> {
  try {
    const searchUrl = 'https://html.duckduckgo.com/html/';

    const params = new URLSearchParams({
      q: query,
      kl: options.locale || 'us-en',
      s: String(options.safeSearch || 'moderate'),
      df: options.time || '',
    });

    const response = await axios.get(`${searchUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
    });

    // Parse results using regex instead of cheerio
    const results = parseSearchResultsFromHTML(response.data);

    // Check if no results found
    const noResultsIndicator = response.data.includes('no-results') || results.length === 0;

    return {
      success: true,
      noResults: noResultsIndicator,
      results,
    };

  } catch (error) {
    console.error('Fallback search error:', error);
    return {
      success: false,
      noResults: true,
      results: [],
      error: `Fallback search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fallback image search using DuckDuckGo HTML search with image-focused query
 */
export async function fallbackImageSearch(
  query: string,
  options: SearchOptions = {}
): Promise<FallbackSearchResponse> {
  try {
    // Use web search with image-focused keywords as a fallback
    const imageQuery = `${query} images photos pictures`;
    return await fallbackWebSearch(imageQuery, options);

  } catch (error) {
    console.error('Fallback image search error:', error);
    return {
      success: false,
      noResults: true,
      results: [],
      error: `Fallback image search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fallback news search using DuckDuckGo
 */
export async function fallbackNewsSearch(
  query: string,
  options: SearchOptions = {}
): Promise<FallbackSearchResponse> {
  try {
    // Use regular web search with news site focus
    const newsQuery = `${query} site:news.com OR site:bbc.com OR site:cnn.com OR site:reuters.com`;
    return await fallbackWebSearch(newsQuery, options);

  } catch (error) {
    console.error('Fallback news search error:', error);
    return {
      success: false,
      noResults: true,
      results: [],
      error: `Fallback news search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fallback video search using DuckDuckGo
 */
export async function fallbackVideoSearch(
  query: string,
  options: SearchOptions = {}
): Promise<FallbackSearchResponse> {
  try {
    // Use web search with video site focus
    const videoQuery = `${query} site:youtube.com OR site:vimeo.com OR site:dailymotion.com`;
    return await fallbackWebSearch(videoQuery, options);

  } catch (error) {
    console.error('Fallback video search error:', error);
    return {
      success: false,
      noResults: true,
      results: [],
      error: `Fallback video search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
