/**
 * Unit tests for pageContent.ts — opt-in page fetching + heuristic extraction.
 * axios is mocked; no real network calls are made.
 */

jest.mock('axios');

import axios from 'axios';
import {
  decodeEntities,
  extractMainText,
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
