/**
 * Web and Image fetch every result DuckDuckGo gives them in one request and
 * then cut the list to `maxResults` - before storing it. `maxResults` was not
 * part of the cache key, so the cut list was served to a later request that
 * asked for more, and came back short with nothing to say so.
 *
 * News and Video had the same defect for a different reason: there the cached
 * answer skipped the pagination loop entirely. That case is covered in
 * paginationShortfall.test.ts.
 */

jest.mock('../directSearch');
jest.mock('../fallbackSearch');

import { directWebSearch, directImageSearch } from '../directSearch';
import { DuckDuckGo } from '../DuckDuckGo.node';
import { clearCache } from '../cache';
import { resetChallengeCooldown } from '../challengeCooldown';

const mockedWeb = directWebSearch as jest.MockedFunction<typeof directWebSearch>;
const mockedImages = directImageSearch as jest.MockedFunction<typeof directImageSearch>;

/** More results than either request asks for, so only the cut can shorten them. */
const WEB_RESULTS = Array.from({ length: 30 }, (_, i) => ({
  title: `Result ${i}`,
  url: `https://e.com/${i}`,
  description: `d${i}`,
}));

const IMAGE_RESULTS = Array.from({ length: 30 }, (_, i) => ({
  title: `Image ${i}`,
  url: `https://e.com/${i}.jpg`,
  thumbnail: `https://e.com/${i}-t.jpg`,
  source: `https://e.com/page${i}`,
  height: 100,
  width: 100,
}));

const context = (operation: string, query: string, maxResults: number) => ({
  getInputData: () => [{ json: {} }],
  getNode: () => ({ id: 'n', name: 'DuckDuckGo', type: 't', typeVersion: 1, position: [0, 0], parameters: {} }),
  continueOnFail: () => false,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  helpers: {
    returnJsonArray: (items: any[]) => items.map((json: any, item: number) => ({ json, pairedItem: { item } })),
  },
  getNodeParameter: (name: string, _i: number, fallback?: unknown) => {
    if (name === 'operation') return operation;
    if (name === 'query' || name === 'imageQuery') return query;
    if (name === 'webSearchOptions' || name === 'imageSearchOptions') return { maxResults };
    if (name === 'cacheSettings') return { enableCache: true, cacheTTL: 300 };
    if (name === 'errorHandling') return 'continueOnFail';
    if (name === 'debugMode') return false;
    return fallback;
  },
});

const run = (operation: string, query: string, maxResults: number) =>
  (new DuckDuckGo().execute as any).call(context(operation, query, maxResults));

beforeEach(() => {
  jest.clearAllMocks();
  clearCache();
  resetChallengeCooldown();
  mockedWeb.mockResolvedValue({ results: WEB_RESULTS } as any);
  mockedImages.mockResolvedValue({ results: IMAGE_RESULTS, vqd: '3-1-1' } as any);
});

describe('the web search cache key', () => {
  it('does not serve a ten-result answer to a request for twenty', async () => {
    const first = await run('search', 'ai', 10);
    expect(first[0]).toHaveLength(10);

    const second = await run('search', 'ai', 20);

    expect(second[0]).toHaveLength(20);
    expect(mockedWeb).toHaveBeenCalledTimes(2);
  });

  it('still serves the cache when the same request is repeated', async () => {
    await run('search', 'ai', 10);
    const second = await run('search', 'ai', 10);

    expect(second[0]).toHaveLength(10);
    expect(mockedWeb).toHaveBeenCalledTimes(1);
  });
});

describe('the image search cache key', () => {
  it('does not serve a ten-result answer to a request for twenty', async () => {
    const first = await run('searchImages', 'cats', 10);
    expect(first[0]).toHaveLength(10);

    const second = await run('searchImages', 'cats', 20);

    expect(second[0]).toHaveLength(20);
    expect(mockedImages).toHaveBeenCalledTimes(2);
  });

  it('still serves the cache when the same request is repeated', async () => {
    await run('searchImages', 'cats', 10);
    const second = await run('searchImages', 'cats', 10);

    expect(second[0]).toHaveLength(10);
    expect(mockedImages).toHaveBeenCalledTimes(1);
  });
});
