/**
 * Extraction of DuckDuckGo's VQD token from a search page.
 *
 * The VQD is a short-lived, query-bound token that image, news and video
 * requests must carry. DuckDuckGo does not publish it in a stable place: over
 * time the same token has appeared as a bare query parameter, as a quoted
 * attribute, and as a JSON property in an inline script. A single pattern is
 * therefore a single point of failure — when DuckDuckGo changes the surrounding
 * markup, extraction stops working even though the token is still present.
 *
 * Each known shape is tried in turn. All patterns capture the same token, so the
 * first match wins and order only affects which shape is preferred.
 */

/**
 * Known serialisations of the token, most specific first.
 *
 * The quoted and JSON forms are matched before the bare form so that a longer,
 * correctly delimited match is preferred over a prefix of it.
 */
const VQD_PATTERNS: readonly RegExp[] = [
  /"vqd"\s*:\s*"([\d-]+)"/,   // JSON property in an inline script
  /vqd=["']([\d-]+)["']/,      // quoted attribute or assignment
  /vqd=([\d-]+)&/,             // query parameter followed by another parameter
  /vqd=([\d-]+)/,              // bare query parameter (historical form)
];

/**
 * Return the VQD token found in a DuckDuckGo page, or null when none is present.
 *
 * Pure and side-effect free. Non-string input yields null so callers can pass a
 * response body straight through without narrowing it first.
 */
export function extractVqd(body: unknown): string | null {
  if (typeof body !== 'string' || body.length === 0) {
    return null;
  }

  for (const pattern of VQD_PATTERNS) {
    const match = pattern.exec(body);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
