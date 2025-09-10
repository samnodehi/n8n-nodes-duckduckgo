import axios from 'axios';
import { BROWSER_USER_AGENT } from './constants';
import { SearchOptions, search as duckSearch } from 'duck-duck-scrape';
import { searchWithAPI } from './apiClient';

export enum Backend {
  AUTO = 'auto',
  DUCK_DUCK_SCRAPE = 'duck-duck-scrape',
  SEARCH_API = 'search-api',
  HTML = 'html',
  LITE = 'lite'
}

export interface MultiBackendSearchResult {
  title: string;
  href: string;
  body: string;
  url?: string;
  hostname?: string;
  snippet?: string;
}

export interface MultiBackendSearchResponse {
  success: boolean;
  noResults?: boolean;
  results: MultiBackendSearchResult[];
  vqd?: string;
  error?: string;
  backend?: Backend;
  timestamp?: number;
  knowledge_graph?: any;
  ai_overview?: any;
  top_stories?: any[];
  related_searches?: any[];
  inline_images?: any[];
  inline_videos?: any[];
}

/**
 * Enhanced multi-backend search inspired by Python duckduckgo-search v8.0.4
 * Supports auto, html, and lite backends for maximum reliability
 * Updated to work without cheerio dependency - using regex-based parsing
 */
export class MultiBackendDuckDuckGoSearch {
  private readonly backends: Backend[];
  private readonly cache: Set<string> = new Set();

