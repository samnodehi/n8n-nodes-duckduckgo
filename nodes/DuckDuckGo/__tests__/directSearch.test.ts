/**
 * Unit tests for directSearch.ts
 * Tests directWebSearch parser behaviour with mocked axios responses.
 * Tests directImageSearch HTTP path (VQD extraction, i.js call, error branches).
 */

jest.mock('axios');

import axios from 'axios';

// Import after mocking
import { directWebSearch, directImageSearch } from '../directSearch';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Minimal HTML fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid DuckDuckGo HTML search results page with one result block.
 * Uses the exact class names the parser depends on.
 */
const VALID_HTML_ONE_RESULT = `<!DOCTYPE html>
<html lang="en"><head><title>DuckDuckGo</title></head>
<body>
<div id="links">
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a class="result__a" href="https://example.com/page1">Example Result Title</a>
  </h2>
  <a class="result__snippet" href="https://example.com/page1">This is the snippet text for the result.</a>
</div>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a class="result__a" href="https://example.com/page2">Second Result</a>
  </h2>
  <a class="result__snippet" href="https://example.com/page2">Second snippet text.</a>
</div>
</div>
</body></html>`;

/**
 * Genuine no-results page returned by DuckDuckGo (HTTP 202).
 * Does NOT contain results_links, result__title, or result__a.
 * Contains duckduckgo.com references but no parseable result blocks.
 */
const NO_RESULTS_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>DuckDuckGo</title></head>
<body>
<center id="lite_wrapper">
  <a class="header-url" href="//duckduckgo.com/">DuckDuckGo</a>
  <form id="search_form" action="/html/" method="post">
    <input type="text" name="q" value="xzqwerty99zz" />
    <input type="submit" value="S" />
  </form>
  <!-- No results section — no results_links, no result__title -->
