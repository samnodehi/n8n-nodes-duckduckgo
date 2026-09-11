/**
 * Direct DuckDuckGo search implementation
 * Bypasses duck-duck-scrape VQD issues by using HTML API directly
 */

import axios from 'axios';
import { BROWSER_USER_AGENT } from './constants';
import { assertNotChallenged } from './challengeDetection';
import { getCooldownReason } from './challengeCooldown';
import { extractVqd } from './vqdExtraction';
import { DuckDuckGoError, DuckDuckGoErrorType } from './errors';

/**
 * Clean text by removing HTML entities and normalizing whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<\/?b>/g, '') // Remove bold tags
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if the parsed URL belongs to a known ad or tracker destination
 * that must be dropped from search results.
 * Hostname comparisons use toLowerCase() for safety.
 */
function isBlockedAdUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  if (host === 'duckduckgo.com' && u.pathname === '/y.js') return true;
  if ((host === 'bing.com' || host.endsWith('.bing.com')) && u.pathname === '/aclick') return true;
  if (u.searchParams.has('ad_provider') || u.searchParams.has('ad_type') || u.searchParams.has('ad_domain')) return true;
  return false;
}

/**
 * Normalise a URL extracted from DuckDuckGo search HTML.
 *
 * Returns null   → caller must discard this result (ad or unresolvable redirect).
 * Returns string → the clean, final destination URL.
 *
 * Handles:
 *   - Protocol-relative hrefs (//host/path) → https:host/path  (no double-slash)
 *   - duckduckgo.com/y.js              → null  (JS ad redirect)
 *   - bing.com/aclick                   → null  (Bing ad click tracker)
 *   - ?ad_provider / ?ad_type / ?ad_domain params → null  (DDG ad params)
 *   - duckduckgo.com/l/?uddg=<encoded>  → decoded final destination URL
 *     • URLSearchParams.get() already decodes the value once — no second
 *       decodeURIComponent() call is made, which would corrupt percent-encoded
 *       characters in the target URL (e.g. ?q=100%25+AI → ?q=100%+AI).
 *     • The extracted target is validated with new URL(), must be http/https,
 *       and is re-checked for ad/tracker patterns before being returned.
 */
function normaliseDdgUrl(raw: string): string | null {
  if (!raw) return null;
  // Resolve protocol-relative hrefs so URL constructor can parse them.
  // Use 'https:' + raw (which already starts with '//') — not 'https://' + raw.
  const href = raw.startsWith('//') ? `https:${raw}` : raw;
  if (!href.startsWith('http://') && !href.startsWith('https://')) return null;
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  if (isBlockedAdUrl(u)) return null;
  // Unwrap DDG organic redirect wrapper → extract and validate the real destination.
  if (u.hostname.toLowerCase() === 'duckduckgo.com' && u.pathname === '/l/') {
    // URLSearchParams.get() decodes percent-encoding exactly once.
    // Do NOT call decodeURIComponent() again on the result.
    const uddg = u.searchParams.get('uddg');
    if (!uddg) return null;
    let target: URL;
    try { target = new URL(uddg); } catch { return null; }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
    // Re-run ad/tracker check on the decoded destination.
    if (isBlockedAdUrl(target)) return null;
    return uddg;
  }
  return href;
}


export interface DirectSearchResult {
  title: string;
  url: string;
  description: string;
}

export interface DirectImageResult {
  title: string;
  url: string;
  thumbnail: string;
  width?: number;
  height?: number;
  source?: string;
}

/**
 * Direct web search using DuckDuckGo HTML API
 */
