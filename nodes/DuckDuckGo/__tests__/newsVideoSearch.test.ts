/**
 * News and Video requests, sent the way DuckDuckGo's own results page sends
 * them. Three things are pinned here: the request is the one that was served
 * live, results come out exactly as duck-duck-scrape shaped them, and no block
 * or broken answer is ever passed off as an empty result list.
 */

jest.mock('axios');
// duck-duck-scrape stays a dev dependency for one purpose: the parity test
// below runs its real mapping. needle is replaced so it cannot reach the network.
jest.mock('needle', () => ({ __esModule: true, default: jest.fn() }));

import axios from 'axios';
import { searchNews as libraryNews, searchVideos as libraryVideos } from 'duck-duck-scrape';
import { searchNews, searchVideos, mapNewsResult, mapVideoResult } from '../newsVideoSearch';
import { getRemainingCooldownMs, noteChallenge } from '../challengeCooldown';
import { DuckDuckGoError, DuckDuckGoErrorType } from '../errors';
import { SafeSearchLevel } from '../types';

const mockedGet = axios.get as jest.Mock;
// needle ships no types, so the mock is taken from the registry instead of imported.
const mockedNeedle = jest.requireMock('needle').default as jest.Mock;

const VQD = '4-142907716215351487660642192699445978524';
const VQD_PAGE = `<script>DDG.deep.initialize('/d.js?q=x&vqd="${VQD}"');</script>`;

/** DuckDuckGo's raw news JSON, with the entities and gaps the mapping must handle. */
const RAW_NEWS = {
  results: [
    {
      date: 1727100000,
      excerpt: 'Wind &amp; solar &#39;overtake&#39; coal&hellip; says the IEA&rsquo;s report',
      image: 'https://e.com/a.jpg',
      relative_time: '2 hours ago',
      syndicate: 'Example News',
      title: 'Renewables &#x2019;win&#x2019; &mdash; for now',
      url: 'https://e.com/a?utm_source=ddg',
      is_old: 1,
    },
    {
      date: 1727000000,
      excerpt: 'No image, no is_old',
      relative_time: '1 day ago',
      syndicate: 'Other',
      title: 'Plain title',
      url: 'https://e.com/b',
    },
  ],
  next: 'news.js?q=wind&l=wt-wt&o=json&p=1&s=30&df=a&vqd=' + VQD + '&noamp=1&u=bing',
};

const RAW_VIDEOS = {
  results: [
    {
      content: 'https://www.youtube.com/watch?v=abc',
      title: 'How turbines &amp; grids work',
      description: 'A &quot;primer&quot;&hellip;',
      images: { large: '', medium: 'https://i/m.jpg', small: 'https://i/s.jpg', motion: '' },
      duration: '12:34',
      publisher: 'YouTube',
      published: '2026-09-01T00:00:00.000Z',
      uploader: 'Energy Channel',
      statistics: { viewCount: 12345 },
    },
    {
      content: 'https://vimeo.com/1',
      title: 'Zero views',
      description: '',
      images: { large: 'https://i/l.jpg', medium: '', small: '', motion: '' },
      duration: '0:30',
      publisher: 'Vimeo',
      published: '2026-09-02T00:00:00.000Z',
      uploader: 'Someone',
      statistics: { viewCount: 0 },
    },
  ],
  next: 'v.js?q=wind&l=wt-wt&o=json&p=1&s=60&vqd=' + VQD,
};

const respond = (status: number, data: string) => ({ status, data, headers: {} });
const json = (body: unknown) => respond(200, JSON.stringify(body));
const requestedUrl = (call: number) => new URL(mockedGet.mock.calls[call][0]);
const requestedHeaders = (call: number) => mockedGet.mock.calls[call][1].headers;

beforeEach(() => {
  mockedGet.mockReset();
  mockedNeedle.mockReset();
});

