/**
 * Unit tests for urlGuard.ts and its enforcement inside fetchPageContent.
 *
 * The node is exposed to AI agents (usableAsTool) and fetches a caller-supplied
 * URL, so the URL is untrusted input. Without the guard the n8n host could be
 * made to read addresses only it can reach — its own API, cloud metadata, or
 * internal services — and hand the body back to the model.
 */

jest.mock('axios');

import axios from 'axios';
import { Readable } from 'stream';

import { isBlockedHost, getUrlBlockReason, isFetchableUrl, createGuardedLookup } from '../urlGuard';
import { fetchPageContent } from '../pageContent';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Page bodies are read as a stream, as axios delivers them with responseType stream.
const bodyOf = (html: string) => Readable.from([Buffer.from(html)]);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isBlockedHost', () => {
  it.each([
    ['localhost', 'localhost'],
    ['a .localhost subdomain (RFC 6761)', 'api.localhost'],
    ['IPv4 loopback', '127.0.0.1'],
    ['anywhere in 127.0.0.0/8', '127.1.2.3'],
    ['IPv6 loopback', '::1'],
    ['bracketed IPv6 loopback', '[::1]'],
    ['unspecified address', '0.0.0.0'],
    ['cloud metadata', '169.254.169.254'],
    ['RFC1918 10/8', '10.0.0.5'],
    ['RFC1918 172.16/12', '172.20.10.1'],
    ['RFC1918 192.168/16', '192.168.1.1'],
    ['CGNAT 100.64/10', '100.100.0.1'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 unique-local', 'fd00::1'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
  ])('blocks %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    ['a normal domain', 'example.com'],
    ['a subdomain', 'en.wikipedia.org'],
    ['a public IPv4', '8.8.8.8'],
    ['172.15 (just outside RFC1918)', '172.15.0.1'],
    ['172.32 (just outside RFC1918)', '172.32.0.1'],
    ['a public IPv6', '2606:4700:4700::1111'],
  ])('allows %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe('IPv6 spellings of a private address', () => {
  // These go through a real URL rather than calling isBlockedHost with a
  // hand-written host, because that is where the bug was. `new URL()`
  // normalises every IPv6 literal before `.hostname` returns it - the longest
  // zero run is compressed and the embedded IPv4 octets become hex - so
  // `[::ffff:169.254.169.254]` arrives as `::ffff:a9fe:a9fe`. A guard written
  // against the dotted spelling matched a string the parser never produces, and
  // the cloud metadata address was reachable in 32.15.0 and earlier.
  it.each([
    ['IPv4-mapped cloud metadata', 'http://[::ffff:169.254.169.254]/latest/meta-data/'],
    ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/'],
    ['IPv4-mapped RFC1918', 'http://[::ffff:10.0.0.5]/'],
    ['IPv4-mapped 192.168', 'http://[::ffff:192.168.1.1]/'],
    ['IPv4-compatible loopback', 'http://[::127.0.0.1]/'],
    ['NAT64-embedded metadata', 'http://[64:ff9b::169.254.169.254]/'],
    ['plain loopback', 'http://[::1]/'],
    ['link-local at the bottom of the range', 'http://[fe80::1]/'],
    ['link-local at the top of the range', 'http://[febf::1]/'],
    ['link-local mid-range', 'http://[feb0::1]/'],
    ['unique-local fc00', 'http://[fc00::1]/'],
    ['unique-local fd00', 'http://[fd00::1]/'],
  ])('blocks %s', (_label, url) => {
    expect(isFetchableUrl(url)).toBe(false);
  });

  it.each([
    ['a public IPv6', 'http://[2001:4860:4860::8888]/'],
    ['an IPv4-mapped PUBLIC address', 'http://[::ffff:8.8.8.8]/'],
    ['a public IPv6 with a full-length spelling', 'http://[2606:4700:4700:0:0:0:0:1111]/'],
  ])('allows %s', (_label, url) => {
    expect(isFetchableUrl(url)).toBe(true);
  });

  it('treats a literal that is not an address as blocked, since it cannot be a public one', () => {
    // Nonsense must not throw, and it is not fetched: it cannot be a public address.
    expect(isBlockedHost('not:an:address:at:all:zz')).toBe(true);
  });
});

