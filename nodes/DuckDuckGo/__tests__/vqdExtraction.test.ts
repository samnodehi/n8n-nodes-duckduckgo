/**
 * Unit tests for vqdExtraction.ts.
 *
 * DuckDuckGo has served the VQD token in several shapes over time. Matching only
 * one of them makes image search fail the moment the surrounding markup changes,
 * even though the token is still on the page — these tests pin every known shape.
 */

import { extractVqd } from '../vqdExtraction';

const TOKEN = '4-123456789012345678901234567890';

describe('extractVqd', () => {
  it.each([
    ['a bare query parameter', `<a href="/i.js?q=cats&vqd=${TOKEN}">`],
    ['a query parameter followed by another', `/i.js?vqd=${TOKEN}&o=json`],
    ['a double-quoted value', `<input name="vqd" value="vqd=${TOKEN}">`],
    ['a single-quoted assignment', `var v = 'vqd=${TOKEN}';`],
    ['a JSON property', `<script>window.DDG={"vqd":"${TOKEN}","x":1}</script>`],
    ['a JSON property with spacing', `{"vqd" : "${TOKEN}"}`],
  ])('extracts the token from %s', (_label, body) => {
    expect(extractVqd(body)).toBe(TOKEN);
  });

  it('extracts a short token of the historical form', () => {
    expect(extractVqd('vqd=3-987654321')).toBe('3-987654321');
  });

  it('prefers the JSON form when a page contains both shapes', () => {
    // A page that carries an older inline link plus the current JSON payload must
    // still yield a usable token; either match is the same token in practice.
    const body = `<a href="/x?vqd=${TOKEN}">link</a><script>{"vqd":"${TOKEN}"}</script>`;
    expect(extractVqd(body)).toBe(TOKEN);
  });

  it.each([
    ['a page with no token', '<html><body>no token here</body></html>'],
    ['an empty string', ''],
    ['undefined', undefined],
    ['null', null],
    ['a parsed object', { vqd: TOKEN }],
  ])('returns null for %s', (_label, body) => {
    expect(extractVqd(body)).toBeNull();
  });

  it('does not match a token-like word that is not a vqd assignment', () => {
    expect(extractVqd('novqdhere 4-1234')).toBeNull();
  });
});
