/**
 * Paging through DuckDuckGo News and Video results.
 *
 * DuckDuckGo pages by item offset, and a page is not ten results long. A live
 * News response held 30 results and named `s=30` as its own next page. Both
 * loops this replaces asked for page 2 at `s=10`, so a request for more than 30
 * got page 1 again with a shifted start, or a 403. The next offset is therefore
 * the number of results actually received, which is what DuckDuckGo's own
 * `next` says; the library drops `next`, so it is counted rather than read.
 *
 * Two things are never silent. A page that fails ends the paging and says why,
 * and so does the page limit: a request cut short to spare the rate limit is
 * reported as exactly that, not passed off as all DuckDuckGo had. Only real
 * exhaustion - an empty page, or a short one - ends it without a word.
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
 * out, a page fails, or the page budget is spent.
 *
 * The budget is derived from the first page's size, so a search is never sent
 * more pages than it needs to reach `maxResults` at that size, and never more
 * than {@link MAX_PAGES}. The caller cuts the list to `maxResults` after
 * ranking, so collecting past it is harmless.
 *
 * @param fetchPage - Fetches the page starting at `offset`, with the token the
 *   first page was served under.
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

  // Returns how many items were new. Items without a URL cannot be compared
  // and are always kept.
  const add = (items: T[]): number => {
    let added = 0;
    for (const item of items) {
      const key = dedupeKey(item);
      if (key !== undefined) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      results.push(item);
      added++;
    }
    return added;
  };

  const pageSize = firstPage.results?.length ?? 0;
  add(firstPage.results ?? []);
  if (pageSize === 0 || results.length >= maxResults) {
    return { results };
  }

  const pageBudget = Math.min(MAX_PAGES, Math.ceil(maxResults / pageSize));
  let received = pageSize;

  for (let page = 2; results.length < maxResults; page++) {
    if (page > pageBudget) {
      return {
        results,
        shortfall: {
          reason: `stopped after ${pageBudget} pages to limit requests to DuckDuckGo`,
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

    onPage?.(page, received);

    let next: ResultPage<T>;
    try {
      next = await fetchPage(received, firstPage.vqd);
    } catch (error) {
      return {
        results,
        shortfall: { reason: error instanceof Error ? error.message : String(error), transient: true },
      };
    }

    const items = next.results ?? [];
    if (items.length === 0) {
      break;
    }
    received += items.length;

    // With the offset right, a page of nothing new means the listing moved
    // under us between requests (breaking news does). That is not DuckDuckGo
    // saying it has no more, so it is reported rather than taken as the end.
    if (add(items) === 0) {
      return {
        results,
        shortfall: { reason: 'DuckDuckGo answered with results already collected', transient: true },
      };
    }

    // A page shorter than the first is the last one there is.
    if (items.length < pageSize) {
      break;
    }
  }

  return { results };
}
