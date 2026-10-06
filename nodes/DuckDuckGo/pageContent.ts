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
import * as path from 'path';
import { StringDecoder } from 'string_decoder';
import { Worker } from 'worker_threads';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { BROWSER_USER_AGENT } from './constants';
import { getUrlBlockReason, isBlockedHost } from './urlGuard';

export interface PageContentOptions {
  /** Time allowed for the whole download - connecting, redirects and body - in milliseconds. */
  timeout?: number;
  /** Maximum characters of extracted text to keep (0 or negative = no limit). */
  maxLength?: number;
  /** Bytes of the page that are read; a longer page is read up to here and marked truncated. */
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
  /** True when the text was cut to fit maxLength, or only the first maxBytes of the page were read. */
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

/**
 * Extraction runs in a worker thread so it can be stopped. Readability takes
 * seconds to minutes on a few kilobytes of deeply nested HTML, and the regex
 * tier is quadratic on an unclosed <script> flood; run synchronously, either
 * would freeze the whole n8n process while it lasts.
 */
const EXTRACTION = {
  timeoutMs: 10000,
  // Measured in review: a 1.6-2 MB page of tiny elements peaks at 200-700 MB
  // while parsed. The limit covers the worker's old generation only.
  maxOldGenerationSizeMb: 512,
  // One page at a time keeps the peak at what a single page needs, as it was
  // when extraction ran on the main thread.
  concurrency: 1,
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

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Number(mb.toFixed(1))} MB` : `${Math.round(bytes / 1024)} KB`;
}

function isHtmlContentType(contentType: unknown): boolean {
  if (typeof contentType !== 'string' || contentType === '') return true; // unknown → attempt anyway
  const ct = contentType.toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml') || ct.includes('text/plain');
}

/** Main text and metadata from a page's HTML: the part that runs in the worker. */
export interface ExtractedText {
  content: string;
  truncated: boolean;
  meta?: PageMeta;
  error?: string;
}

/**
 * Three-tier extraction: Readability (with metadata) for clean article text;
 * a linkedom DOM heuristic (drops menus by link density) when Readability
 * finds no article; and the regex heuristic as a last resort.
 */
export function extractFromHtml(html: string, maxLength: number): ExtractedText {
  const readable = extractWithReadability(html);
  const rawText = readable
    ? readable.text
    : (extractWithDomHeuristic(html) ?? extractMainText(html));
  const { text, truncated } = truncateText(rawText, maxLength);
  const result: ExtractedText = { content: text, truncated };
  if (readable && Object.keys(readable.meta).length > 0) {
    result.meta = readable.meta;
  }
  return result;
}

let extractionsRunning = 0;
const extractionQueue: Array<() => void> = [];

async function acquireExtractionSlot(): Promise<void> {
  if (extractionsRunning < EXTRACTION.concurrency) {
    extractionsRunning++;
    return;
  }
  // The slot is handed over by release, so the count is not raised here.
  await new Promise<void>((resolve) => extractionQueue.push(resolve));
}

function releaseExtractionSlot(): void {
  const next = extractionQueue.shift();
  if (next) {
    next();
  } else {
    extractionsRunning--;
  }
}

/** Errors that mean no worker can start here at all, not that this page is bad. */
const WORKER_UNAVAILABLE = new Set([
  'MODULE_NOT_FOUND',
  'ERR_MODULE_NOT_FOUND',
  'ERR_WORKER_PATH',
  'ERR_WORKER_INIT_FAILED',
  'ERR_WORKER_UNSUPPORTED_OPERATION',
]);

export interface ExtractionOptions {
  /** Compiled worker script; defaults to the one built next to this file. */
  workerFile?: string;
  timeoutMs?: number;
}

/**
 * Run extractFromHtml in a worker thread and stop it after the deadline.
 *
 * Never throws. When no worker can be started - the script is missing, as
 * under ts-jest where only the .ts source exists - extraction runs inline as
 * it did before workers were used, so the node keeps working without the
 * time bound rather than not working at all.
 */
export async function runExtraction(
  html: string,
  maxLength: number,
  options: ExtractionOptions = {},
): Promise<ExtractedText> {
  const workerFile = options.workerFile ?? path.join(__dirname, 'extractWorker.js');
  const timeoutMs = options.timeoutMs ?? EXTRACTION.timeoutMs;
  const failed = (error: string): ExtractedText => ({ content: '', truncated: false, error });

  let worker: Worker | undefined;
  // The slot is released once the thread has actually stopped, so a page being
  // terminated and the next one never hold memory at the same time.
  let stopped: Promise<void> = Promise.resolve();
  await acquireExtractionSlot();
  try {
    return await new Promise<ExtractedText>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const finish = (result: ExtractedText) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (worker) stopped = worker.terminate().then(() => undefined, () => undefined);
        resolve(result);
      };
      const inline = () => {
        try {
          finish(extractFromHtml(html, maxLength));
        } catch (error) {
          finish(failed(`Page could not be processed: ${error instanceof Error ? error.message : String(error)}`));
        }
      };

      try {
        worker = new Worker(workerFile, {
          workerData: { html, maxLength },
          resourceLimits: { maxOldGenerationSizeMb: EXTRACTION.maxOldGenerationSizeMb },
        });
      } catch (error: any) {
        if (WORKER_UNAVAILABLE.has(error?.code)) {
          inline();
        } else {
          finish(failed(`Page could not be processed: ${error?.message ?? 'worker did not start'}`));
        }
        return;
      }

      timer = setTimeout(
        () => finish(failed(`Page took too long to process (over ${timeoutMs / 1000} s)`)),
        timeoutMs,
      );
      worker.once('message', (message: ExtractedText) => finish(message));
      worker.once('error', (error: any) => {
        if (WORKER_UNAVAILABLE.has(error?.code)) {
          inline();
        } else if (error?.code === 'ERR_WORKER_OUT_OF_MEMORY') {
          finish(failed('Page needs too much memory to process'));
        } else {
          finish(failed(`Page could not be processed: ${error?.message ?? 'unknown error'}`));
        }
      });
      worker.once('exit', (code: number) => finish(failed(`Page could not be processed (exit code ${code})`)));
    });
  } finally {
    await stopped;
    releaseExtractionSlot();
  }
}

/**
 * Read a response body up to maxBytes. A longer body is cut there and the
 * stream stopped, so a big page still yields its beginning, where the
 * article text normally starts, instead of nothing.
 */
async function readUpTo(stream: AsyncIterable<Buffer | string>, maxBytes: number): Promise<{ text: string; cut: boolean }> {
  // Decoded chunk by chunk: the decoder holds back a character split across
  // two chunks instead of turning each half into U+FFFD.
  const decoder = new StringDecoder('utf8');
  let text = '';
  let total = 0;
  for await (const chunk of stream) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    if (total + buf.length > maxBytes) {
      text += decoder.write(buf.subarray(0, maxBytes - total));
      return { text: text + decoder.end(), cut: true };
    }
    text += decoder.write(buf);
    total += buf.length;
  }
  return { text: text + decoder.end(), cut: false };
}

/**
 * Elements whose content is not page text. Inside one, '<' does not start
 * markup the reader sees, so the scan jumps to the element's end tag.
 */
const SKIP_TO_END_TAG = new Set([
  'script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes',
  'noscript', 'plaintext', 'template', 'svg',
]);

/**
 * Index of the '>' that completes the end tag of `name` at or after `from`,
 * or -1. Only a whole tag counts: '</scriptx>' is not one, and neither is
 * '</script' cut off before its '>'.
 */
function findEndTag(lower: string, name: string, from: number): number {
  const open = '</' + name;
  let at = lower.indexOf(open, from);
  while (at !== -1) {
    const next = lower.charAt(at + open.length);
    if (next === '>' || next === '/' || next === ' ' || next === '\t' || next === '\n' || next === '\r' || next === '\f') {
      return lower.indexOf('>', at + open.length);
    }
    at = lower.indexOf(open, at + 1);
  }
  return -1;
}

/**
 * Drop the unfinished tail of HTML that was cut at the byte limit: a comment,
 * script or similar element left open, or a tag cut in half, would otherwise
 * be read as text. The scan runs forwards, so a string such as '<style>'
 * inside a script that is closed does not count as an open element.
 */
export function trimCutHtml(html: string): string {
  // ASCII-only lowering keeps every index valid; toLowerCase() can change the
  // length of a string ('İ' becomes two characters).
  const lower = html.replace(/[A-Z]+/g, (s) => s.toLowerCase());
  let cutAt = html.length;
  let i = 0;
  for (;;) {
    const lt = lower.indexOf('<', i);
    if (lt === -1) break;
    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4);
      if (end === -1) {
        cutAt = lt;
        break;
      }
      i = end + 3;
      continue;
    }
    const tag = /^<(\/?)([a-z][a-z0-9-]*)/.exec(lower.slice(lt, lt + 40));
    if (!tag) {
      i = lt + 1;
      continue;
    }
    const gt = lower.indexOf('>', lt);
    if (gt === -1) {
      cutAt = lt;
      break;
    }
    const name = tag[2];
    if (!tag[1] && SKIP_TO_END_TAG.has(name) && lower[gt - 1] !== '/') {
      const endTagClose = findEndTag(lower, name, gt + 1);
      if (endTagClose === -1) {
        cutAt = lt;
        break;
      }
      i = endTagClose + 1;
      continue;
    }
    i = gt + 1;
  }
  // A multi-byte character split at the cut decodes as U+FFFD.
  let end = cutAt;
  while (end > 0 && html.charCodeAt(end - 1) === 0xfffd) end--;
  return html.slice(0, end);
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
  const maxBytes = options.maxBytes && options.maxBytes > 0 ? options.maxBytes : DEFAULTS.maxBytes;

  // The URL is untrusted input: with usableAsTool an AI agent chooses it, and the
  // agent can be steered by text inside the results this node itself returned.
  const blockReason = getUrlBlockReason(url);
  if (blockReason) {
    return { content: '', truncated: false, error: blockReason };
  }

  // With responseType stream, axios applies no timeout at all once the
  // headers arrive (and in text mode its timeout was an idle timer that each
  // byte reset), so a server sending a byte every few hundred milliseconds
  // could hold the read open indefinitely. This deadline covers the whole
  // download: connecting, redirects and body.
  const controller = new AbortController();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  let body: (AsyncIterable<Buffer | string> & { destroy?: () => void; on?: (event: string, listener: () => void) => void }) | undefined;

  try {
    const response = await axios.get(url, {
      timeout,
      signal: controller.signal,
      responseType: 'stream',
      // The size limit is applied while reading, so a long page is cut, not refused.
      maxContentLength: -1,
      validateStatus: (status: number) => status >= 200 && status < 300,
      // A redirect can point somewhere the original URL could not, so every hop
      // is re-checked. Throwing here aborts the request chain.
      beforeRedirect: (options: Record<string, any>) => {
        const nextProtocol = String(options.protocol ?? '');
        const nextHost = String(options.hostname ?? options.host ?? '');
        if ((nextProtocol !== 'http:' && nextProtocol !== 'https:') || isBlockedHost(nextHost)) {
          throw new Error('Refused to follow a redirect to a private, loopback or non-HTTP(S) address');
        }
      },
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    body = response.data;
    // A stream can still emit an error after it is stopped early; without a
    // listener that would be thrown at the process level.
    body?.on?.('error', () => undefined);

    const contentType = response.headers?.['content-type'];
    if (!isHtmlContentType(contentType)) {
      return { content: '', truncated: false, error: `Unsupported content type: ${contentType}` };
    }
    // axios removes the header once it has decoded the body; one left over is
    // an encoding it could not decode, and the bytes would read as garbage.
    const encoding = response.headers?.['content-encoding'];
    if (typeof encoding === 'string' && encoding !== '' && encoding.toLowerCase() !== 'identity') {
      return { content: '', truncated: false, error: `Unsupported content encoding: ${encoding}` };
    }

    const { text, cut } = await readUpTo(body as AsyncIterable<Buffer | string>, maxBytes);
    clearTimeout(deadline);

    let html = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    if (cut) {
      html = trimCutHtml(html);
    }
    const extracted = await runExtraction(html, maxLength);
    if (extracted.error) {
      return { content: '', truncated: false, error: extracted.error };
    }
    if (cut) {
      if (!extracted.content) {
        return { content: '', truncated: true, error: `No readable text in the first ${formatBytes(maxBytes)} of the page` };
      }
      extracted.truncated = true;
    }
    return extracted;
  } catch (error: any) {
    // With responseType stream, a refused status (403, 404, 5xx) still carries
    // its unread body, which holds the connection open until destroyed.
    error?.response?.data?.destroy?.();
    let message: string;
    if (timedOut || error?.code === 'ECONNABORTED') {
      message = `Timed out after ${timeout}ms`;
    } else if (error?.response?.status && !(error.response.status >= 200 && error.response.status < 300)) {
      // A body that breaks off mid-read also carries its 2xx response, and
      // "HTTP 200" would hide the reason; those fall through to the code.
      message = `HTTP ${error.response.status}`;
    } else if (error?.code === 'ERR_BAD_RESPONSE') {
      // axios uses this one code for several failures, so the code alone
      // tells the user nothing.
      const detail = typeof error.message === 'string' ? error.message : '';
      message = detail ? `ERR_BAD_RESPONSE: ${detail}` : 'ERR_BAD_RESPONSE';
    } else if (error?.code) {
      message = String(error.code);
    } else {
      message = error instanceof Error ? error.message : 'Unknown error';
    }
    return { content: '', truncated: false, error: message };
  } finally {
    clearTimeout(deadline);
    body?.destroy?.();
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
