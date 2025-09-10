/**
 * SearchAPI.io client for DuckDuckGo search operations
 * This replaces the broken duck-duck-scrape library
 */

import axios, { AxiosResponse } from 'axios';
import { BROWSER_USER_AGENT } from './constants';

export interface SearchAPIResponse {
  organic_results?: Array<{
    position: number;
    title: string;
    link: string;
    snippet: string;
    snippet_highlighted_words?: string[];
    favicon?: string;
    sitelinks?: Array<{
      title: string;
      link: string;
      snippet?: string;
    }>;
  }>;

  ads?: Array<{
    position: number;
    title: string;
    link: string;
    source: string;
    snippet: string;
    snippet_highlighted_words?: string[];
  }>;

  knowledge_graph?: {
    title: string;
    subtitle?: string;
    description: string;
    thumbnail?: string;
    facts?: Record<string, string>;
    profiles?: Array<{
      name: string;
      link: string;
      thumbnail?: string;
    }>;
  };

  news_results?: Array<{
    position: number;
    title: string;
    link: string;
    snippet: string;
    source: string;
    date: string;
    thumbnail?: string;
  }>;

  inline_images?: Array<{
    title: string;
    source: {
      name: string;
      link: string;
    };
    original: {
      link: string;
      height: number;
      width: number;
    };
    thumbnail: string;
  }>;

  inline_videos?: Array<{
    position: number;
    title: string;
    link: string;
    video_link: string;
    source: string;
    channel?: string;
    views?: number;
    date: string;
    thumbnail: string;
    uploader?: string;
  }>;

  related_searches?: Array<{
    query: string;
    link: string;
  }>;

  search_metadata?: {
    id: string;
    status: string;
    created_at: string;
    processed_at: string;
    total_time_taken: number;
  };

  search_parameters?: {
    engine: string;
    q: string;
    locale?: string;
    safe?: string;
    time_period?: string;
  };
}

export interface SearchAPIOptions {
  q: string;
  locale?: string;
  safe?: 'on' | 'moderate' | 'off';
  time_period?: 'any_time' | 'past_year' | 'past_month' | 'past_week' | 'past_day';
  next_page_token?: string;
}

