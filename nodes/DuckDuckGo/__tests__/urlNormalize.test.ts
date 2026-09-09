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