describe('the mapping', () => {
  // The library checks for a two-dash token before using one, so the parity
  // runs give it one; the token has no part in the mapping.
  const LIBRARY_TOKEN = '3-123456789-98765432109876543210';

  it('is exactly what duck-duck-scrape produced, for news', async () => {
    mockedNeedle.mockResolvedValue({ statusCode: 200, body: JSON.stringify(RAW_NEWS) });

    const fromLibrary = await libraryNews('wind', { vqd: LIBRARY_TOKEN } as any);

    expect(RAW_NEWS.results.map(mapNewsResult)).toEqual(fromLibrary.results);
  });

  it('is exactly what duck-duck-scrape produced, for video', async () => {
    mockedNeedle.mockResolvedValue({ statusCode: 200, body: JSON.stringify(RAW_VIDEOS) });

    const fromLibrary = await libraryVideos('wind', { vqd: LIBRARY_TOKEN } as any);

    expect(RAW_VIDEOS.results.map(mapVideoResult)).toEqual(fromLibrary.results);
  });

  it('decodes every named, decimal and hex entity, not a short list', () => {
    const [first] = RAW_NEWS.results.map(mapNewsResult);

    expect(first.title).toBe('Renewables ’win’ — for now');
    expect(first.excerpt).toBe('Wind & solar \'overtake\' coal… says the IEA’s report');
  });

  it('does not throw on a video without images or statistics, as the library did', () => {
    const mapped = mapVideoResult({ content: 'https://e.com/v', title: 'x', description: '' });

    expect(mapped.url).toBe('https://e.com/v');
    expect(mapped.image).toBeUndefined();
    expect(mapped.viewCount).toBeUndefined();
  });
});

describe('the news request', () => {
  it('fetches a token from the results page, then asks for the page as that page would', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(202, VQD_PAGE))
      .mockResolvedValueOnce(json(RAW_NEWS));

    const page = await searchNews('wind power', {
      safeSearch: SafeSearchLevel.Strict,
      locale: 'de-de',
      time: 'w',
    });

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(requestedUrl(0).searchParams.get('ia')).toBe('news');

    const url = requestedUrl(1);
    expect(url.origin + url.pathname).toBe('https://duckduckgo.com/news.js');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      l: 'de-de', o: 'json', noamp: '1', q: 'wind power', vqd: VQD, p: '1', df: 'w', s: '0',
    });

    const headers = requestedHeaders(1);
    expect(headers.Referer).toBe(requestedUrl(0).toString());
    expect(headers['Sec-Fetch-Mode']).toBe('cors');
    expect(headers['Sec-Fetch-Site']).toBe('same-origin');
    expect(headers.Accept).toMatch(/^application\/json/);

    expect(page.vqd).toBe(VQD);
    expect(page.results).toHaveLength(2);
    expect(page.nextOffset).toBe(30);
  });

  it('sends Moderate and Off as DuckDuckGo expects them', async () => {
    mockedGet.mockResolvedValue(json({ results: [] }));

    await searchNews('q', { vqd: VQD, safeSearch: SafeSearchLevel.Moderate });
    await searchNews('q', { vqd: VQD, safeSearch: SafeSearchLevel.Off });

    expect(requestedUrl(0).searchParams.get('p')).toBe('-1');
    expect(requestedUrl(1).searchParams.get('p')).toBe('-2');
  });

  it('with a token already held, sends one request and asks for the offset given', async () => {
    mockedGet.mockResolvedValueOnce(json(RAW_NEWS));

    await searchNews('wind', { vqd: VQD, offset: 30, safeSearch: SafeSearchLevel.Strict, time: 'a' });

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(requestedUrl(0).searchParams.get('s')).toBe('30');
  });

  it('takes only the offset from `next`: the settings stay the node\'s own and nothing is fetched from it', async () => {
    // A `next` that tried to change the level, the region and the host.
    mockedGet.mockResolvedValueOnce(json({
      results: RAW_NEWS.results,
      next: 'https://elsewhere.example/news.js?q=other&p=-2&l=us-en&s=60',
    }));

    const page = await searchNews('wind', { vqd: VQD, offset: 30, safeSearch: SafeSearchLevel.Strict });

    expect(page.nextOffset).toBe(60);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(requestedUrl(0).host).toBe('duckduckgo.com');
    expect(requestedUrl(0).searchParams.get('p')).toBe('1');
  });

  it('names no next page when DuckDuckGo names none, or one that does not move forward', async () => {
    mockedGet
      .mockResolvedValueOnce(json({ results: RAW_NEWS.results }))
      .mockResolvedValueOnce(json({ results: RAW_NEWS.results, next: 'news.js?s=30' }));

    expect((await searchNews('q', { vqd: VQD })).nextOffset).toBeUndefined();
    expect((await searchNews('q', { vqd: VQD, offset: 30 })).nextOffset).toBeUndefined();
  });
});

