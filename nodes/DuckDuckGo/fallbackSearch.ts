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
import { BROWSER_USER_AGENT } from './constants';

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
      const rawHref = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
      const body = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      // normaliseDdgUrl drops ad URLs and decodes DDG redirect wrappers.
      // It also fixes protocol-relative hrefs (// prefix) so they never
      // produce the malformed https://// form.
      const normHref = normaliseDdgUrl(rawHref);
      if (title && normHref) {
        results.push({
          title: cleanText(title),
          href: normHref,
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
 * Returns true if the parsed URL belongs to a known ad or tracker destination
 * that must be dropped from search results.
 * Hostname comparisons use toLowerCase() for safety.
 */
function isBlockedAdUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  if (host === 'duckduckgo.com' && u.pathname === '/y.js') return true;
  if ((host === 'bing.com' || host.endsWith('.bing.com')) && u.pathname === '/aclick') return true;
  if (u.searchParams.has('ad_provider') || u.searchParams.has('ad_type') || u.searchParams.has('ad_domain')) return true;
  return false;
}

/**
 * Normalise a URL extracted from DuckDuckGo search HTML.
 *
 * Returns null   → caller must discard this result (ad or unresolvable redirect).
 * Returns string → the clean, final destination URL.
 *
 * Handles:
 *   - Protocol-relative hrefs (//host/path) → https:host/path  (no double-slash)
 *   - duckduckgo.com/y.js              → null  (JS ad redirect)
 *   - bing.com/aclick                   → null  (Bing ad click tracker)
 *   - ?ad_provider / ?ad_type / ?ad_domain params → null  (DDG ad params)
 *   - duckduckgo.com/l/?uddg=<encoded>  → decoded final destination URL
 *     • URLSearchParams.get() already decodes the value once — no second
 *       decodeURIComponent() call is made, which would corrupt percent-encoded
 *       characters in the target URL (e.g. ?q=100%25+AI → ?q=100%+AI).
 *     • The extracted target is validated with new URL(), must be http/https,
 *       and is re-checked for ad/tracker patterns before being returned.
 */
function normaliseDdgUrl(raw: string): string | null {
  if (!raw) return null;
  // Resolve protocol-relative hrefs so URL constructor can parse them.
  // Use 'https:' + raw (which already starts with '//') — not 'https://' + raw.
  const href = raw.startsWith('//') ? `https:${raw}` : raw;
  if (!href.startsWith('http://') && !href.startsWith('https://')) return null;
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  if (isBlockedAdUrl(u)) return null;
  // Unwrap DDG organic redirect wrapper → extract and validate the real destination.
  if (u.hostname.toLowerCase() === 'duckduckgo.com' && u.pathname === '/l/') {
    // URLSearchParams.get() decodes percent-encoding exactly once.
    // Do NOT call decodeURIComponent() again on the result.
    const uddg = u.searchParams.get('uddg');
    if (!uddg) return null;
    let target: URL;
    try { target = new URL(uddg); } catch { return null; }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
    // Re-run ad/tracker check on the decoded destination.
    if (isBlockedAdUrl(target)) return null;
    return uddg;
  }
  return href;
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
        'User-Agent': BROWSER_USER_AGENT,
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
    // Append 'news' to bias DuckDuckGo's HTML-Lite ranking toward news content.
    // The user query is always the dominant term. Hard-coded site: filters were removed
    // because the OR operator caused BBC/CNN results to appear regardless of the query.
    const newsQuery = `${query} news`;
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