describe('getUrlBlockReason', () => {
  it('accepts ordinary http and https URLs', () => {
    expect(getUrlBlockReason('https://example.com/article')).toBeNull();
    expect(getUrlBlockReason('http://example.com/article')).toBeNull();
    expect(isFetchableUrl('https://example.com')).toBe(true);
  });

  it.each([
    ['file', 'file:///etc/passwd'],
    ['data', 'data:text/html,<h1>hi</h1>'],
    ['ftp', 'ftp://example.com/x'],
    ['javascript', 'javascript:alert(1)'],
  ])('refuses the %s scheme', (_label, url) => {
    expect(getUrlBlockReason(url)).toContain('non-HTTP(S)');
  });

  it.each([
    ["n8n's own API", 'http://127.0.0.1:5678/rest/workflows'],
    ['cloud instance metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['an internal service', 'http://192.168.1.1/admin'],
    ['localhost by name', 'http://localhost:5678/'],
  ])('refuses %s', (_label, url) => {
    expect(getUrlBlockReason(url)).toContain('private, loopback or link-local');
  });

  it.each([
    ['a missing URL', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['a non-string', 42],
  ])('rejects %s', (_label, url) => {
    expect(getUrlBlockReason(url)).toBe('No URL to fetch');
  });

  it('rejects an unparseable URL', () => {
    expect(getUrlBlockReason('not a url')).toBe('Invalid URL');
  });
});

describe('fetchPageContent URL enforcement', () => {
  it('refuses a loopback URL without making a request', async () => {
    const result = await fetchPageContent('http://127.0.0.1:5678/rest/workflows');

    expect(result.content).toBe('');
    expect(result.error).toContain('private, loopback or link-local');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('refuses the cloud metadata address without making a request', async () => {
    const result = await fetchPageContent('http://169.254.169.254/latest/meta-data/');

    expect(result.error).toContain('private, loopback or link-local');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('refuses a non-HTTP scheme without making a request', async () => {
    const result = await fetchPageContent('file:///etc/passwd');

    expect(result.error).toContain('non-HTTP(S)');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('still fetches an ordinary public URL', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: bodyOf(`<html><body><article>
        <p>A sufficiently long article paragraph so that the extractor treats this as
        real content rather than boilerplate navigation, with enough words to pass the
        minimum length threshold used before trusting the parsed result.</p>
        <p>A second paragraph keeps the extracted article comfortably above that
        threshold so the assertion below is stable.</p>
      </article></body></html>`),
    });

    const result = await fetchPageContent('https://example.com/article');

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('registers a beforeRedirect hook that rejects a private redirect target', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: bodyOf('<html><body><p>ok</p></body></html>'),
    });

    await fetchPageContent('https://example.com/article');

    const config = mockedAxios.get.mock.calls[0][1] as any;
    expect(typeof config.beforeRedirect).toBe('function');

    // A redirect to an internal address must abort the chain.
    expect(() => config.beforeRedirect({ protocol: 'http:', hostname: '169.254.169.254' }))
      .toThrow(/Refused to follow a redirect/);
    expect(() => config.beforeRedirect({ protocol: 'http:', hostname: '127.0.0.1' }))
      .toThrow(/Refused to follow a redirect/);
    // A redirect to another public host is fine.
    expect(() => config.beforeRedirect({ protocol: 'https:', hostname: 'example.org' }))
      .not.toThrow();
  });

  it('rejects a redirect target spelled as IPv4-mapped IPv6', async () => {
    // follow-redirects builds the target with the native URL class, so the
    // hostname reaches the hook in the same hex-compressed form that defeated
    // the guard on the initial URL. The redirect path carried the identical
    // bypass and is covered by the same fix.
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: bodyOf('<html><body><p>ok</p></body></html>'),
    });

    await fetchPageContent('https://example.com/article');
    const config = mockedAxios.get.mock.calls[0][1] as any;

    const hostnameOf = (url: string) => new URL(url).hostname;
    expect(hostnameOf('http://[::ffff:169.254.169.254]/')).toBe('[::ffff:a9fe:a9fe]');

    expect(() =>
      config.beforeRedirect({
        protocol: 'http:',
        hostname: hostnameOf('http://[::ffff:169.254.169.254]/'),
      }),
    ).toThrow(/Refused to follow a redirect/);

    expect(() =>
      config.beforeRedirect({
        protocol: 'http:',
        hostname: hostnameOf('http://[::ffff:127.0.0.1]/'),
      }),
    ).toThrow(/Refused to follow a redirect/);

    // A public address in the same notation must still be followed.
    expect(() =>
      config.beforeRedirect({
        protocol: 'http:',
        hostname: hostnameOf('http://[::ffff:8.8.8.8]/'),
      }),
    ).not.toThrow();
  });
});

describe('names that only resolve inside a network', () => {
  it.each([
    ['localhost with a trailing dot', 'localhost.'],
    ['a .localhost name with a trailing dot', 'foo.localhost.'],
    ['a Docker service name', 'n8n'],
    ['another one-label name', 'redis'],
    ['a one-label name with a trailing dot', 'printer.'],
    ['mDNS .local', 'printer.local'],
    ['.internal (cloud and Docker)', 'metadata.google.internal'],
    ['host.docker.internal', 'host.docker.internal'],
    ['.lan', 'router.lan'],
    ['.localdomain', 'box.localdomain'],
    ['.home.arpa', 'nas.home.arpa'],
    ['a Kubernetes service name', 'api.default.svc'],
    ['a Kubernetes cluster name', 'api.default.svc.cluster.local'],
    ['.intranet', 'wiki.intranet'],
    ['the bare ending itself', 'internal'],
  ])('blocks %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it('does not block a public name for ending in a dot, or for containing an internal word', () => {
    expect(isBlockedHost('example.com.')).toBe(false);
    expect(isBlockedHost('www.example.com')).toBe(false);
    expect(isBlockedHost('internal.example.com')).toBe(false);
    expect(isBlockedHost('local.example.org')).toBe(false);
    expect(isBlockedHost('homeaway.com')).toBe(false);
  });

  it('refuses these URLs, trailing dot and port included', () => {
    for (const url of ['http://localhost./', 'http://foo.localhost./', 'http://n8n:5678/', 'http://redis/', 'http://metadata.google.internal/computeMetadata/v1/']) {
      expect(getUrlBlockReason(url)).toContain('private, loopback or link-local');
    }
  });
});

describe('reserved address ranges', () => {
  it.each([
    ['benchmarking 198.18/15 (low)', '198.18.0.1'],
    ['benchmarking 198.18/15 (high)', '198.19.255.254'],
    ['IETF protocol assignments 192.0.0.0/24', '192.0.0.8'],
    ['documentation 192.0.2.0/24', '192.0.2.1'],
    ['documentation 198.51.100.0/24', '198.51.100.7'],
    ['documentation 203.0.113.0/24', '203.0.113.9'],
    ['multicast 224/4', '224.0.0.1'],
    ['reserved 240/4', '240.0.0.1'],
    ['limited broadcast', '255.255.255.255'],
    ['IPv6 multicast', 'ff02::1'],
    ['Teredo 2001::/32', '2001:0:4136:e378:8000:63bf:3fff:fdd2'],
    ['IPv6 documentation 2001:db8::/32', '2001:db8::1'],
    ['local-use NAT64 64:ff9b:1::/48', '64:ff9b:1::7f00:1'],
    ['6to4 carrying a loopback address', '2002:7f00:1::'],
    ['6to4 carrying a private address', '2002:c0a8:101::'],
  ])('blocks %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    ['198.17 (just below 198.18/15)', '198.17.255.1'],
    ['198.20 (just above 198.18/15)', '198.20.0.1'],
    ['223.255.255.1 (just below multicast)', '223.255.255.1'],
    ['6to4 carrying a public address', '2002:0808:0808::'],
    ['2001:4860 (a public IPv6 block)', '2001:4860:4860::8888'],
    ['64:ff9b::808:808 (global NAT64 of a public IPv4)', '64:ff9b::808:808'],
  ])('allows %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe('what the red-team round found', () => {
  it.each([
    ['a link-local address with a zone id', 'fe80::1%eth0'],
    ['a loopback with a zone id', '::1%lo'],
    ['site-local fec0::/10', 'fec0::1'],
    ['discard-only 100::/64', '100::1'],
    ['documentation 3fff::/20', '3fff::1'],
    ['benchmarking 2001:2::/48', '2001:2::1'],
    ['IPv4-translated loopback (hex)', '::ffff:0:7f00:1'],
    ['IPv4-translated loopback (dotted)', '::ffff:0:127.0.0.1'],
    ['the Azure WireServer address', '168.63.129.16'],
  ])('blocks %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(true);
  });

  it.each([
    ['a neighbouring Azure address', '168.63.129.17'],
    ['IPv4-translated public address', '::ffff:0:808:808'],
    ['3fff:1000:: (outside the 3fff::/20 documentation block)', '3fff:1000::1'],
  ])('allows %s', (_label, host) => {
    expect(isBlockedHost(host)).toBe(false);
  });
});

