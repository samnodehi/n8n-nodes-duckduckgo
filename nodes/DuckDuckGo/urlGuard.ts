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
 * Expand an IPv6 literal to its eight 16-bit groups.
 *
 * Matching IPv6 as text does not work here. `new URL()` normalises every literal
 * before `.hostname` returns it, and the normal form is lower-case hex with the
 * longest zero run compressed — so `[::ffff:169.254.169.254]` arrives as
 * `::ffff:a9fe:a9fe`, and a pattern written against the dotted-quad spelling
 * never matches. Comparing numbers avoids the whole class of spelling bugs.
 *
 * @returns The eight groups, or null when the literal cannot be parsed.
 */
function ipv6Groups(host: string): number[] | null {
  let text = host;

  // A trailing dotted-quad (::ffff:127.0.0.1) is two groups written in decimal.
  const embedded = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (embedded) {
    const octets = embedded[2].split('.').map(Number);
    if (octets.some((o) => Number.isNaN(o) || o > 255)) return null;
    const hi = (octets[0] << 8) | octets[1];
    const lo = (octets[2] << 8) | octets[3];
    text = `${embedded[1]}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parse = (part: string): number[] | null => {
    if (part === '') return [];
    const out: number[] = [];
    for (const group of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      out.push(parseInt(group, 16));
    }
    return out;
  };

  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (head === null || tail === null) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const gap = 8 - head.length - tail.length;
  if (gap < 1) return null;
  return [...head, ...new Array(gap).fill(0), ...tail];
}

/** Render the last two groups of an IPv6 address as a dotted-quad. */
function embeddedIpv4(groups: number[]): string {
  const [hi, lo] = groups.slice(6);
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/**
 * True when an IPv6 literal is loopback, link-local, unique-local, or carries an
 * embedded IPv4 address that is itself private. The host arrives without its
 * surrounding brackets.
 */
function isPrivateIpv6(host: string): boolean {
  const groups = ipv6Groups(host.toLowerCase());
  if (!groups) return false;

  const [first] = groups;
  if (groups.every((g) => g === 0)) return true;                     // ::
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
  if (first >= 0xfe80 && first <= 0xfebf) return true;               // fe80::/10 link-local
  if (first >= 0xfc00 && first <= 0xfdff) return true;               // fc00::/7  unique-local

  // Three ways an IPv4 address rides inside an IPv6 one. Each must be judged on
  // the address it carries, or the v4 rules above can be stepped around by
  // spelling the same host in v6.
  const prefix = groups.slice(0, 6);
  const isMapped = prefix.slice(0, 5).every((g) => g === 0) && prefix[5] === 0xffff; // ::ffff:a.b.c.d
  const isCompat = prefix.every((g) => g === 0);                                     // ::a.b.c.d
  const isNat64 = prefix[0] === 0x64 && prefix[1] === 0xff9b && prefix.slice(2).every((g) => g === 0);
  if (isMapped || isCompat || isNat64) return isPrivateIpv4(embeddedIpv4(groups));

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
