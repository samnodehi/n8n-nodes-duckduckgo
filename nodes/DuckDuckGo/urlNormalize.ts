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

/**
 * Presigned-URL signatures. These cover the whole query, so removing any
 * parameter from a URL carrying one invalidates it — the link would still look
 * right and fail to authenticate. When one is present nothing is removed at all.
 *
 * Only vendor-namespaced names are listed, because they cannot mean anything
 * else. Azure's shared access signature is deliberately absent: it is spelled
 * `sig`, which plenty of ordinary URLs use for their own purposes, and treating
 * that as a signature would quietly switch this off for them. A signed Azure URL
 * in a search result therefore remains unhandled — accepted, because such URLs
 * expire in minutes and do not survive to be indexed.
 */
const SIGNATURE_PARAMETERS: ReadonlySet<string> = new Set([
  'x-amz-signature',   // AWS Signature Version 4
  'x-goog-signature',  // Google Cloud Storage
]);

function isTrackingParameter(name: string): boolean {
  const lowered = name.toLowerCase();
  return lowered.startsWith(TRACKING_PREFIX) || TRACKING_PARAMETERS.has(lowered);
}

/**
 * Decode a raw parameter name for comparison only. The result is never written
 * back, so a name that will not decode is compared as it was written.
 */
function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

/**
 * Return the URL without advertising click identifiers.
 *
 * The removal is string surgery on the original query rather than a rebuild
 * through `URLSearchParams`. Rebuilding re-encodes the parameters that survive
 * — `?q=a%20b` comes back as `?q=a+b`, `~` as `%7E` — which is a different URL
 * to a server that signs its query or distinguishes the two spellings.
 * Only the matching `name=value` segments are cut; every surviving byte is the
 * byte DuckDuckGo returned.
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

  // A "?" after the "#" belongs to the fragment — a single-page app route, for
  // instance — and is not a query at all.
  const hashAt = url.indexOf('#');
  const limit = hashAt === -1 ? url.length : hashAt;
  const queryAt = url.slice(0, limit).indexOf('?');
  if (queryAt === -1) {
    return url;
  }

  const head = url.slice(0, queryAt);
  const query = url.slice(queryAt + 1, limit);
  const tail = hashAt === -1 ? '' : url.slice(hashAt);

  const segments = query.split('&');
  const names = segments.map((segment) => {
    const equals = segment.indexOf('=');
    return decodeName(equals === -1 ? segment : segment.slice(0, equals)).toLowerCase();
  });

  if (names.some((name) => SIGNATURE_PARAMETERS.has(name))) {
    return url;
  }

  const kept = segments.filter((_segment, index) => !isTrackingParameter(names[index]));

  if (kept.length === segments.length) {
    // Nothing matched, so hand back the original string untouched.
    return url;
  }

  // A query of nothing but empty segments — what "?utm_source=x&" leaves behind
  // — is dropped with its "?". Keeping it would leave "https://example.com/?",
  // which compares as a different URL from "https://example.com/" and so
  // defeats the deduplication this exists for. Empty segments alongside a real
  // parameter are still kept, since there the query layout is the site's.
  const hasParameter = kept.some((segment) => segment !== '');
  return hasParameter ? `${head}?${kept.join('&')}${tail}` : head + tail;
}
