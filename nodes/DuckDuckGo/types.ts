/**
 * Types for DuckDuckGo node
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

export enum DuckDuckGoOperation {
  Search = 'search',
  SearchImages = 'searchImages',
  SearchNews = 'searchNews',
  SearchVideos = 'searchVideos',
}

export interface IDuckDuckGoSearchResult {
  title?: string | null;
  description?: string | null;
  hostname?: string | null;
  icon?: string | null;
  url?: string | null;
}

export interface IDuckDuckGoImageResult {
  height?: number | null;
  image?: string | null;
  source?: string | null;
  thumbnail?: string | null;
  title?: string | null;
  url?: string | null;
  width?: number | null;
}

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