</center>
</body></html>`;

/**
 * Simulates a DuckDuckGo HTML 200 response where the structure has changed:
 * no known class names, but large enough to be a real page (>1000 chars).
 * This is the parser-failure scenario.
 */
const CHANGED_STRUCTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DuckDuckGo Search</title>
  <link rel="stylesheet" href="//duckduckgo.com/dist/new-layout.abc123.css" type="text/css"/>
  <link rel="stylesheet" href="//duckduckgo.com/dist/new-components.def456.css" type="text/css"/>
</head>
<body>
<div id="react-duckduckgo-app" data-version="2026">
  <!-- DuckDuckGo has moved to a new React frontend structure.
       Old class names (result__title, result__a, results_links) no longer exist.
       This HTML is 200 OK but cannot be parsed by the old regex/split approach. -->
  <nav class="header-nav" aria-label="DuckDuckGo navigation">
    <a href="https://duckduckgo.com/" class="logo-link">DuckDuckGo</a>
  </nav>
  <main class="search-results-container" role="main">
    <div data-testid="result" class="search-result-item-v2">
      <span class="title-new-format">Some Result Here That Cannot Be Parsed</span>
      <a href="https://example.com" class="link-new-format">example.com</a>
      <p class="desc-new-format">Description goes here with important details</p>
    </div>
    <div data-testid="result" class="search-result-item-v2">
      <span class="title-new-format">Another Result That Also Cannot Be Parsed</span>
      <a href="https://other.com" class="link-new-format">other.com</a>
      <p class="desc-new-format">Another description with some content</p>
    </div>
  </main>
  <footer class="search-footer">
    <p>Search powered by DuckDuckGo — privacy-focused search engine</p>
    <a href="https://duckduckgo.com/privacy">Privacy Policy</a>
  </footer>
</div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('directWebSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normal result parsing', () => {
    it('should parse result blocks and return results with correct fields', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: VALID_HTML_ONE_RESULT,
      });

      const output = await directWebSearch('test query');

      expect(output.results).toHaveLength(2);
      expect(output.results[0]).toMatchObject({
        title: 'Example Result Title',
        url: 'https://example.com/page1',
        description: 'This is the snippet text for the result.',
      });
      expect(output.results[1]).toMatchObject({
        title: 'Second Result',
        url: 'https://example.com/page2',
      });
    });

    it('should respect maxResults option', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: VALID_HTML_ONE_RESULT,
      });

      const output = await directWebSearch('test query', { maxResults: 1 });

      expect(output.results).toHaveLength(1);
      expect(output.results[0].title).toBe('Example Result Title');
    });

    it('should send locale and safeSearch parameters in the POST body', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: VALID_HTML_ONE_RESULT,
      });

      await directWebSearch('test query', { locale: 'uk-en', safeSearch: 'strict' });

      const postCall = (mockedAxios.post as jest.Mock).mock.calls[0];
      // Second argument is the URLSearchParams body
      const body = postCall[1] as URLSearchParams;
      expect(body.get('kl')).toBe('uk-en');
      expect(body.get('kp')).toBe('1'); // strict = '1'
      expect(body.get('q')).toBe('test query');
    });

    it('should encode safeSearch moderate as kp=-1', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: VALID_HTML_ONE_RESULT,
      });

      await directWebSearch('test', { safeSearch: 'moderate' });

      const body = (mockedAxios.post as jest.Mock).mock.calls[0][1] as URLSearchParams;
      expect(body.get('kp')).toBe('-1');
    });
  });

  describe('genuine no-results (HTTP 202)', () => {
    it('should return empty results array without throwing when DuckDuckGo returns HTTP 202', async () => {
      // HTTP 202 = confirmed DuckDuckGo no-results signal (verified live 2026-05-15)
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 202,
        data: NO_RESULTS_HTML,
      });

      const output = await directWebSearch('xzqwerty99zz totally made up query');

      expect(output.results).toHaveLength(0);
      expect(Array.isArray(output.results)).toBe(true);
    });

    it('should not throw for HTTP 202 no-results, even with large HTML', async () => {
      // Padded no-results HTML to ensure length > 1000 does NOT trigger parser error
      // when status is 202
      const paddedNoResults = NO_RESULTS_HTML + ' '.repeat(5000);
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 202,
        data: paddedNoResults,
      });

      await expect(directWebSearch('no results query')).resolves.toMatchObject({
        results: [],
      });
    });
  });

  describe('parser/structure failure detection (HTTP 200 + no parseable blocks)', () => {
    it('should throw a parser-failure error when HTTP 200 returns large HTML but no result blocks', async () => {
      // Simulates DuckDuckGo changing its HTML class names
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: CHANGED_STRUCTURE_HTML,
      });

      await expect(directWebSearch('something')).rejects.toThrow(
        'DuckDuckGo web search response could not be parsed'
      );
    });

    it('parser-failure error message should mention page structure', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: CHANGED_STRUCTURE_HTML,
      });

      let caughtMessage = '';
      try {
        await directWebSearch('something');
      } catch (e) {
        caughtMessage = (e as Error).message;
      }

      expect(caughtMessage).toContain('page structure may have changed');
    });

    it('should NOT throw for HTTP 200 with very short HTML (edge case)', async () => {
      // Short body (< 1000 chars) does not trigger parser failure
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: '<html><body>tiny</body></html>',
      });

      const output = await directWebSearch('query');
      expect(output.results).toHaveLength(0);
    });
  });

  describe('network error handling', () => {
    it('should throw timeout error on ECONNABORTED', async () => {
      const timeoutError = Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
      mockedAxios.post = jest.fn().mockRejectedValue(timeoutError);

      await expect(directWebSearch('query')).rejects.toThrow(
        'Web search request timed out'
      );
    });

    it('should throw connection error on ENOTFOUND', async () => {
      const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
      mockedAxios.post = jest.fn().mockRejectedValue(dnsError);

      await expect(directWebSearch('query')).rejects.toThrow(
        'Unable to connect to DuckDuckGo'
      );
    });

    it('should throw rate limit error on HTTP 429', async () => {
      const rateLimitError = Object.assign(new Error('rate limited'), {
        response: { status: 429 },
      });
      mockedAxios.post = jest.fn().mockRejectedValue(rateLimitError);

      await expect(directWebSearch('query')).rejects.toThrow(
        'Too many requests'
      );
    });

    it('should throw server error on HTTP 500+', async () => {
      const serverError = Object.assign(new Error('server error'), {
        response: { status: 503 },
      });
      mockedAxios.post = jest.fn().mockRejectedValue(serverError);

      await expect(directWebSearch('query')).rejects.toThrow(
        'DuckDuckGo server error'
      );
    });
  });
});

// ---------------------------------------------------------------------------
// directImageSearch tests
// ---------------------------------------------------------------------------

/**
 * VQD value used in the page HTML fixtures below.
 * The directImageSearch regex /vqd=([\d-]+)/ matches digits and dashes only.
 */
const VALID_VQD = '3-123456789';

/** HTML that carries a purely digit-dash VQD, matching the regex exactly. */
const IMAGE_PAGE_HTML_REGEX_VQD = `<!DOCTYPE html><html><body>
vqd=${VALID_VQD} some more content here
</body></html>`;

/** Minimal i.js JSON response with two image results. */
const IMAGE_JS_RESPONSE = {
  results: [
    {
      title: 'Cat on a mat',
      image: 'https://example.com/cat.jpg',
      thumbnail: 'https://example.com/cat_thumb.jpg',
      url: 'https://example.com/cat-page',
      width: 800,
      height: 600,
    },
    {
      title: 'Another cat',
      image: 'https://example.com/cat2.jpg',
      thumbnail: 'https://example.com/cat2_thumb.jpg',
      url: 'https://example.com/cat-page-2',
      width: 1024,
      height: 768,
    },
  ],
};

/** HTML page that does NOT contain a VQD token. */
const IMAGE_PAGE_HTML_NO_VQD = `<!DOCTYPE html><html><body>
<div id="react-duckduckgo-app">No token here</div>
</body></html>`;

describe('directImageSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful image search', () => {
    it('should parse image results from i.js JSON response', async () => {
      // First GET: HTML page containing VQD token
      // Second GET: i.js JSON response with image results
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      const output = await directImageSearch('cats');

      expect(output.results).toHaveLength(2);
      expect(output.results[0]).toMatchObject({
        title: 'Cat on a mat',
        url: 'https://example.com/cat.jpg',
        thumbnail: 'https://example.com/cat_thumb.jpg',
        source: 'https://example.com/cat-page',
        width: 800,
        height: 600,
      });
      expect(output.results[1]).toMatchObject({
        title: 'Another cat',
        url: 'https://example.com/cat2.jpg',
      });
      // Return value must include the VQD that was extracted from the page
      expect(output.vqd).toBe(VALID_VQD);
    });

    it('should make exactly two GET requests: one page GET and one i.js GET', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      await directImageSearch('cats');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      // Second call must be to i.js
      const secondCallUrl = (mockedAxios.get as jest.Mock).mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('duckduckgo.com/i.js');
    });

    it('should pass locale and safeSearch to the i.js request', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      await directImageSearch('cats', { locale: 'uk-en', safeSearch: 'strict' });

      const secondCallUrl = (mockedAxios.get as jest.Mock).mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('l=uk-en');
      expect(secondCallUrl).toContain('p=1'); // strict = '1'
    });

    it('should respect maxResults option', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      const output = await directImageSearch('cats', { maxResults: 1 });

      expect(output.results).toHaveLength(1);
      expect(output.results[0].title).toBe('Cat on a mat');
    });

    it('should return empty results when i.js returns no results array', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: { results: [] } });

      const output = await directImageSearch('obscure query with no images');

      expect(output.results).toHaveLength(0);
      expect(Array.isArray(output.results)).toBe(true);
    });
  });

  describe('VQD extraction failure', () => {
    it('should throw the VQD-missing error when the page HTML contains no VQD token', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_NO_VQD });

      await expect(directImageSearch('cats')).rejects.toThrow(
        'DuckDuckGo image search token (VQD) could not be extracted'
      );
    });

    it('VQD-missing error should mention that image search may be temporarily unavailable', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_NO_VQD });

      let caughtMessage = '';
      try {
        await directImageSearch('cats');
      } catch (e) {
        caughtMessage = (e as Error).message;
      }

      expect(caughtMessage).toContain('temporarily unavailable');
    });

    it('should make only one GET request when VQD is missing (no i.js call)', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_NO_VQD });

      await expect(directImageSearch('cats')).rejects.toThrow();

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('network error handling', () => {
    it('should throw image timeout error on ECONNABORTED', async () => {
      const timeoutError = Object.assign(new Error('timeout of 15000ms exceeded'), {
        code: 'ECONNABORTED',
      });
      mockedAxios.get = jest.fn().mockRejectedValue(timeoutError);

      await expect(directImageSearch('cats')).rejects.toThrow(
        'Image search request timed out'
      );
    });

    it('should throw image connection error on ENOTFOUND', async () => {
      const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND duckduckgo.com'), {
        code: 'ENOTFOUND',
      });
      mockedAxios.get = jest.fn().mockRejectedValue(dnsError);

      await expect(directImageSearch('cats')).rejects.toThrow(
        'Unable to connect to DuckDuckGo for image search'
      );
    });

    it('should throw image connection error on ECONNREFUSED', async () => {
      const connRefusedError = Object.assign(new Error('connect ECONNREFUSED 52.250.42.157:443'), {
        code: 'ECONNREFUSED',
      });
      mockedAxios.get = jest.fn().mockRejectedValue(connRefusedError);

      await expect(directImageSearch('cats')).rejects.toThrow(
        'Unable to connect to DuckDuckGo for image search'
      );
    });

    it('should throw image rate-limit error on HTTP 429', async () => {
      const rateLimitError = Object.assign(new Error('Request failed with status code 429'), {
        response: { status: 429 },
      });
      mockedAxios.get = jest.fn().mockRejectedValue(rateLimitError);

      await expect(directImageSearch('cats')).rejects.toThrow(
        'Too many image search requests'
      );
    });

    it('should throw 403 Forbidden error with VQD context on HTTP 403', async () => {
      const forbiddenError = Object.assign(new Error('Request failed with status code 403'), {
        response: { status: 403 },
      });
      mockedAxios.get = jest.fn().mockRejectedValue(forbiddenError);

      await expect(directImageSearch('cats')).rejects.toThrow(
        '403 Forbidden'
      );
    });

    it('HTTP 403 error message should mention VQD', async () => {
      const forbiddenError = Object.assign(new Error('Request failed with status code 403'), {
        response: { status: 403 },
      });
      mockedAxios.get = jest.fn().mockRejectedValue(forbiddenError);

      let caughtMessage = '';
      try {
        await directImageSearch('cats');
      } catch (e) {
        caughtMessage = (e as Error).message;
      }

      expect(caughtMessage).toContain('403 Forbidden');
      expect(caughtMessage).toContain('VQD');
    });

    it('HTTP 403 on i.js after successful VQD extraction should still throw 403 error', async () => {
      // Page GET succeeds and returns VQD; i.js GET returns 403
      const forbiddenError = Object.assign(new Error('Request failed with status code 403'), {
        response: { status: 403 },
      });
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockRejectedValueOnce(forbiddenError);

      await expect(directImageSearch('cats')).rejects.toThrow('403 Forbidden');
    });
  });

  describe('vqdHint — VQD reuse (skipping page GET)', () => {
    it('should skip the page GET and make only one GET request when vqdHint is provided', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      await directImageSearch('cats', {}, VALID_VQD);

      // Only one GET: the i.js call. No page GET.
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      const callUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('duckduckgo.com/i.js');
    });

    it('should include the provided vqdHint in the i.js URL', async () => {
      const hint = '3-hint-token-99';
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      await directImageSearch('cats', {}, hint);

      const callUrl = (mockedAxios.get as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain(`vqd=${hint}`);
    });

    it('should return correct image results when vqdHint is provided', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      const output = await directImageSearch('cats', {}, VALID_VQD);

      expect(output.results).toHaveLength(2);
      expect(output.results[0].title).toBe('Cat on a mat');
    });

    it('should echo the provided vqdHint in the returned vqd field', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      const output = await directImageSearch('cats', {}, VALID_VQD);

      // The caller needs the VQD back to store it in the cache Map
      expect(output.vqd).toBe(VALID_VQD);
    });

    it('should throw 403 error when reused vqdHint is rejected by i.js', async () => {
      const forbiddenError = Object.assign(new Error('Request failed with status code 403'), {
        response: { status: 403 },
      });
      mockedAxios.get = jest.fn().mockRejectedValue(forbiddenError);

      // Providing a stale/expired VQD hint — i.js rejects with 403
      await expect(directImageSearch('cats', {}, 'stale-vqd-token')).rejects.toThrow(
        '403 Forbidden'
      );

      // Only one GET attempt (no page GET was made first)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should NOT reuse a vqdHint from a different query (caller responsibility, verified by key isolation)', async () => {
      // This test verifies the contract: the function itself does not enforce key
      // isolation — that is the caller's responsibility (keyed Map in node.ts).
      // What we verify here is that the VQD from a first call is NOT automatically
      // injected into a second call with a different query — the caller must pass it.
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML_REGEX_VQD })
        .mockResolvedValueOnce({ status: 200, data: IMAGE_JS_RESPONSE });

      // First call — no hint
      await directImageSearch('cats');
      // Second call — different query, no hint passed → page GET happens again
      await directImageSearch('dogs');

      // Total: 4 GETs (page + i.js for each query)
      expect(mockedAxios.get).toHaveBeenCalledTimes(4);
    });
  });
});

// ---------------------------------------------------------------------------
// Ad-filter and URL-normalisation tests (32.5.1 hotfix)
// These exercise normaliseDdgUrl logic through the directWebSearch public API.
// ---------------------------------------------------------------------------

/**
 * HTML block helper — wraps a single result entry in the exact class skeleton
 * that directWebSearch splits on.
 */
function makeResultBlock(href: string, title: string, snippet: string): string {
  return `<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a class="result__a" href="${href}">${title}</a>
  </h2>
  <a class="result__snippet" href="${href}">${snippet}</a>
