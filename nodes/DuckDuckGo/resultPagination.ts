/**
 * Paging through DuckDuckGo News and Video results.
 *
 * Each page names the offset of the next one, and paging follows that rather
 * than counting: live News pages of 30, 28, 26 and 22 results all named offsets
 * in fixed steps of 30, and Video stepped by 60, so a count drifts from
 * DuckDuckGo's own figure. Where a page names no next offset, there is nothing
 * more to fetch.
 *
 * DuckDuckGo repeats itself across pages - a live second page repeated 12 of
 * its 22 results from the first - so results are de-duplicated as they are
 * collected, and paging carries on past repeats while there are pages left.
 *
 * Two things are never silent. A page that fails ends the paging and says why,
 * and so does the page limit: a request cut short to spare the rate limit is
 * reported as exactly that, not passed off as all DuckDuckGo had. Only real
 * exhaustion - no next page, or an empty one - ends it without a word.
 */

import { stripTrackingParameters } from './urlNormalize';

/**
 * Most pages fetched for one search, the first included. The limit is on
 * requests, not results: DuckDuckGo blocks an IP by how many requests it sends.
 */
export const MAX_PAGES = 5;

/** One page, in the shape `searchNews` and `searchVideos` return. */
export interface ResultPage<T> {
  results?: T[];
  vqd?: string;
  /** Offset of the next page as DuckDuckGo names it; absent on the last page. */
  nextOffset?: number;
}

/**
 * Why fewer results were collected than asked for. `transient` separates a
 * failure, which the next run may not repeat and so must not be cached, from
 * the page limit, which every run would hit again identically.
 */
export interface Shortfall {
  reason: string;
  transient: boolean;
}

export interface CollectedResults<T> {
  results: T[];
  shortfall?: Shortfall;
}

/**
 * Two copies of one article can differ only by tracking parameters, and the
 * output strips those anyway, so they are compared the way they will be shown.
 */
function dedupeKey(item: { url?: string | null }): string | undefined {
  return stripTrackingParameters(item.url) ?? undefined;
}

/**
 * Collect results page by page until `maxResults` are held, DuckDuckGo runs
 * out, a page fails, or {@link MAX_PAGES} have been fetched. The caller cuts
 * the list to `maxResults` after ranking, so collecting past it is harmless.
 *
 * @param fetchPage - Fetches the page at `offset`, with the token the first
 *   page was served under.
 * @param onPage - Called before each page after the first is requested.
 */
export async function collectPages<T extends { url?: string | null }>(
  firstPage: ResultPage<T>,
  maxResults: number,
  fetchPage: (offset: number, vqd: string) => Promise<ResultPage<T>>,
  onPage?: (page: number, offset: number) => void,
): Promise<CollectedResults<T>> {
  const results: T[] = [];
  const seen = new Set<string>();

  // Items without a URL cannot be compared and are always kept.
  const add = (items: T[]): void => {
    for (const item of items) {
      const key = dedupeKey(item);
      if (key !== undefined) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      results.push(item);
    }
  };

  add(firstPage.results ?? []);

  let current = firstPage;
  for (let page = 2; results.length < maxResults; page++) {
    const offset = current.nextOffset;
    if (offset === undefined) {
      break;
    }
    if (page > MAX_PAGES) {
      return {
        results,
        shortfall: {
          reason: `stopped after ${MAX_PAGES} pages to limit requests to DuckDuckGo`,
          transient: false,
        },
      };
    }
    if (!firstPage.vqd) {
      return {
        results,
        shortfall: { reason: 'DuckDuckGo did not return a token to page with', transient: true },
      };
    }

    onPage?.(page, offset);

    try {
      current = await fetchPage(offset, firstPage.vqd);
    } catch (error) {
      return {
        results,
        shortfall: { reason: error instanceof Error ? error.message : String(error), transient: true },
      };
    }

    const items = current.results ?? [];
    if (items.length === 0) {
      break;
    }
    add(items);
  }

  return { results };
}
