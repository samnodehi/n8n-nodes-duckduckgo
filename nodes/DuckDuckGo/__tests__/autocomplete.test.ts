/**
 * Unit tests for autocomplete.ts.
 *
 * DuckDuckGo has returned two different shapes from /ac/ — the `type=list`
 * pair form and an array of `{ phrase }` objects — and neither is contractual,
 * so both are pinned here along with graceful handling of anything else.
 */

jest.mock('axios');

import axios from 'axios';

import { getAutocomplete, parseSuggestions } from '../autocomplete';

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseSuggestions', () => {
  it('reads the type=list pair form', () => {
    expect(parseSuggestions(['n8n', ['n8n docs', 'n8n cloud', 'n8n nodes']]))
      .toEqual(['n8n docs', 'n8n cloud', 'n8n nodes']);
  });

  it('reads the phrase-object form', () => {
    expect(parseSuggestions([{ phrase: 'n8n docs' }, { phrase: 'n8n cloud' }]))
      .toEqual(['n8n docs', 'n8n cloud']);
  });

  it('drops entries that are not usable strings', () => {
    expect(parseSuggestions(['q', ['good', '', '   ', 42, null, 'also good']]))
      .toEqual(['good', 'also good']);
    expect(parseSuggestions([{ phrase: 'kept' }, { nope: 1 }, null, { phrase: '  ' }]))
      .toEqual(['kept']);
  });

  it.each([
    ['a non-array', { suggestions: [] }],
    ['null', null],
    ['undefined', undefined],
    ['an empty array', []],
  ])('returns an empty list for %s', (_label, data) => {
    expect(parseSuggestions(data)).toEqual([]);
  });
});

describe('getAutocomplete', () => {
  it('returns suggestions for a partial query', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: ['how to', ['how to build', 'how to code']] });

    const result = await getAutocomplete('how to');

    expect(result.error).toBeUndefined();
    expect(result.suggestions).toEqual(['how to build', 'how to code']);
  });

  it('requests the list shape and no region by default', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: ['x', []] });

    await getAutocomplete('x');

    const url = mockedAxios.get.mock.calls[0][0] as string;
    expect(url).toContain('duckduckgo.com/ac/');
    expect(url).toContain('type=list');
    expect(url).not.toContain('kl=');
  });

  it('passes the region through as kl', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: ['x', []] });

    await getAutocomplete('x', { region: 'de-de' });

    expect(mockedAxios.get.mock.calls[0][0] as string).toContain('kl=de-de');
  });

  it('caps the list at maxResults', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: ['a', ['1', '2', '3', '4', '5']] });

    const result = await getAutocomplete('a', { maxResults: 3 });

    expect(result.suggestions).toEqual(['1', '2', '3']);
  });

  it('treats maxResults of 0 as no limit', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: ['a', ['1', '2', '3']] });

    const result = await getAutocomplete('a', { maxResults: 0 });

    expect(result.suggestions).toHaveLength(3);
  });

  it.each([
    ['an empty query', ''],
    ['whitespace only', '   '],
  ])('rejects %s without making a request', async (_label, query) => {
    const result = await getAutocomplete(query);

    expect(result.error).toBe('No query provided');
    expect(result.suggestions).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('reports a timeout instead of throwing', async () => {
    mockedAxios.get.mockRejectedValueOnce({ code: 'ECONNABORTED' });

    const result = await getAutocomplete('x', { timeout: 1234 });

    expect(result.suggestions).toEqual([]);
    expect(result.error).toBe('Timed out after 1234ms');
  });

  it('reports an HTTP error instead of throwing', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 503 } });

    const result = await getAutocomplete('x');

    expect(result.error).toBe('HTTP 503');
  });

  it('degrades to an empty list when the payload shape is unfamiliar', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { unexpected: true } });

    const result = await getAutocomplete('x');

    expect(result.suggestions).toEqual([]);
    expect(result.error).toBeUndefined();
  });
});
