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
 * Two layers. `isBlockedHost` judges the name or literal address in the URL, and
 * in every redirect hop, without any DNS lookup: local names, names that only
 * resolve inside a network (one label, .local, .internal, ...) and literal
 * addresses that are not public. `createGuardedLookup` judges what a public
 * looking name resolves to, at the moment the socket connects, so a name that
 * points at a private address (or is re-pointed after the first check) is
 * refused as well.
 */

import * as dns from 'dns';

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
  if (a === 192 && b === 0 && octets[2] === 0) return true;   // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && octets[2] === 2) return true;   // 192.0.2.0/24 documentation
  if (a === 198 && (b === 18 || b === 19)) return true;       // 198.18/15 benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return true; // 198.51.100.0/24 documentation
  if (a === 203 && b === 0 && octets[2] === 113) return true;  // 203.0.113.0/24 documentation
  if (a >= 224) return true;                       // 224/4 multicast, 240/4 reserved, broadcast
  if (a === 168 && b === 63 && octets[2] === 129 && octets[3] === 16) return true; // 168.63.129.16 Azure WireServer
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
  // A zone id ("fe80::1%eth0") names an interface: it makes the address a
  // local one, and the address itself is judged without it.
  const groups = ipv6Groups(host.toLowerCase().replace(/%.*$/, ''));
  // Not an address at all: it cannot be a public one, so it is not fetched.
  if (!groups) return true;

  const [first] = groups;
  if (groups.every((g) => g === 0)) return true;                     // ::
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
  if (first >= 0xfe80 && first <= 0xfebf) return true;               // fe80::/10 link-local
  if (first >= 0xfc00 && first <= 0xfdff) return true;               // fc00::/7  unique-local
  if (first >= 0xff00) return true;                                  // ff00::/8  multicast
  if (first >= 0xfec0 && first <= 0xfeff) return true;               // fec0::/10 site-local (deprecated)
  if (first === 0x0100 && groups.slice(0, 4).every((g, i) => i === 0 || g === 0)) return true; // 100::/64 discard-only
  if (first === 0x3fff && groups[1] < 0x1000) return true;           // 3fff::/20 documentation
  if (first === 0x2001 && groups[1] === 0x0002 && groups[2] === 0) return true; // 2001:2::/48 benchmarking
  if (first === 0x2001 && groups[1] === 0) return true;              // 2001::/32 Teredo
  if (first === 0x2001 && groups[1] === 0x0db8) return true;         // 2001:db8::/32 documentation
  if (first === 0x0064 && groups[1] === 0xff9b && groups[2] === 1) return true; // 64:ff9b:1::/48 local-use NAT64
  // 6to4 (2002::/16) carries an IPv4 address in the next two groups
  if (first === 0x2002) return isPrivateIpv4(`${groups[1] >> 8}.${groups[1] & 0xff}.${groups[2] >> 8}.${groups[2] & 0xff}`);

  // Three ways an IPv4 address rides inside an IPv6 one. Each must be judged on
  // the address it carries, or the v4 rules above can be stepped around by
  // spelling the same host in v6.
  const prefix = groups.slice(0, 6);
  const isMapped = prefix.slice(0, 5).every((g) => g === 0) && prefix[5] === 0xffff; // ::ffff:a.b.c.d
  const isCompat = prefix.every((g) => g === 0);                                     // ::a.b.c.d
  const isNat64 = prefix[0] === 0x64 && prefix[1] === 0xff9b && prefix.slice(2).every((g) => g === 0);
  // ::ffff:0:a.b.c.d (IPv4-translated, SIIT) carries the address in the last two groups as well
  const isTranslated = groups.slice(0, 4).every((g) => g === 0) && groups[4] === 0xffff && groups[5] === 0;
  if (isMapped || isCompat || isNat64 || isTranslated) return isPrivateIpv4(embeddedIpv4(groups));

  return false;
}

/**
 * Name endings that only resolve inside a network, never on the public
 * internet: RFC 6761 / 6762 / 8375 names and the endings that Docker,
 * Kubernetes, home routers and corporate networks use.
 */
const INTERNAL_SUFFIXES = [
  '.localhost', '.local', '.internal', '.lan', '.localdomain', '.home.arpa',
  '.svc', '.cluster.local', '.intranet', '.corp', '.home',
];

/**
 * True when a hostname must not be fetched: a local name, a name that only
 * resolves inside a network, or a non-publicly-routable literal address.
 */
export function isBlockedHost(hostname: string): boolean {
  // URL.hostname keeps IPv6 in brackets; compare the bare address. A fully
  // qualified name may end in a dot ("localhost." is localhost), which would
  // step around every comparison below.
  let host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  while (host.endsWith('.')) host = host.slice(0, -1);
  if (host.length === 0) return true;
  if (LOOPBACK_LITERALS.has(host)) return true;
  if (host.includes(':')) return isPrivateIpv6(host);
  if (isPrivateIpv4(host)) return true;
  // One label ("n8n", "redis", "printer") is a name from the local network, a
  // Docker service or a hosts file entry: never a public site.
  if (!host.includes('.')) return true;
  return INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix) || host === suffix.slice(1));
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;
type LookupFunction = (hostname: string, options: dns.LookupOptions | number | undefined, callback: LookupCallback) => void;

/**
 * A `lookup` function for http.Agent / https.Agent that refuses a connection
 * when the name resolves to an address that is not public (any one of the
 * answers is enough). It runs when the socket is opened, for the first request
 * and for every redirect, so a public-looking name that points at an internal
 * address, or is re-pointed after the URL was checked, cannot reach it. The
 * resolver is a parameter so that it can be replaced in tests.
 */
export function createGuardedLookup(resolve: LookupFunction = dns.lookup as unknown as LookupFunction): LookupFunction {
  return (hostname, options, callback) => {
    const lookupOptions = typeof options === 'object' && options !== null ? options : {};
    resolve(hostname, options, (error, address, family) => {
      if (error) return callback(error, address, family);
      const answers: string[] = Array.isArray(address) ? address.map((a) => a.address) : [String(address)];
      const blocked = answers.find((a) => isBlockedHost(a));
      if (blocked !== undefined) {
        const refusal: NodeJS.ErrnoException = new Error('Refused to connect to a private, loopback or link-local address');
        refusal.code = 'ERR_BLOCKED_ADDRESS';
        return callback(refusal, lookupOptions.all ? [] : '', undefined);
      }
      return callback(null, address, family);
    });
  };
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
