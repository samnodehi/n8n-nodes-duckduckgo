/**
 * htmlParser.ts
 *
 * HTML parser for DuckDuckGo search results
 * Updated to work without cheerio dependency - using regex-based parsing
 */

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
 * Parses HTML results from a DuckDuckGo search page using regex.
 *
 * @param html - The raw HTML content returned by DuckDuckGo's HTML interface.
 * @returns An array of parsed search results.
 */
export function parseHtmlResults(html: string): HtmlSearchResult[] {
  const results: HtmlSearchResult[] = [];

  // Each <div class="result"> is one search hit
  const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const resultDiv = match[1];

    // 1) Extract the title text from the first <a class="result__a">
    const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*(?:href="([^"]*)"[^>]*)?>(.*?)<\/a>/i;
    const titleMatch = titleRegex.exec(resultDiv);

    if (!titleMatch) continue;

    const title = titleMatch[2] ? titleMatch[2].replace(/<[^>]*>/g, '').trim() : '';
    const url = titleMatch[1] || '';

    // 3) Extract the snippet — DuckDuckGo sometimes uses <a> or <div> for snippets
    let snippet = '';

    // Try <a class="result__snippet"> first
    const snippetARegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/i;
    const snippetAMatch = snippetARegex.exec(resultDiv);

    if (snippetAMatch) {
      snippet = snippetAMatch[1].replace(/<[^>]*>/g, '').trim();
    } else {
      // Try <div class="result__snippet">
      const snippetDivRegex = /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/div>/i;
      const snippetDivMatch = snippetDivRegex.exec(resultDiv);

      if (snippetDivMatch) {
        snippet = snippetDivMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }

    // Only push if we got at least a title and URL
    if (title && url && title.length > 0 && url.length > 0) {
      results.push({
        title: cleanHtml(title),
        url,
        snippet: cleanHtml(snippet),
        source: 'html',
      });
    }
  }

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
