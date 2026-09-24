/**
 * Paging follows the offset each page names for the next one. The offsets
 * asked for are the point of most of these tests: the loops this module
 * replaced asked for page 2 at `s=10`, and its first version counted results,
 * which drifts from DuckDuckGo's own fixed steps of 30.
 */

import { collectPages, MAX_PAGES, ResultPage } from '../resultPagination';

const VQD = '4-123456789-987654321';

type Item = { url?: string | null };

/** `count` results numbered from `from`, naming `next` as the next page. */
const page = (from: number, count: number, next?: number): ResultPage<Item> => ({
  vqd: VQD,
  results: Array.from({ length: count }, (_, i) => ({ url: `https://e.com/${from + i}` })),
  nextOffset: next,
});

/**
 * A DuckDuckGo that steps by 30 but serves `perPage` results a page, from
 * `total` in all, and names no next page after the last.
 */
const catalogue = (total: number, perPage = 30) =>
  jest.fn(async (offset: number) => {
    const count = Math.max(0, Math.min(perPage, total - offset));
    return page(offset, count, offset + 30 < total ? offset + 30 : undefined);
  });

describe('the offset', () => {
  it('is the one the previous page named, not a count of what it held', async () => {
    // Page 1 holds 26 but names s=30, as DuckDuckGo's did live.
    const fetchPage = catalogue(500, 26);

    await collectPages(page(0, 26, 30), 60, fetchPage);

    expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([30, 60]);
  });

  it('pages with the token the first page was served under', async () => {
    const fetchPage = catalogue(500);

    await collectPages(page(0, 30, 30), 45, fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(30, VQD);
  });
});

describe('how many requests are sent', () => {
  it('sends none when the first page already holds enough', async () => {
    const fetchPage = catalogue(500);

    const out = await collectPages(page(0, 30, 30), 25, fetchPage);

    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.results).toHaveLength(30);
    expect(out.shortfall).toBeUndefined();
  });

  it('stops as soon as it holds enough', async () => {
    const fetchPage = catalogue(500);

    const out = await collectPages(page(0, 30, 30), 100, fetchPage);

    // 30 + 30 + 30 + 30 = 120 after three more pages.
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(out.results).toHaveLength(120);
    expect(out.shortfall).toBeUndefined();
  });

  it(`never fetches more than ${MAX_PAGES} pages, and says so when that is why it stopped`, async () => {
    const fetchPage = catalogue(500, 10);

    const out = await collectPages(page(0, 10, 30), 100, fetchPage);

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
  it('stops without comment when a page names no next page', async () => {
    const fetchPage = catalogue(500);

    const out = await collectPages(page(0, 30), 60, fetchPage);

    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.results).toHaveLength(30);
    expect(out.shortfall).toBeUndefined();
  });

  it('stops without comment on an empty page', async () => {
    const fetchPage = jest.fn(async () => page(30, 0, 60));

    const out = await collectPages(page(0, 30, 30), 60, fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(out.shortfall).toBeUndefined();
  });

  it('carries on after a page shorter than the first while a next page is named', async () => {
    // DuckDuckGo served 26 then 22 and still named s=60: a short page is not the last.
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(30, 22, 60))
      .mockResolvedValueOnce(page(60, 22));

    const out = await collectPages(page(0, 26, 30), 100, fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(out.results).toHaveLength(70);
  });
});

describe('duplicates', () => {
  it('drops a result already collected from an earlier page', async () => {
    // Page 2 repeats the last ten of page 1, then brings ten new ones.
    const fetchPage = jest.fn(async () => page(20, 20));

    const out = await collectPages(page(0, 30, 30), 40, fetchPage);

    const urls = out.results.map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toHaveLength(40);
  });

  it('treats the same article with different tracking parameters as one', async () => {
    const first = { vqd: VQD, results: [{ url: 'https://e.com/story?utm_source=ddg' }], nextOffset: 30 };
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

    const out = await collectPages(first, 1, jest.fn());

    expect(out.results).toHaveLength(2);
  });

  it('carries on past a page of nothing new while DuckDuckGo names another', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(0, 30, 60))
      .mockResolvedValueOnce(page(60, 30));

    const out = await collectPages(page(0, 30, 30), 60, fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(out.results).toHaveLength(60);
    expect(out.shortfall).toBeUndefined();
  });
});

describe('failures', () => {
  it('stops at a failed page, keeps what it has, and says why', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(30, 30, 60))
      .mockRejectedValueOnce(new Error('DuckDuckGo refused the news search request (HTTP 403).'));

    const out = await collectPages(page(0, 30, 30), 100, fetchPage);

    expect(out.results).toHaveLength(60);
    expect(out.shortfall).toEqual({
      reason: 'DuckDuckGo refused the news search request (HTTP 403).',
      transient: true,
    });
  });

  it('reports a first page that came without a token to page with', async () => {
    const fetchPage = catalogue(500);

    const out = await collectPages({ ...page(0, 30, 30), vqd: undefined }, 60, fetchPage);

    expect(fetchPage).not.toHaveBeenCalled();
    expect(out.shortfall).toEqual({
      reason: 'DuckDuckGo did not return a token to page with',
      transient: true,
    });
  });

  it('reports a thrown value that is not an Error', async () => {
    const fetchPage = jest.fn().mockRejectedValueOnce('socket hang up');

    const out = await collectPages(page(0, 30, 30), 60, fetchPage);

    expect(out.shortfall).toEqual({ reason: 'socket hang up', transient: true });
  });
});

describe('the debug callback', () => {
  it('is told each page and the offset it is asked for', async () => {
    const onPage = jest.fn();

    await collectPages(page(0, 30, 30), 90, catalogue(500), onPage);

    expect(onPage.mock.calls).toEqual([[2, 30], [3, 60]]);
  });
});