describe('createGuardedLookup', () => {
  type Answer = string | Array<{ address: string; family: number }>;
  const resolverGiving = (answer: Answer) =>
    jest.fn((_host: string, _options: unknown, callback: (e: Error | null, a: Answer, f?: number) => void) => callback(null, answer, 4));
  const lookupWith = (answer: Answer, options: Record<string, unknown> = {}) =>
    new Promise<{ error: NodeJS.ErrnoException | null; address: unknown }>((resolve) => {
      createGuardedLookup(resolverGiving(answer) as never)('example.test', options as never, (error, address) => resolve({ error, address }));
    });

  it('passes a name that resolves to a public address', async () => {
    const result = await lookupWith('93.184.216.34');
    expect(result.error).toBeNull();
    expect(result.address).toBe('93.184.216.34');
  });

  it('refuses a name that resolves to a private address, with a code that says why', async () => {
    const result = await lookupWith('10.0.0.5');
    expect(result.error?.code).toBe('ERR_BLOCKED_ADDRESS');
    expect(result.error?.message).toContain('private, loopback or link-local');
  });

  it.each(['127.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fd00::1', '::ffff:127.0.0.1'])('refuses a name that resolves to %s', async (address) => {
    expect((await lookupWith(address)).error?.code).toBe('ERR_BLOCKED_ADDRESS');
  });

  it('refuses when any one of several answers is private (the all option of net.connect)', async () => {
    const result = await lookupWith(
      [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }],
      { all: true },
    );
    expect(result.error?.code).toBe('ERR_BLOCKED_ADDRESS');
    expect(result.address).toEqual([]);
  });

  it('passes several public answers through unchanged', async () => {
    const answers = [{ address: '93.184.216.34', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
    const result = await lookupWith(answers, { all: true });
    expect(result.error).toBeNull();
    expect(result.address).toEqual(answers);
  });

  it('passes a resolver error on as it is', async () => {
    const failing = (_h: string, _o: unknown, callback: (e: Error | null) => void) => callback(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }));
    const result = await new Promise<{ error: NodeJS.ErrnoException | null }>((resolve) => {
      createGuardedLookup(failing as never)('nope.test', {} as never, (error) => resolve({ error }));
    });
    expect(result.error?.code).toBe('ENOTFOUND');
  });
});

