/**
 * Cross-execution storage of DuckDuckGo's VQD token.
 *
 * Image search costs two requests: a page GET whose only purpose is to yield a
 * VQD, then the `i.js` call that returns the results. The token is reusable, so
 * the first of those is avoidable — and every request avoided is one that
 * cannot count towards the rate limit that gets an instance's IP blocked.
 *
 * The token is bound to the query: reusing one across different queries is
 * answered with 403. It is stored per query, and per User-Agent as well, since
 * DuckDuckGo issues the token against the client it was asked by.
 *
 * `take` rather than `get` is deliberate. A token is removed as it is handed
 * out and only written back after the request it served succeeded, so a failed
 * run cannot leave a token behind that poisons every later one until it
 * expires. The cost of that choice is an extra page GET when two executions
 * overlap, which is the behaviour without any cache at all.
 *
 * On the lifetime: this is an hour, matching what SearXNG uses in production
 * for the same token. `vqdPagination.ts` keeps its own tokens for four minutes,
 * but that is a different judgement for a different job — it reuses one token
 * across many rapid page requests, where a stale token costs a whole paginated
 * run. Here a stale token costs one wasted request, because `directImageSearch`
 * recovers by fetching a fresh one and retrying. That recovery is what makes
 * the longer lifetime safe; without it a longer TTL would only trade a saved
 * request for a failed search.
 */

import { deleteCached, getCached, setCache } from './cache';

/** One hour, in seconds, as `setCache` expects. */
export const VQD_TTL_SECONDS = 60 * 60;

/**
 * Build the storage key. The query is normalised the way a user would expect
 * two searches to be "the same"; the User-Agent is included verbatim because a
 * token issued to one client is not valid for another.
 */
function vqdKey(query: string, userAgent: string): string {
  return `vqd:${query.trim().toLowerCase()}::${userAgent}`;
}

/**
 * Return the stored token for this query and remove it, or `undefined` when
 * there is none. Call `storeVqd` after the request it served has succeeded.
 */
export function takeStoredVqd(query: string, userAgent: string): string | undefined {
  const key = vqdKey(query, userAgent);
  const token = getCached<string>(key);
  deleteCached(key);
  return token;
}

/** Record a token that has just been used successfully. */
export function storeVqd(query: string, userAgent: string, token: string): void {
  if (!token) {
    return;
  }
  setCache(vqdKey(query, userAgent), token, VQD_TTL_SECONDS);
}
