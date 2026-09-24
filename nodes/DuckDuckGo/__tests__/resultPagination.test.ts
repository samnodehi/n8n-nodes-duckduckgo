/**
 * The offsets asked for are the point of these tests. The loops this module
 * replaced asked for page 2 at `s=10` whatever the first page held, and no test
 * looked at the offset, so nothing noticed when DuckDuckGo's pages turned out
 * to be 30 long.
 */

import { collectPages, MAX_PAGES, PagingUnavailable, ResultPage } from '../resultPagination';

const VQD = '4-123456789-987654321';

type Item = { url?: string | null; n?: number };

/** `count` results numbered from `from`, each with its own URL. */
const page = (from: number, count: number): ResultPage<Item> => ({
  vqd: VQD,
  results: Array.from({ length: count }, (_, i) => ({ url: `https://e.com/${from + i}`, n: from + i })),
});

/** A DuckDuckGo that pages by item offset and holds `total` results. */
const catalogue = (total: number, pageSize: number) =>
  jest.fn(async (offset: number) => page(offset, Math.max(0, Math.min(pageSize, total - offset))));

describe('the offset', () => {
  it('asks for the next page where the first one ended, not at ten', async () => {
    const fetchPage = catalogue(200, 30);

    await collectPages(page(0, 30), 60, fetchPage);

    // DuckDuckGo's own `next` after a 30-result page is s=30.
    expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([30]);
  });

  it('keeps counting what was received across several pages', async () => {
    const fetchPage = catalogue(200, 10);

    await collectPages(page(0, 10), 40, fetchPage);

    expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([10, 20, 30]);
  });

  it('pages with the token the first page was served under', async () => {
    const fetchPage = catalogue(200, 30);

    await collectPages(page(0, 30), 45, fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(30, VQD);
  });
});

describe('how many requests are sent', () => {
  it('sends none when the first page already holds enough', async () => {
    const fetchPage = catalogue(200, 30);

    const out = await collectPages(page(0, 30), 25, fetchPage);

    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.results).toHaveLength(30);
    expect(out.shortfall).toBeUndefined();
  });

  it('sends only as many pages as maxResults needs at the observed page size', async () => {
    const fetchPage = catalogue(500, 30);

    const out = await collectPages(page(0, 30), 100, fetchPage);

    // ceil(100 / 30) = 4 pages in all, so three more requests.
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(out.results).toHaveLength(120);
    expect(out.shortfall).toBeUndefined();
  });

  it(`never fetches more than ${MAX_PAGES} pages, and says so when that is why it stopped`, async () => {
    const fetchPage = catalogue(500, 10);

    const out = await collectPages(page(0, 10), 100, fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(MAX_PAGES - 1);
    expect(out.results).toHaveLength(MAX_PAGES * 10);
    // Not a failure: every run would stop at the same place, so it may be cached.
    expect(out.shortfall).toEqual({
      reason: `stopped after ${MAX_PAGES} pages to limit requests to DuckDuckGo`,
      transient: false,
    });
  });
});

describe('DuckDuckGo running out', () => {
  it('stops without comment on an empty page', async () => {
    const fetchPage = catalogue(30, 30);

    const out = await collectPages(page(0, 30), 60, fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(out.results).toHaveLength(30);
    expect(out.shortfall).toBeUndefined();
  });

  it('stops without comment after a page shorter than the first', async () => {
    const fetchPage = catalogue(42, 30);

    const out = await collectPages(page(0, 30), 100, fetchPage);

    // Page 2 held 12 of a possible 30: it was the last one, so no third request.
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(out.results).toHaveLength(42);
    expect(out.shortfall).toBeUndefined();
  });

  it('does not page at all when the first page is empty', async () => {
    const fetchPage = catalogue(0, 30);

    const out = await collectPages(page(0, 0), 50, fetchPage);

    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.results).toHaveLength(0);
  });
});

describe('duplicates', () => {
  it('drops a result already collected from an earlier page', async () => {
    const fetchPage = jest.fn(async () => ({
      vqd: VQD,
      results: [{ url: 'https://e.com/5' }, { url: 'https://e.com/new' }],
    }));

    const out = await collectPages(page(0, 10), 12, fetchPage);

    expect(out.results.map((r) => r.url)).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `https://e.com/${i}`),
      'https://e.com/new',
    ]);
  });

  it('treats the same article with different tracking parameters as one', async () => {
    const first = { vqd: VQD, results: [{ url: 'https://e.com/story?utm_source=ddg' }] };
    const fetchPage = jest.fn(async () => ({
      vqd: VQD,
      results: [{ url: 'https://e.com/story?utm_source=other&fbclid=x' }, { url: 'https://e.com/other' }],
    }));

    const out = await collectPages(first, 5, fetchPage);

    // The output strips these parameters, so both would have shown the same URL.
    expect(out.results.map((r) => r.url)).toEqual([
      'https://e.com/story?utm_source=ddg',
      'https://e.com/other',
    ]);
  });

  it('keeps results that have no URL to compare', async () => {
    const first = { vqd: VQD, results: [{ url: null }, { url: undefined }] as Item[] };
    const fetchPage = jest.fn(async () => ({ vqd: VQD, results: [] as Item[] }));

    const out = await collectPages(first, 1, fetchPage);

    expect(out.results).toHaveLength(2);
  });

  it('reports a page of nothing new instead of taking it as the end', async () => {
    const fetchPage = jest.fn(async () => page(0, 30));

    const out = await collectPages(page(0, 30), 60, fetchPage);

    // With the offset right this means the listing moved between requests,
    // which is not DuckDuckGo saying it has no more.
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(out.results).toHaveLength(30);
    expect(out.shortfall).toEqual({
      reason: 'DuckDuckGo answered with results already collected',
      transient: true,
    });
  });
});

describe('failures', () => {
  it('stops at a failed page, keeps what it has, and says why', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(30, 30))
      .mockRejectedValueOnce(new Error('A server error occurred!'));

    const out = await collectPages(page(0, 30), 100, fetchPage);

    expect(out.results).toHaveLength(60);
    expect(out.shortfall).toEqual({ reason: 'A server error occurred!', transient: true });
  });

  it('reports a first page that came without a token to page with', async () => {
    const fetchPage = catalogue(200, 30);

    const out = await collectPages({ ...page(0, 30), vqd: undefined }, 60, fetchPage);

    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.shortfall).toEqual({
      reason: 'DuckDuckGo did not return a token to page with',
      transient: true,
    });
  });

  it('reports paging that cannot happen at all as permanent, so it may be cached', async () => {
    const fetchPage = jest.fn().mockRejectedValueOnce(new PagingUnavailable('no later pages here'));

    const out = await collectPages(page(0, 30), 60, fetchPage);

    expect(out.results).toHaveLength(30);
    expect(out.shortfall).toEqual({ reason: 'no later pages here', transient: false });
  });

  it('reports a thrown value that is not an Error', async () => {
    const fetchPage = jest.fn().mockRejectedValueOnce('socket hang up');

    const out = await collectPages(page(0, 30), 60, fetchPage);

    expect(out.shortfall).toEqual({ reason: 'socket hang up', transient: true });
  });
});

describe('the debug callback', () => {
  it('is told each page and the offset it is asked for', async () => {
    const onPage = jest.fn();

    await collectPages(page(0, 30), 90, catalogue(200, 30), onPage);

    expect(onPage.mock.calls).toEqual([[2, 30], [3, 60]]);
  });
});
