/**
 * News and Video search, requested the way DuckDuckGo's own results page
 * requests them.
 *
 * Until 32.16 these went through duck-duck-scrape, and no page after the first
 * could be fetched. The library refuses DuckDuckGo's current one-dash tokens
 * when it is handed one to page with (Snazzah/duck-duck-scrape#149), and sent
 * directly with the library's navigation-style headers, later pages were
 * refused with 403 four times out of four. Sent as the same-origin XHR the
 * results page itself makes - JSON accept, a Referer, fetch-metadata headers -
 * both pages were served.
 *
 * Paging follows DuckDuckGo's own `next` field rather than counting results:
 * pages of 30, 28, 26 and 22 results all named an offset in fixed steps of 30,
 * so a count drifts from it. Only the offset is taken from `next`. The rest of
 * the request is always rebuilt from the node's own settings, so a later page
 * cannot quietly come back under a different safe-search level, region or time
 * filter, and nothing is ever fetched from a URL DuckDuckGo supplied.
 *
 * Results are mapped to exactly the shape duck-duck-scrape returned, down to
 * its entity decoding, so nothing downstream changes; a test holds the two
 * mappings equal against the real library.
 */

import axios from 'axios';
import { decode } from 'html-entities';
import { BROWSER_USER_AGENT } from './constants';
import { assertNotChallenged } from './challengeDetection';
import { getCooldownReason } from './challengeCooldown';
import { DuckDuckGoError, DuckDuckGoErrorType } from './errors';
import { SafeSearchLevel, SearchOptions } from './types';
import { extractVqd } from './vqdExtraction';

export interface PagedSearchOptions extends SearchOptions {
  /** Item offset of the page to fetch; 0 for the first. */
  offset?: number;
  /** Token from an earlier page of the same search. Omitted, one is fetched. */
  vqd?: string;
}

export interface NewsResult {
  date: number;
  excerpt: string;
  image?: string;
  relativeTime: string;
  syndicate: string;
  title: string;
  url: string;
  isOld: boolean;
}

export interface VideoResult {
  url: string;
  title: string;
  description: string;
  image: string;
  duration: string;
  publishedOn: string;
  published: string;
  publisher: string;
  viewCount?: number;
}

export interface SearchPage<T> {
  noResults: boolean;
  vqd: string;
  results: T[];
  /** Offset of the next page as DuckDuckGo names it; absent on the last page. */
  nextOffset?: number;
}

const TIMEOUT_MS = 15000;

/** The results page a person would be looking at while it made this request. */
function resultsPageUrl(query: string, ia: 'news' | 'videos'): string {
  return `https://duckduckgo.com/?${new URLSearchParams({ q: query, ia, iar: ia })}`;
}

/** duck-duck-scrape's mapping of the level to `p`: Strict is sent as 1. */
function safeSearchParam(level: SafeSearchLevel | undefined): string {
  const value = level ?? SafeSearchLevel.Moderate;
  return value === SafeSearchLevel.Strict ? '1' : String(value);
}

async function fetchVqd(pageUrl: string, label: string): Promise<string> {
  const response = await axios.get(pageUrl, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    responseType: 'text',
    timeout: TIMEOUT_MS,
    // A block is recognised from the body, whatever the status.
    validateStatus: () => true,
  });

  const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');
  assertNotChallenged(body, response.status, label);

  const vqd = extractVqd(body);
  if (!vqd) {
    throw new Error(`DuckDuckGo did not return a search token for ${label} (HTTP ${response.status}).`);
  }
  return vqd;
}

/** `s` from a `next` value such as `news.js?q=…&s=30&…`, if it moves forward. */
function nextOffsetFrom(next: unknown, current: number): number | undefined {
  if (typeof next !== 'string') return undefined;
  const query = next.slice(next.indexOf('?') + 1);
  const offset = Number(new URLSearchParams(query).get('s'));
  return Number.isInteger(offset) && offset > current ? offset : undefined;
}

