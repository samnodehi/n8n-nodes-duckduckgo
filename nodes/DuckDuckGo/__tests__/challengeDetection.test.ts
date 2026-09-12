/**
 * Unit tests for challengeDetection.ts and its integration into the search paths.
 *
 * Covers the failure this was written for: DuckDuckGo answers a blocked client
 * with a human-verification page served as HTTP 202, which axios accepts as a
 * success, which the parser then reads as "no results". The user saw an empty
 * result set and no error.
 */

jest.mock('axios');

import axios from 'axios';

import { isChallengePage, createChallengeError, assertNotChallenged } from '../challengeDetection';
import { DuckDuckGoError, DuckDuckGoErrorType, ErrorSeverity } from '../errors';
import { directWebSearch, directImageSearch } from '../directSearch';
import { fallbackWebSearch } from '../fallbackSearch';
import { TEST_NODE } from './testNode';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** DuckDuckGo's anti-bot challenge page, reduced to the markers that identify it. */
const CHALLENGE_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>DuckDuckGo</title>
<script src="/dist/anomaly.js"></script></head>
<body>
<div id="anomaly-modal" class="anomaly-modal">
  <div class="anomaly-modal__box">
    <p>Please complete the following challenge to confirm this search was made by a human.</p>
  </div>
</div>
</body></html>`;

/** A normal results page — must never be classified as a challenge. */
const RESULTS_HTML = `<!DOCTYPE html>
<html lang="en"><body><div id="links">
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a class="result__a" href="https://example.com/a">Example</a>
  </h2>
  <a class="result__snippet" href="https://example.com/a">Snippet text.</a>
</div>
</div></body></html>`;

/** Genuine empty result set: no result blocks and no challenge markers. */
const NO_RESULTS_HTML = `<!DOCTYPE html>
<html lang="en"><body><center id="lite_wrapper">
  <form id="search_form" action="/html/" method="post">
    <input type="text" name="q" value="xzqwerty99zz" />
  </form>