describe('fetchPageContent and the guarded lookup', () => {
  const PROXY_VARS = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY'];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(PROXY_VARS.map((v) => [v, process.env[v]]));
    for (const v of PROXY_VARS) delete process.env[v];
    mockedAxios.get.mockResolvedValue({ data: bodyOf('<html><body><p>hello</p></body></html>'), headers: { 'content-type': 'text/html' } } as never);
  });
  afterEach(() => {
    for (const v of PROXY_VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });
  const configOf = () => (mockedAxios.get.mock.calls[0] as unknown[])[1] as { httpAgent?: unknown; httpsAgent?: unknown };

  it('tells the user why a name that resolved to a private address was refused', async () => {
    mockedAxios.get.mockRejectedValue(Object.assign(new Error('blocked'), { code: 'ERR_BLOCKED_ADDRESS' }));
    const result = await fetchPageContent('https://example.com/a');
    expect(result.error).toBe('Refused to connect to a private, loopback or link-local address');
    expect(result.content).toBe('');
  });

  it.each([
    ['HTTPS_PROXY for an https URL', { HTTPS_PROXY: 'http://proxy.corp.example:3128' }, 'https://example.com/a'],
    ['https_proxy for an https URL', { https_proxy: 'http://proxy.corp.example:3128' }, 'https://example.com/a'],
    ['HTTP_PROXY for an http URL', { HTTP_PROXY: 'http://proxy.corp.example:3128' }, 'http://example.com/a'],
    ['ALL_PROXY', { ALL_PROXY: 'http://proxy.corp.example:3128' }, 'https://example.com/a'],
    ['HTTP_PROXY even for an https URL: a redirect hop can change the scheme', { HTTP_PROXY: 'http://proxy.corp.example:3128' }, 'https://example.com/a'],
    ['a proxy and a NO_PROXY: axios decides per hop, so the guarded agents stay off', { HTTPS_PROXY: 'http://proxy.corp.example:3128', NO_PROXY: 'example.com' }, 'https://example.com/a'],
  ])('does not use the guarded agents when a proxy is configured (%s): the proxy resolves the target', async (_label, env, url) => {
    Object.assign(process.env, env);
    await fetchPageContent(url);
    expect(configOf().httpAgent).toBeUndefined();
    expect(configOf().httpsAgent).toBeUndefined();
  });

  it('judges a redirect by the address it points to, also when axios has put the proxy into hostname', async () => {
    await fetchPageContent('https://example.com/a');
    const hook = (configOf() as unknown as { beforeRedirect: (o: Record<string, unknown>) => void }).beforeRedirect;
    // the proxy is public-looking, the redirect target is the cloud metadata address
    expect(() => hook({ hostname: 'proxy.example.net', protocol: 'http:', href: 'http://169.254.169.254/latest/meta-data/' })).toThrow('Refused to follow a redirect');
    expect(() => hook({ hostname: '127.0.0.2', protocol: 'http:', href: 'http://internal-svc.corp/' })).toThrow('Refused to follow a redirect');
    // a private proxy no longer blocks a redirect to a public page
    expect(() => hook({ hostname: '10.0.0.9', protocol: 'http:', href: 'http://example.org/next' })).not.toThrow();
    // without href the old fields are used
    expect(() => hook({ hostname: '127.0.0.1', protocol: 'http:' })).toThrow('Refused to follow a redirect');
  });

  it('keeps the guarded agents when no proxy is configured, and treats an empty variable as none', async () => {
    await fetchPageContent('https://example.com/a');
    expect(configOf().httpsAgent).toBeDefined();

    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: bodyOf('<html><body><p>hello</p></body></html>'), headers: { 'content-type': 'text/html' } } as never);
    process.env.HTTPS_PROXY = '  ';
    process.env.NO_PROXY = 'localhost';
    await fetchPageContent('https://example.com/a');
    expect(configOf().httpsAgent).toBeDefined();
  });
});