async function fetchPage(
  endpoint: 'news.js' | 'v.js',
  params: Record<string, string>,
  referer: string,
  label: string,
): Promise<{ results: any[]; next: unknown }> {
  const response = await axios.get(`https://duckduckgo.com/${endpoint}?${new URLSearchParams(params)}`, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: referer,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    },
    responseType: 'text',
    timeout: TIMEOUT_MS,
    validateStatus: () => true,
  });

  const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');

  // A challenge can arrive as 202, 200 or 403; its markers are the only
  // reliable sign, so they are checked before the status or the JSON is.
  if (response.status !== 200) {
    assertNotChallenged(body, response.status, label);
    throw new Error(`DuckDuckGo refused the ${label} request (HTTP ${response.status}).`);
  }

  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    assertNotChallenged(body, response.status, label);
    throw new Error(`DuckDuckGo answered the ${label} request with something other than JSON.`);
  }

  if (!data || !Array.isArray(data.results)) {
    throw new Error(`DuckDuckGo's ${label} answer had no results list.`);
  }
  return { results: data.results, next: data.next };
}

function refuseWhileCooling(): void {
  const cooling = getCooldownReason();
  if (cooling) {
    throw new DuckDuckGoError(cooling, DuckDuckGoErrorType.BOT_CHALLENGE, { userMessage: cooling });
  }
}

/** One page of news results. */
export async function searchNews(query: string, options: PagedSearchOptions = {}): Promise<SearchPage<NewsResult>> {
  refuseWhileCooling();
  const referer = resultsPageUrl(query, 'news');
  const vqd = options.vqd ?? (await fetchVqd(referer, 'news search'));
  const offset = options.offset ?? 0;

  // The parameters duck-duck-scrape sent, in its order.
  const { results, next } = await fetchPage('news.js', {
    l: options.locale || 'wt-wt',
    o: 'json',
    noamp: '1',
    q: query,
    vqd,
    p: safeSearchParam(options.safeSearch),
    df: options.time || '',
    s: String(offset),
  }, referer, 'news search');

  return {
    noResults: results.length === 0,
    vqd,
    results: results.map(mapNewsResult),
    nextOffset: nextOffsetFrom(next, offset),
  };
}

/** One page of video results. */
export async function searchVideos(query: string, options: PagedSearchOptions = {}): Promise<SearchPage<VideoResult>> {
  refuseWhileCooling();
  const referer = resultsPageUrl(query, 'videos');
  const vqd = options.vqd ?? (await fetchVqd(referer, 'video search'));
  const offset = options.offset ?? 0;

  const { results, next } = await fetchPage('v.js', {
    l: options.locale || 'wt-wt',
    o: 'json',
    q: query,
    vqd,
    p: safeSearchParam(options.safeSearch),
    // The node sets no video filters; this is the empty filter list the
    // library sent: time, definition, duration and licence, all unset.
    f: ',,,',
    s: String(offset),
  }, referer, 'video search');

  return {
    noResults: results.length === 0,
    vqd,
    results: results.map(mapVideoResult),
    nextOffset: nextOffsetFrom(next, offset),
  };
}

/** duck-duck-scrape's news mapping (lib/search/news.js), field for field. */
export function mapNewsResult(article: any): NewsResult {
  return {
    date: article.date,
    excerpt: decode(article.excerpt),
    image: article.image,
    relativeTime: article.relative_time,
    syndicate: article.syndicate,
    title: decode(article.title),
    url: article.url,
    isOld: !!article.is_old,
  };
}

/**
 * duck-duck-scrape's video mapping (lib/search/videos.js), field for field,
 * except that an item without `images` or `statistics` no longer throws.
 */
export function mapVideoResult(video: any): VideoResult {
  const images = video.images ?? {};
  return {
    url: video.content,
    title: decode(video.title),
    description: decode(video.description),
    image: images.large || images.medium || images.small || images.motion,
    duration: video.duration,
    publishedOn: video.publisher,
    published: video.published,
    publisher: video.uploader,
    viewCount: video.statistics?.viewCount || undefined,
  };
}
