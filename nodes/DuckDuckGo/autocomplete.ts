/**
 * DuckDuckGo search-suggestion (autocomplete) client.
 *
 * Uses DuckDuckGo's public suggestion endpoint (https://duckduckgo.com/ac/),
 * which needs no VQD token, no cookies and no API key, and returns a tiny
 * payload. During endpoint probing it was the only DuckDuckGo surface that was
 * never answered with a bot-detection challenge, which makes it a useful
 * companion when search itself is rate-limited.
 *
 * With `type=list` the response is `["<query>", ["suggestion", ...]]`; without
 * it, an array of `{ phrase }` objects. Both shapes are accepted here because
 * DuckDuckGo has returned each of them, and neither is contractual.
 */

import axios from 'axios';
import { BROWSER_USER_AGENT } from './constants';

export interface AutocompleteResult {
  /** Suggested queries, in DuckDuckGo's own order. */
  suggestions: string[];
  /** Present only when the request failed. */
  error?: string;
}

export interface AutocompleteOptions {
  /** DuckDuckGo region code, e.g. `us-en`, `de-de`, `wt-wt`. */
  region?: string;
  /** Maximum suggestions to keep. 0 or negative means no limit. */
  maxResults?: number;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

const DEFAULT_TIMEOUT = 8000;

/**
 * Pull suggestion strings out of either response shape, ignoring anything that
 * is not a usable string so a format change degrades rather than throws.
 */
export function parseSuggestions(data: unknown): string[] {
  if (!Array.isArray(data)) return [];

  // `type=list` shape: ["query", ["a", "b", ...]]
  if (Array.isArray(data[1])) {
    return (data[1] as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim() !== '');
  }

  // Object shape: [{ phrase: "a" }, ...]
  return (data as unknown[])
    .map((item) => (item && typeof (item as any).phrase === 'string' ? (item as any).phrase : ''))
    .filter((s) => s.trim() !== '');
}

/**
 * Fetch search suggestions for a partial query. Never throws: failures are
 * reported via the `error` field, matching the Instant Answer client.
 */
export async function getAutocomplete(
  query: string,
  options: AutocompleteOptions = {},
): Promise<AutocompleteResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const maxResults = options.maxResults ?? 0;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { suggestions: [], error: 'No query provided' };
  }

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      type: 'list',
    });
    if (options.region && options.region.trim() !== '') {
      params.set('kl', options.region.trim());
    }

    const response = await axios.get(`https://duckduckgo.com/ac/?${params.toString()}`, {
      timeout,
      responseType: 'json',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    let suggestions = parseSuggestions(response.data);
    if (maxResults > 0 && suggestions.length > maxResults) {
      suggestions = suggestions.slice(0, maxResults);
    }

    return { suggestions };
  } catch (error: any) {
    let message: string;
    if (error?.code === 'ECONNABORTED') {
      message = `Timed out after ${timeout}ms`;
    } else if (error?.response?.status) {
      message = `HTTP ${error.response.status}`;
    } else if (error?.code) {
      message = String(error.code);
    } else {
      message = error instanceof Error ? error.message : 'Unknown error';
    }
    return { suggestions: [], error: message };
  }
}
