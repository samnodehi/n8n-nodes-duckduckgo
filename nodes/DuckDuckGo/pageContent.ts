/**
 * Optional page-content fetching and main-text extraction for Web and News
 * Search results.
 *
 * IMPORTANT: fetching page content makes HTTP requests to the third-party
 * result sites — not only to DuckDuckGo. This module is used only when the
 * user explicitly opts in via the "Fetch Page Content" option (off by default).
 *
 * Extraction is three-tiered: (1) Mozilla Readability over a linkedom DOM for
 * clean article text; (2) a linkedom DOM heuristic that drops boilerplate and
 * high link-density blocks (menus) when Readability finds no article; and
 * (3) a dependency-free regex heuristic as a last resort if DOM parsing fails.
 */

import axios from 'axios';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { BROWSER_USER_AGENT } from './constants';

export interface PageContentOptions {
  /** Per-request timeout in milliseconds. */
  timeout?: number;
  /** Maximum characters of extracted text to keep (0 or negative = no limit). */
  maxLength?: number;
  /** Maximum response size to download, in bytes (guards against huge pages). */
  maxBytes?: number;
}

export interface PageMeta {
  /** Article title. */
  title?: string;
  /** Author / byline. */
  author?: string;
  /** Short excerpt or description. */
  excerpt?: string;
  /** Published time as reported by the page. */
  published?: string;
  /** Site name. */
  siteName?: string;
}

export interface PageContentResult {
  /** Extracted (and possibly truncated) main text. Empty string on failure. */
  content: string;
  /** True when the text was cut to fit maxLength. */
  truncated: boolean;
  /** Article metadata, present only when Readability identified an article. */
  meta?: PageMeta;
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

  return htmlFragmentToText(s);
}

/**
 * Convert an HTML fragment to readable text: block elements become line breaks,
 * remaining tags are removed, entities decoded, and whitespace normalised.
 */
function htmlFragmentToText(html: string): string {
  let s = html;
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote|td|th|pre)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return normaliseWhitespace(s);
}

const BOILERPLATE_SELECTOR =
  'script,style,noscript,template,svg,head,nav,footer,header,aside,form,iframe,button,select,figure';
const LINK_DENSITY_SELECTOR = 'ul,ol,div,section,table';

/**
 * DOM-based fallback (linkedom) for pages where Readability finds no article.
 * Removes boilerplate elements and high link-density blocks (menus / link lists
 * not wrapped in <nav>), then extracts text from the main article/body. Returns
 * null on failure so the caller can fall back to the regex heuristic.
 */
export function extractWithDomHeuristic(html: string): string | null {
  if (!html) return null;
  try {
    const doc: any = parseHTML(html).document;
    Array.from(doc.querySelectorAll(BOILERPLATE_SELECTOR)).forEach((el: any) => el.remove());
    // Drop blocks whose text is mostly link text (navigation / menus).
    Array.from(doc.querySelectorAll(LINK_DENSITY_SELECTOR)).forEach((el: any) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 2000) return;
      const linkText = Array.from(el.querySelectorAll('a'))
        .map((a: any) => a.textContent || '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (linkText.length / text.length > 0.5) el.remove();
    });
    const container = doc.querySelector('article') || doc.querySelector('main') || doc.body;
    const fragment: string = container ? container.innerHTML : '';
    const text = htmlFragmentToText(fragment);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Collapse runs of spaces/tabs, trim around newlines, and cap blank lines. */
function normaliseWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Minimum article length (characters) for a Readability result to be trusted.
 * Below this the page is likely not an article, so the heuristic is used.
 */
const MIN_READABLE_LENGTH = 200;

export interface ReadabilityResult {
  /** Clean, normalised article text. */
  text: string;
  /** Article metadata extracted alongside the text. */
  meta: PageMeta;
}

/**
 * Extract clean article text and metadata using Mozilla Readability over a
 * linkedom DOM. Returns null when no substantial article is found, so the
 * caller can fall back to the heuristic extractor. Never throws.
 */
export function extractWithReadability(html: string): ReadabilityResult | null {
  if (!html) return null;
  try {
    const { document } = parseHTML(html);
    // linkedom's Document is structurally compatible enough for Readability;
    // cast to any because this project does not include the DOM lib types.
    const article = new Readability(document as any).parse();
    if (article && article.textContent && (article.length ?? 0) >= MIN_READABLE_LENGTH) {
      const text = normaliseWhitespace(article.textContent);
      if (text.length === 0) return null;
      const meta: PageMeta = {};
      if (article.title) meta.title = article.title;
      if (article.byline) meta.author = article.byline;
      if (article.excerpt) meta.excerpt = article.excerpt;
      if (article.publishedTime) meta.published = article.publishedTime;
      if (article.siteName) meta.siteName = article.siteName;
      return { text, meta };
    }
    return null;
  } catch {
    return null;
  }
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
    // Three-tier extraction: Readability (with metadata) for clean article text;
    // a linkedom DOM heuristic (drops menus by link density) when Readability
    // finds no article; and the regex heuristic as a last resort.
    const readable = extractWithReadability(html);
    const rawText = readable
      ? readable.text
      : (extractWithDomHeuristic(html) ?? extractMainText(html));
    const { text: finalText, truncated } = truncateText(rawText, maxLength);
    const result: PageContentResult = { content: finalText, truncated };
    if (readable && Object.keys(readable.meta).length > 0) {
      result.meta = readable.meta;
    }
    return result;
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
