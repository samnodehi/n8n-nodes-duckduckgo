/**
 * Direct DuckDuckGo search implementation
 * Bypasses duck-duck-scrape VQD issues by using HTML API directly
 */

import axios from 'axios';

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
    .replace(/&#x27;/g, "'")
    .replace(/<\/?b>/g, '') // Remove bold tags
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DirectSearchResult {
  title: string;
  url: string;
  description: string;
}

export interface DirectImageResult {
  title: string;
  url: string;
  thumbnail: string;
  width?: number;
  height?: number;
  source?: string;
}

/**
 * Direct web search using DuckDuckGo HTML API
 */
export async function directWebSearch(query: string, options: {
  locale?: string;
  safeSearch?: string;
  maxResults?: number;
} = {}): Promise<{ results: DirectSearchResult[] }> {
  try {
    // Use POST method to DuckDuckGo HTML endpoint
    const response = await axios.post('https://html.duckduckgo.com/html/',
      new URLSearchParams({
        q: query,
        b: '',
        kl: options.locale || 'us-en',
        kp: options.safeSearch === 'strict' ? '1' : options.safeSearch === 'moderate' ? '-1' : '-2',
      }), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 10000,
    });

    const results: DirectSearchResult[] = [];
    const html = response.data;

    // Split HTML by result containers and parse each one
    const resultSections = html.split(/<div[^>]*class="[^"]*result results_links[^"]*"[^>]*>/);

    for (let i = 1; i < resultSections.length; i++) {
      const section = resultSections[i];

      // Extract title and URL from result__title section
      const titleMatch = section.match(/<h2[^>]*class="result__title"[^>]*>[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/);

      // Extract description from result__snippet
      const snippetMatch = section.match(/<a[^>]*class="result__snippet"[^>]*href="[^"]*"[^>]*>(.*?)<\/a>/);

      if (titleMatch) {
        const url = titleMatch[1];
        const title = titleMatch[2];
        const description = snippetMatch ? snippetMatch[1] : '';

        if (title && url && url.startsWith('http')) {
          results.push({
            title: cleanText(title),
            url: url,
            description: cleanText(description),
          });

          // Limit results if maxResults is specified
          if (options.maxResults && results.length >= options.maxResults) {
            break;
          }
        }
      }
    }

    return { results };
  } catch (error) {
    console.error('Direct web search error:', error);
    throw new Error(`Direct web search failed: ${error.message}`);
  }
}

/**
 * Direct image search using DuckDuckGo
 * This uses a different approach to get images without VQD issues
 */
export async function directImageSearch(query: string, options: {
  locale?: string;
  safeSearch?: string;
  maxResults?: number;
} = {}): Promise<{ results: DirectImageResult[] }> {
  try {
    // First, make a request to get the initial page
    const searchParams = new URLSearchParams({
      q: query,
      iax: 'images',
      ia: 'images',
    });

    const searchUrl = `https://duckduckgo.com/?${searchParams.toString()}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 10000,
    });

    // Extract VQD token from the page
    const vqdMatch = response.data.match(/vqd=([\d-]+)/);
    const vqd = vqdMatch ? vqdMatch[1] : null;

    if (!vqd) {
      // Fallback to web search with image keywords
      const webResults = await directWebSearch(`${query} images photos`, options);
      return {
        results: webResults.results.map(result => ({
          title: result.title,
          url: result.url,
          thumbnail: '',
          source: result.url,
        })),
      };
    }

    // Make image API request
    const imageParams = new URLSearchParams({
      l: options.locale || 'us-en',
      o: 'json',
      q: query,
      vqd: vqd,
      f: ',,,,,',
      p: options.safeSearch === 'strict' ? '1' : options.safeSearch === 'moderate' ? '-1' : '-2',
    });

    const imageResponse = await axios.get(`https://duckduckgo.com/i.js?${imageParams.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': searchUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000,
    });

    const imageData = imageResponse.data;
    const results: DirectImageResult[] = [];

    if (imageData && imageData.results) {
      for (const item of imageData.results) {
        results.push({
          title: item.title || '',
          url: item.image || '',
          thumbnail: item.thumbnail || '',
          width: item.width,
          height: item.height,
          source: item.url || '',
        });

        if (options.maxResults && results.length >= options.maxResults) {
          break;
        }
      }
    }

    return { results };
  } catch (error) {
    console.error('Direct image search error:', error);
    // Fallback to web search
    const webResults = await directWebSearch(`${query} images photos`, options);
    return {
      results: webResults.results.map(result => ({
        title: result.title,
        url: result.url,
        thumbnail: '',
        source: result.url,
      })),
    };
  }
}

/**
 * Convert safe search value to string
 */
export function getSafeSearchString(value: number): string {
  switch (value) {
    case 2:
      return 'strict';
    case 1:
      return 'moderate';
    default:
      return 'off';
  }
}
