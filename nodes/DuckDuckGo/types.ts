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
  SearchMaps = 'searchMaps',
  SearchShopping = 'searchShopping',
  AIChat = 'aiChat',
}

/**
 * AI Chat models available
 */
export enum AIModel {
  GPT35Turbo = 'gpt-3.5-turbo',
  Claude3Haiku = 'claude-3-haiku',
  Llama370B = 'llama-3-70b',
  Mixtral8x7B = 'mixtral-8x7b',
}

/**
 * Shopping sort options
 */
export enum ShoppingSortBy {
  Relevance = '',
  PriceLowToHigh = 'price_low',
  PriceHighToLow = 'price_high',
  Rating = 'rating',
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
 * Maps search result interface
 */
export interface IDuckDuckGoMapsResult {
  title?: string | null;
  address?: string | null;
  phone?: string | null;
  hours?: string | null;
  category?: string | null;
  rating?: number | null;
  reviews?: number | null;
  url?: string | null;
  website?: string | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  distance?: string | null;
}

/**
 * Shopping search result interface
 */
export interface IDuckDuckGoShoppingResult {
  title?: string | null;
  price?: string | null;
  currency?: string | null;
  store?: string | null;
  url?: string | null;
  image?: string | null;
  rating?: number | null;
  reviews?: number | null;
  shipping?: string | null;
  condition?: string | null;
  inStock?: boolean | null;
}

/**
 * AI Chat response interface
 */
export interface IDuckDuckGoAIChatResponse {
  message?: string | null;
  model?: string | null;
  conversationId?: string | null;
  timestamp?: number | null;
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

export interface IMapsSearchOutput extends IDuckDuckGoMapsResult {
  sourceType: 'maps';
}

export interface IShoppingSearchOutput extends IDuckDuckGoShoppingResult {
  sourceType: 'shopping';
}

export interface IAIChatOutput extends IDuckDuckGoAIChatResponse {
  sourceType: 'aiChat';
}

/**
 * Union type for all output types
 */
export type DuckDuckGoOutput =
  IWebSearchOutput |
  IImageSearchOutput |
  INewsSearchOutput |
  IVideoSearchOutput |
  IMapsSearchOutput |
  IShoppingSearchOutput |
  IAIChatOutput;