</center></body></html>`;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure detector
// ---------------------------------------------------------------------------

describe('isChallengePage', () => {
  it('detects the challenge page', () => {
    expect(isChallengePage(CHALLENGE_HTML)).toBe(true);
  });

  it.each([
    ['modal id', '<div id="anomaly-modal"></div>'],
    ['internal flag', '{"anomalyDetectionBlock":true}'],
    ['challenge script', '<script src="/anomaly.js"></script>'],
    ['bot_challenge flag', 'var page = "bot_challenge";'],
    ['challenge copy', 'confirm this search was made by a human'],
  ])('detects a challenge by its %s', (_label, body) => {
    expect(isChallengePage(body)).toBe(true);
  });

  it('matches markers regardless of case', () => {
    expect(isChallengePage('<DIV ID="ANOMALY-MODAL">')).toBe(true);
  });

  it('does not flag a normal results page', () => {
    expect(isChallengePage(RESULTS_HTML)).toBe(false);
  });

  it('does not flag a genuine no-results page', () => {
    expect(isChallengePage(NO_RESULTS_HTML)).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a parsed JSON object', { results: [] }],
  ])('returns false for %s', (_label, body) => {
    expect(isChallengePage(body)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------

describe('createChallengeError', () => {
  it('produces a typed, non-retryable error carrying the status code', () => {
    const error = createChallengeError('web search', 202);

    expect(error).toBeInstanceOf(DuckDuckGoError);
    expect(error.errorType).toBe(DuckDuckGoErrorType.BOT_CHALLENGE);
    expect(error.statusCode).toBe(202);
    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    // Retrying immediately would only add load to an IP that is already blocked.
    expect(error.isRetryable).toBe(false);
  });

  it('gives the user an actionable message', () => {
    const message = createChallengeError('web search').userMessage.toLowerCase();

    expect(message).toContain('bot-detection challenge');
    expect(message).toContain('ip address');
    expect(message).toContain('wait');
  });
});

describe('assertNotChallenged', () => {
  it('throws for a challenge page', () => {
    expect(() => assertNotChallenged(CHALLENGE_HTML, 202, 'web search')).toThrow(DuckDuckGoError);
  });

  it('is a no-op for anything else', () => {
    expect(() => assertNotChallenged(RESULTS_HTML, 200, 'web search')).not.toThrow();
    expect(() => assertNotChallenged(undefined, 200, 'web search')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration — the paths that previously failed silently
// ---------------------------------------------------------------------------

describe('directWebSearch challenge handling', () => {
  it('throws instead of returning an empty result set when challenged (HTTP 202)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 202, data: CHALLENGE_HTML });

    await expect(directWebSearch(TEST_NODE, 'anything')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
  });

  it('detects a challenge served with HTTP 200 as well', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 200, data: CHALLENGE_HTML });

    await expect(directWebSearch(TEST_NODE, 'anything')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
  });

  it('still returns an empty result set for a genuine HTTP 202 no-results page', async () => {
    // Regression guard: the challenge check must not turn a real empty result
    // set into an error, including when the page is large.
    mockedAxios.post.mockResolvedValueOnce({
      status: 202,
      data: NO_RESULTS_HTML + ' '.repeat(5000),
    });

    const output = await directWebSearch(TEST_NODE, 'xzqwerty99zz totally made up query');

    expect(output.results).toHaveLength(0);
  });

  it('does not misclassify a page that returns real results', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 200, data: RESULTS_HTML });

    const output = await directWebSearch(TEST_NODE, 'example');

    expect(output.results).toHaveLength(1);
  });
});

describe('directImageSearch challenge handling', () => {
  it('names the challenge rather than reporting a missing VQD token', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 202, data: CHALLENGE_HTML });

    await expect(directImageSearch(TEST_NODE, 'cats')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
  });

  it('reports a challenge served by i.js after the VQD page succeeded', async () => {
    // The bootstrap page answers normally and yields a token; the block lands
    // on the request that would have carried results.
    mockedAxios.get
      .mockResolvedValueOnce({ status: 200, data: '<script>vqd="3-123456789012345"</script>' })
      .mockResolvedValueOnce({ status: 202, data: CHALLENGE_HTML });

    await expect(directImageSearch(TEST_NODE, 'cats')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
  });

  it('reports a challenge on i.js even when the VQD page was skipped', async () => {
    // With a supplied token there is no bootstrap request at all, so this was
    // the path with no challenge check whatsoever.
    mockedAxios.get.mockResolvedValueOnce({ status: 202, data: CHALLENGE_HTML });

    await expect(
      directImageSearch(TEST_NODE, 'cats', {}, '3-supplied-token'),
    ).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
  });

  it('leaves a genuine empty image response reported as no results', async () => {
    // Parsed JSON is never a challenge page, so an honest empty answer must
    // still come back as an empty set rather than an error.
    mockedAxios.get
      .mockResolvedValueOnce({ status: 200, data: '<script>vqd="3-123456789012345"</script>' })
      .mockResolvedValueOnce({ status: 200, data: { results: [] } });

    const output = await directImageSearch(TEST_NODE, 'xzqwerty99zz');

    expect(output.results).toHaveLength(0);
  });
});

describe('fallbackWebSearch challenge handling', () => {
  it('reports a challenge instead of masquerading as "no results"', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 202, data: CHALLENGE_HTML });

    const response = await fallbackWebSearch('anything');

    expect(response.challenged).toBe(true);
    expect(response.success).toBe(false);
    expect(response.results).toHaveLength(0);
    expect(response.error).toContain('bot-detection challenge');
  });

  it('leaves a genuine empty result set reported as success', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 202, data: NO_RESULTS_HTML });

    const response = await fallbackWebSearch('xzqwerty99zz');

    expect(response.challenged).toBeUndefined();
    expect(response.success).toBe(true);
    expect(response.noResults).toBe(true);
  });
});
