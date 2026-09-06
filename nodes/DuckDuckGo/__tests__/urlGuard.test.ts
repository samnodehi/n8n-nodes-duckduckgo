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

import { isBlockedHost, getUrlBlockReason, isFetchableUrl } from '../urlGuard';
import { fetchPageContent } from '../pageContent';

const mockedAxios = axios as jest.Mocked<typeof axios>;

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
      data: `<html><body><article>
        <p>A sufficiently long article paragraph so that the extractor treats this as
        real content rather than boilerplate navigation, with enough words to pass the
        minimum length threshold used before trusting the parsed result.</p>
        <p>A second paragraph keeps the extracted article comfortably above that
        threshold so the assertion below is stable.</p>
      </article></body></html>`,
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
      data: '<html><body><p>ok</p></body></html>',
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
});
