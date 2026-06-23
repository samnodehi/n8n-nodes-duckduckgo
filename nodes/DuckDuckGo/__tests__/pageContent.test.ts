/**
 * Unit tests for pageContent.ts — opt-in page fetching + heuristic extraction.
 * axios is mocked; no real network calls are made.
 */

jest.mock('axios');

import axios from 'axios';
import {
  decodeEntities,
  extractMainText,
  extractWithReadability,
  extractWithDomHeuristic,
  truncateText,
  fetchPageContent,
  fetchPageContents,
} from '../pageContent';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('pageContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeEntities', () => {
    it('decodes common named entities', () => {
      expect(decodeEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
      expect(decodeEntities('&lt;tag&gt; &quot;q&quot; &#39;a&#39;')).toBe('<tag> "q" \'a\'');
      expect(decodeEntities('a&nbsp;b')).toBe('a b');
    });

    it('decodes decimal and hex numeric entities', () => {
      expect(decodeEntities('&#65;&#66;')).toBe('AB');
      expect(decodeEntities('&#x41;&#X42;')).toBe('AB');
    });

    it('leaves unknown entities untouched', () => {
      expect(decodeEntities('&notareal; &amp;')).toBe('&notareal; &');
    });
  });

  describe('extractMainText', () => {
    it('returns empty string for empty input', () => {
      expect(extractMainText('')).toBe('');
    });

    it('drops script and style content', () => {
      const html = '<body><p>Hello</p><script>alert(1)</script><style>.x{}</style></body>';
      expect(extractMainText(html)).toBe('Hello');
    });

    it('drops navigation, header and footer boilerplate', () => {
      const html = '<body><nav>Menu</nav><header>Top</header><p>Body text</p><footer>Foot</footer></body>';
      expect(extractMainText(html)).toBe('Body text');
    });

    it('prefers the body and ignores the head', () => {
      const html = '<html><head><title>Title</title></head><body><p>Real content</p></body></html>';
      expect(extractMainText(html)).toBe('Real content');
    });

    it('converts block elements to line breaks and strips inline tags', () => {
      const html = '<body><p>One</p><p>Two <b>bold</b></p></body>';
      expect(extractMainText(html)).toBe('One\nTwo bold');
    });

    it('decodes entities in the extracted text', () => {
      expect(extractMainText('<body><p>A &amp; B</p></body>')).toBe('A & B');
    });
  });

  describe('extractWithReadability', () => {
    it('returns clean article text and drops nav/footer boilerplate', () => {
      const html = `<!DOCTYPE html><html><head><title>Understanding Widgets</title></head><body>
        <nav>MENU_ITEM_SHOULD_BE_REMOVED Home Pricing Login</nav>
        <article>
          <h1>Understanding Widgets</h1>
          <p>Widgets are small reusable components that encapsulate behaviour and presentation. They are widely used across modern software to compose complex interfaces from simple parts.</p>
          <p>A well designed widget exposes a clear interface, hides its internal state, and can be tested in isolation. This makes large applications easier to reason about and maintain over time.</p>
          <p>In practice, teams build libraries of widgets so that common patterns do not have to be reinvented for every screen or feature that they ship to their users.</p>
        </article>
        <footer>FOOTER_SHOULD_BE_REMOVED copyright 2026</footer>
      </body></html>`;

      const text = extractWithReadability(html);
      expect(text).not.toBeNull();
      expect(text as string).toContain('reusable components');
      expect(text as string).not.toContain('MENU_ITEM_SHOULD_BE_REMOVED');
      expect(text as string).not.toContain('FOOTER_SHOULD_BE_REMOVED');
    });

    it('returns null for pages with too little content (caller falls back)', () => {
      expect(extractWithReadability('<html><body><p>hi</p></body></html>')).toBeNull();
      expect(extractWithReadability('')).toBeNull();
    });
  });

  describe('extractWithDomHeuristic', () => {
    it('removes high link-density menus (not in <nav>) and keeps article text', () => {
      const html = `<!DOCTYPE html><html><body>
        <ul class="site-menu">
          <li><a href="/a">Courses</a></li>
          <li><a href="/b">Tutorials</a></li>
          <li><a href="/c">DSA</a></li>
          <li><a href="/d">Python</a></li>
          <li><a href="/e">Java</a></li>
        </ul>
        <article>
          <h1>Real Title</h1>
          <p>This is the genuine article body with enough descriptive prose that it clearly is not a navigation menu and should be preserved by the extractor.</p>
        </article>
      </body></html>`;

      const text = extractWithDomHeuristic(html);
      expect(text).not.toBeNull();
      expect(text as string).toContain('genuine article body');
      expect(text as string).not.toContain('DSA');
      expect(text as string).not.toContain('Tutorials');
    });

    it('returns null for empty input', () => {
      expect(extractWithDomHeuristic('')).toBeNull();
    });
  });

  describe('truncateText', () => {
    it('returns text unchanged when under the limit', () => {
      expect(truncateText('short', 100)).toEqual({ text: 'short', truncated: false });
    });

    it('does not truncate when maxLength is 0 or negative', () => {
      expect(truncateText('anything goes', 0)).toEqual({ text: 'anything goes', truncated: false });
      expect(truncateText('anything goes', -5)).toEqual({ text: 'anything goes', truncated: false });
    });

    it('truncates at a word boundary and appends an ellipsis', () => {
      const out = truncateText('hello world foobar', 13);
      expect(out.truncated).toBe(true);
      expect(out.text).toBe('hello world…');
    });
  });

  describe('fetchPageContent', () => {
    it('uses Readability output (clean article, no nav) for article pages', async () => {
      const html = `<!DOCTYPE html><html><head><title>A</title></head><body>
        <nav>NAVBOILERPLATE</nav>
        <article><h1>Topic</h1>
        <p>This is a sufficiently long article paragraph about an interesting topic that contains enough words for Readability to treat it as the main content of the page rather than boilerplate navigation links.</p>
        <p>It continues with a second paragraph so the extracted article comfortably exceeds the minimum length threshold used to trust the Readability result instead of the heuristic fallback path.</p>
        </article></body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: html,
      });
      const result = await fetchPageContent('https://example.com/article');
      expect(result.error).toBeUndefined();
      expect(result.content).toContain('interesting topic');
      expect(result.content).not.toContain('NAVBOILERPLATE');
    });

    it('extracts main text from an HTML response', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        data: '<body><p>Hello world</p><script>x()</script></body>',
      });

      const result = await fetchPageContent('https://example.com');
      expect(result.error).toBeUndefined();
      expect(result.content).toBe('Hello world');
      expect(result.truncated).toBe(false);
    });

    it('truncates long content to maxLength', async () => {
      const longText = 'word '.repeat(200).trim(); // ~999 chars
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: `<body><p>${longText}</p></body>`,
      });

      const result = await fetchPageContent('https://example.com', { maxLength: 50 });
      expect(result.truncated).toBe(true);
      expect(result.content.length).toBeLessThanOrEqual(51); // 50 + ellipsis
      expect(result.content.endsWith('…')).toBe(true);
    });

    it('skips non-HTML content types', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: '{"a":1}',
      });

      const result = await fetchPageContent('https://api.example.com/data.json');
      expect(result.content).toBe('');
      expect(result.error).toContain('Unsupported content type');
    });

    it('returns an error without calling axios for an empty URL', async () => {
      mockedAxios.get = jest.fn();
      const result = await fetchPageContent('');
      expect(result.error).toBe('No URL to fetch');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('reports a timeout error', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue({ code: 'ECONNABORTED' });
      const result = await fetchPageContent('https://slow.example.com', { timeout: 1234 });
      expect(result.content).toBe('');
      expect(result.error).toBe('Timed out after 1234ms');
    });

    it('reports an HTTP status error', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue({ response: { status: 404 } });
      const result = await fetchPageContent('https://missing.example.com');
      expect(result.error).toBe('HTTP 404');
    });
  });

  describe('fetchPageContents', () => {
    it('resolves all URLs independently, isolating failures', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: '<body><p>Good</p></body>',
        })
        .mockRejectedValueOnce({ response: { status: 500 } });

      const results = await fetchPageContents(['https://a.com', 'https://b.com']);
      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('Good');
      expect(results[1].error).toBe('HTTP 500');
    });
  });
});
