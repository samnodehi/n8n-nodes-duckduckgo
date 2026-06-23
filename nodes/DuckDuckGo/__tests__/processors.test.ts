/**
 * Unit tests for processors.ts — result shaping for each operation.
 *
 * Inputs are cast to `any` because these tests intentionally exercise the
 * processors' own defaulting/filtering rather than the upstream result types.
 */

import {
  processWebSearchResults,
  processImageSearchResults,
  processNewsSearchResults,
  processVideoSearchResults,
  processError,
} from '../processors';

describe('processors', () => {
  describe('processWebSearchResults', () => {
    it('returns [] for non-array input', () => {
      expect(processWebSearchResults(undefined as any, 0)).toEqual([]);
      expect(processWebSearchResults(null as any, 0)).toEqual([]);
    });

    it('filters out items missing a title or url', () => {
      const input = [
        { title: 'A', url: 'https://a.com', description: 'da', hostname: 'a.com' },
        { title: '', url: 'https://b.com' }, // no title
        { title: 'C', url: '' }, // no url
      ];
      const out = processWebSearchResults(input as any, 0);
      expect(out).toHaveLength(1);
      expect(out[0].json.title).toBe('A');
    });

    it('maps fields, assigns 1-based position, sourceType web, and pairedItem', () => {
      const input = [
        { title: 'First', url: 'https://1.com', description: 'd1', hostname: '1.com' },
        { title: 'Second', url: 'https://2.com', description: 'd2', hostname: '2.com' },
      ];
      const out = processWebSearchResults(input as any, 3);
      expect(out[0].json.position).toBe(1);
      expect(out[1].json.position).toBe(2);
      expect(out[0].json.sourceType).toBe('web');
      expect(out[0].json.url).toBe('https://1.com');
      expect(out[0].json.hostname).toBe('1.com');
      expect(out[0].pairedItem).toEqual({ item: 3 });
    });

    it('decodes HTML entities in title and description', () => {
      const input = [
        { title: 'Tom &amp; Jerry', url: 'https://x.com', description: 'a &lt;b&gt;', hostname: 'x.com' },
      ];
      const out = processWebSearchResults(input as any, 0);
      expect(out[0].json.title).toBe('Tom & Jerry');
      expect(out[0].json.description).toBe('a <b>');
    });

    it('appends knowledge_graph, ai_overview, top_stories and related_searches blocks from rawResponse', () => {
      const input = [{ title: 'A', url: 'https://a.com', description: '', hostname: 'a.com' }];
      const raw = {
        knowledge_graph: { title: 'KG' },
        ai_overview: { answer: 'AI' },
        top_stories: [{ title: 'TS' }],
        related_searches: [{ query: 'rs' }],
      };
      const out = processWebSearchResults(input as any, 0, raw);
      expect(out.map((o) => o.json.sourceType)).toEqual([
        'web',
        'knowledge_graph',
        'ai_overview',
        'top_story',
        'related_searches',
      ]);
    });
  });

  describe('processImageSearchResults', () => {
    it('returns [] for non-array input', () => {
      expect(processImageSearchResults(undefined as any, 0)).toEqual([]);
    });

    it('drops items without an image and maps the rest', () => {
      const input = [
        {
          title: 'Pic',
          image: 'https://img/1.jpg',
          thumbnail: 'https://t/1.jpg',
          url: 'https://p.com',
          width: 100,
          height: 50,
          source: 'p.com',
        },
        { title: 'NoImage', url: 'https://x.com' },
      ];
      const out = processImageSearchResults(input as any, 2);
      expect(out).toHaveLength(1);
      expect(out[0].json).toMatchObject({
        title: 'Pic',
        imageUrl: 'https://img/1.jpg',
        thumbnailUrl: 'https://t/1.jpg',
        url: 'https://p.com',
        width: 100,
        height: 50,
        source: 'p.com',
        sourceType: 'image',
      });
      expect(out[0].pairedItem).toEqual({ item: 2 });
    });

    it('defaults width and height to null when missing', () => {
      const input = [{ title: 'P', image: 'https://i/1.jpg' }];
      const out = processImageSearchResults(input as any, 0);
      expect(out[0].json.width).toBeNull();
      expect(out[0].json.height).toBeNull();
    });
  });

  describe('processNewsSearchResults', () => {
    it('maps excerpt->description, formats the date, defaults isFallback false', () => {
      const input = [
        {
          title: 'N &amp; M',
          excerpt: 'body',
          url: 'https://n.com',
          image: 'https://n/i.jpg',
          date: 1700000000,
          relativeTime: '2h ago',
          syndicate: 'Pub',
          isOld: false,
        },
      ];
      const out = processNewsSearchResults(input as any, 1);
      expect(out[0].json.title).toBe('N & M');
      expect(out[0].json.description).toBe('body');
      expect(out[0].json.date).toBe(new Date(1700000000 * 1000).toISOString());
      expect(out[0].json.syndicate).toBe('Pub');
      expect(out[0].json.isFallback).toBe(false);
      expect(out[0].json.sourceType).toBe('news');
      expect(out[0].pairedItem).toEqual({ item: 1 });
    });

    it('preserves explicit isFallback true and a null date', () => {
      const input = [
        {
          title: 'N',
          excerpt: '',
          url: '',
          image: '',
          date: null,
          relativeTime: '',
          syndicate: 'DuckDuckGo Fallback',
          isOld: false,
          isFallback: true,
        },
      ];
      const out = processNewsSearchResults(input as any, 0);
      expect(out[0].json.isFallback).toBe(true);
      expect(out[0].json.date).toBeNull();
    });
  });

  describe('processVideoSearchResults', () => {
    it('maps fields, defaults isFallback false, sourceType video', () => {
      const input = [
        {
          title: 'V',
          description: 'desc',
          url: 'https://v.com',
          image: 'https://v/i.jpg',
          duration: '2:00',
          published: '2024-01-01',
          publishedOn: 'YouTube',
          publisher: 'Chan',
          viewCount: '100',
        },
      ];
      const out = processVideoSearchResults(input as any, 0);
      expect(out[0].json).toMatchObject({
        title: 'V',
        description: 'desc',
        url: 'https://v.com',
        imageUrl: 'https://v/i.jpg',
        duration: '2:00',
        published: '2024-01-01',
        publishedOn: 'YouTube',
        publisher: 'Chan',
        viewCount: '100',
        isFallback: false,
        sourceType: 'video',
      });
    });

    it('preserves explicit isFallback true', () => {
      const input = [
        {
          title: 'V',
          description: '',
          url: '',
          image: '',
          duration: '',
          published: '',
          publishedOn: '',
          publisher: 'DuckDuckGo Fallback',
          viewCount: '',
          isFallback: true,
        },
      ];
      const out = processVideoSearchResults(input as any, 0);
      expect(out[0].json.isFallback).toBe(true);
    });
  });

  describe('processError', () => {
    it('builds an error item carrying the original data, success false, and message', () => {
      const out = processError(new Error('boom'), { foo: 'bar' }, 2);
      expect(out.json.success).toBe(false);
      expect(out.json.error).toBe('boom');
      expect(out.json.foo).toBe('bar');
      expect(out.pairedItem).toEqual({ item: 2 });
    });

    it('includes operation, errorDetails and requestOptions in debug mode', () => {
      const out = processError(new Error('boom'), {}, 0, true, 'search', { q: 'x' });
      expect(out.json.operation).toBe('search');
      expect((out.json.errorDetails as any).name).toBe('Error');
      expect(out.json.requestOptions).toEqual({ q: 'x' });
    });

    it('omits errorDetails when debug mode is off', () => {
      const out = processError(new Error('boom'), {}, 0);
      expect(out.json.errorDetails).toBeUndefined();
    });
  });
});
