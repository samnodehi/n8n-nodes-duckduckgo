/**
 * Removal of advertising click identifiers from result URLs.
 *
 * Two of the node's jobs are made harder by them. Deduplicating results across
 * runs compares URLs, and the same article carrying a different `utm_campaign`
 * on each fetch compares as a different page. And an AI Agent handed these URLs
 * pastes the tracking string into whatever it writes.
 *
 * The design is deliberately narrow. Only parameters whose sole purpose is
 * attribution are removed; the path, the fragment, the order of the surviving
 * parameters and every unrecognised parameter are left exactly as they were.
 * A URL with nothing to strip is returned as the identical string rather than
 * re-serialised, so `new URL()` cannot quietly change a URL — adding a trailing
 * slash, lowercasing a host, re-encoding a character — on a result that had no
 * tracking in it to begin with.
 *
 * The fragment is kept on purpose. It is tempting to drop, but for a search
 * node it carries meaning: `…/guide#install` and `…/guide#config` are different
 * results, and a single-page app puts its whole route after the `#`.
 */

/**
 * Exact parameter names to remove. Every entry is an advertising or email
 * campaign click identifier with no meaning to the destination page. Names that
 * some sites use as real parameters — `ref`, `source`, `id` — are deliberately
 * absent: a false positive here silently breaks a URL, which is far worse than
 * leaving a tracking parameter in place.
 */
const TRACKING_PARAMETERS: ReadonlySet<string> = new Set([
  'fbclid',    // Facebook
  'gclid',     // Google Ads
  'gbraid',    // Google Ads, app-to-web
  'wbraid',    // Google Ads, web-to-app
  'dclid',     // Google Display
  'msclkid',   // Microsoft Ads
  'twclid',    // X/Twitter
  'ttclid',    // TikTok
  'igshid',    // Instagram
  'yclid',     // Yandex
  'mc_cid',    // Mailchimp campaign
  'mc_eid',    // Mailchimp recipient
  '_hsenc',    // HubSpot
  '_hsmi',     // HubSpot
]);

/** Prefix covering the Urchin family: utm_source, utm_medium, utm_campaign, … */
const TRACKING_PREFIX = 'utm_';

function isTrackingParameter(name: string): boolean {
  const lowered = name.toLowerCase();
  return lowered.startsWith(TRACKING_PREFIX) || TRACKING_PARAMETERS.has(lowered);
}

/**
 * Return the URL without advertising click identifiers.
 *
 * Never throws and never returns an empty result for a non-empty input: a value
 * that does not parse, or is not http(s), is passed through untouched. Dropping
 * a result because its URL looked odd would be a worse failure than leaving the
 * URL as DuckDuckGo gave it.
 *
 * `null` and `undefined` are accepted and returned as they arrived, because
 * some result shapes carry an absent URL and the caller's own handling of that
 * must not change.
 */
export function stripTrackingParameters(
  url: string | null | undefined,
): string | null | undefined {
  if (!url) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return url;
  }

  const names = [...parsed.searchParams.keys()];
  const tracking = names.filter(isTrackingParameter);
  if (tracking.length === 0) {
    // Nothing to do, so hand back the original string rather than a
    // re-serialised equivalent.
    return url;
  }

  for (const name of tracking) {
    parsed.searchParams.delete(name);
  }

  // URL keeps a bare "?" when the last parameter is removed.
  return parsed.searchParams.toString() === ''
    ? parsed.toString().replace(/\?(?=#|$)/, '')
    : parsed.toString();
}