export async function directWebSearch(query: string, options: {
  locale?: string;
  safeSearch?: string;
  maxResults?: number;
} = {}): Promise<{ results: DirectSearchResult[] }> {
  // A challenge was seen very recently; sending another request would only
  // extend the block on this IP.
  const cooling = getCooldownReason();
  if (cooling) {
    throw new DuckDuckGoError(cooling, DuckDuckGoErrorType.BOT_CHALLENGE, { userMessage: cooling });
  }

  try {
    // Use POST method to DuckDuckGo HTML endpoint
    const response = await axios.post('https://html.duckduckgo.com/html/',
      new URLSearchParams({
        q: query,
        b: '',
        kl: options.locale || 'us-en',
        kp: options.safeSearch === 'strict' ? '1' : options.safeSearch === 'moderate' ? '-1' : '-2',
      }), {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 15000,
    });

    const results: DirectSearchResult[] = [];
    const html = response.data;

    // Split HTML by result containers and parse each one
    const resultSections = html.split(/<div[^>]*class="[^"]*result results_links[^"]*"[^>]*>/);

    for (let i = 1; i < resultSections.length; i++) {
      const section = resultSections[i];

      // Extract title and URL from result__title section
      const titleMatch = section.match(/<h2[^>]*class="result__title"[^>]*>[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/);

      // Extract description from result__snippet
      const snippetMatch = section.match(/<a[^>]*class="result__snippet"[^>]*href="[^"]*"[^>]*>(.*?)<\/a>/);

      if (titleMatch) {
        const rawUrl = titleMatch[1];
        const title = titleMatch[2];
        const description = snippetMatch ? snippetMatch[1] : '';

        // normaliseDdgUrl drops ad URLs and decodes DDG redirect wrappers.
        // Returns null for any result that must be excluded.
        const url = normaliseDdgUrl(rawUrl);
        if (title && url) {
          results.push({
            title: cleanText(title),
            url: url,
            description: cleanText(description),
          });

          // Limit results if maxResults is specified
          if (options.maxResults && results.length >= options.maxResults) {
            break;
          }
        }
      }
    }

    // Nothing parsed — establish why before returning an empty set. This is the
    // only point at which a challenge page can be detected without risking a
    // false positive on marker text appearing inside a real result.
    if (results.length === 0 && resultSections.length === 1) {
      // DuckDuckGo serves its bot-detection page with HTTP 202 — the same status
      // as a genuine no-results page — so the status alone cannot tell them apart.
      // Inspecting the body first stops an IP-level block from being reported as
      // an ordinary empty result set, which is how it used to fail silently.
      assertNotChallenged(html, response.status, 'web search');

      if (response.status === 200 && html.length > 1000) {
        throw new Error(
          'DuckDuckGo web search response could not be parsed. ' +
          'The page structure may have changed. Please try again later.'
        );
      }
      // HTTP 202 without challenge markers = genuine no-results page. Return empty.
    }

    return { results };
  } catch (error) {
    // Re-throw errors that already carry specific, user-readable messages
    // (e.g. the parser-failure error thrown above — no .code, no .response)
    if (!error.code && !error.response) {
      throw error;
    }

    // Provide more specific error messages based on error type
    if (error.code === 'ECONNABORTED') {
      throw new Error('Web search request timed out. Please try again.');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to DuckDuckGo. Please check your internet connection.');
    } else if (error.response && error.response.status === 429) {
      throw new Error('Too many requests. Please wait a moment before trying again.');
    } else if (error.response && error.response.status >= 500) {
      throw new Error('DuckDuckGo server error. Please try again later.');
    } else {
      throw new Error(`Web search failed: ${error.message}`);
    }
  }
}

/**
 * Direct image search using DuckDuckGo
 *
 * @param vqdHint - Optional VQD token from a previous call for the same query.
 *   When provided, the initial DuckDuckGo page GET is skipped and this token is
 *   used directly for the i.js request. A hint that DuckDuckGo has since
 *   invalidated is recovered from rather than surfaced: the token is refetched
 *   once and the request retried, and the token actually used is returned, so a
 *   caller storing it always stores a working one. That recovery is what makes
 *   it safe to reuse a token across executions rather than only within one.
 */
export async function directImageSearch(query: string, options: {
  locale?: string;
  safeSearch?: string;
  maxResults?: number;
} = {}, vqdHint?: string): Promise<{ results: DirectImageResult[]; vqd: string }> {
  const cooling = getCooldownReason();
  if (cooling) {
    throw new DuckDuckGoError(cooling, DuckDuckGoErrorType.BOT_CHALLENGE, { userMessage: cooling });
  }

  try {
    const searchParams = new URLSearchParams({
      q: query,
      iax: 'images',
      ia: 'images',
    });
    const searchUrl = `https://duckduckgo.com/?${searchParams.toString()}`;

    // Fetch the search page and read the VQD token out of it.
    const fetchVqd = async (): Promise<string> => {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 15000,
      });

      // A challenge page carries no VQD. Detect it first so the cause is named
      // instead of surfacing as a misleading "token could not be extracted".
      assertNotChallenged(response.data, response.status, 'image search');

      // DuckDuckGo has served this token as a bare parameter, a quoted value and
      // a JSON property; extractVqd tries each known shape rather than betting
      // on one, so a markup change does not silently break image search.
      const extracted = extractVqd(response.data);

      if (!extracted) {
        throw new Error(
          'DuckDuckGo image search token (VQD) could not be extracted. ' +
          'Image search may be temporarily unavailable. Please try again later.'
        );
      }
      return extracted;
    };

    const requestImages = async (token: string) => {
      const imageParams = new URLSearchParams({
        l: options.locale || 'us-en',
        o: 'json',
        q: query,
        vqd: token,
        f: ',,,,,',
        p: options.safeSearch === 'strict' ? '1' : options.safeSearch === 'moderate' ? '-1' : '-2',
      });

      return axios.get(`https://duckduckgo.com/i.js?${imageParams.toString()}`, {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': searchUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 15000,
      });
    };

    // A block is turned away with 403 as well as with the 202 challenge page.
    // Every attempt goes through here so that is named wherever it happens,
    // rather than only on the attempt someone remembered to guard: naming it
    // reports it as a block and starts the back-off, instead of letting it
    // surface as a token error that tells the user to try again.
    const requestImagesChecked = async (token: string) => {
      try {
        return await requestImages(token);
      } catch (error) {
        if (error?.response?.status === 403) {
          assertNotChallenged(error.response?.data, 403, 'image search');
        }
        throw error;
      }
    };

    let vqd = vqdHint ?? (await fetchVqd());
    let imageResponse;

    try {
      imageResponse = await requestImagesChecked(vqd);
    } catch (error) {
      // Not a block, so a 403 means DuckDuckGo did not accept the token. A
      // supplied hint can have expired since it was issued, so that is
      // recoverable: fetch a fresh token and try once more. Without a hint the
      // token was minted moments ago, so a 403 means something else again and
      // retrying would only add a request.
      if (!vqdHint || error?.response?.status !== 403) {
        throw error;
      }

      vqd = await fetchVqd();
      imageResponse = await requestImagesChecked(vqd);
    }

    const imageData = imageResponse.data;
    const results: DirectImageResult[] = [];

    if (imageData && imageData.results) {
      for (const item of imageData.results) {
        results.push({
          title: item.title || '',
          url: item.image || '',
          thumbnail: item.thumbnail || '',
          width: item.width,
          height: item.height,
          source: item.url || '',
        });

        if (options.maxResults && results.length >= options.maxResults) {
          break;
        }
      }
    }

    // `i.js` is the request that actually carries results, and it is the one a
    // block lands on: DuckDuckGo answers it with the challenge page as HTML
    // instead of JSON, which has no `results` property and so parses to an
    // empty set. Checking only the VQD bootstrap above missed that entirely,
    // and missed it completely when a caller supplied `vqdHint` and skipped the
    // bootstrap. A genuine empty answer is parsed JSON, which
    // `isChallengePage` never matches.
    if (results.length === 0) {
      assertNotChallenged(imageResponse.data, imageResponse.status, 'image search');
    }

    return { results, vqd };
  } catch (error) {
    // Preserve typed errors (e.g. the bot-challenge error) rather than
    // flattening them into a generic message and losing their guidance.
    if (error instanceof DuckDuckGoError) {
      throw error;
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Image search request timed out. Please try again.');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to DuckDuckGo for image search. Please check your internet connection.');
    } else if (error.response && error.response.status === 429) {
      throw new Error('Too many image search requests. Please wait a moment before trying again.');
    } else if (error.response && error.response.status === 403) {
      throw new Error(
        'DuckDuckGo image search returned 403 Forbidden. ' +
        'The search token (VQD) may have expired or the request was blocked. Please try again.'
      );
    } else {
      throw new Error(`Image search failed: ${error.message}`);
    }
  }
}

/**
 * Convert safe search value to string
 */
export function getSafeSearchString(value: number): string {
  switch (value) {
    case 0:
      return 'strict';
    case -1:
      return 'moderate';
    case -2:
    default:
      return 'off';
  }
}
