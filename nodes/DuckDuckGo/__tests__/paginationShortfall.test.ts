/**
 * News and Video ask DuckDuckGo for one page at a time. When a later page
 * fails, the node keeps the pages it already has - which is right, ten real
 * results beat none - but until now it returned them with nothing to say that
 * anything had gone wrong.
 *
 * That is the same shape as the bug this node spent a month on: DuckDuckGo's
 * HTTP 202 challenge page gave *empty* results silently. This gave *partial*
 * results silently.
 */

jest.mock('duck-duck-scrape');
jest.mock('../fallbackSearch');

import { searchNews, searchVideos } from 'duck-duck-scrape';
import { DuckDuckGo } from '../DuckDuckGo.node';
import * as cacheModule from '../cache';
import { clearCache } from '../cache';
import { resetChallengeCooldown } from '../challengeCooldown';

const mockedNews = searchNews as jest.MockedFunction<typeof searchNews>;
const mockedVideos = searchVideos as jest.MockedFunction<typeof searchVideos>;

const VQD = '3-123456789-98765432109876543210';

const newsPage = (n: number) => ({
  noResults: n === 0,
  vqd: VQD,
  results: Array.from({ length: n }, (_, i) => ({
    date: 1625097600,
    excerpt: `excerpt ${i}`,
    image: 'https://e.com/i.jpg',
    relativeTime: '2 hours ago',
    syndicate: 'Example News',
    title: `Article ${i}`,
    url: `https://e.com/a${i}`,
    isOld: false,
  })),
});

/** A news page whose articles are numbered from `from`, so pages do not repeat. */
const newsPageFrom = (from: number, n: number) => {
  const p = newsPage(n);
  p.results.forEach((r, i) => { r.url = `https://e.com/a${from + i}`; r.title = `Article ${from + i}`; });
  return p;
};

const videoPage = (n: number) => ({
  noResults: n === 0,
  vqd: VQD,
  results: Array.from({ length: n }, (_, i) => ({
    content: `https://e.com/v${i}`,
    description: 'd',
    duration: '1:00',
    embed_html: '',
    embed_url: '',
    image_token: '',
    images: { large: '', medium: '', motion: '', small: '' },
    provider: 'YouTube',
    published: '',
    publisher: 'Example',
    statistics: { viewCount: 1 },
    title: `Video ${i}`,
    uploader: 'someone',
  })),
});

/** A video page whose videos are numbered from `from`, so pages do not repeat. */
const videoPageFrom = (from: number, n: number) => {
  const p = videoPage(n);
  p.results.forEach((r, i) => { r.content = `https://e.com/v${from + i}`; r.title = `Video ${from + i}`; });
  return p;
};

let logger: Record<'debug' | 'info' | 'warn' | 'error', jest.Mock>;
let addExecutionHints: jest.Mock;
let setCacheSpy: jest.SpyInstance;

const context = (operation: string, query: string, maxResults: number, enableCache = false) => ({
  getInputData: () => [{ json: {} }],
  getNode: () => ({ id: 'n', name: 'DuckDuckGo', type: 't', typeVersion: 1, position: [0, 0], parameters: {} }),
  continueOnFail: () => false,
  logger,
  addExecutionHints,
  helpers: {
    returnJsonArray: (items: any[]) => items.map((json: any, item: number) => ({ json, pairedItem: { item } })),
  },
  getNodeParameter: (name: string, _i: number, fallback?: unknown) => {
    if (name === 'operation') return operation;
    if (name === 'newsQuery' || name === 'videoQuery') return query;
    if (name === 'newsSearchOptions' || name === 'videoSearchOptions') return { maxResults };
    if (name === 'cacheSettings') return { enableCache, cacheTTL: 300 };
    if (name === 'errorHandling') return 'continueOnFail';
    if (name === 'debugMode') return false;
    return fallback;
  },
});

const run = (operation: string, query: string, maxResults: number, enableCache = false) =>
  (new DuckDuckGo().execute as any).call(context(operation, query, maxResults, enableCache));

beforeEach(() => {
  jest.clearAllMocks();
  clearCache();
  resetChallengeCooldown();
  logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  addExecutionHints = jest.fn();
  setCacheSpy = jest.spyOn(cacheModule, 'setCache');
});

afterEach(() => {
  setCacheSpy.mockRestore();
});

describe('a later page failing', () => {
  it('says so on the canvas and in the log, and still returns what it has', async () => {
    mockedNews
      .mockResolvedValueOnce(newsPage(10) as any)
      .mockRejectedValueOnce(new Error('A server error occurred!'));

    const out = await run('searchNews', 'ai', 30);

    expect(out[0]).toHaveLength(10);

    const warned = logger.warn.mock.calls[0][0] as string;
    expect(warned).toContain('30');
    expect(warned).toContain('10');
    expect(warned).toContain('A server error occurred!');

    expect(addExecutionHints).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning', location: 'outputPane' }),
    );
  });

  it('does not cache the short answer', async () => {
    mockedNews
      .mockResolvedValueOnce(newsPage(10) as any)
      .mockRejectedValueOnce(new Error('A server error occurred!'));

    await run('searchNews', 'ai', 30, true);

    // Caching it would serve the shortfall for the whole TTL without a request,
    // and without anything left to report it.
    expect(setCacheSpy).not.toHaveBeenCalled();
  });

  it('reports the same way for video search', async () => {
    mockedVideos
      .mockResolvedValueOnce(videoPage(10) as any)
      .mockRejectedValueOnce(new Error('A server error occurred!'));

    const out = await run('searchVideos', 'ai', 30);

    expect(out[0]).toHaveLength(10);
    expect(logger.warn).toHaveBeenCalled();
    expect(addExecutionHints).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning', location: 'outputPane' }),
    );
  });
});

