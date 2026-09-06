/**
 * Outbound URL safety for the page-fetching features.
 *
 * `fetchPageContent` retrieves a caller-supplied URL, and the node is exposed to
 * AI agents (`usableAsTool`). An agent can be steered by injected text — including
 * text arriving inside the very search results this node returns — so the URL it
 * asks for must be treated as untrusted input rather than an operator decision.
 *
 * Without this guard the n8n host can be made to fetch addresses only it can
 * reach and hand the body back to the model, for example:
 *   http://127.0.0.1:5678/rest/...            (n8n's own API)
 *   http://169.254.169.254/latest/meta-data/  (cloud instance credentials)
 *   http://10.0.0.5/, http://192.168.1.1/     (internal services)
 *
 * The checks are literal-address based and therefore cannot be defeated by the
 * URL itself. They do NOT resolve DNS, so a hostname that resolves to a private
 * address (DNS rebinding) is out of scope — see PROJECT_PLAN.md.
 */

/** Hosts that always denote the local machine. */
const LOOPBACK_LITERALS = new Set(['localhost', '127.0.0.1', '::1', '0:0:0:0:0:0:0:1', '0.0.0.0', '::']);

/** Decimal dotted-quad, captured as four octets. */
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * True when an IPv4 address is not routable on the public internet.
 * Covers loopback, link-local (cloud metadata), the RFC 1918 ranges, the
 * carrier-grade NAT range, and "this network".
 */
function isPrivateIpv4(host: string): boolean {
  const match = IPV4_PATTERN.exec(host);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((o) => Number.isNaN(o) || o > 255)) return false;
  const [a, b] = octets;

  if (a === 0) return true;                        // 0.0.0.0/8   this network
  if (a === 10) return true;                       // 10.0.0.0/8  private
  if (a === 127) return true;                      // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;         // 169.254/16  link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12  private
  if (a === 192 && b === 168) return true;         // 192.168/16  private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  return false;
}

/**
 * True when an IPv6 literal is loopback, link-local, or unique-local.
 * The host arrives without its surrounding brackets.
 */
function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === '::1' || h === '::' || h === '0:0:0:0:0:0:0:1') return true;
  if (h.startsWith('fe80:')) return true;                       // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;                // fc00::/7 unique-local
  // IPv4-mapped (e.g. ::ffff:127.0.0.1) must be judged on the embedded address.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

/**
 * True when a hostname must not be fetched: a local name or a
 * non-publicly-routable literal address.
 */
export function isBlockedHost(hostname: string): boolean {
  // URL.hostname keeps IPv6 in brackets; compare the bare address.
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host.length === 0) return true;
  if (LOOPBACK_LITERALS.has(host)) return true;
  // RFC 6761 reserves the whole .localhost TLD for the local machine.
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(':') && isPrivateIpv6(host)) return true;
  return false;
}

/**
 * Validate a URL that is about to be fetched on the caller's behalf.
 *
 * @returns The reason it must not be fetched, or null when it is acceptable.
 */
export function getUrlBlockReason(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return 'No URL to fetch';
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Invalid URL';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `Refused to fetch a non-HTTP(S) URL (${parsed.protocol.replace(':', '')})`;
  }

  if (isBlockedHost(parsed.hostname)) {
    return 'Refused to fetch a private, loopback or link-local address';
  }

  return null;
}

/** Convenience wrapper for call sites that only need a yes/no answer. */
export function isFetchableUrl(rawUrl: unknown): boolean {
  return getUrlBlockReason(rawUrl) === null;
}
