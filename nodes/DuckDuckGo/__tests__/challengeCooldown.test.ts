/**
 * Unit tests for challengeCooldown.ts and its effect on the request paths.
 *
 * After DuckDuckGo serves a challenge, further requests are wasted: the block
 * follows the IP, lasts tens of minutes, and every extra request prolongs it.
 * The back-off makes the node fail fast locally instead of sending them.
 */

jest.mock('axios');

import axios from 'axios';

import {
  CHALLENGE_COOLDOWN_MS,
  getCooldownReason,
  getRemainingCooldownMs,
  noteChallenge,
  resetChallengeCooldown,
} from '../challengeCooldown';
import { createChallengeError } from '../challengeDetection';
import { DuckDuckGoErrorType } from '../errors';
import { directWebSearch, directImageSearch } from '../directSearch';
import { fallbackWebSearch } from '../fallbackSearch';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const CHALLENGE_HTML =
  '<div id="anomaly-modal">Please complete the following challenge</div>';

beforeEach(() => {
  jest.clearAllMocks();
  resetChallengeCooldown();
});

describe('challengeCooldown', () => {
  it('reports no back-off when nothing has happened', () => {
    expect(getRemainingCooldownMs()).toBe(0);
    expect(getCooldownReason()).toBeNull();
  });

  it('starts a back-off window when a challenge is noted', () => {
    const now = 1_000_000;
    noteChallenge(now);

    expect(getRemainingCooldownMs(now)).toBe(CHALLENGE_COOLDOWN_MS);
    expect(getRemainingCooldownMs(now + 10_000)).toBe(CHALLENGE_COOLDOWN_MS - 10_000);
  });

  it('expires exactly at the end of the window', () => {
    const now = 1_000_000;
    noteChallenge(now);

    expect(getRemainingCooldownMs(now + CHALLENGE_COOLDOWN_MS - 1)).toBe(1);
    expect(getRemainingCooldownMs(now + CHALLENGE_COOLDOWN_MS)).toBe(0);
    expect(getCooldownReason(now + CHALLENGE_COOLDOWN_MS)).toBeNull();
  });

  it('explains the wait in seconds, and says requests resume by themselves', () => {
    const now = 1_000_000;
    noteChallenge(now);

    const reason = getCooldownReason(now + 30_000) as string;
    expect(reason).toContain('30s');
    expect(reason).toContain('was not sent');
    expect(reason.toLowerCase()).toContain('ip address');
  });

  it('is started by creating a challenge error, wherever that happens', () => {
    expect(getRemainingCooldownMs()).toBe(0);

    createChallengeError('web search', 202);

    expect(getRemainingCooldownMs()).toBeGreaterThan(0);
  });
});

describe('request paths during the back-off', () => {
  it('web search fails fast without sending a request', async () => {
    noteChallenge();

    await expect(directWebSearch('anything')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('image search fails fast without sending a request', async () => {
    noteChallenge();

    await expect(directImageSearch('cats')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('the fallback path reports it without sending a request', async () => {
    noteChallenge();

    const response = await fallbackWebSearch('anything');

    expect(response.challenged).toBe(true);
    expect(response.success).toBe(false);
    expect(response.error).toContain('was not sent');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('a challenge on one path stops the next request on another', async () => {
    // The block follows the IP, so a challenge seen by web search must also
    // hold back the fallback path — this is what stopped the amplification.
    mockedAxios.post.mockResolvedValueOnce({ status: 202, data: CHALLENGE_HTML });

    await expect(directWebSearch('anything')).rejects.toMatchObject({
      errorType: DuckDuckGoErrorType.BOT_CHALLENGE,
    });

    const response = await fallbackWebSearch('anything');
    expect(response.challenged).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('requests resume once the window has passed', async () => {
    noteChallenge(Date.now() - CHALLENGE_COOLDOWN_MS - 1);
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: `<div class="result results_links"><h2 class="result__title">
        <a class="result__a" href="https://example.com/a">Example</a></h2>
        <a class="result__snippet" href="https://example.com/a">Snippet.</a></div>`,
    });

    const output = await directWebSearch('anything');

    expect(output.results).toHaveLength(1);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