describe('the guarded lookup on a real socket', () => {
  it('refuses a connection to a name that resolves to loopback, with the real resolver', async () => {
    const http = await import('http');
    const server = http.createServer((_req, res) => res.end('secret'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const agent = new http.Agent({ lookup: createGuardedLookup() as never });
      const code = await new Promise<string>((resolve) => {
        const request = http.get({ host: 'localhost', port, agent }, () => resolve('CONNECTED'));
        request.on('error', (error: NodeJS.ErrnoException) => resolve(String(error.code)));
      });
      expect(code).toBe('ERR_BLOCKED_ADDRESS');
      // the same request without the guard does connect, so the refusal above is the guard's
      const plain = await new Promise<string>((resolve) => {
        const request = http.get({ host: 'localhost', port }, () => resolve('CONNECTED'));
        request.on('error', (error: NodeJS.ErrnoException) => resolve(String(error.code)));
      });
      expect(plain).toBe('CONNECTED');
    } finally {
      server.close();
    }
  });
});

describe('fetchPageContent connects through the guarded lookup', () => {
  it('passes agents with a lookup to axios, for http and for https', async () => {
    mockedAxios.get.mockResolvedValue({ data: bodyOf('<html><body><p>hello</p></body></html>'), headers: { 'content-type': 'text/html' } } as never);
    await fetchPageContent('https://example.com/a');
    const config = (mockedAxios.get.mock.calls[0] as unknown[])[1] as { httpAgent: { options: { lookup?: unknown } }; httpsAgent: { options: { lookup?: unknown } } };
    expect(typeof config.httpAgent.options.lookup).toBe('function');
    expect(config.httpsAgent.options.lookup).toBe(config.httpAgent.options.lookup);
    // and it is the guarded one: the plain resolver would answer 127.0.0.1 for localhost
    const lookup = config.httpsAgent.options.lookup as (host: string, options: unknown, callback: (error: NodeJS.ErrnoException | null) => void) => void;
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => lookup('localhost', {}, (e) => resolve(e)));
    expect(error?.code).toBe('ERR_BLOCKED_ADDRESS');
  });
});