describe('the video request', () => {
  it('sends the parameters duck-duck-scrape sent, with no video filters', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(200, VQD_PAGE))
      .mockResolvedValueOnce(json(RAW_VIDEOS));

    const page = await searchVideos('wind', { safeSearch: SafeSearchLevel.Strict, locale: 'wt-wt' });

    expect(requestedUrl(0).searchParams.get('ia')).toBe('videos');
    const url = requestedUrl(1);
    expect(url.pathname).toBe('/v.js');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      l: 'wt-wt', o: 'json', q: 'wind', vqd: VQD, p: '1', f: ',,,', s: '0',
    });
    expect(page.results[0].url).toBe('https://www.youtube.com/watch?v=abc');
    expect(page.nextOffset).toBe(60);
  });
});

describe('a block is never an empty result list', () => {
  const CHALLENGE = '<html><div id="anomaly-modal">Please complete the following challenge</div></html>';

  it.each([
    ['as HTTP 202', 202],
    ['as HTTP 200', 200],
    ['as HTTP 403', 403],
  ])('on the page request %s: reported as a challenge, and the back-off starts', async (_label, status) => {
    mockedGet.mockResolvedValueOnce(respond(status, CHALLENGE));

    const failure = searchNews('q', { vqd: VQD });

    await expect(failure).rejects.toBeInstanceOf(DuckDuckGoError);
    await expect(failure).rejects.toMatchObject({ errorType: DuckDuckGoErrorType.BOT_CHALLENGE });
    expect(getRemainingCooldownMs()).toBeGreaterThan(0);
  });

  it('on the token request: reported as a challenge too', async () => {
    mockedGet.mockResolvedValueOnce(respond(202, CHALLENGE));

    await expect(searchVideos('q')).rejects.toMatchObject({ errorType: DuckDuckGoErrorType.BOT_CHALLENGE });
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('a plain 403 is an error that names the status, not a challenge', async () => {
    mockedGet.mockResolvedValueOnce(respond(403, 'If this error persists, please let us know: ops@duckduckgo.com'));

    await expect(searchNews('q', { vqd: VQD })).rejects.toThrow('DuckDuckGo refused the news search request (HTTP 403).');
    expect(getRemainingCooldownMs()).toBe(0);
  });

  it('an answer that is not JSON, or has no results list, is an error', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(200, '<html>maintenance</html>'))
      .mockResolvedValueOnce(json({ answer: 'no list' }));

    await expect(searchNews('q', { vqd: VQD })).rejects.toThrow('something other than JSON');
    await expect(searchNews('q', { vqd: VQD })).rejects.toThrow('no results list');
  });

  it('a genuine empty answer is an empty list, not an error', async () => {
    mockedGet.mockResolvedValueOnce(json({ results: [] }));

    const page = await searchNews('q', { vqd: VQD });

    expect(page.results).toEqual([]);
    expect(page.noResults).toBe(true);
  });

  it('a token page without a token is an error that says so', async () => {
    mockedGet.mockResolvedValueOnce(respond(200, '<html>no token here</html>'));

    await expect(searchNews('q')).rejects.toThrow('did not return a search token for news search');
  });

  it('sends nothing during the back-off', async () => {
    noteChallenge();

    await expect(searchNews('q')).rejects.toMatchObject({ errorType: DuckDuckGoErrorType.BOT_CHALLENGE });
    expect(mockedGet).not.toHaveBeenCalled();
  });
});
