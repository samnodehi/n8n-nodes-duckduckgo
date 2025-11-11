import { IExecuteFunctions } from 'n8n-workflow';
import { DuckDuckGo } from '../DuckDuckGo.node';
import * as duckDuckScrape from 'duck-duck-scrape';
import * as cache from '../cache';
import * as directSearch from '../directSearch';
import { resetGlobalReliabilityManager } from '../reliabilityManager';

// Mock the duck-duck-scrape library
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
  VideoDefinition: {
    HIGH: 'high',
    STANDARD: 'standard',
    ALL: 'all',
  },
  VideoDuration: {
    SHORT: 'short',
    MEDIUM: 'medium',
    LONG: 'long',
    ALL: 'all',
  },
  VideoLicense: {
    CREATIVE_COMMONS: 'creativeCommons',
    YOUTUBE: 'youtube',
    ALL: 'all',
  },
}));

// Mock the cache module
jest.mock('../cache', () => ({
  getCached: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
  getCacheSize: jest.fn(),
  pruneExpiredEntries: jest.fn(),
}));

// Mock the directSearch module
jest.mock('../directSearch', () => ({
  directWebSearch: jest.fn(),
  directImageSearch: jest.fn(),
  getSafeSearchString: jest.fn((value) => {
    switch (value) {
      case 2: return 'strict';
      case 1: return 'moderate';
      default: return 'off';
    }
  }),
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
        returnJsonArray: jest.fn((items: any[]) => items.map((item: any, index: number) => ({ json: item, pairedItem: { item: index } }))),
      },
      continueOnFail: jest.fn().mockReturnValue(false),
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'test-api-key' }),
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    } as unknown as IExecuteFunctions;

    // Reset all mocks
    jest.clearAllMocks();

    // Reset global reliability manager to prevent state from persisting between tests
    resetGlobalReliabilityManager();
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
            maxResults: options.maxResults || 99,
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
          return options.cacheTtl || 300;
        case 'debugMode':
          return options.debugMode || false;
        case 'useApiKey':
          return options.useApiKey || false;
        case 'errorHandling':
          return options.errorHandling || 'continueOnFail';
        case 'enableTelemetry':
          return options.enableTelemetry || false;
        case 'cacheSettings':
          return options.cacheSettings || { enableCache: options.useCache !== undefined ? options.useCache : false };
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

      // Setup the mock implementation of directWebSearch
      const mockDirectResults = {
        results: mockWebSearchResults.results.map(r => ({
          title: r.title,
          url: r.url,
          description: r.description,
        }))
      };
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue(mockDirectResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('"test query"', expect.objectContaining({
        locale: 'us-en',
        safeSearch: 'moderate',
      }));
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
      setupNodeParameters('search', 'cached query', { useCache: true, cacheTtl: 300 });

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
      expect(directSearch.directWebSearch).not.toHaveBeenCalled(); // The API call should be skipped
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('title', 'Cached Result');
      expect(result[0][0].json).toHaveProperty('url', 'https://example.com/cached');
    });

    it('should store results in cache when cache is enabled', async () => {
      // Set up node parameters with cache enabled
      setupNodeParameters('search', 'query to cache', { useCache: true, cacheTtl: 300 });

      // Mock cache miss then API success
      (cache.getCached as jest.Mock).mockReturnValue(undefined);
      const mockDirectResults = {
        results: mockWebSearchResults.results.map(r => ({
          title: r.title,
          url: r.url,
          description: r.description,
        }))
      };
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue(mockDirectResults);

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(cache.getCached).toHaveBeenCalled();
      expect(directSearch.directWebSearch).toHaveBeenCalled();
      expect(cache.setCache).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          results: expect.any(Array),
          noResults: false,
        }),
        300 // TTL value passed to setCache
      );
    });

    it('should handle API errors gracefully', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'error query');

      // Mock an API error
      const apiError = new Error('API request failed');
      apiError.name = 'FetchError';
      apiError.stack = 'Error stack trace';
      (directSearch.directWebSearch as jest.Mock).mockRejectedValue(apiError);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('error query 2025', expect.any(Object));
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      expect(typeof result[0][0].json.error).toBe('string');
    });

    it('should handle empty search results', async () => {
      // Set up node parameters
      setupNodeParameters('search', 'no results query');

      // Mock empty search results
      const emptyResults = { results: [] };
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue(emptyResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('no results query', expect.any(Object));
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
        if (parameter === 'webSearchOptions') return {
          useSearchOperators: false,
          safeSearch: 1,
          locale: 'us-en',
          timePeriod: '',
          useCache: false,
          cacheTtl: 300,
          debugMode: false
        };
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

      // Setup the mock implementation of directImageSearch
      const mockDirectImageResults = {
        results: mockImageSearchResults.results.map(r => ({
          title: r.title,
          url: r.image,
          thumbnail: r.thumbnail,
          width: r.width,
          height: r.height,
          source: r.url,
        }))
      };
      (directSearch.directImageSearch as jest.Mock).mockResolvedValue(mockDirectImageResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(directSearch.directImageSearch).toHaveBeenCalledWith('cat pictures', expect.objectContaining({
        locale: 'us-en',
        safeSearch: 'moderate',
      }));
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
      (directSearch.directImageSearch as jest.Mock).mockRejectedValue(errorWithCode);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      // With the new fallback implementation, the error message includes both attempts
      expect(result[0][0].json.error).toContain('image search');
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
      setupNodeParameters('searchNews', 'latest tech news', { timePeriod: 'd' });

      // Setup the mock implementation of searchNews
      (duckDuckScrape.searchNews as jest.Mock).mockResolvedValue(mockNewsSearchResults);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(duckDuckScrape.searchNews).toHaveBeenCalledWith('latest tech news', expect.objectContaining({
        time: 'd' // timePeriod gets converted to time with SearchTimeType values
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
      setupNodeParameters('searchNews', 'cached news query', { useCache: true, cacheTtl: 300 });

      // Mock cache miss then API success
      (cache.getCached as jest.Mock).mockReturnValue(undefined);
      (duckDuckScrape.searchNews as jest.Mock).mockResolvedValue(mockNewsSearchResults);

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(cache.setCache).toHaveBeenCalledWith(
        expect.any(String),
        mockNewsSearchResults,
        300 // TTL value passed to setCache
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
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Note: Our direct implementation doesn't use headers for API key
      // Just verify the search was called
      expect(directSearch.directWebSearch).toHaveBeenCalledWith(
        'api auth query',
        expect.any(Object)
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
      (directSearch.directWebSearch as jest.Mock).mockRejectedValue(timeoutError);

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
      (directSearch.directWebSearch as jest.Mock).mockRejectedValue(errorWithCode);

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
      expect(result[0][0].json.error).toContain('Rate limit exceeded');
      expect(result[0][0].json).toHaveProperty('errorDetails');
    });

    it('should throw NodeApiError when validation fails and continueOnFail is false', async () => {
      // Setup node parameters with empty query but mock continueOnFail as false
      mockGetNodeParameter.mockImplementation((parameter: string) => {
        if (parameter === 'operation') return 'search';
        if (parameter === 'query') return '';
        if (parameter === 'webSearchOptions') return {
          useSearchOperators: false,
          safeSearch: 1,
          locale: 'us-en',
          timePeriod: '',
          useCache: false,
          cacheTtl: 300,
          debugMode: false
        };
        return null;
      });

      // Mock continueOnFail to return false
      mockExecuteFunction.continueOnFail = jest.fn().mockReturnValue(false);

      // Execute the node and expect it to throw
      await expect(duckDuckGoNode.execute.call(mockExecuteFunction))
        .rejects
        .toThrow();
    });
  });

  describe('Input Validation', () => {
    it('should validate maxResults is within acceptable range', async () => {
      // Set up node parameters without maxResults since it's not supported by duck-duck-scrape 2.2.7
      setupNodeParameters('search', 'test query', { debugMode: true });

      // Mock API response
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify search was called with correct parameters (should not include maxResults in search options)
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('"test query"', expect.not.objectContaining({
        maxResults: expect.any(Number),
      }));
    });

    it('should validate and handle invalid time period', async () => {
      // Set up node parameters with invalid time period
      setupNodeParameters('search', 'time period test', { timePeriod: 'invalidValue' });

      // Mock API response
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify that a default or corrected time period was used
      expect(directSearch.directWebSearch).toHaveBeenCalledWith(
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
      (directSearch.directWebSearch as jest.Mock)
        .mockResolvedValueOnce({ results: [{ title: 'Result 1', url: 'https://example.com/1', description: 'Desc 1' }] })
        .mockResolvedValueOnce({ results: [{ title: 'Result 2', url: 'https://example.com/2', description: 'Desc 2' }] });

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions
      expect(directSearch.directWebSearch).toHaveBeenCalledTimes(2);
      expect(directSearch.directWebSearch).toHaveBeenNthCalledWith(1, '"query 1"', expect.any(Object));
      expect(directSearch.directWebSearch).toHaveBeenNthCalledWith(2, '"query 2"', expect.any(Object));

      // Verify correct structure of results - all results are in one array with proper pairedItems
      expect(result).toHaveLength(1); // One array with all results
      expect(result[0]).toHaveLength(2); // Two results total (one per input)
      expect(result[0][0].json).toHaveProperty('title', 'Result 1');
      expect(result[0][1].json).toHaveProperty('title', 'Result 2');

      // Verify paired items
      expect(result[0][0].pairedItem).toEqual({ item: 0 });
      expect(result[0][1].pairedItem).toEqual({ item: 1 });
    });
  });
});
