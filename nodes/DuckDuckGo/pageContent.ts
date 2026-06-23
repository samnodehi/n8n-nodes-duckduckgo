/**
 * Optional page-content fetching and lightweight, dependency-free main-text
 * extraction for Web Search results.
 *
 * IMPORTANT: fetching page content makes HTTP requests to the third-party
 * result sites — not only to DuckDuckGo. This module is used only when the
 * user explicitly opts in via the "Fetch Page Content" option (off by default).
 *
 * Extraction is intentionally a simple heuristic (no cheerio/jsdom): it strips
 * boilerplate elements, keeps the <body>, turns block elements into line
 * breaks, removes the remaining tags, decodes entities, and normalises
 * whitespace. It is good enough for feeding text to downstream nodes/agents
 * and can later be upgraded to a readability library if needed.
 */

import axios from 'axios';
import { BROWSER_USER_AGENT } from './constants';

export interface PageContentOptions {
  /** Per-request timeout in milliseconds. */
  timeout?: number;
  /** Maximum characters of extracted text to keep (0 or negative = no limit). */
  maxLength?: number;
  /** Maximum response size to download, in bytes (guards against huge pages). */
  maxBytes?: number;
}

export interface PageContentResult {
  /** Extracted (and possibly truncated) main text. Empty string on failure. */
  content: string;
  /** True when the text was cut to fit maxLength. */
  truncated: boolean;
  /** Present only when the page could not be fetched or parsed. */
  error?: string;
}

const DEFAULTS = {
  timeout: 8000,
  maxLength: 2000,
  maxBytes: 2 * 1024 * 1024, // 2 MB
};

// Common named HTML entities. Numeric entities are handled separately.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', deg: '°', euro: '€', pound: '£', cent: '¢',
};

/** Decode named and numeric (decimal and hex) HTML entities. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

/**
 * Extract readable main text from an HTML document using a lightweight,
 * dependency-free heuristic.
 */
export function extractMainText(html: string): string {
  if (!html) return '';
  let s = html;

  // Drop comments.
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');

  // Drop boilerplate / non-content elements together with their contents.
  s = s.replace(
    /<(script|style|noscript|template|svg|head|nav|footer|header|aside|form|iframe|button|select|figure)\b[^>]*>[\s\S]*?<\/\1>/gi,
    ' ',
  );

  // Prefer the <body> if present.
  const body = s.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (body) s = body[1];

  // Convert block-level boundaries into newlines for readable paragraphs.
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote|td|th|pre)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // Remove all remaining tags.
  s = s.replace(/<[^>]+>/g, ' ');

  // Decode entities, then normalise whitespace (keep newlines as paragraph hints).
  s = decodeEntities(s);
  s = s
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}

/** Truncate at a word boundary, appending an ellipsis when cut. */
export function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (!maxLength || maxLength <= 0 || text.length <= maxLength) {
    return { text, truncated: false };
  }
  let cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  // Only back off to a word boundary if it does not discard too much text.
  if (lastSpace > maxLength * 0.6) {
    cut = cut.slice(0, lastSpace);
  }
  return { text: `${cut.trimEnd()}…`, truncated: true };
}

function isHtmlContentType(contentType: unknown): boolean {
  if (typeof contentType !== 'string' || contentType === '') return true; // unknown → attempt anyway
  const ct = contentType.toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml') || ct.includes('text/plain');
}

/**
 * Fetch a single URL and return its extracted main text.
 *
 * Never throws: failures are reported via the `error` field so one bad page
 * does not abort the whole search.
 */
export async function fetchPageContent(
  url: string,
  options: PageContentOptions = {},
): Promise<PageContentResult> {
  const timeout = options.timeout ?? DEFAULTS.timeout;
  const maxLength = options.maxLength ?? DEFAULTS.maxLength;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;

  if (!url || typeof url !== 'string') {
    return { content: '', truncated: false, error: 'No URL to fetch' };
  }

  try {
    const response = await axios.get(url, {
      timeout,
      responseType: 'text',
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      validateStatus: (status: number) => status >= 200 && status < 300,
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const contentType = response.headers?.['content-type'];
    if (!isHtmlContentType(contentType)) {
      return { content: '', truncated: false, error: `Unsupported content type: ${contentType}` };
    }

    const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    const text = extractMainText(html);
    const { text: finalText, truncated } = truncateText(text, maxLength);
    return { content: finalText, truncated };
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
    return { content: '', truncated: false, error: message };
  }
}

/**
 * Fetch page content for several URLs in parallel. Each entry resolves
 * independently; a failure on one URL never rejects the whole batch.
 */
export async function fetchPageContents(
  urls: string[],
  options: PageContentOptions = {},
): Promise<PageContentResult[]> {
  return Promise.all(urls.map((u) => fetchPageContent(u, options)));
}