  constructor(backends: Backend[] = [Backend.AUTO]) {
    if (backends.includes(Backend.AUTO)) {
      // Shuffle backends for better distribution like Python DDGS
      this.backends = this.shuffleArray([
        Backend.DUCK_DUCK_SCRAPE,
        Backend.SEARCH_API,
        Backend.HTML,
        Backend.LITE
      ]);
    } else {
      this.backends = backends;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Search with duck-duck-scrape backend
   */
  private async searchWithDuckDuckScrape(query: string, options: SearchOptions): Promise<MultiBackendSearchResponse> {
    try {
      const result = await duckSearch(query, options);

      if (result && result.results && result.results.length > 0) {
        const convertedResults = result.results.map((item: any) => ({
          title: item.title || '',
          href: item.url || '',
          body: item.description || '',
          hostname: this.extractHostname(item.url || ''),
          snippet: item.description || ''
        }));

        return {
          success: true,
          results: convertedResults.filter((r: MultiBackendSearchResult) => !this.cache.has(r.href) && (this.cache.add(r.href), true)),
          backend: Backend.DUCK_DUCK_SCRAPE,
          vqd: result.vqd,
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        noResults: true,
        results: [],
        backend: Backend.DUCK_DUCK_SCRAPE,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Duck-duck-scrape backend failed: ${error.message}`);
    }
  }

  /**
   * Search with SearchAPI backend
   */
  private async searchWithSearchAPI(query: string, options: SearchOptions): Promise<MultiBackendSearchResponse> {
    try {
      const result = await searchWithAPI(query, options);

      if (result && result.results && result.results.length > 0) {
        const convertedResults = result.results.map((item: any) => ({
          title: item.title || '',
          href: item.url || '',
          body: item.description || item.body || '',
          hostname: this.extractHostname(item.url || ''),
          snippet: item.description || item.body || ''
        }));

        return {
          success: true,
          results: convertedResults.filter((r: MultiBackendSearchResult) => !this.cache.has(r.href) && (this.cache.add(r.href), true)),
          backend: Backend.SEARCH_API,
          vqd: result.vqd,
          timestamp: Date.now(),
          knowledge_graph: result.knowledge_graph,
          ai_overview: result.ai_overview,
          top_stories: result.top_stories,
          related_searches: result.related_searches,
          inline_images: result.inline_images,
          inline_videos: result.inline_videos
        };
      }

      return {
        success: true,
        noResults: true,
        results: [],
        backend: Backend.SEARCH_API,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`SearchAPI backend failed: ${error.message}`);
    }
  }

  /**
   * Normalize URL by ensuring it starts with http/https
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }

  /**
   * Extract hostname from URL
   */
  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  /**
   * Auto backend: tries all backends in optimal order
   */
  private async autoSearch(query: string, options: SearchOptions): Promise<MultiBackendSearchResponse> {
    let lastError: Error | null = null;

    for (const backend of this.backends) {
      try {
        let result: MultiBackendSearchResponse;

        switch (backend) {
          case Backend.HTML:
            result = await this.searchWithHtmlBackend(query, options);
            break;
          case Backend.LITE:
            result = await this.searchWithLiteBackend(query, options);
            break;
          case Backend.DUCK_DUCK_SCRAPE:
            result = await this.searchWithDuckDuckScrape(query, options);
            break;
          case Backend.SEARCH_API:
            result = await this.searchWithSearchAPI(query, options);
            break;
          default:
            continue;
        }

        if (result.success && result.results.length > 0) {
          return result;
        }
      } catch (error) {
        console.warn(`Backend ${backend} failed: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    return {
      success: false,
      noResults: true,
      results: [],
      error: `All backends failed. Last error: ${lastError?.message || 'Unknown error'}`,
      backend: Backend.AUTO,
      timestamp: Date.now()
    };
  }

  /**
   * Main search function with automatic backend selection
   */
  async search(
    query: string,
    options: SearchOptions & { backend?: Backend } = {}
  ): Promise<MultiBackendSearchResponse> {
    const { backend = Backend.AUTO, ...searchOptions } = options;

    switch (backend) {
      case Backend.AUTO:
        return await this.autoSearch(query, searchOptions);
      case Backend.HTML:
        return await this.searchWithHtmlBackend(query, searchOptions);
      case Backend.LITE:
        return await this.searchWithLiteBackend(query, searchOptions);
      case Backend.DUCK_DUCK_SCRAPE:
        return await this.searchWithDuckDuckScrape(query, searchOptions);
      case Backend.SEARCH_API:
        return await this.searchWithSearchAPI(query, searchOptions);
      default:
        throw new Error(`Unknown backend: ${backend}`);
    }
  }

  /**
   * Search with HTML backend (html.duckduckgo.com)
   */
  private async searchWithHtmlBackend(query: string, options: SearchOptions = {}): Promise<MultiBackendSearchResponse> {
    try {
      const searchUrl = 'https://html.duckduckgo.com/html';

      const response = await axios.post(searchUrl, new URLSearchParams({
        q: query,
        kl: options.locale || 'en-us',
        df: options.time || '',
        s: options.safeSearch?.toString() || '1'
      }), {
        headers: {
          'Referer': 'https://html.duckduckgo.com/',
          'User-Agent': BROWSER_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      });

      const results = this.parseHtmlResults(response.data);

      return {
        results: results.filter(r => !this.cache.has(r.href) && (this.cache.add(r.href), true)),
        backend: Backend.HTML,
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`HTML backend failed: ${error.message}`);
    }
  }

  /**
   * Search with Lite backend (lite.duckduckgo.com)
   */
  private async searchWithLiteBackend(query: string, options: SearchOptions = {}): Promise<MultiBackendSearchResponse> {
    try {
      const searchUrl = 'https://lite.duckduckgo.com/lite/';

      const response = await axios.post(searchUrl, new URLSearchParams({
        q: query,
        kl: options.locale || 'en-us',
        df: options.time || ''
      }), {
        headers: {
          'Referer': 'https://lite.duckduckgo.com/',
          'User-Agent': BROWSER_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      });

      const results = this.parseLiteResults(response.data);

      return {
        results: results.filter(r => !this.cache.has(r.href) && (this.cache.add(r.href), true)),
        backend: Backend.LITE,
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Lite backend failed: ${error.message}`);
    }
  }

  /**
   * Parse HTML results similar to Python DDGS
   */
  private parseHtmlResults(html: string): MultiBackendSearchResult[] {
    const results: MultiBackendSearchResult[] = [];

    // Simple regex-based parsing (could be enhanced with proper HTML parser)
    const resultPattern = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/i;
    const snippetPattern = /<span[^>]*class="[^"]*snippet[^"]*"[^>]*>(.*?)<\/span>/i;

    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      const resultHtml = match[1];
      const linkMatch = linkPattern.exec(resultHtml);
      const snippetMatch = snippetPattern.exec(resultHtml);

      if (linkMatch) {
        const url = linkMatch[1];
        const title = this.cleanText(linkMatch[2]);
        const snippet = snippetMatch ? this.cleanText(snippetMatch[1]) : '';

        if (url && title && !url.includes('google.com/search') && !url.includes('duckduckgo.com/y.js')) {
          results.push({
            title,
            href: this.normalizeUrl(url),
            body: this.cleanText(snippet),
          });
        }
      }
    }

    return results;
  }

  /**
   * Parse Lite results similar to Python DDGS
   */
  private parseLiteResults(html: string): MultiBackendSearchResult[] {
    const results: MultiBackendSearchResult[] = [];

    // Parse table-based results from lite.duckduckgo.com
    const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    let tableMatch;
    while ((tableMatch = tablePattern.exec(html)) !== null) {
      const tableHtml = tableMatch[1];
      let rowMatch;

      while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
        const rowHtml = rowMatch[1];
        const linkMatch = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/i.exec(rowHtml);

        if (linkMatch) {
          const url = linkMatch[1];
          const title = this.cleanText(linkMatch[2]);

          if (url && title && !url.includes('google.com/search') && !url.includes('duckduckgo.com/y.js')) {
            results.push({
              title,
              href: this.normalizeUrl(url),
              body: '',
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Clean and normalize text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Image search with multiple backends
   */
  async searchImages(query: string, options: SearchOptions & { backend?: Backend } = {}): Promise<MultiBackendSearchResponse> {
    // Use web search with image-focused query as fallback
    const imageQuery = `${query} images photos pictures`;
    return this.search(imageQuery, options);
  }

  /**
   * News search with multiple backends
   */
  async searchNews(query: string, options: SearchOptions & { backend?: Backend } = {}): Promise<MultiBackendSearchResponse> {
    // Use web search with news site focus
    const newsQuery = `${query} site:news.com OR site:bbc.com OR site:cnn.com OR site:reuters.com`;
    return this.search(newsQuery, options);
  }

  /**
   * Video search with multiple backends
   */
  async searchVideos(query: string, options: SearchOptions & { backend?: Backend } = {}): Promise<MultiBackendSearchResponse> {
    // Use web search with video site focus
    const videoQuery = `${query} site:youtube.com OR site:vimeo.com OR site:dailymotion.com`;
    return this.search(videoQuery, options);
  }
}

// Export singleton instance
export const multiBackendSearch = new MultiBackendDuckDuckGoSearch();
