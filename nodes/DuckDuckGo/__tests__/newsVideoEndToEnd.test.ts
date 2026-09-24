/**
 * News and Video through the node's own execute(), with only the network
 * replaced. Every other node-level test mocks newsVideoSearch wholesale, so
 * this is the one place the node's settings, the real request module and the
 * paging meet - and where the request count at default settings is pinned.
 */

jest.mock('axios');

import axios from 'axios';
import { DuckDuckGo } from '../DuckDuckGo.node';
import { getRemainingCooldownMs } from '../challengeCooldown';

const mockedGet = axios.get as jest.Mock;

const VQD = '4-142907716215351487660642192699445978524';
const VQD_PAGE = `<script>DDG.deep.initialize('/d.js?q=x&vqd="${VQD}"');</script>`;
const CHALLENGE = '<html><div id="anomaly-modal">Please complete the following challenge</div></html>';

const respond = (status: number, data: string) => ({ status, data, headers: {} });

/** A raw news.js answer: `count` articles numbered from `from`, naming `next` if given. */
const newsJs = (from: number, count: number, next?: number) => respond(200, JSON.stringify({
  results: Array.from({ length: count }, (_, i) => ({
    date: 1727100000,
    excerpt: `Excerpt ${from + i} &amp; more`,
    image: 'https://e.com/i.jpg',
    relative_time: '1 hour ago',
    syndicate: 'Example',
    title: `Article ${from + i}`,
    url: `https://e.com/a${from + i}`,
  })),
  ...(next !== undefined ? { next: `news.js?q=x&s=${next}&vqd=${VQD}` } : {}),
}));

const vJs = (count: number) => respond(200, JSON.stringify({
  results: Array.from({ length: count }, (_, i) => ({
    content: `https://e.com/v${i}`,
    title: `Video ${i}`,
    description: 'd',
    images: { large: 'https://e.com/l.jpg' },
    duration: '1:00',
    publisher: 'YouTube',
    published: '',
    uploader: 'someone',
    statistics: { viewCount: 5 },
  })),
}));

const run = (operation: string, options: Record<string, unknown> = {}) => {
  const ctx = {
    getInputData: () => [{ json: {} }],
    getNode: () => ({ id: 'n', name: 'DuckDuckGo', type: 't', typeVersion: 1, position: [0, 0], parameters: {} }),
    continueOnFail: () => true,
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    addExecutionHints: jest.fn(),
    helpers: {
      returnJsonArray: (items: any[]) => items.map((json: any, item: number) => ({ json, pairedItem: { item } })),
    },
    getNodeParameter: (name: string, _i: number, fallback?: unknown) => {
      if (name === 'operation') return operation;
      if (name === 'newsQuery' || name === 'videoQuery') return 'wind power';
      if (name === 'newsSearchOptions' || name === 'videoSearchOptions') return options;
      if (name === 'cacheSettings') return { enableCache: false };
      if (name === 'errorHandling') return 'continueOnFail';
      if (name === 'debugMode') return false;
      return fallback;
    },
  };
  return (new DuckDuckGo().execute as any).call(ctx);
};

const url = (call: number) => new URL(mockedGet.mock.calls[call][0]);

beforeEach(() => {
  mockedGet.mockReset();
});

describe('News at default settings', () => {
  it('costs two requests, sends the node\'s defaults, and returns mapped results', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(202, VQD_PAGE))
      .mockResolvedValueOnce(newsJs(0, 30, 30));

    const out = await run('searchNews');

    expect(mockedGet).toHaveBeenCalledTimes(2);
    // Strict and all time are the node's defaults; DuckDuckGo takes them as p=1 and df=a.
    expect(url(1).searchParams.get('p')).toBe('1');
    expect(url(1).searchParams.get('df')).toBe('a');
    expect(url(1).searchParams.get('l')).toBe('wt-wt');
    expect(out[0]).toHaveLength(10);
    expect(out[0][0].json.description).toBe('Excerpt 0 & more');
  });
});

describe('News asked for more than one page holds', () => {
  it('asks for the page DuckDuckGo names next, with the same settings, and drops repeats', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(202, VQD_PAGE))
      .mockResolvedValueOnce(newsJs(0, 26, 30))
      // Page 2 repeats the last six of page 1, as DuckDuckGo's did live.
      .mockResolvedValueOnce(newsJs(20, 22, 60));

    const out = await run('searchNews', { maxResults: 40, safeSearch: -1, region: 'de-de' });

    expect(mockedGet).toHaveBeenCalledTimes(3);
    expect(url(2).searchParams.get('s')).toBe('30');
    expect(url(2).searchParams.get('vqd')).toBe(VQD);
    expect(url(2).searchParams.get('p')).toBe('-1');
    expect(url(2).searchParams.get('l')).toBe('de-de');
    const urls = out[0].map((item: any) => item.json.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toHaveLength(40);
  });
});

describe('Video at default settings', () => {
  it('costs two requests and returns mapped results', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(200, VQD_PAGE))
      .mockResolvedValueOnce(vJs(12));

    const out = await run('searchVideos');

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(url(1).pathname).toBe('/v.js');
    expect(out[0]).toHaveLength(10);
    expect(out[0][0].json.url).toBe('https://e.com/v0');
  });
});

describe('a block on the News request', () => {
  it('starts the back-off and sends no fallback request into it', async () => {
    mockedGet
      .mockResolvedValueOnce(respond(200, VQD_PAGE))
      .mockResolvedValueOnce(respond(202, CHALLENGE));

    const out = await run('searchNews');

    // Token and page only: the fallback saw the back-off and sent nothing.
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(getRemainingCooldownMs()).toBeGreaterThan(0);
    expect(out[0][0].json.success).toBe(false);
  });
});
