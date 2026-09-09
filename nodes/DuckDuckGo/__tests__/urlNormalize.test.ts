/**
 * Tests for urlNormalize.ts.
 *
 * The risk this guards against is not "a tracking parameter survived" — it is
 * "a URL was changed when it should not have been". Most of these assert that
 * nothing happened.
 */

import { stripTrackingParameters } from '../urlNormalize';

describe('stripTrackingParameters', () => {
  describe('removes advertising identifiers', () => {
    it.each([
      [
        'the whole utm_ family',
        'https://example.com/a?utm_source=ddg&utm_medium=web&utm_campaign=x',
        'https://example.com/a',
      ],
      [
        'a Google Ads click id',
        'https://example.com/a?gclid=abc123',
        'https://example.com/a',
      ],
      [
        'a Facebook click id',
        'https://example.com/a?fbclid=IwAR0abc',
        'https://example.com/a',
      ],
      [
        'a Mailchimp pair',
        'https://example.com/a?mc_cid=1&mc_eid=2',
        'https://example.com/a',
      ],
      [
        'a name in a different case',
        'https://example.com/a?UTM_Source=x&GCLID=y',
        'https://example.com/a',
      ],
    ])('%s', (_label, input, expected) => {
      expect(stripTrackingParameters(input)).toBe(expected);
    });

    it('keeps the parameters the page actually needs', () => {
      expect(
        stripTrackingParameters('https://example.com/search?q=n8n&utm_source=ddg&page=2'),
      ).toBe('https://example.com/search?q=n8n&page=2');
    });

    it('preserves the order of the surviving parameters', () => {
      expect(
        stripTrackingParameters('https://example.com/?z=1&utm_medium=x&a=2&b=3'),
      ).toBe('https://example.com/?z=1&a=2&b=3');
    });

    it('keeps the fragment, which identifies the result', () => {
      expect(
        stripTrackingParameters('https://example.com/guide?utm_source=x#install'),
      ).toBe('https://example.com/guide#install');
    });

    it('keeps a single-page app route held in the fragment', () => {
      expect(
        stripTrackingParameters('https://example.com/?fbclid=abc#/docs/getting-started'),
      ).toBe('https://example.com/#/docs/getting-started');
    });
  });

  describe('leaves everything else exactly as it was', () => {
    it.each([
      ['a URL with no query at all', 'https://example.com/article'],
      ['a URL with only real parameters', 'https://example.com/search?q=n8n&page=2'],
      ['a bare origin without a trailing slash', 'https://example.com'],
      ['an uppercase host', 'https://Example.COM/Path'],
      ['a percent-encoded path', 'https://example.com/a%20b/c%2Fd'],
      ['a fragment on its own', 'https://example.com/guide#install'],
      ['a port and credentials', 'https://user:pw@example.com:8443/x?a=1'],
      ['a signed asset URL', 'https://cdn.example.com/i.jpg?X-Amz-Signature=deadbeef&Expires=1'],
      ['a ref parameter, which sites use for real', 'https://example.com/?ref=hn'],
      ['a source parameter, likewise', 'https://example.com/?source=rss'],
      ['a non-http scheme', 'ftp://example.com/x?utm_source=y'],
      ['something that is not a URL', 'not a url at all'],
      ['an empty string', ''],
    ])('%s', (_label, input) => {
      expect(stripTrackingParameters(input)).toBe(input);
    });

    it('is byte-identical, not merely equivalent, when there is nothing to strip', () => {
      // `new URL(x).toString()` would append a slash here. Returning the input
      // unchanged is what keeps that from happening.
      const input = 'https://example.com';
      expect(stripTrackingParameters(input)).toBe(input);
      expect(stripTrackingParameters(input)).not.toBe('https://example.com/');
    });
  });

  describe('edge cases', () => {
    it('drops the "?" when the last parameter was tracking', () => {
      expect(stripTrackingParameters('https://example.com/a?utm_source=x')).toBe(
        'https://example.com/a',
      );
    });

    it('drops the "?" but keeps the fragment', () => {
      expect(stripTrackingParameters('https://example.com/a?gclid=x#top')).toBe(
        'https://example.com/a#top',
      );
    });

    it('leaves the surviving parameters byte-for-byte', () => {
      // Rebuilding through URLSearchParams would turn %20 into + and ~ into
      // %7E, which is a different URL to a server that signs its query.
      expect(
        stripTrackingParameters('https://example.com/?q=a%20b&utm_source=x'),
      ).toBe('https://example.com/?q=a%20b');
      expect(stripTrackingParameters('https://example.com/?t=~tilde&gclid=1')).toBe(
        'https://example.com/?t=~tilde',
      );
      expect(
        stripTrackingParameters('https://example.com/?sig=A%2FB%2BC&fbclid=1'),
      ).toBe('https://example.com/?sig=A%2FB%2BC');
    });

    it('does not treat a "?" inside the fragment as a query', () => {
      const spa = 'https://example.com/#/docs?utm_source=x';
      expect(stripTrackingParameters(spa)).toBe(spa);
    });

    it('keeps an empty segment rather than tidying the query', () => {
      expect(stripTrackingParameters('https://example.com/?&a=1&utm_source=x')).toBe(
        'https://example.com/?&a=1',
      );
    });

    it.each([
      ['a trailing separator', 'https://example.com/?utm_source=x&', 'https://example.com/'],
      ['a leading separator', 'https://example.com/?&gclid=1', 'https://example.com/'],
      ['nothing but separators', 'https://example.com/?&&fbclid=1&', 'https://example.com/'],
      ['with a fragment to keep', 'https://example.com/a?gclid=1&#top', 'https://example.com/a#top'],
    ])('drops the "?" when only empty segments would remain — %s', (_label, input, expected) => {
      // "https://example.com/?" compares as a different URL from
      // "https://example.com/", which would defeat the deduplication.
      expect(stripTrackingParameters(input)).toBe(expected);
    });

    it('keeps a parameter whose value is empty, which is not an empty segment', () => {
      expect(stripTrackingParameters('https://example.com/?a=&utm_source=x')).toBe(
        'https://example.com/?a=',
      );
    });

    it('matches a percent-encoded parameter name', () => {
      expect(stripTrackingParameters('https://example.com/?utm%5Fsource=x&a=1')).toBe(
        'https://example.com/?a=1',
      );
    });

    it('removes a valueless tracking parameter', () => {
      expect(stripTrackingParameters('https://example.com/?gclid&a=1')).toBe(
        'https://example.com/?a=1',
      );
    });

    it('removes every occurrence of a repeated tracking parameter', () => {
      expect(
        stripTrackingParameters('https://example.com/?utm_source=a&utm_source=b&q=1'),
      ).toBe('https://example.com/?q=1');
    });

    it('never throws, whatever it is given', () => {
      const inputs = ['', '   ', '://', 'https://', 'javascript:alert(1)', 'https://[bad'];
      for (const input of inputs) {
        expect(() => stripTrackingParameters(input)).not.toThrow();
      }
    });

    it('returns an absent URL exactly as it arrived', () => {
      // News and Video results can carry no URL at all, and how the caller
      // handles that must not change because this function sits in the path.
      expect(stripTrackingParameters(null)).toBeNull();
      expect(stripTrackingParameters(undefined)).toBeUndefined();
    });
  });
});
