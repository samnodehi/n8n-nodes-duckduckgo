/**
 * Unit tests for instantAnswer.ts — DuckDuckGo Instant Answer API client.
 * axios is mocked; no real network calls.
 */

jest.mock('axios');

import axios from 'axios';
import { getInstantAnswer } from '../instantAnswer';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('instantAnswer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an error for an empty query without calling axios', async () => {
    mockedAxios.get = jest.fn();
    const r = await getInstantAnswer('   ');
    expect(r.error).toBe('No query provided');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('parses abstract, source, heading, type and makes the image absolute', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      data: {
        Heading: 'DuckDuckGo',
        AbstractText: 'DuckDuckGo is an internet search engine.',
        AbstractSource: 'Wikipedia',
        AbstractURL: 'https://en.wikipedia.org/wiki/DuckDuckGo',
        Image: '/i/abc.png',
        Type: 'A',
        RelatedTopics: [],
      },
    });
    const r = await getInstantAnswer('duckduckgo');
    expect(r.error).toBeUndefined();
    expect(r.heading).toBe('DuckDuckGo');
    expect(r.abstract).toContain('search engine');
    expect(r.abstractSource).toBe('Wikipedia');
    expect(r.type).toBe('A');
    expect(r.image).toBe('https://duckduckgo.com/i/abc.png');
  });

  it('keeps already-absolute image URLs unchanged', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { Image: 'https://x.com/y.png', RelatedTopics: [] } });
    const r = await getInstantAnswer('q');
    expect(r.image).toBe('https://x.com/y.png');
  });

  it('captures a direct Answer (e.g. calculations)', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({ data: { Answer: '42', AnswerType: 'calc', RelatedTopics: [] } });
    const r = await getInstantAnswer('6 * 7');
    expect(r.answer).toBe('42');
    expect(r.answerType).toBe('calc');
  });

  it('flattens both flat and nested (category) related topics', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      data: {
        RelatedTopics: [
          { Text: 'Topic A', FirstURL: 'https://a.com' },
          { Name: 'Category', Topics: [{ Text: 'Sub B', FirstURL: 'https://b.com' }] },
          { something: 'ignored' },
        ],
      },
    });
    const r = await getInstantAnswer('q');
    expect(r.relatedTopics).toEqual([
      { text: 'Topic A', url: 'https://a.com' },
      { text: 'Sub B', url: 'https://b.com' },
    ]);
  });

  it('reports a timeout error', async () => {
    mockedAxios.get = jest.fn().mockRejectedValue({ code: 'ECONNABORTED' });
    const r = await getInstantAnswer('q', { timeout: 1234 });
    expect(r.error).toBe('Timed out after 1234ms');
    expect(r.abstract).toBe('');
  });

  it('reports an HTTP error', async () => {
    mockedAxios.get = jest.fn().mockRejectedValue({ response: { status: 500 } });
    const r = await getInstantAnswer('q');
    expect(r.error).toBe('HTTP 500');
  });
});
