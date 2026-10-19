/**
 * What a search failure looks like in the result item's `error` field.
 *
 * The node catches a failed Web, Image, News or Video search and returns the text
 * `parseApiError` makes of the thrown error. The README quotes that text, and the
 * example workflows branch on it, so the pair - the error the search helper throws
 * and the wording `parseApiError` gives it - is pinned here rather than each half on
 * its own. A reworded message in `directSearch.ts` that stops being recognised as a
 * rate limit fails here.
 */

jest.mock('axios');

import axios from 'axios';
import { directWebSearch, directImageSearch } from '../directSearch';
import { searchNews } from '../newsVideoSearch';
import { resetChallengeCooldown } from '../challengeCooldown';
import { parseApiError } from '../utils';
import { TEST_NODE } from './testNode';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const CHALLENGE_HTML = '<div id="anomaly-modal">Please complete the following challenge</div>';
const IMAGE_PAGE_HTML = 'vqd=3-123456789 some more content here';
const RATE_LIMIT = 'DuckDuckGo rate limit reached. Please wait before making more requests.';
const ACCESS_DENIED = 'Access denied. DuckDuckGo may have detected unusual search patterns.';

const httpError = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: '' } });

const itemError = async (operation: 'web search' | 'image search' | 'news search', run: () => Promise<unknown>) => {
  const error = await run().then(
    () => { throw new Error('the search did not fail'); },
    (e) => e,
  );
  return parseApiError(error, operation);
};

const web = () => directWebSearch(TEST_NODE, 'cats');
const image = () => directImageSearch(TEST_NODE, 'cats');
const news = () => searchNews('cats');

describe('the error field of a failed search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChallengeCooldown();
  });

  afterAll(() => resetChallengeCooldown());

  describe('rate limit (HTTP 429)', () => {
    it('web search names a rate limit', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(httpError(429));
      expect(await itemError('web search', web)).toBe(RATE_LIMIT);
    });

    it('image search names a rate limit', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML })
        .mockRejectedValueOnce(httpError(429));
      expect(await itemError('image search', image)).toBe(RATE_LIMIT);
    });
  });

  // News and Video do not throw on a status: they read it from the response and word the failure.
  describe('News Search', () => {
    it.each([[429, RATE_LIMIT], [403, ACCESS_DENIED], [400, 'Invalid search query or parameters. Please check your input and try again.']])(
      'HTTP %i on the results request',
      async (status, expected) => {
        mockedAxios.get = jest
          .fn()
          .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML })
          .mockResolvedValueOnce({ status, data: 'refused' });
        expect(await itemError('news search', news)).toBe(expected);
      },
    );

    it('HTTP 429 on the token page', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({ status: 429, data: 'slow down' });
      expect(await itemError('news search', news)).toBe(RATE_LIMIT);
    });
  });

  describe('access denied (HTTP 403)', () => {
    it('web search', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(httpError(403));
      expect(await itemError('web search', web)).toBe(ACCESS_DENIED);
    });

    it('web search, HTTP 400', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(httpError(400));
      expect(await itemError('web search', web)).toBe('Invalid search query or parameters. Please check your input and try again.');
    });

    it('image search', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: IMAGE_PAGE_HTML })
        .mockRejectedValueOnce(httpError(403));
      expect(await itemError('image search', image)).toBe(ACCESS_DENIED);
    });
  });

  describe('bot-detection challenge', () => {
    // The wording the README quotes, with what to do about it.
    const guidance = [
      'DuckDuckGo served a bot-detection challenge instead of results.',
      'typically for tens of minutes',
      'reduce how frequently this node runs',
    ];

    it('web search carries the guidance, without a prefix', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ status: 202, data: CHALLENGE_HTML });
      const message = await itemError('web search', web);
      guidance.forEach((part) => expect(message).toContain(part));
      expect(message).not.toMatch(/^Error during/);
    });

    it('image search carries the guidance, without a prefix', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 202, data: CHALLENGE_HTML });
      const message = await itemError('image search', image);
      guidance.forEach((part) => expect(message).toContain(part));
      expect(message).not.toMatch(/^Error during/);
    });

    it('the back-off after one says how long it lasts, in both searches', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ status: 202, data: CHALLENGE_HTML });
      await itemError('web search', web); // starts the back-off
      for (const [operation, run] of [['web search', web], ['image search', image]] as const) {
        const message = await itemError(operation, run);
        expect(message).toMatch(/^DuckDuckGo served a bot-detection challenge moments ago, so this request was not sent\./);
        expect(message).toMatch(/Requests resume automatically in \d+s;/);
      }
    });
  });

  // These keep the prefix; the README quotes the part after it.
  describe('other failures', () => {
    it('image search without a VQD token', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: '<html>nothing here</html>' });
      expect(await itemError('image search', image)).toBe(
        'Error during image search: Image search failed: DuckDuckGo image search token (VQD) could not be extracted. '
        + 'Image search may be temporarily unavailable. Please try again later.',
      );
    });

    it('web search whose page cannot be parsed', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: `<html>${'x'.repeat(2000)}</html>` });
      expect(await itemError('web search', web)).toBe(
        'Error during web search: DuckDuckGo web search response could not be parsed. '
        + 'The page structure may have changed. Please try again later.',
      );
    });

    it('web search server error', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(httpError(503));
      expect(await itemError('web search', web)).toBe('Error during web search: DuckDuckGo server error. Please try again later.');
    });
  });
});