</div>`;
}

function wrapBlocks(...blocks: string[]): string {
  return `<!DOCTYPE html><html><head><title>DuckDuckGo</title></head><body><div id="links">${blocks.join('\n')}</div></body></html>`;
}

describe('directWebSearch — ad filtering and URL normalisation (normaliseDdgUrl)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops result whose href is a duckduckgo.com/y.js ad redirect', async () => {
    const html = wrapBlocks(
      makeResultBlock(
        'https://duckduckgo.com/y.js?ad_domain=example.com&ad_provider=bingv7aa&rut=abc',
        'Sponsored Ad',
        'Buy now at a great price',
      ),
      makeResultBlock('https://organic.example.com/page', 'Organic Result', 'Real snippet'),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    // The y.js result must be dropped; only the organic result survives.
    expect(output.results).toHaveLength(1);
    expect(output.results[0].url).toBe('https://organic.example.com/page');
    expect(output.results[0].title).toBe('Organic Result');
  });

  it('drops result whose href is a bing.com/aclick ad tracker URL', async () => {
    const html = wrapBlocks(
      makeResultBlock(
        'https://www.bing.com/aclick?ld=e8abc&url=https%3A%2F%2Fadvertiser.example.com%2F',
        'Bing Ad',
        'Click here for a deal',
      ),
      makeResultBlock('https://real.example.com/', 'Real Page', 'Real content'),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(1);
    expect(output.results[0].url).toBe('https://real.example.com/');
  });

  it('drops result with ad_provider query param', async () => {
    const html = wrapBlocks(
      makeResultBlock(
        'https://duckduckgo.com/y.js?ad_provider=bingv7aa&ad_type=txad&ad_domain=buy.example.com&rut=xyz',
        'Text Ad',
        'Promoted content',
      ),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(0);
  });

  it('decodes duckduckgo.com/l/?uddg= redirect to final organic URL', async () => {
    const finalUrl = 'https://example.com/actual-article';
    const encodedFinal = encodeURIComponent(finalUrl);
    const html = wrapBlocks(
      makeResultBlock(
        `https://duckduckgo.com/l/?uddg=${encodedFinal}&rut=some-token`,
        'Organic Article',
        'Article snippet',
      ),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(1);
    // URL must be the decoded destination, not the DDG redirect wrapper.
    expect(output.results[0].url).toBe(finalUrl);
  });

  it('drops duckduckgo.com/l/ redirect that has no uddg param', async () => {
    const html = wrapBlocks(
      makeResultBlock(
        'https://duckduckgo.com/l/?rut=some-token',
        'Bad Redirect',
        'No uddg param present',
      ),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(0);
  });

  it('passes normal organic https:// URL through unchanged', async () => {
    const html = wrapBlocks(
      makeResultBlock('https://wikipedia.org/wiki/AI', 'Artificial Intelligence', 'Wikipedia article'),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(1);
    expect(output.results[0].url).toBe('https://wikipedia.org/wiki/AI');
  });

  it('returns only organic results when ad and organic results are mixed', async () => {
    const html = wrapBlocks(
      makeResultBlock(
        'https://duckduckgo.com/y.js?ad_provider=bingv7aa',
        'Ad 1',
        'Sponsored ad snippet',
      ),
      makeResultBlock('https://first-organic.example.com/', 'Organic 1', 'First organic'),
      makeResultBlock(
        'https://www.bing.com/aclick?ld=xyz',
        'Ad 2',
        'Another sponsored ad',
      ),
      makeResultBlock('https://second-organic.example.com/', 'Organic 2', 'Second organic'),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(2);
    expect(output.results[0].url).toBe('https://first-organic.example.com/');
    expect(output.results[1].url).toBe('https://second-organic.example.com/');
  });

  // -------------------------------------------------------------------------
  // 32.5.1 robustness — uddg target re-filtering and no double-decode
  // -------------------------------------------------------------------------

  it('drops redirect whose uddg target is bing.com/aclick (ad hiding inside DDG redirect)', async () => {
    // The redirect wrapper itself looks like an organic DDG /l/ URL, but its
    // decoded target is a Bing ad click tracker — must be dropped.
    const adTarget = 'https://www.bing.com/aclick?ld=xyz&url=https%3A%2F%2Fadvertiser.example.com%2F';
    const html = wrapBlocks(
      makeResultBlock(
        `https://duckduckgo.com/l/?uddg=${encodeURIComponent(adTarget)}&rut=token`,
        'Ad via redirect',
        'Should not appear',
      ),
      makeResultBlock('https://organic.example.com/', 'Organic', 'Real result'),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(1);
    expect(output.results[0].url).toBe('https://organic.example.com/');
  });

  it('drops redirect whose uddg target carries ad_provider param (ad hiding inside DDG redirect)', async () => {
    const adTarget = 'https://buy.example.com/?ad_provider=bingv7aa&ad_type=txad';
    const html = wrapBlocks(
      makeResultBlock(
        `https://duckduckgo.com/l/?uddg=${encodeURIComponent(adTarget)}`,
        'Ad param via redirect',
        'Should not appear',
      ),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(0);
  });

  it('preserves percent-encoded characters in uddg target without double-decode corruption', async () => {
    // Target URL contains a percent-encoded percent sign: ?q=100%25+AI
    // The href attribute encodes the full target URL once, so %25 becomes %2525 in the href.
    // After URLSearchParams.get() decodes one layer: uddg = 'https://example.com/search?q=100%25+AI'
    // A second decodeURIComponent() call would corrupt %25 → %, breaking the URL.
    const target = 'https://example.com/search?q=100%25+AI';
    const html = wrapBlocks(
      makeResultBlock(
        `https://duckduckgo.com/l/?uddg=${encodeURIComponent(target)}&rut=tok`,
        'Article With Encoded Params',
        'snippet',
      ),
    );

    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: html });

    const output = await directWebSearch('AI');

    expect(output.results).toHaveLength(1);
    // Must be the once-decoded value from URLSearchParams.get() — not double-decoded.
    expect(output.results[0].url).toBe(target);
    // The double-decode corruption form must never appear.
    expect(output.results[0].url).not.toContain('%+A');
  });
});
