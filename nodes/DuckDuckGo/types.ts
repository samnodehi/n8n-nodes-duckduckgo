/**
 * Search configuration options
 */
export enum SafeSearchLevel {
  Strict = 0,
  Moderate = -1,
  Off = -2,
}

export enum TimePeriod {
  AllTime = '',
  PastDay = 'd',
  PastWeek = 'w',
  PastMonth = 'm',
  PastYear = 'y',
}

/**
 * Operation types supported by the node
 */
export enum DuckDuckGoOperation {
  Search = 'search',
  SearchImages = 'searchImages',
  SearchNews = 'searchNews',
  SearchVideos = 'searchVideos',
}

/**
 * Search options interface with strict types
 * Compatible with duck-duck-scrape package
 */
export interface IDuckDuckGoSearchOptions {
  safeSearch: number;
  locale: string;
  maxResults?: number;
  timePeriod?: string;
}

/**
 * Base result interface with common properties
 */
export interface IBaseResult {
  title: string | null;
  url: string | null;
}

/**
 * Web search result interface
 * Compatible with duck-duck-scrape SearchResult
 */
export interface IDuckDuckGoSearchResult {
  bang?: string | null;
  description?: string | null;
  hostname?: string | null;
  icon?: string | null;
  rawDescription?: string | null;
  title?: string | null;
  url?: string | null;
}

/**
 * Image search result interface
 * Compatible with duck-duck-scrape DuckbarImageResult
 */
export interface IDuckDuckGoImageResult {
  height?: number | null;
  image?: string | null;
  source?: string | null;
  thumbnail?: string | null;
  title?: string | null;
  url?: string | null;
  width?: number | null;
}

/**
 * News search result interface
 * Compatible with duck-duck-scrape NewsResult
 */
export interface IDuckDuckGoNewsResult {
  date?: number | null;
  excerpt?: string | null;
  image?: string | null;
  isOld?: boolean | null;
  relativeTime?: string | null;
  syndicate?: string | null;
  title?: string | null;
  url?: string | null;
}

/**
 * Video search result interface
 * Compatible with duck-duck-scrape VideoResult
 */
export interface IDuckDuckGoVideoResult {
  description?: string | null;
  duration?: string | null;
  image?: string | null;
  published?: string | null;
  publishedOn?: string | null;
  publisher?: string | null;
  title?: string | null;
  url?: string | null;
  viewCount?: string | null;
}

/**
 * Output types that include sourceType
 */
export interface IWebSearchOutput extends IDuckDuckGoSearchResult {
  sourceType: 'web';
}

export interface IImageSearchOutput extends IDuckDuckGoImageResult {
  sourceType: 'image';
}

export interface INewsSearchOutput extends IDuckDuckGoNewsResult {
  sourceType: 'news';
}

export interface IVideoSearchOutput extends IDuckDuckGoVideoResult {
  sourceType: 'video';
}

/**
 * Union type for all output types
 */
export type DuckDuckGoOutput =
  IWebSearchOutput |
  IImageSearchOutput |
  INewsSearchOutput |
  IVideoSearchOutput;
