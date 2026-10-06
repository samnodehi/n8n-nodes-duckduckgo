/**
 * Unit tests for pageContent.ts — opt-in page fetching + heuristic extraction.
 * axios is mocked; no real network calls are made.
 */

jest.mock('axios');

import axios from 'axios';
import { Readable } from 'stream';
import {
  decodeEntities,
  extractMainText,
  extractWithReadability,
  extractWithDomHeuristic,
  truncateText,
  trimCutHtml,
  fetchPageContent,
  fetchPageContents,
} from '../pageContent';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Page bodies are read as a stream, as axios delivers them with responseType stream.
const bodyOf = (html: string) => Readable.from([Buffer.from(html)]);

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

      const result = extractWithReadability(html);
      expect(result).not.toBeNull();
      expect(result!.text).toContain('reusable components');
      expect(result!.text).not.toContain('MENU_ITEM_SHOULD_BE_REMOVED');
      expect(result!.text).not.toContain('FOOTER_SHOULD_BE_REMOVED');
      expect(result!.meta.title).toContain('Understanding Widgets');
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

  describe('trimCutHtml', () => {
    it('drops a script, style or comment left open by the cut', () => {
      expect(trimCutHtml('<p>Text</p><script>var a = 1')).toBe('<p>Text</p>');
      expect(trimCutHtml('<p>Text</p><style>p { color')).toBe('<p>Text</p>');
      expect(trimCutHtml('<p>Text</p><!-- a note')).toBe('<p>Text</p>');
    });

    it('keeps closed scripts and drops a tag cut in half', () => {
      expect(trimCutHtml('<script>x()</script><p>Text</p><div class="a')).toBe('<script>x()</script><p>Text</p>');
    });

    it('is not misled by markup-like strings inside a closed script', () => {
      const html = "<script>var tpl = '<style>' + '<!--';</script><p>Article text.</p><p>More";
      expect(trimCutHtml(html)).toBe(html);
    });

    it('treats an end tag cut before its > or with a longer name as still open', () => {
      expect(trimCutHtml('<p>ok</p><script>SECRET</script')).toBe('<p>ok</p>');
      expect(trimCutHtml('<p>ok</p><script>a = "</scriptx>"; SECRET')).toBe('<p>ok</p>');
      expect(trimCutHtml('<p>ok</p><script>x()</script ><p>after')).toBe('<p>ok</p><script>x()</script ><p>after');
    });

    it('cuts at the right place after characters whose lower case is longer', () => {
      expect(trimCutHtml('<p>' + 'İ'.repeat(200) + '</p><script>var secret = 1;')).toBe('<p>' + 'İ'.repeat(200) + '</p>');
    });

    it('drops a broken character at the very end', () => {
      expect(trimCutHtml('<p>caf' + String.fromCharCode(0xfffd))).toBe('<p>caf');
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
        data: bodyOf(html),
      });
      const result = await fetchPageContent('https://example.com/article');
      expect(result.error).toBeUndefined();
      expect(result.content).toContain('interesting topic');
      expect(result.content).not.toContain('NAVBOILERPLATE');
      expect(result.meta).toBeDefined();
    });

    it('extracts main text from an HTML response', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        data: bodyOf('<body><p>Hello world</p><script>x()</script></body>'),
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
        data: bodyOf(`<body><p>${longText}</p></body>`),
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
        data: bodyOf('{"a":1}'),
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

    it('reads the start of a page longer than the byte limit and marks it truncated', async () => {
      const article = '<body><p>' + 'Opening words of a long article. '.repeat(20) + '</p>';
      const rest = '<p>' + 'later text '.repeat(5000) + '</p></body>';
      const body = Readable.from([Buffer.from(article), Buffer.from(rest)]);
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: body });

      const result = await fetchPageContent('https://long.example.com', { maxBytes: 2000, maxLength: 0 });
      expect(result.error).toBeUndefined();
      expect(result.truncated).toBe(true);
      expect(result.content).toContain('Opening words of a long article.');
      expect(body.destroyed).toBe(true);
    });

    it('does not read a script cut open at the limit as text', async () => {
      const html = '<body><p>Visible text.</p><script>var secret = "' + 'x'.repeat(5000) + '";</script></body>';
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: bodyOf(html) });

      const result = await fetchPageContent('https://script.example.com', { maxBytes: 1000 });
      expect(result.content).toBe('Visible text.');
      expect(result.content).not.toContain('secret');
      expect(result.truncated).toBe(true);
    });

    it('says so when the part read holds no text', async () => {
      const html = '<html><head><script>' + 'var a=1;'.repeat(1000) + '</script></head><body><p>Late text.</p></body></html>';
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: bodyOf(html) });

      const result = await fetchPageContent('https://heavy.example.com', { maxBytes: 2048 });
      expect(result.content).toBe('');
      expect(result.error).toBe('No readable text in the first 2 KB of the page');
    });

    it('does not split a multi-byte character at the cut', async () => {
      // "é" is two bytes; the limit lands between them.
      const html = '<body><p>caf' + 'é'.repeat(10) + '</p></body>';
      const limit = Buffer.byteLength('<body><p>caf') + 5;
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: bodyOf(html) });

      const result = await fetchPageContent('https://utf8.example.com', { maxBytes: limit });
      expect(result.content).toBe('café' + 'é');
    });

    it('stops a download that outlasts the timeout, however slowly the bytes come', async () => {
      // A server that keeps sending a little at a time never trips an idle
      // timeout; the deadline must stop it. The mock behaves as axios does on
      // abort: it destroys the body stream with an error.
      const body = new Readable({ read() { /* bytes arrive only when pushed */ } });
      body.push('<body><p>start');
      mockedAxios.get = jest.fn().mockImplementation(async (_url: string, config: any) => {
        config.signal.addEventListener('abort', () => body.destroy(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })));
        return { status: 200, headers: { 'content-type': 'text/html' }, data: body };
      });

      const started = Date.now();
      const result = await fetchPageContent('https://drip.example.com', { timeout: 50 });
      expect(result.error).toBe('Timed out after 50ms');
      expect(Date.now() - started).toBeLessThan(2000);
    });

    it('asks axios for a stream with no size limit and an abort signal', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: bodyOf('<p>x</p>') });
      await fetchPageContent('https://example.com');
      const config = (mockedAxios.get as jest.Mock).mock.calls[0][1];
      expect(config.responseType).toBe('stream');
      expect(config.maxContentLength).toBe(-1);
      expect(config.signal).toBeDefined();
    });

    it('closes the body of a refused status', async () => {
      const body = bodyOf('<html>Not found</html>');
      mockedAxios.get = jest.fn().mockRejectedValue({ response: { status: 404, data: body } });
      const result = await fetchPageContent('https://missing.example.com/page');
      expect(result.error).toBe('HTTP 404');
      expect(body.destroyed).toBe(true);
    });

    it('stops reading a body it will not use', async () => {
      const body = bodyOf('{"a":1}');
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'application/json' }, data: body });
      await fetchPageContent('https://api.example.com/data.json');
      expect(body.destroyed).toBe(true);
    });

    it('refuses a body in an encoding axios did not decode', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html', 'content-encoding': 'compress' },
        data: bodyOf('\x1f\x9d binary'),
      });
      const result = await fetchPageContent('https://old.example.com');
      expect(result.error).toBe('Unsupported content encoding: compress');
    });

    it('keeps the reason for any other bad response', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue({
        code: 'ERR_BAD_RESPONSE',
        message: 'unexpected end of file',
      });
      const result = await fetchPageContent('https://broken.example.com');
      expect(result.error).toBe('ERR_BAD_RESPONSE: unexpected end of file');
    });

    it('still reports the HTTP status when a bad response has one', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue({
        code: 'ERR_BAD_RESPONSE',
        message: 'Request failed with status code 502',
        response: { status: 502 },
      });
      const result = await fetchPageContent('https://down.example.com');
      expect(result.error).toBe('HTTP 502');
    });

    it('keeps the reason when a 200 response breaks off mid-body', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue({
        code: 'ERR_BAD_RESPONSE',
        message: 'stream has been aborted',
        response: { status: 200 },
      });
      const result = await fetchPageContent('https://cut.example.com');
      expect(result.error).toBe('ERR_BAD_RESPONSE: stream has been aborted');
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
          data: bodyOf('<body><p>Good</p></body>'),
        })
        .mockRejectedValueOnce({ response: { status: 500 } });

      const results = await fetchPageContents(['https://a.com', 'https://b.com']);
      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('Good');
      expect(results[1].error).toBe('HTTP 500');
    });
  });
});
