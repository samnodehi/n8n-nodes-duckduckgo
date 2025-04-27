import { IExecuteFunctions } from 'n8n-workflow';
import { DuckDuckGo } from '../DuckDuckGo.node';
import * as duckDuckScrape from 'duck-duck-scrape';
import * as cache from '../cache';

// Mock the duck-duck-scrape library
jest.mock('duck-duck-scrape', () => ({
  search: jest.fn(),
  searchNews: jest.fn(),
  searchImages: jest.fn(),
  searchVideos: jest.fn(),
}));

// Mock the cache module
jest.mock('../cache', () => ({
  getCached: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
  getCacheSize: jest.fn(),
  pruneExpiredEntries: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('DuckDuckGo Node', () => {
  let duckDuckGoNode: DuckDuckGo;
  let mockExecuteFunction: IExecuteFunctions;
  let mockGetNodeParameter: jest.Mock;

  beforeEach(() => {
    // Create a new DuckDuckGo node instance for each test
    duckDuckGoNode = new DuckDuckGo();

    // Create mock functions
    mockGetNodeParameter = jest.fn();

    // Mock the execute functions context
    mockExecuteFunction = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: mockGetNodeParameter,
      getNode: jest.fn().mockReturnValue({
        name: 'DuckDuckGo',
        type: 'n8n-nodes-base.duckDuckGo',
        typeVersion: 1
      }),
      helpers: {
        returnJsonArray: jest.fn((items) => items),
      },
      continueOnFail: jest.fn().mockReturnValue(false),
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'test-api-key' }),
    } as unknown as IExecuteFunctions;

    // Reset all mocks
    jest.clearAllMocks();
  });

  // Helper function to set up common node parameters
  const setupNodeParameters = (operation: string, query: string, options: any = {}, additionalParams: any = {}) => {
    mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, fallback: any) => {
      switch (parameter) {
        case 'operation':
          return operation;
        case 'query':
        case 'imageQuery':
        case 'newsQuery':
        case 'videoQuery':
          return query;
        case 'webSearchOptions':
        case 'imageSearchOptions':
        case 'newsSearchOptions':
        case 'videoSearchOptions':
          return {
            maxResults: options.maxResults || 10,
            region: options.region || 'us-en',
            safeSearch: options.safeSearch !== undefined ? options.safeSearch : 1,
            timePeriod: options.timePeriod || '',
            ...options
          };
        case 'locale':
          return options.locale || 'en-us';
        case 'useCache':
          return options.useCache !== undefined ? options.useCache : true;
        case 'cacheTtl':
          return options.cacheTtl || 3600;
        case 'debugMode':
          return options.debugMode || false;
        case 'useApiKey':
          return options.useApiKey || false;
        case 'errorHandling':
          return options.errorHandling || 'continueOnFail';
        default:
          if (additionalParams[parameter] !== undefined) {
            return additionalParams[parameter];
          }
          return fallback;
      }
    });
  };

  describe('Web Search Operation', () => {
    const mockWebSearchResults = {
      results: [
        {
          title: 'Test Result 1',
          description: 'Description for test result 1',
          url: 'https://example.com/1',
          hostname: 'example.com',
          icon: 'https://example.com/favicon.ico',
        },
        {
          title: 'Test Result 2',
          description: 'Description for test result 2',
          url: 'https://example.com/2',
          hostname: 'example.com',
          icon: 'https://example.com/favicon.ico',
        },
      ],
    };

    it('should return web search results successfully', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'test query');

      // Setup the mock implementation of search
      (duckDuckScrape.search as jest.Mock).mockResolvedValue(mockWebSearchResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.search).toHaveBeenCalledWith('test query', expect.any(Object));
      expect(result).toHaveLength(1); // One array of results
      expect(result[0]).toHaveLength(2); // Two individual results
      expect(result[0][0].json).toHaveProperty('url', 'https://example.com/1');
      expect(result[0][0].json).toHaveProperty('title', 'Test Result 1');
      expect(result[0][0].json).toHaveProperty('description', 'Description for test result 1');
      expect(result[0][0].json).toHaveProperty('sourceType', 'web');
      expect(result[0][1].json).toHaveProperty('url', 'https://example.com/2');
      expect(result[0][1].json).toHaveProperty('title', 'Test Result 2');
    });

    it('should use cache when available', async () => {
      // Set up node parameters with cache enabled
      setupNodeParameters('search', 'cached query', { useCache: true, cacheTtl: 60 });

      // Mock cache hit
      const cachedResults = {
        results: [
          {
            title: 'Cached Result',
            description: 'This is a cached result',
            url: 'https://example.com/cached',
            hostname: 'example.com',
          },
        ],
      };
      (cache.getCached as jest.Mock).mockReturnValue(cachedResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(cache.getCached).toHaveBeenCalled();
      expect(duckDuckScrape.search).not.toHaveBeenCalled(); // The API call should be skipped
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('title', 'Cached Result');
      expect(result[0][0].json).toHaveProperty('url', 'https://example.com/cached');
    });

    it('should store results in cache when cache is enabled', async () => {
      // Set up node parameters with cache enabled
      setupNodeParameters('search', 'query to cache', { useCache: true, cacheTtl: 120 });

      // Mock cache miss then API success
      (cache.getCached as jest.Mock).mockReturnValue(undefined);
      (duckDuckScrape.search as jest.Mock).mockResolvedValue(mockWebSearchResults);

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(cache.getCached).toHaveBeenCalled();
      expect(duckDuckScrape.search).toHaveBeenCalled();
      expect(cache.setCache).toHaveBeenCalledWith(
        expect.any(String),
        mockWebSearchResults,
        120 // TTL value passed to setCache
      );
    });

    it('should handle API errors gracefully', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'error query');

      // Mock an API error
      const apiError = new Error('API request failed');
      apiError.name = 'FetchError';
      apiError.stack = 'Error stack trace';
      (duckDuckScrape.search as jest.Mock).mockRejectedValue(apiError);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.search).toHaveBeenCalledWith('error query', expect.any(Object));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      expect(result[0][0].json.error).toContain('API request failed');
    });

    it('should handle empty search results', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'no results query');

      // Mock empty search results
      const emptyResults = { results: [] };
      (duckDuckScrape.search as jest.Mock).mockResolvedValue(emptyResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.search).toHaveBeenCalledWith('no results query', expect.any(Object));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', true);
      expect(result[0][0].json).toHaveProperty('results');
      expect(result[0][0].json.results).toHaveLength(0);
    });

    it('should throw an error when query is missing', async () => {
      // Setup parameters with missing query
      mockGetNodeParameter.mockImplementation((parameter: string) => {
        if (parameter === 'operation') return 'search';
        if (parameter === 'query') return '';
        return null;
      });

      // Execute the node and expect it to throw
      await expect(duckDuckGoNode.execute.call(mockExecuteFunction))
        .rejects
        .toThrow(/query is required/i);
    });
  });

  describe('Image Search Operation', () => {
    const mockImageSearchResults = {
      results: [
        {
          title: 'Image 1',
          image: 'https://example.com/image1.jpg',
          thumbnail: 'https://example.com/thumb1.jpg',
          url: 'https://example.com/page1',
          width: 800,
          height: 600,
          source: 'example.com'
        },
        {
          title: 'Image 2',
          image: 'https://example.com/image2.jpg',
          thumbnail: 'https://example.com/thumb2.jpg',
          url: 'https://example.com/page2',
          width: 1024,
          height: 768,
          source: 'example.com'
        }
      ]
    };

    it('should return image search results successfully', async () => {
      // Set up node parameters
      setupNodeParameters('searchImages', 'cat pictures');

      // Setup the mock implementation of searchImages
      (duckDuckScrape.searchImages as jest.Mock).mockResolvedValue(mockImageSearchResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.searchImages).toHaveBeenCalledWith('cat pictures', expect.any(Object));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0].json).toHaveProperty('imageUrl', 'https://example.com/image1.jpg');
      expect(result[0][0].json).toHaveProperty('thumbnailUrl', 'https://example.com/thumb1.jpg');
      expect(result[0][0].json).toHaveProperty('title', 'Image 1');
      expect(result[0][0].json).toHaveProperty('width', 800);
      expect(result[0][0].json).toHaveProperty('height', 600);
      expect(result[0][0].json).toHaveProperty('sourceType', 'image');
    });

    it('should handle error in image search', async () => {
      // Set up node parameters
      setupNodeParameters('searchImages', 'error query');

      // Mock an API error with HTTP status code
      const apiError = new Error('Image search failed');
      apiError.name = 'HTTPError';
      // Create an object with properties consistent with NodeApiError
      const errorWithCode = Object.assign(apiError, {
        httpCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Image search failed',
      });
      (duckDuckScrape.searchImages as jest.Mock).mockRejectedValue(errorWithCode);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.searchImages).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      expect(result[0][0].json.error).toContain('Image search failed');
    });
  });

  describe('News Search Operation', () => {
    const mockNewsSearchResults = {
      results: [
        {
          title: 'News Article 1',
          excerpt: 'First news article excerpt',
          url: 'https://news.example.com/article1',
          date: 1625097600000, // Timestamp
          relativeTime: '2 hours ago',
          image: 'https://news.example.com/image1.jpg',
          syndicate: 'Example News'
        },
        {
          title: 'News Article 2',
          excerpt: 'Second news article excerpt',
          url: 'https://news.example.com/article2',
          date: 1625094000000, // Timestamp
          relativeTime: '3 hours ago',
          image: 'https://news.example.com/image2.jpg',
          syndicate: 'Example News'
        }
      ]
    };

    it('should return news search results successfully', async () => {
      // Set up node parameters
      setupNodeParameters('searchNews', 'latest tech news', { timePeriod: 'pastDay' });

      // Setup the mock implementation of searchNews
      (duckDuckScrape.searchNews as jest.Mock).mockResolvedValue(mockNewsSearchResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.searchNews).toHaveBeenCalledWith('latest tech news', expect.objectContaining({
        timePeriod: 'd' // pastDay value
      }));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0].json).toHaveProperty('title', 'News Article 1');
      expect(result[0][0].json).toHaveProperty('description', 'First news article excerpt');
      expect(result[0][0].json).toHaveProperty('url', 'https://news.example.com/article1');
      expect(result[0][0].json).toHaveProperty('relativeTime', '2 hours ago');
      expect(result[0][0].json).toHaveProperty('imageUrl', 'https://news.example.com/image1.jpg');
      expect(result[0][0].json).toHaveProperty('sourceType', 'news');
    });

    it('should cache news search results when enabled', async () => {
      // Set up node parameters with cache enabled
      setupNodeParameters('searchNews', 'cached news query', { useCache: true, cacheTtl: 30 });

      // Mock cache miss then API success
      (cache.getCached as jest.Mock).mockReturnValue(undefined);
      (duckDuckScrape.searchNews as jest.Mock).mockResolvedValue(mockNewsSearchResults);

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(cache.setCache).toHaveBeenCalledWith(
        expect.any(String),
        mockNewsSearchResults,
        30 // TTL value passed to setCache
      );
    });
  });

  describe('Video Search Operation', () => {
    const mockVideoSearchResults = {
      results: [
        {
          title: 'Video 1',
          description: 'Description for video 1',
          url: 'https://videos.example.com/video1',
          image: 'https://videos.example.com/thumb1.jpg',
          duration: '10:15',
          published: '2023-01-15',
          publishedOn: 'Example Videos',
          publisher: 'Example Publisher',
          viewCount: '1.2M views'
        },
        {
          title: 'Video 2',
          description: 'Description for video 2',
          url: 'https://videos.example.com/video2',
          image: 'https://videos.example.com/thumb2.jpg',
          duration: '5:30',
          published: '2023-01-10',
          publishedOn: 'Example Videos',
          publisher: 'Example Publisher',
          viewCount: '562K views'
        }
      ]
    };

    it('should return video search results successfully', async () => {
      // Set up node parameters
      setupNodeParameters('searchVideos', 'tutorial videos');

      // Setup the mock implementation of searchVideos
      (duckDuckScrape.searchVideos as jest.Mock).mockResolvedValue(mockVideoSearchResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.searchVideos).toHaveBeenCalledWith('tutorial videos', expect.any(Object));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0].json).toHaveProperty('title', 'Video 1');
      expect(result[0][0].json).toHaveProperty('description', 'Description for video 1');
      expect(result[0][0].json).toHaveProperty('url', 'https://videos.example.com/video1');
      expect(result[0][0].json).toHaveProperty('duration', '10:15');
      expect(result[0][0].json).toHaveProperty('imageUrl', 'https://videos.example.com/thumb1.jpg');
      expect(result[0][0].json).toHaveProperty('viewCount', '1.2M views');
      expect(result[0][0].json).toHaveProperty('sourceType', 'video');
    });

    it('should handle server error (500) in video search', async () => {
      // Set up node parameters
      setupNodeParameters('searchVideos', 'server error', { debugMode: true });

      // Mock a server error
      const serverError = new Error('Internal Server Error');
      serverError.name = 'ServerError';
      // Create an object with properties consistent with NodeApiError
      const errorWithCode = Object.assign(serverError, {
        httpCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
      });
      (duckDuckScrape.searchVideos as jest.Mock).mockRejectedValue(errorWithCode);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.searchVideos).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      expect(result[0][0].json).toHaveProperty('errorDetails'); // Debug mode enabled
      expect(result[0][0].json.error).toContain('Internal Server Error');
    });
  });

  describe('API Key Authentication', () => {
    it('should include API key when authentication is enabled', async () => {
      // Set up node parameters with API key enabled
      setupNodeParameters('search', 'api auth query', { useApiKey: true });

      // Mock the API response
      (duckDuckScrape.search as jest.Mock).mockResolvedValue({ results: [] });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify that the API key was included in the request options
      expect(duckDuckScrape.search).toHaveBeenCalledWith(
        'api auth query',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key'
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeout errors', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'timeout query');

      // Mock a timeout error
      const timeoutError = new Error('Network request timed out');
      timeoutError.name = 'TimeoutError';
      (duckDuckScrape.search as jest.Mock).mockRejectedValue(timeoutError);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      expect(result[0][0].json.error).toContain('Network request timed out');
    });

    it('should handle rate limit errors (429)', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'rate limited', { debugMode: true });

      // Mock a rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      // Create an object with properties consistent with NodeApiError
      const errorWithCode = Object.assign(rateLimitError, {
        httpCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
      });
      (duckDuckScrape.search as jest.Mock).mockRejectedValue(errorWithCode);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('error');
      expect(result[0][0].json.error).toContain('Rate limit exceeded');
      expect(result[0][0].json).toHaveProperty('errorDetails');
    });

    it('should throw NodeApiError when validation fails and continueOnFail is false', async () => {
      // Setup node parameters but mock continueOnFail as false
      setupNodeParameters('search', '');
      mockExecuteFunction.continueOnFail = jest.fn().mockReturnValue(false);

      // Execute the node and expect it to throw
      await expect(duckDuckGoNode.execute.call(mockExecuteFunction))
        .rejects
        .toThrow();
    });
  });

  describe('Input Validation', () => {
    it('should validate maxResults is within acceptable range', async () => {
      // Set up node parameters with invalid maxResults
      setupNodeParameters('search', 'test query', { maxResults: 1000 });

      // Mock API response
      (duckDuckScrape.search as jest.Mock).mockResolvedValue({ results: [] });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify that maxResults was capped to a reasonable value
      expect(duckDuckScrape.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          maxResults: expect.any(Number)
        })
      );

      // Get the actual call arguments
      const callArgs = (duckDuckScrape.search as jest.Mock).mock.calls[0][1];

      // Assert maxResults is reasonably capped (actual implementation will determine exact cap)
      expect(callArgs.maxResults).toBeLessThan(1000);
    });

    it('should validate and handle invalid time period', async () => {
      // Set up node parameters with invalid time period
      setupNodeParameters('search', 'time period test', { timePeriod: 'invalidValue' });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify that a default or corrected time period was used
      expect(duckDuckScrape.search).toHaveBeenCalledWith(
        'time period test',
        expect.not.objectContaining({
          timePeriod: 'invalidValue'
        })
      );
    });
  });

  describe('Multiple Input Items', () => {
    it('should process multiple input items correctly', async () => {
      // Mock multiple input items
      mockExecuteFunction.getInputData = jest.fn().mockReturnValue([
        { json: { query: 'first query' } },
        { json: { query: 'second query' } }
      ]);

      // Set up node parameters to use input item data
      mockGetNodeParameter.mockImplementation((parameter: string, itemIndex: number) => {
        if (parameter === 'operation') return 'search';
        if (parameter === 'query') return `query ${itemIndex + 1}`;
        if (parameter === 'webSearchOptions') return { maxResults: 5 };
        return null;
      });

      // Mock search results for each query
      (duckDuckScrape.search as jest.Mock)
        .mockResolvedValueOnce({ results: [{ title: 'Result 1', url: 'https://example.com/1' }] })
        .mockResolvedValueOnce({ results: [{ title: 'Result 2', url: 'https://example.com/2' }] });

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.search).toHaveBeenCalledTimes(2);
      expect(duckDuckScrape.search).toHaveBeenNthCalledWith(1, 'query 1', expect.any(Object));
      expect(duckDuckScrape.search).toHaveBeenNthCalledWith(2, 'query 2', expect.any(Object));

      // Verify correct structure of results
      expect(result).toHaveLength(2); // Two arrays of results (one per input)
      expect(result[0]).toHaveLength(1); // One result for first input
      expect(result[1]).toHaveLength(1); // One result for second input
      expect(result[0][0].json).toHaveProperty('title', 'Result 1');
      expect(result[1][0].json).toHaveProperty('title', 'Result 2');

      // Verify paired items
      expect(result[0][0].pairedItem).toEqual({ item: 0 });
      expect(result[1][0].pairedItem).toEqual({ item: 1 });
    });
  });
});