export class SearchAPIClient {
  private readonly baseUrl = 'https://www.searchapi.io/api/v1/search';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    // Use environment variable or default test key
    this.apiKey = apiKey || process.env.SEARCHAPI_KEY || 'demo-key';
  }

  /**
   * Main search method that calls SearchAPI.io
   */
  async search(options: SearchAPIOptions): Promise<SearchAPIResponse> {
    const url = new URL(this.baseUrl);

    // Set required parameters
    url.searchParams.set('engine', 'duckduckgo');
    url.searchParams.set('q', options.q);

    // Set optional parameters
    if (options.locale) {
      url.searchParams.set('locale', options.locale);
    }

    if (options.safe) {
      url.searchParams.set('safe', options.safe);
    }

    if (options.time_period) {
      url.searchParams.set('time_period', options.time_period);
    }

    if (options.next_page_token) {
      url.searchParams.set('next_page_token', options.next_page_token);
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_USER_AGENT,
      'Accept': 'application/json',
    };

        try {
      const response: AxiosResponse<SearchAPIResponse> = await axios.get(url.toString(), {
        headers,
        timeout: 30000, // 30 second timeout
      });

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 'unknown';
        const statusText = error.response?.statusText || 'unknown';
        const errorData = error.response?.data || error.message;
        throw new Error(`SearchAPI request failed: ${status} ${statusText} - ${errorData}`);
      }

      if (error instanceof Error) {
        throw new Error(`SearchAPI error: ${error.message}`);
      }
      throw new Error('Unknown SearchAPI error occurred');
    }
  }

  /**
   * Convert SearchAPI response to duck-duck-scrape compatible format
   */
  convertToLegacyFormat(response: SearchAPIResponse): any {
    const results: any[] = [];

    // Convert organic results
    if (response.organic_results) {
      for (const result of response.organic_results) {
        results.push({
          title: result.title,
          url: result.link,
          description: result.snippet,
          hostname: this.extractHostname(result.link),
          body: result.snippet,
        });
      }
    }

    return {
      results,
      vqd: null, // Not used in SearchAPI
      noResults: results.length === 0,
      // Add metadata for compatibility
      metadata: response.search_metadata || {},
      originalResponse: response
    };
  }

  /**
   * Convert SearchAPI image response to duck-duck-scrape format
   */
  convertImageResults(response: SearchAPIResponse): any {
    const results: any[] = [];

    if (response.inline_images) {
      for (const image of response.inline_images) {
        results.push({
          title: image.title,
          image: image.original.link,
          thumbnail: image.thumbnail,
          url: image.source.link,
          source: image.source.name,
          height: image.original.height,
          width: image.original.width,
        });
      }
    }

    return {
      results,
      vqd: null,
      noResults: results.length === 0,
    };
  }

  /**
   * Convert SearchAPI news response to duck-duck-scrape format
   */
  convertNewsResults(response: SearchAPIResponse): any {
    const results: any[] = [];

    if (response.news_results) {
      for (const news of response.news_results) {
        results.push({
          title: news.title,
          url: news.link,
          description: news.snippet,
          date: news.date,
          source: news.source,
          image: news.thumbnail,
          body: news.snippet,
        });
      }
    }

    return {
      results,
      vqd: null,
      noResults: results.length === 0,
    };
  }

  /**
   * Convert SearchAPI video response to duck-duck-scrape format
   */
  convertVideoResults(response: SearchAPIResponse): any {
    const results: any[] = [];

    if (response.inline_videos) {
      for (const video of response.inline_videos) {
        results.push({
          title: video.title,
          url: video.link,
          description: `Video from ${video.source}`,
          duration: 'Unknown', // SearchAPI doesn't provide duration
          uploaded: video.date,
          views: video.views || 0,
          uploader: video.uploader || video.channel,
          thumbnail: video.thumbnail,
          embed: video.video_link,
        });
      }
    }

    return {
      results,
      vqd: null,
      noResults: results.length === 0,
    };
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
   * Convert safe search numeric value to SearchAPI format
   */
  static convertSafeSearch(value: number): 'on' | 'moderate' | 'off' {
    switch (value) {
      case 0:
        return 'on'; // Strict
      case -1:
        return 'moderate'; // Moderate
      case -2:
        return 'off'; // Off
      default:
        return 'moderate';
    }
  }

  /**
   * Convert time period to SearchAPI format
   */
  static convertTimePeriod(value?: string): 'any_time' | 'past_year' | 'past_month' | 'past_week' | 'past_day' {
    switch (value) {
      case 'pastDay':
      case 'd':
        return 'past_day';
      case 'pastWeek':
      case 'w':
        return 'past_week';
      case 'pastMonth':
      case 'm':
        return 'past_month';
      case 'pastYear':
      case 'y':
        return 'past_year';
      case 'anyTime':
      case 'a':
      default:
        return 'any_time';
    }
  }
}

/**
 * Create legacy-compatible search functions
 */
export const searchWithAPI = async (query: string, options: any = {}): Promise<any> => {
  const client = new SearchAPIClient();

  const searchOptions: SearchAPIOptions = {
    q: query,
    locale: options.locale || 'en-us',
    safe: SearchAPIClient.convertSafeSearch(options.safeSearch || -1),
    time_period: SearchAPIClient.convertTimePeriod(options.time),
  };

  const response = await client.search(searchOptions);
  return client.convertToLegacyFormat(response);
};

export const searchImagesWithAPI = async (query: string, options: any = {}): Promise<any> => {
  const client = new SearchAPIClient();

  const searchOptions: SearchAPIOptions = {
    q: `${query} images`,
    locale: options.locale || 'en-us',
    safe: SearchAPIClient.convertSafeSearch(options.safeSearch || -1),
  };

  const response = await client.search(searchOptions);
  return client.convertImageResults(response);
};

export const searchNewsWithAPI = async (query: string, options: any = {}): Promise<any> => {
  const client = new SearchAPIClient();

  const searchOptions: SearchAPIOptions = {
    q: `${query} news`,
    locale: options.locale || 'en-us',
    safe: SearchAPIClient.convertSafeSearch(options.safeSearch || -1),
    time_period: SearchAPIClient.convertTimePeriod(options.time),
  };

  const response = await client.search(searchOptions);
  return client.convertNewsResults(response);
};

export const searchVideosWithAPI = async (query: string, options: any = {}): Promise<any> => {
  const client = new SearchAPIClient();

  const searchOptions: SearchAPIOptions = {
    q: `${query} videos`,
    locale: options.locale || 'en-us',
    safe: SearchAPIClient.convertSafeSearch(options.safeSearch || -1),
  };

  const response = await client.search(searchOptions);
  return client.convertVideoResults(response);
};
