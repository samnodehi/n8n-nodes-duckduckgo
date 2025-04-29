/**
 * htmlParser.ts
 *
 * HTML parser for DuckDuckGo search results
 */

import * as cheerio from 'cheerio';

/**
 * The shape of a parsed HTML search result.
 */
export interface HtmlSearchResult {
  /** The title text of the result */
  title: string;
  /** The href (URL) of the result */
  url: string;
  /** The snippet or description text */
  snippet: string;
  /** Marker to indicate these came from HTML parsing */
  source: 'html';
}

/**
 * Parses HTML results from a DuckDuckGo search page using Cheerio.
 *
 * @param html - The raw HTML content returned by DuckDuckGo's HTML interface.
 * @returns An array of parsed search results.
 */
export function parseHtmlResults(html: string): HtmlSearchResult[] {
  const results: HtmlSearchResult[] = [];

  // Load HTML into cheerio for DOM-like querying
  const $ = cheerio.load(html);

  // Each <div class="result"> is one search hit
  $('div.result').each((_, element) => {
    const el = $(element);

    // 1) Extract the title text from the first <a class="result__a">
    const title = el.find('a.result__a').first().text().trim();

    // 2) Extract the URL from the same link's href attribute
    const url = el.find('a.result__a').first().attr('href') ?? '';

    // 3) Extract the snippet — DuckDuckGo sometimes uses <a> or <div> for snippets
    let snippet = el.find('a.result__snippet').first().text().trim();
    if (!snippet) {
      snippet = el.find('div.result__snippet').first().text().trim();
    }

    // Only push if we got at least a title and URL
    if (title && url) {
      results.push({
        title: cleanHtml(title),
        url,
        snippet: cleanHtml(snippet),
        source: 'html',
      });
    }
  });

  return results;
}

/**
 * Cleans up a string by decoding common HTML entities and normalizing whitespace.
 *
 * @param text - Raw string which may contain HTML tags or entities.
 * @returns A cleaned, human-readable string.
 */
function cleanHtml(text: string): string {
  return text
    // decode a few common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // collapse multiple whitespace into one space
    .replace(/\s+/g, ' ')
    .trim();
}
