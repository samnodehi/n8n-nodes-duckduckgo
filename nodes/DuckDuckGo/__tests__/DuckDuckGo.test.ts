import { IExecuteFunctions } from 'n8n-workflow';
import { DuckDuckGo } from '../DuckDuckGo.node';
import * as duckDuckScrape from 'duck-duck-scrape';

jest.mock('duck-duck-scrape', () => ({
  search: jest.fn(),
  searchNews: jest.fn(),
  searchImages: jest.fn(),
  searchVideos: jest.fn(),
  SafeSearchType: {
    STRICT: 'strict',
    MODERATE: 'moderate',
    OFF: 'off',
  },
  SearchTimeType: {
    DAY: 'd',
    WEEK: 'w',
    MONTH: 'm',
    YEAR: 'y',
    ALL: 'a',
  },
}));

describe('DuckDuckGo Node', () => {
  let duckDuckGoNode: DuckDuckGo;
  let mockExecuteFunction: IExecuteFunctions;
  let mockGetNodeParameter: jest.Mock;

  beforeEach(() => {
    duckDuckGoNode = new DuckDuckGo();
    mockGetNodeParameter = jest.fn();

    mockExecuteFunction = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: mockGetNodeParameter,
      getNode: jest.fn().mockReturnValue({
        name: 'DuckDuckGo',
        type: 'n8n-nodes-base.duckDuckGo',
        typeVersion: 1,
      }),
      continueOnFail: jest.fn().mockReturnValue(true),
    } as unknown as IExecuteFunctions;

    jest.clearAllMocks();
  });

  const setupNodeParameters = (operation: string, query: string, options: any = {}) => {
    mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, fallback: any) => {
      switch (parameter) {
        case 'operation':
          return operation;
        case 'query':
          return query;
        case 'locale':
          return options.locale || 'en-us';
        case 'maxResults':
          return options.maxResults || 10;
        case 'region':
          return options.region || 'wt-wt';
        case 'safeSearch':
          return options.safeSearch !== undefined ? options.safeSearch : -1;
        case 'timePeriod':
          return options.timePeriod || '';
        default:
          return fallback;
      }
    });
  };

  describe('Web Search', () => {
    const mockResults = {
      results: [
        { title: 'Result 1', description: 'Desc 1', url: 'https://example.com/1', hostname: 'example.com' },
        { title: 'Result 2', description: 'Desc 2', url: 'https://example.com/2', hostname: 'example.com' },
      ],
    };

    it('should return web search results', async () => {
      setupNodeParameters('search', 'test query');
      (duckDuckScrape.search as jest.Mock).mockResolvedValue(mockResults);

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(duckDuckScrape.search).toHaveBeenCalledWith('test query', expect.any(Object));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0].json).toHaveProperty('title', 'Result 1');
      expect(result[0][0].json).toHaveProperty('sourceType', 'web');
    });

    it('should handle empty results', async () => {
      setupNodeParameters('search', 'no results');
      (duckDuckScrape.search as jest.Mock).mockResolvedValue({ results: [] });

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(result[0][0].json).toHaveProperty('success', true);
      expect(result[0][0].json).toHaveProperty('count', 0);
    });

    it('should handle errors gracefully', async () => {
      setupNodeParameters('search', 'error query');
      (duckDuckScrape.search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
    });

    it('should throw error when query is empty', async () => {
      setupNodeParameters('search', '');
      mockExecuteFunction.continueOnFail = jest.fn().mockReturnValue(false);

      await expect(duckDuckGoNode.execute.call(mockExecuteFunction)).rejects.toThrow(/cannot be empty/i);
    });
  });

  describe('Image Search', () => {
    const mockResults = {
      results: [
        { title: 'Image 1', image: 'https://example.com/img1.jpg', thumbnail: 'https://example.com/thumb1.jpg', url: 'https://example.com/1' },
      ],
    };

    it('should return image search results', async () => {
      setupNodeParameters('searchImages', 'cat');
      (duckDuckScrape.searchImages as jest.Mock).mockResolvedValue(mockResults);

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(duckDuckScrape.searchImages).toHaveBeenCalledWith('cat', expect.any(Object));
      expect(result[0][0].json).toHaveProperty('sourceType', 'image');
      expect(result[0][0].json).toHaveProperty('imageUrl', 'https://example.com/img1.jpg');
    });
  });

  describe('News Search', () => {
    const mockResults = {
      results: [
        { title: 'News 1', excerpt: 'News excerpt', url: 'https://news.example.com/1', date: 1625097600 },
      ],
    };

    it('should return news search results', async () => {
      setupNodeParameters('searchNews', 'tech news');
      (duckDuckScrape.searchNews as jest.Mock).mockResolvedValue(mockResults);

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(duckDuckScrape.searchNews).toHaveBeenCalledWith('tech news', expect.any(Object));
      expect(result[0][0].json).toHaveProperty('sourceType', 'news');
    });
  });

  describe('Video Search', () => {
    const mockResults = {
      results: [
        { title: 'Video 1', description: 'Video desc', url: 'https://video.example.com/1', duration: '10:00' },
      ],
    };

    it('should return video search results', async () => {
      setupNodeParameters('searchVideos', 'tutorial');
      (duckDuckScrape.searchVideos as jest.Mock).mockResolvedValue(mockResults);

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(duckDuckScrape.searchVideos).toHaveBeenCalledWith('tutorial', expect.any(Object));
      expect(result[0][0].json).toHaveProperty('sourceType', 'video');
    });
  });

  describe('Parameters', () => {
    it('should use region parameter for locale', async () => {
      setupNodeParameters('search', 'test', { region: 'fr-fr' });
      (duckDuckScrape.search as jest.Mock).mockResolvedValue({ results: [] });

      await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(duckDuckScrape.search).toHaveBeenCalledWith('test', expect.objectContaining({
        locale: 'fr-fr',
      }));
    });

    it('should limit results to maxResults', async () => {
      setupNodeParameters('search', 'test', { maxResults: 2 });
      const manyResults = {
        results: Array(10).fill(null).map((_, i) => ({
          title: `Result ${i}`, description: `Desc ${i}`, url: `https://example.com/${i}`, hostname: 'example.com',
        })),
      };
      (duckDuckScrape.search as jest.Mock).mockResolvedValue(manyResults);

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(result[0]).toHaveLength(2);
    });
  });
});
