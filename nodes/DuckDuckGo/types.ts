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
  InstantAnswer = 'instantAnswer',
  Dictionary = 'dictionary',
  Stocks = 'stocks',
  Currency = 'currency',
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
 * Instant Answer API response interface
 */
export interface IDuckDuckGoInstantAnswer {
  Abstract?: string | null;
  AbstractText?: string | null;
  AbstractSource?: string | null;
  AbstractURL?: string | null;
  Image?: string | null;
  Heading?: string | null;
  Answer?: string | null;
  AnswerType?: string | null;
  Definition?: string | null;
  DefinitionSource?: string | null;
  DefinitionURL?: string | null;
  RelatedTopics?: Array<{
    Result?: string | null;
    FirstURL?: string | null;
    Icon?: {
      URL?: string | null;
      Height?: number | null;
      Width?: number | null;
    } | null;
    Text?: string | null;
  }> | null;
  Results?: Array<{
    Result?: string | null;
    FirstURL?: string | null;
    Icon?: {
      URL?: string | null;
      Height?: number | null;
      Width?: number | null;
    } | null;
    Text?: string | null;
  }> | null;
  Type?: string | null;
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

export interface IInstantAnswerOutput extends IDuckDuckGoInstantAnswer {
  sourceType: 'instantAnswer';
}

/**
 * Dictionary definition result interface
 * Compatible with duck-duck-scrape DictionaryDefinitionResult
 */
export interface IDuckDuckGoDictionaryResult {
  word?: string | null;
  partOfSpeech?: string | null;
  definition?: string | null;
  examples?: string[] | null;
  synonyms?: string[] | null;
  antonyms?: string[] | null;
  attributionText?: string | null;
  attributionUrl?: string | null;
  wordnikUrl?: string | null;
}

/**
 * Stock result interface
 * Compatible with duck-duck-scrape StocksResult
 */
export interface IDuckDuckGoStockResult {
  symbol?: string | null;
  name?: string | null;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  marketCap?: number | null;
  peRatio?: number | null;
  weekHigh52?: number | null;
  weekLow52?: number | null;
  lastUpdated?: string | null;
}

/**
 * Currency conversion result interface
 * Compatible with duck-duck-scrape CurrencyResult
 */
export interface IDuckDuckGoCurrencyResult {
  from?: string | null;
  to?: string | null;
  amount?: number | null;
  convertedAmount?: number | null;
  exchangeRate?: number | null;
  fromName?: string | null;
  toName?: string | null;
  lastUpdated?: string | null;
}

export interface IDictionaryOutput extends IDuckDuckGoDictionaryResult {
  sourceType: 'dictionary';
}

export interface IStockOutput extends IDuckDuckGoStockResult {
  sourceType: 'stock';
}

export interface ICurrencyOutput extends IDuckDuckGoCurrencyResult {
  sourceType: 'currency';
}

/**
 * Union type for all output types
 */
export type DuckDuckGoOutput =
  IWebSearchOutput |
  IImageSearchOutput |
  INewsSearchOutput |
  IVideoSearchOutput |
  IInstantAnswerOutput |
  IDictionaryOutput |
  IStockOutput |
  ICurrencyOutput;

/**
 * Re-export search operators interface
 */
export { ISearchOperators } from './searchOperators';
