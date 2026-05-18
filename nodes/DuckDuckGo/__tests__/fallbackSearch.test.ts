/**
 * Unit tests for fallbackSearch.ts — 32.5.1 hotfix coverage
 *
 * Exercises normaliseDdgUrl behaviour through the fallbackWebSearch
 * public interface, using mocked axios responses.
 *
 * Coverage:
 *   - Ad results (duckduckgo.com/y.js) are dropped
 *   - Bing ad tracker (bing.com/aclick) results are dropped
 *   - Protocol-relative DDG redirect (//duckduckgo.com/l/?uddg=) is decoded
 *     to the final URL — no https://// malformed output
 *   - Normal http/https organic results pass through unchanged
 */

jest.mock('axios');
jest.mock('duck-duck-scrape', () => ({
  search: jest.fn(),
  searchNews: jest.fn(),
  searchVideos: jest.fn(),
  SafeSearchType: { STRICT: 'strict', MODERATE: 'moderate', OFF: 'off' },
  SearchTimeType: { DAY: 'd', WEEK: 'w', MONTH: 'm', YEAR: 'y', ALL: 'a' },
}));
jest.mock('../apiClient', () => ({
  searchWithAPI: jest.fn(),
  searchNewsWithAPI: jest.fn(),
  searchVideosWithAPI: jest.fn(),
}));

import axios from 'axios';
import { fallbackWebSearch, fallbackNewsSearch } from '../fallbackSearch';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// HTML fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal DuckDuckGo HTML result block compatible with the
 * parseSearchResultsFromHTML regex.
 */
function makeResultDiv(href: string, title: string, snippet: string): string {
  return `<div class="result results_links web-result">
  <a class="result__a" href="${href}">${title}</a>
  <span class="result__snippet">${snippet}</span>
</div>`;
}

function htmlPage(...blocks: string[]): string {
  return `<!DOCTYPE html><html><head><title>DuckDuckGo</title></head><body>${blocks.join('\n')}</body></html>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fallbackWebSearch — ad filtering and URL normalisation (normaliseDdgUrl)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops result whose href is a duckduckgo.com/y.js ad redirect', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          'https://duckduckgo.com/y.js?ad_provider=bingv7aa&ad_type=txad&ad_domain=buy.example.com',
          'Sponsored Product',
          'Buy at the best price',
        ),
        makeResultDiv('https://organic.example.com/article', 'Organic Article', 'Real content here'),
      ),
    });

    const result = await fallbackWebSearch('AI');

    // Only the organic result should survive
    expect(result.results).toHaveLength(1);
    expect(result.results[0].href).toBe('https://organic.example.com/article');
  });

  it('drops result whose href is a bing.com/aclick ad tracker URL', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          'https://www.bing.com/aclick?ld=e8xyz&url=https%3A%2F%2Fads.example.com%2F',
          'Bing Ad',
          'Promoted product',
        ),
        makeResultDiv('https://legit.example.com/', 'Legit Page', 'Legitimate content'),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].href).toBe('https://legit.example.com/');
  });

  it('decodes protocol-relative //duckduckgo.com/l/?uddg= redirect to the final URL', async () => {
    const finalUrl = 'https://news.example.com/article/123';
    const encodedFinal = encodeURIComponent(finalUrl);
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          `//duckduckgo.com/l/?uddg=${encodedFinal}&rut=token`,
          'News Article',
          'Article summary text',
        ),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(1);
    // Must be the decoded destination — not a DDG redirect wrapper
    expect(result.results[0].href).toBe(finalUrl);
    // The malformed https://// form must never appear
    expect(result.results[0].href).not.toMatch(/^https:\/\/\/\//);
  });

  it('drops protocol-relative //duckduckgo.com/l/ redirect with no uddg param', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          '//duckduckgo.com/l/?rut=token-only',
          'Bad Redirect',
          'No target URL',
        ),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(0);
  });

  it('no output href ever starts with https:////', async () => {
    // Mix of protocol-relative DDG redirect and organic URL
    const finalUrl = 'https://target.example.com/page';
    const encodedFinal = encodeURIComponent(finalUrl);
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(`//duckduckgo.com/l/?uddg=${encodedFinal}`, 'Redirected', 'snippet'),
        makeResultDiv('https://direct.example.com/', 'Direct', 'direct snippet'),
      ),
    });

    const result = await fallbackWebSearch('AI');

    for (const item of result.results) {
      expect(item.href).not.toMatch(/^https:\/\/\/\//);
    }
  });

  it('passes normal https:// organic URL through unchanged', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv('https://wikipedia.org/wiki/AI', 'Artificial Intelligence', 'Wikipedia summary'),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].href).toBe('https://wikipedia.org/wiki/AI');
  });

  it('returns only organic results when ad and organic results are mixed', async () => {
    const finalUrl = 'https://decoded.example.com/page';
    const encodedFinal = encodeURIComponent(finalUrl);
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          'https://duckduckgo.com/y.js?ad_provider=bingv7aa',
          'Ad 1', 'Ad text',
        ),
        makeResultDiv(
          `//duckduckgo.com/l/?uddg=${encodedFinal}`,
          'Organic via redirect', 'snippet',
        ),
        makeResultDiv(
          'https://www.bing.com/aclick?ld=xyz',
          'Ad 2', 'Another ad',
        ),
        makeResultDiv('https://direct-organic.example.com/', 'Direct Organic', 'direct'),
      ),
    });

    const result = await fallbackWebSearch('AI');

    // Only the two organic results should survive
    expect(result.results).toHaveLength(2);
    expect(result.results[0].href).toBe(finalUrl);
    expect(result.results[1].href).toBe('https://direct-organic.example.com/');
  });

  // -------------------------------------------------------------------------
  // 32.5.1 robustness — uddg target re-filtering and no double-decode
  // -------------------------------------------------------------------------

  it('drops redirect whose uddg target is bing.com/aclick (ad hiding inside DDG redirect)', async () => {
    const adTarget = 'https://www.bing.com/aclick?ld=xyz&url=https%3A%2F%2Fadvertiser.example.com%2F';
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          `//duckduckgo.com/l/?uddg=${encodeURIComponent(adTarget)}&rut=token`,
          'Ad via redirect',
          'Should not appear',
        ),
        makeResultDiv('https://organic.example.com/', 'Organic', 'Real result'),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].href).toBe('https://organic.example.com/');
  });

  it('drops redirect whose uddg target carries ad_provider param (ad hiding inside DDG redirect)', async () => {
    const adTarget = 'https://buy.example.com/?ad_provider=bingv7aa&ad_type=txad';
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          `//duckduckgo.com/l/?uddg=${encodeURIComponent(adTarget)}`,
          'Ad param via redirect',
          'Should not appear',
        ),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(0);
  });

  it('preserves percent-encoded characters in uddg target without double-decode corruption', async () => {
    const target = 'https://example.com/search?q=100%25+AI';
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: htmlPage(
        makeResultDiv(
          `//duckduckgo.com/l/?uddg=${encodeURIComponent(target)}&rut=tok`,
          'Encoded Params Article',
          'snippet',
        ),
      ),
    });

    const result = await fallbackWebSearch('AI');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].href).toBe(target);
    // Double-decode corruption form must never appear.
    expect(result.results[0].href).not.toContain('%+A');
  });
});

