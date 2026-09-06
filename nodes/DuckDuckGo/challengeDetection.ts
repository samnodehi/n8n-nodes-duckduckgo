/**
 * Detection of DuckDuckGo's anti-bot challenge ("anomaly") page.
 *
 * When DuckDuckGo decides a client is automated it answers with a
 * human-verification page instead of results. Two properties make that
 * dangerous for an HTML client:
 *
 *   1. It is served with HTTP 202, which axios treats as success, so the page
 *      flows straight into the result parser.
 *   2. The parser simply finds no result blocks, so the caller sees an empty
 *      result set and no error — the failure is silent.
 *
 * The block is scoped to the requesting IP (not to the host), lasts tens of
 * minutes, and survives a change of User-Agent, so retrying immediately or
 * falling back to a sibling DuckDuckGo host only adds load. Callers should
 * surface it rather than mask it as "no results".
 *
 * Detection is applied only where parsing already yielded zero results. A
 * response that produced real results was self-evidently not a challenge, so
 * marker text appearing inside a result snippet can never trigger a false
 * positive.
 */

import { DuckDuckGoError, DuckDuckGoErrorType } from './errors';

/**
 * Substrings identifying the challenge page. Each is structural (element id,
 * script path, internal flag) or verbatim challenge copy; none occur in
 * ordinary result markup.
 */
const CHALLENGE_MARKERS: readonly string[] = [
  'anomaly-modal',
  'anomalydetectionblock',
  'anomaly.js',
  'bot_challenge',
  'confirm this search was made by a human',
  'please complete the following challenge',
];

/**
 * True when a response body is DuckDuckGo's challenge page.
 *
 * Pure and side-effect free. Non-string bodies (e.g. parsed JSON) are never
 * challenge pages and return false.
 */
export function isChallengePage(body: unknown): boolean {
  if (typeof body !== 'string' || body.length === 0) {
    return false;
  }
  const haystack = body.toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => haystack.includes(marker));
}

/**
 * Build the error used for a detected challenge. Centralised so the wording
 * stays identical wherever a challenge surfaces.
 *
 * @param operation - Human-readable operation name, used in the technical message.
 * @param statusCode - HTTP status the challenge arrived with (typically 202).
 */
export function createChallengeError(operation: string, statusCode?: number): DuckDuckGoError {
  return new DuckDuckGoError(
    `DuckDuckGo returned a bot-detection challenge instead of ${operation} results.`,
    DuckDuckGoErrorType.BOT_CHALLENGE,
    { statusCode },
  );
}

/**
 * Throw a descriptive error when the body is a challenge page; otherwise do
 * nothing. Call this at the point where zero results were parsed.
 */
export function assertNotChallenged(
  body: unknown,
  statusCode: number | undefined,
  operation: string,
): void {
  if (isChallengePage(body)) {
    throw createChallengeError(operation, statusCode);
  }
}