describe('DuckDuckGo simply running out of results', () => {
  it('is not reported as a failure, and is cached', async () => {
    mockedNews
      .mockResolvedValueOnce(newsPage(10) as any)
      .mockResolvedValueOnce(newsPage(0) as any);

    const out = await run('searchNews', 'ai', 30, true);

    expect(out[0]).toHaveLength(10);
    // Ten was all there was. Nothing went wrong, so nothing is said.
    expect(logger.warn).not.toHaveBeenCalled();
    expect(addExecutionHints).not.toHaveBeenCalled();
    expect(setCacheSpy).toHaveBeenCalled();
  });
});

describe('paging through news', () => {
  it('asks for the second page where the first ended', async () => {
    mockedNews
      .mockResolvedValueOnce(newsPageFrom(0, 30) as any)
      .mockResolvedValueOnce(newsPageFrom(30, 30) as any);

    const out = await run('searchNews', 'ai', 45);

    // The old loop asked for s=10 here, which DuckDuckGo answered with 403 or
    // with page 1 again. Its own next page after 30 results is s=30.
    expect(mockedNews).toHaveBeenCalledTimes(2);
    expect(mockedNews.mock.calls[1][1]).toEqual(expect.objectContaining({ offset: 30, vqd: VQD }));
    expect(out[0]).toHaveLength(45);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when the page limit is what stopped it, and still caches the answer', async () => {
    for (let p = 0; p < 5; p++) {
      mockedNews.mockResolvedValueOnce(newsPageFrom(p * 10, 10) as any);
    }

    const out = await run('searchNews', 'ai', 100, true);

    expect(out[0]).toHaveLength(50);
    expect(logger.warn.mock.calls[0][0]).toContain('stopped after 5 pages');
    expect(addExecutionHints).toHaveBeenCalled();
    // Every run would stop at the same place, so there is nothing to recover by
    // asking again.
    expect(setCacheSpy).toHaveBeenCalled();
  });
});

describe('a capped answer served from the cache', () => {
  it('still says it is short', async () => {
    for (let p = 0; p < 5; p++) {
      mockedNews.mockResolvedValueOnce(newsPageFrom(p * 10, 10) as any);
    }
    await run('searchNews', 'ai', 100, true);
    logger.warn.mockClear();
    addExecutionHints.mockClear();

    const out = await run('searchNews', 'ai', 100, true);

    // Served without a request, and without the warning the first run gave,
    // this would be exactly the silent short list the warning exists to prevent.
    expect(mockedNews).toHaveBeenCalledTimes(5);
    expect(out[0]).toHaveLength(50);
    expect(logger.warn.mock.calls[0][0]).toContain('stopped after 5 pages');
    expect(addExecutionHints).toHaveBeenCalled();
  });
});

describe('paging through videos', () => {
  it('asks for the second page where the first ended', async () => {
    mockedVideos
      .mockResolvedValueOnce(videoPageFrom(0, 30) as any)
      .mockResolvedValueOnce(videoPageFrom(30, 30) as any);

    const out = await run('searchVideos', 'ai', 45);

    expect(mockedVideos).toHaveBeenCalledTimes(2);
    expect(mockedVideos.mock.calls[1][1]).toEqual(expect.objectContaining({ offset: 30, vqd: VQD }));
    expect(out[0]).toHaveLength(45);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when the page limit is what stopped it, and still caches the answer', async () => {
    for (let p = 0; p < 5; p++) {
      mockedVideos.mockResolvedValueOnce(videoPageFrom(p * 10, 10) as any);
    }

    const out = await run('searchVideos', 'ai', 100, true);

    expect(out[0]).toHaveLength(50);
    expect(logger.warn.mock.calls[0][0]).toContain('stopped after 5 pages');
    expect(setCacheSpy).toHaveBeenCalled();
  });
});

describe('the cache key', () => {
  it('separates a request for ten results from a request for fifty', async () => {
    mockedNews.mockResolvedValue(newsPage(10) as any);

    await run('searchNews', 'ai', 10, true);
    const callsAfterFirst = mockedNews.mock.calls.length;

    // Before maxResults was part of the key, this second run was served the
    // ten-result answer from cache, skipped pagination entirely, and returned
    // ten where fifty were asked for - with nothing to show for it.
    await run('searchNews', 'ai', 50, true);

    expect(mockedNews.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});

describe('a node running on an n8n without execution hints', () => {
  it('still logs the shortfall instead of throwing', async () => {
    mockedNews
      .mockResolvedValueOnce(newsPage(10) as any)
      .mockRejectedValueOnce(new Error('A server error occurred!'));

    const ctx = context('searchNews', 'ai', 30) as any;
    delete ctx.addExecutionHints;

    const out = await (new DuckDuckGo().execute as any).call(ctx);

    expect(out[0]).toHaveLength(10);
    expect(logger.warn).toHaveBeenCalled();
  });
});