// ---------------------------------------------------------------------------
// 32.5.2 — fallbackNewsSearch query construction
// ---------------------------------------------------------------------------

describe('fallbackNewsSearch — query construction (32.5.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls fallbackWebSearch with "${query} news" form for a simple query', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: `<!DOCTYPE html><html><body>
        <div class="result results_links web-result">
          <a class="result__a" href="https://community.n8n.io/news">n8n automation news</a>
          <span class="result__snippet">Latest n8n news and updates</span>
        </div>
      </body></html>`,
    });

    await fallbackNewsSearch('n8n');

    // axios.get must have been called once (the underlying HTML GET)
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    const calledUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
    const qParam = new URL(calledUrl).searchParams.get('q') || '';
    // The URL must contain the user query
    expect(qParam).toContain('n8n');
    // Must carry the ' news' suffix
    expect(qParam).toContain('n8n news');
  });

  it('does NOT include site:bbc.com in the fallback news query', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: '<html><body></body></html>' });
    await fallbackNewsSearch('n8n');
    const calledUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).not.toContain('site:bbc.com');
  });

  it('does NOT include site:cnn.com in the fallback news query', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: '<html><body></body></html>' });
    await fallbackNewsSearch('n8n');
    const calledUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).not.toContain('site:cnn.com');
  });

  it('does NOT include site:reuters.com in the fallback news query', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: '<html><body></body></html>' });
    await fallbackNewsSearch('n8n');
    const calledUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).not.toContain('site:reuters.com');
  });

  it('does NOT include site:news.com in the fallback news query', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: '<html><body></body></html>' });
    await fallbackNewsSearch('n8n');
    const calledUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).not.toContain('site:news.com');
  });

  it('query construction works correctly for a multi-word query', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: '<html><body></body></html>' });
    await fallbackNewsSearch('workflow automation');
    const calledUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
    const qParam = new URL(calledUrl).searchParams.get('q') || '';
    expect(qParam).toContain('workflow automation news');
  });
});
