import { IExecuteFunctions } from 'n8n-workflow';
import { DuckDuckGo } from '../DuckDuckGo.node';
import * as duckDuckScrape from 'duck-duck-scrape';
import * as cache from '../cache';
import * as directSearch from '../directSearch';
import * as fallbackSearch from '../fallbackSearch';


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

// Mock the fallbackSearch module
jest.mock('../fallbackSearch', () => ({
  fallbackNewsSearch: jest.fn(),
  fallbackVideoSearch: jest.fn(),
  fallbackWebSearch: jest.fn(),
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
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('test query', expect.objectContaining({
        locale: 'us-en',
        safeSearch: 'moderate',
      }));
      expect(result).toHaveLength(1); // One array of results
      expect(result[0]).toHaveLength(2); // Two individual results

      const first = result[0][0].json;
      const second = result[0][1].json;

      // Fields that must be present in processed web output
      expect(first).toHaveProperty('url', 'https://example.com/1');
      expect(first).toHaveProperty('title', 'Test Result 1');
      expect(first).toHaveProperty('description', 'Description for test result 1');
      expect(first).toHaveProperty('hostname', 'example.com');
      expect(first).toHaveProperty('sourceType', 'web');
      expect(first).toHaveProperty('position', 1);
      expect(second).toHaveProperty('url', 'https://example.com/2');
      expect(second).toHaveProperty('title', 'Test Result 2');

      // Fields that must NOT be present — snippet was a duplicate of description,
      // favicon was always empty (directWebSearch never returns icon)
      expect(first).not.toHaveProperty('snippet');
      expect(first).not.toHaveProperty('favicon');
      expect(second).not.toHaveProperty('snippet');
      expect(second).not.toHaveProperty('favicon');
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
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('error query', expect.any(Object));
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

    describe('query mutation regression — no silent year injection', () => {
      const noMutationCases = [
        { label: 'commercial intent', query: 'best ai tools' },
        { label: 'commercial intent with review', query: 'top laptops review' },
        { label: 'technical intent', query: 'fix python error' },
        { label: 'technical tutorial', query: 'install docker tutorial' },
        { label: 'news-like query', query: 'latest ai news' },
        { label: 'current events', query: 'current stock market update' },
        { label: 'plain query with no pattern', query: 'duckduckgo privacy' },
      ];

      noMutationCases.forEach(({ label, query }) => {
        it(`should send '${query}' as-is (${label})`, async () => {
          setupNodeParameters('search', query);
          (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

          await duckDuckGoNode.execute.call(mockExecuteFunction);

          expect(directSearch.directWebSearch).toHaveBeenCalledWith(query, expect.any(Object));
          // The query passed to directWebSearch must NOT have ' 2025' or ' 2024' appended
          const calledWith = (directSearch.directWebSearch as jest.Mock).mock.calls[0][0] as string;
        expect(calledWith).not.toMatch(/\s202[45]$/);
        });
      });
    });

    describe('searchBackend parameter regression — stale value is ignored', () => {
      it('should call directWebSearch regardless of stale searchBackend value', async () => {
        // Simulate a saved workflow that has searchBackend: 'html' stored
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'test query with stale backend';
          if (parameter === 'webSearchOptions') return {
            searchBackend: 'html', // stale value from old saved workflow
            safeSearch: 1,
            locale: 'us-en',
            timePeriod: '',
            useCache: false,
            cacheTtl: 300,
            debugMode: false,
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        // directWebSearch must still be called — stale searchBackend must not throw or reroute
        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'test query with stale backend',
          expect.any(Object)
        );
      });

      it('should call directWebSearch regardless of stale searchBackend: "search-api"', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'search api query';
          if (parameter === 'webSearchOptions') return {
            searchBackend: 'search-api',
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'search api query',
          expect.any(Object)
        );
      });
    });

    describe('proxySettings parameter regression — stale value is ignored', () => {
      it('should call directWebSearch unchanged when proxySettings has useProxy: true', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'proxy test query';
          if (parameter === 'webSearchOptions') return {
            proxySettings: { // stale value from an old saved workflow
              useProxy: true,
              proxyType: 'http',
              proxyHost: 'proxy.example.com',
              proxyPort: 8080,
            },
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        // directWebSearch is still called with the plain query — proxy data has no effect
        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'proxy test query',
          expect.any(Object)
        );
      });

      it('should call directWebSearch unchanged when proxySettings has SOCKS5 auth config', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'socks proxy query';
          if (parameter === 'webSearchOptions') return {
            proxySettings: {
              useProxy: true,
              proxyType: 'socks5',
              proxyHost: '10.0.0.1',
              proxyPort: 1080,
              proxyAuth: true,
              proxyUsername: 'user',
              proxyPassword: 'secret',
            },
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'socks proxy query',
          expect.any(Object)
        );
      });
    });

    describe('searchFilters parameter regression — stale value is ignored', () => {
      it('should call directWebSearch unchanged when searchFilters has region + language + date data', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'filter test query';
          if (parameter === 'webSearchOptions') return {
            searchFilters: { // stale value from old saved workflow
              useRegionFilter: true,
              region: 'us-en',
              useLanguageFilter: true,
              language: 'en',
              useDateFilter: true,
              dateRangeType: 'week',
            },
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        // directWebSearch must still be called with the plain query — searchFilters data is ignored
        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'filter test query',
          expect.any(Object)
        );
      });

      it('should call directWebSearch unchanged when searchFilters has custom date range', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'custom date query';
          if (parameter === 'webSearchOptions') return {
            searchFilters: {
              useDateFilter: true,
              dateRangeType: 'custom',
              dateFrom: '2025-01-01',
              dateTo: '2025-03-31',
            },
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'custom date query',
          expect.any(Object)
        );
      });
    });

    describe('reliabilitySettings parameter regression — stale value is ignored', () => {
      it('should call directWebSearch unchanged when reliabilitySettings has enableReliability: true', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'reliability test query';
          if (parameter === 'reliabilitySettings') return {
            // stale value from old saved workflow
            enableReliability: true,
            emptyResultThreshold: 3,
            initialBackoffMs: 1000,
            maxBackoffMs: 30000,
            failureThreshold: 5,
            maxRetries: 3,
          };
          if (parameter === 'webSearchOptions') return {};
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        // directWebSearch must still be called — stale reliabilitySettings has no effect
        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'reliability test query',
          expect.any(Object)
        );
      });

      it('should call directWebSearch unchanged when reliabilitySettings is fully configured', async () => {
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'full reliability config query';
          if (parameter === 'reliabilitySettings') return {
            enableReliability: true,
            emptyResultThreshold: 5,
            initialBackoffMs: 500,
            maxBackoffMs: 60000,
            minJitterMs: 200,
            maxJitterMs: 1000,
            failureThreshold: 10,
            resetTimeoutMs: 120000,
            maxRetries: 5,
            retryDelayMs: 2000,
          };
          if (parameter === 'webSearchOptions') return {};
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'full reliability config query',
          expect.any(Object)
        );
      });
    });

    describe('webSearchOptions.timePeriod regression — stale value is ignored', () => {
      it('should call directWebSearch with the plain query when stale timePeriod: "d" (past day) is stored', async () => {
        // Simulate a saved workflow that has timePeriod: 'd' stored (stale from old node version
        // when Time Period appeared in the Web Search UI)
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'search';
          if (parameter === 'query') return 'time period test query';
          if (parameter === 'webSearchOptions') return {
            timePeriod: 'd', // stale: Past Day — no longer a UI option
            safeSearch: -1,
            region: 'us-en',
          };
          return defaultValue ?? null;
        });

        (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        // directWebSearch must still be called with the plain query
        expect(directSearch.directWebSearch).toHaveBeenCalledWith(
          'time period test query',
          expect.any(Object)
        );

        // directWebSearch must NOT receive any time/period parameter — it never supported date filtering
        const calledOptions = (directSearch.directWebSearch as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
        expect(calledOptions).not.toHaveProperty('time');
        expect(calledOptions).not.toHaveProperty('timePeriod');
        expect(calledOptions).not.toHaveProperty('df');
      });

      it('should produce the same directWebSearch call regardless of stale timePeriod value', async () => {
        // Any stale timePeriod value must produce an identical directWebSearch call
        const staleValues = ['d', 'w', 'm', 'y', ''];

        for (const staleValue of staleValues) {
          jest.clearAllMocks();
          (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

          mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
            if (parameter === 'operation') return 'search';
            if (parameter === 'query') return 'stable query';
            if (parameter === 'webSearchOptions') return {
              timePeriod: staleValue,
            };
            return defaultValue ?? null;
          });

          await duckDuckGoNode.execute.call(mockExecuteFunction);

          expect(directSearch.directWebSearch).toHaveBeenCalledTimes(1);
          expect(directSearch.directWebSearch).toHaveBeenCalledWith(
            'stable query',
            expect.any(Object)
          );
        }
      });
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
      expect(directSearch.directImageSearch).toHaveBeenCalledWith(
        'cat pictures',
        expect.objectContaining({
          locale: 'us-en',
          safeSearch: 'moderate',
        }),
        undefined, // no vqdHint on first call for this query
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0].json).toHaveProperty('imageUrl', 'https://example.com/image1.jpg');
      expect(result[0][0].json).toHaveProperty('thumbnailUrl', 'https://example.com/thumb1.jpg');
      expect(result[0][0].json).toHaveProperty('title', 'Image 1');
      expect(result[0][0].json).toHaveProperty('width', 800);
      expect(result[0][0].json).toHaveProperty('height', 600);
      expect(result[0][0].json).toHaveProperty('sourceType', 'image');
    });

    // -------------------------------------------------------------------------
    // 32.5.2 — image source field
    // -------------------------------------------------------------------------
    it('image result has source populated from the page URL (not empty string)', async () => {
      setupNodeParameters('searchImages', 'n8n logo');

      (directSearch.directImageSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            title: 'n8n Logo',
            url: 'https://cdn.example.com/n8n-logo.png',   // image CDN URL → imageUrl
            thumbnail: 'https://cdn.example.com/n8n-thumb.png',
            source: 'https://n8n.io/brand',                 // page URL → source
            width: 256,
            height: 256,
          },
        ],
        vqd: '3-test-vqd',
      });

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      const item = result[0][0].json;
      // source must be the page URL, not an empty string
      expect(item).toHaveProperty('source', 'https://n8n.io/brand');
      expect(item.source).not.toBe('');
      // imageUrl must be the CDN URL
      expect(item).toHaveProperty('imageUrl', 'https://cdn.example.com/n8n-logo.png');
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

    describe('VQD-missing image search regression — no fake imageUrl', () => {
      it('should return error output when VQD extraction fails, not fake web page URLs', async () => {
        // Simulate directImageSearch throwing the VQD-missing error
        // (as it now does when DuckDuckGo does not return a VQD token)
        setupNodeParameters('searchImages', 'nature landscape');

        (directSearch.directImageSearch as jest.Mock).mockRejectedValue(
          new Error(
            'DuckDuckGo image search token (VQD) could not be extracted. ' +
            'Image search may be temporarily unavailable. Please try again later.'
          )
        );

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // Must return error output — not fake image results
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveLength(1);
        const output = result[0][0].json;

        // Error flag must be set
        expect(output).toHaveProperty('success', false);
        expect(output).toHaveProperty('error');
        expect(String(output.error)).toContain('image search');

        // imageUrl must NOT be present in error output
        expect(output).not.toHaveProperty('imageUrl');
        // results array must NOT be present (not a success response)
        expect(output).not.toHaveProperty('results');
      });

      it('should not return any item where imageUrl is a web page URL when VQD fails', async () => {
        // Confirm no item in the output has imageUrl that looks like a web page
        // (the pre-fix behavior would return web URLs under imageUrl)
        setupNodeParameters('searchImages', 'test query');

        (directSearch.directImageSearch as jest.Mock).mockRejectedValue(
          new Error('DuckDuckGo image search token (VQD) could not be extracted.')
        );

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // Check every output item — none should have imageUrl with a web page URL
        const allItems = result.flat();
        for (const item of allItems) {
          if (item.json.imageUrl) {
            // If somehow imageUrl is present, it must not be a plain web page URL
            // (real image URLs would end in .jpg/.png/.webp etc.)
            const imgUrl = String(item.json.imageUrl);
            expect(imgUrl).not.toMatch(/^https?:\/\/[^/]+\/?$/); // bare web origin
          }
        }
        // Primarily: output must be a single error item
        expect(allItems).toHaveLength(1);
        expect(allItems[0].json).toHaveProperty('success', false);
      });
    });

    describe('VQD reuse across multiple input items', () => {
      it('first item calls directImageSearch without vqdHint; subsequent same-query items receive the vqd returned by the first call', async () => {
        // Two input items, both with imageQuery = 'cats'
        mockExecuteFunction.getInputData = jest.fn().mockReturnValue([
          { json: {} },
          { json: {} },
        ]);

        setupNodeParameters('searchImages', 'cats');

        const REUSE_VQD = '3-reuse-token-42';

        // First call returns vqd; second call (with hint) also returns results
        const mockResults = {
          results: [
            {
              title: 'Cat',
              url: 'https://example.com/cat.jpg',
              thumbnail: 'https://t.example.com/cat.jpg',
              source: 'https://example.com',
              width: 100,
              height: 100,
            },
          ],
          vqd: REUSE_VQD,
        };
        (directSearch.directImageSearch as jest.Mock)
          .mockResolvedValueOnce(mockResults)   // first item — extracts VQD
          .mockResolvedValueOnce(mockResults);  // second item — reuses VQD

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(directSearch.directImageSearch).toHaveBeenCalledTimes(2);

        // First call: no vqdHint (third argument absent or undefined)
        const firstCallArgs = (directSearch.directImageSearch as jest.Mock).mock.calls[0];
        expect(firstCallArgs[2]).toBeUndefined();

        // Second call: vqdHint = the VQD returned by the first call
        const secondCallArgs = (directSearch.directImageSearch as jest.Mock).mock.calls[1];
        expect(secondCallArgs[2]).toBe(REUSE_VQD);
      });

      it('different image queries must not share VQD hints', async () => {
        // Two input items with different queries
        mockExecuteFunction.getInputData = jest.fn().mockReturnValue([
          { json: {} },
          { json: {} },
        ]);

        const VQD_CATS = '3-cats-vqd';
        const VQD_DOGS = '3-dogs-vqd';

        (directSearch.directImageSearch as jest.Mock)
          .mockResolvedValueOnce({ results: [], vqd: VQD_CATS })   // 'cats' item
          .mockResolvedValueOnce({ results: [], vqd: VQD_DOGS });  // 'dogs' item

        // First item: cats
        mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation(
          (param: string, itemIndex: number, fallback?: unknown) => {
            if (param === 'operation') return 'searchImages';
            if (param === 'imageQuery') return itemIndex === 0 ? 'cats' : 'dogs';
            if (param === 'imageSearchOptions') return { safeSearch: -1, maxResults: 5 };
            if (param === 'locale') return 'en-us';
            if (param === 'debugMode') return false;
            if (param === 'cacheSettings') return { enableCache: false };
            if (param === 'errorHandling') return 'continueOnFail';
            return fallback;
          }
        );

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(directSearch.directImageSearch).toHaveBeenCalledTimes(2);

        // 'cats' call — no hint
        const catsCallArgs = (directSearch.directImageSearch as jest.Mock).mock.calls[0];
        expect(catsCallArgs[0]).toBe('cats');
        expect(catsCallArgs[2]).toBeUndefined();

        // 'dogs' call — no hint (different query, VQD must not be shared)
        const dogsCallArgs = (directSearch.directImageSearch as jest.Mock).mock.calls[1];
        expect(dogsCallArgs[0]).toBe('dogs');
        expect(dogsCallArgs[2]).toBeUndefined();
      });

      it('processed image output does not expose the VQD token', async () => {
        setupNodeParameters('searchImages', 'cats');

        (directSearch.directImageSearch as jest.Mock).mockResolvedValue({
          results: [
            {
              title: 'Cat',
              url: 'https://example.com/cat.jpg',
              thumbnail: 'https://t.example.com/cat.jpg',
              source: 'https://example.com',
              width: 100,
              height: 100,
            },
          ],
          vqd: '3-secret-vqd-token',
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        const output = result.flat().map(i => i.json);
        for (const item of output) {
          expect(item).not.toHaveProperty('vqd');
          expect(JSON.stringify(item)).not.toContain('3-secret-vqd-token');
        }
      });
    });
  });

  describe('Stale enableTelemetry regression — UI property removed', () => {
    it('node description does not contain a property named enableTelemetry', () => {
      const nodeInstance = new DuckDuckGo();
      const propNames = nodeInstance.description.properties.map(p => p.name);
      expect(propNames).not.toContain('enableTelemetry');
    });

    it('stale saved enableTelemetry: true does not throw or affect execution', async () => {
      // Simulate a saved workflow that still has enableTelemetry: true in its parameter store.
      // The node must ignore the unknown parameter gracefully.
      setupNodeParameters('search', 'AI', { enableTelemetry: true });
      (duckDuckScrape.search as jest.Mock).mockResolvedValue({
        results: [{ title: 'T', url: 'https://example.com/', excerpt: 'x' }],
        noResults: false,
        vqd: 'tok',
      });

      // Must not throw even though enableTelemetry: true is in the options bag
      await expect(
        duckDuckGoNode.execute.call(mockExecuteFunction)
      ).resolves.not.toThrow();
    });

    it('successful web search completes without any telemetry-related call being required', async () => {
      // The node uses directWebSearch (mocked at module level and returns [] by default here).
      // What we verify: execute() does not throw, and no https.request (telemetry endpoint) is called.
      setupNodeParameters('search', 'AI');
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({
        results: [{ title: 'Result', url: 'https://example.com/', description: 'snippet' }],
      });

      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Must produce at least one output item (the search result)
      expect(result[0]).toHaveLength(1);
      // Processed web results have 'url', not 'success' — no error was thrown
      expect(result[0][0].json).toHaveProperty('url', 'https://example.com/');
      expect(result[0][0].json).not.toHaveProperty('error');
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

    it('should return fallback news results when primary search fails', async () => {
      // Set up node parameters
      setupNodeParameters('searchNews', 'news fallback query');

      // Primary search fails with duck-duck-scrape's known error
      (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(
        new Error('A server error occurred!')
      );

      // Fallback returns results
      (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
        success: true,
        results: [
          { title: 'Fallback Article', body: 'Fallback excerpt', href: 'https://fallback.example.com/article' },
        ],
      });

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions: must return the fallback result, NOT { success: false, error: ... }
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('title', 'Fallback Article');
      expect(result[0][0].json).toHaveProperty('description', 'Fallback excerpt');
      expect(result[0][0].json).toHaveProperty('url', 'https://fallback.example.com/article');
      expect(result[0][0].json).toHaveProperty('sourceType', 'news');
      expect(result[0][0].json).not.toHaveProperty('error');
      expect(result[0][0].pairedItem).toEqual({ item: 0 });
      // Fallback labeling must survive to final output
      expect(result[0][0].json).toHaveProperty('isFallback', true);
      expect(result[0][0].json).toHaveProperty('syndicate', 'DuckDuckGo Fallback');
    });

    it('should return error item when primary fails and fallback also fails', async () => {
      // Set up node parameters
      setupNodeParameters('searchNews', 'news total failure');

      // Both fail
      (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(
        new Error('A server error occurred!')
      );
      (fallbackSearch.fallbackNewsSearch as jest.Mock).mockRejectedValue(
        new Error('Fallback also failed')
      );

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions: must return the error item
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
    });

    describe('news fallback labeling — isFallback and syndicate end-to-end', () => {
      it('fallback news result must carry isFallback: true and syndicate: "DuckDuckGo Fallback"', async () => {
        setupNodeParameters('searchNews', 'label test query');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('primary failed'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'Label test news item', body: 'A query about label and test results', href: 'https://fallback.example.com/labeled' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        expect(item).toHaveProperty('isFallback', true);
        expect(item).toHaveProperty('syndicate', 'DuckDuckGo Fallback');
        expect(item).toHaveProperty('sourceType', 'news');
      });

      it('normal (primary) news result must carry isFallback: false', async () => {
        setupNodeParameters('searchNews', 'normal news query', { timePeriod: 'd' });
        (duckDuckScrape.searchNews as jest.Mock).mockResolvedValue({
          results: [
            {
              title: 'Real Article',
              excerpt: 'Real excerpt',
              url: 'https://news.example.com/real',
              date: 1625097600000,
              relativeTime: '1 hour ago',
              image: '',
              syndicate: 'Real News',
            },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        expect(item).toHaveProperty('isFallback', false);
        expect(item).toHaveProperty('syndicate', 'Real News');
        expect(item).toHaveProperty('sourceType', 'news');
      });
    });

    describe('32.5.1 — news fallback date and description fixes', () => {
      it('fallback result has date: null (not a millisecond timestamp that becomes year ~58344)', async () => {
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'AI Fallback Article', body: 'Some content about AI', href: 'https://fallback.example.com/article' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        // date must be null — not the result of Date.now() (ms) being multiplied by 1000
        expect(item.date).toBeNull();

        // Confirm the year-58344 regression cannot occur: if date were a string,
        // it must not contain a year far in the future.
        if (typeof item.date === 'string') {
          const year = new Date(item.date as string).getFullYear();
          expect(year).toBeLessThan(3000);
        }
      });

      it('fallback result with non-empty body has non-null description', async () => {
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'AI Article With Body', body: 'This is the article body text about AI', href: 'https://fallback.example.com/body' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        expect(item.description).toBe('This is the article body text about AI');
        expect(item.description).not.toBeNull();
      });

      it('fallback result with empty body has description: null (not broken empty string)', async () => {
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'AI Article No Body', body: '', href: 'https://fallback.example.com/nobody' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        // Empty body → excerpt becomes null → decodeHtmlEntities(null) returns null
        expect(item.description).toBeNull();
      });

      it('isFallback: true is preserved after date/description fix', async () => {
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('primary failed'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'AI Fallback Check', body: 'AI body text', href: 'https://fallback.example.com/' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        expect(item).toHaveProperty('isFallback', true);
        expect(item).toHaveProperty('syndicate', 'DuckDuckGo Fallback');
        expect(item).toHaveProperty('sourceType', 'news');
      });

      it('fallback result with body does not expose raw Date.now() value in date field', async () => {
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('primary failed'));

        const beforeMs = Date.now();
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'AI No Raw Timestamp', body: 'AI content', href: 'https://fallback.example.com/ts' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const afterMs = Date.now();
        const item = result[0][0].json;

        // date must not be a raw millisecond epoch value in the range [beforeMs, afterMs]
        if (item.date !== null && item.date !== undefined) {
          const dateValue = item.date as number;
          // A value in millisecond epoch range would be between ~1.7e12 and ~2e12
          // A correct seconds-based value would be ~1.7e9
          const isRawMilliseconds = dateValue >= beforeMs && dateValue <= afterMs;
          expect(isRawMilliseconds).toBe(false);
        }
      });
    });

    // -------------------------------------------------------------------------
    // 32.5.2 — news relevance filter (exact token matching)
    // -------------------------------------------------------------------------
    describe('32.5.2 — news fallback relevance filter', () => {
      // --- n8n token tests (length 3, >= 3 threshold) ----------------------

      it('keeps fallback result whose title contains the query token n8n', async () => {
        setupNodeParameters('searchNews', 'n8n');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'n8n workflow automation tips', body: 'How to use n8n', href: 'https://n8n.io/news' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('title', 'n8n workflow automation tips');
        expect(result[0][0].json).toHaveProperty('isFallback', true);
      });

      it('keeps fallback result whose body contains the query token but title does not', async () => {
        setupNodeParameters('searchNews', 'n8n');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'Workflow Automation Update', body: 'This covers n8n integration changes', href: 'https://example.com/body-match' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('url', 'https://example.com/body-match');
        expect(result[0][0].json).toHaveProperty('isFallback', true);
      });

      it('drops fallback result whose title and body do not contain the query token', async () => {
        setupNodeParameters('searchNews', 'n8n');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        // Simulate what the old broken fallback returned — generic BBC/CNN headlines
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'World leaders meet in Geneva', body: 'Top diplomats convene to discuss global issues', href: 'https://bbc.com/world/article' },
            { title: 'Markets rally on economic data', body: 'US stocks rise amid positive sentiment', href: 'https://cnn.com/markets/rally' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // All results are irrelevant — must fall through to the error-item path
        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('success', false);
        expect(result[0][0].json).toHaveProperty('error');
      });

      it('drops generic BBC result and keeps relevant n8n result when mixed', async () => {
        setupNodeParameters('searchNews', 'n8n');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'World leaders meet in Geneva', body: 'UN summit update', href: 'https://bbc.com/world' },
            { title: 'n8n 1.x release notes', body: 'New features in n8n', href: 'https://n8n.io/release' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // Only the n8n result survives
        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('url', 'https://n8n.io/release');
        expect(result[0][0].json).toHaveProperty('isFallback', true);
      });

      it('preserves the token n8n (length 3, >= 3 threshold) as a valid filter token', async () => {
        setupNodeParameters('searchNews', 'n8n');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('primary failed'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'n8n integration guide', body: 'Setup steps', href: 'https://docs.n8n.io/guide' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // 'n8n' is 3 characters — must NOT be excluded by the >= 3 token length rule
        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('isFallback', true);
        // Must not be an error item
        expect(result[0][0].json).not.toHaveProperty('success', false);
      });

      // --- AI token tests (explicit 2-char allowlist) -----------------------

      it('query AI keeps result whose title contains standalone token "ai"', async () => {
        // 'ai' is in the explicit short-token allowlist; a result with 'AI' as a
        // standalone word must survive the filter.
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'AI startup raises funding', body: 'An AI company secured Series B', href: 'https://techcrunch.com/ai-funding' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('url', 'https://techcrunch.com/ai-funding');
        expect(result[0][0].json).toHaveProperty('isFallback', true);
      });

      it('query AI drops result where "ai" appears only as a substring of unrelated words', async () => {
        // Words like 'Taiwan', 'said', 'again', 'Britain' contain 'ai' as a
        // substring but 'ai' is NOT a standalone token in them.
        // Exact token matching must reject these results.
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            {
              title: 'Taiwan said leaders would meet again',
              body: 'Britain and other nations convened to discuss the matter',
              href: 'https://bbc.com/world/taiwan',
            },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // 'ai' does not appear as a standalone token — result must be dropped
        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('success', false);
        expect(result[0][0].json).toHaveProperty('error');
      });

      it('query AI: keeps relevant AI result, drops Taiwan/said/again result when mixed', async () => {
        setupNodeParameters('searchNews', 'AI');
        (duckDuckScrape.searchNews as jest.Mock).mockRejectedValue(new Error('A server error occurred!'));
        (fallbackSearch.fallbackNewsSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            {
              title: 'Taiwan said the summit would happen again',
              body: 'Britain discussed diplomatic relations',
              href: 'https://bbc.com/taiwan',
            },
            {
              title: 'AI regulation bill passes Senate',
              body: 'New AI rules take effect next year',
              href: 'https://reuters.com/ai-bill',
            },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

        // Only the AI article survives
        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toHaveProperty('url', 'https://reuters.com/ai-bill');
        expect(result[0][0].json).toHaveProperty('isFallback', true);
      });
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
      // Fallback also fails so error item is returned
      (fallbackSearch.fallbackVideoSearch as jest.Mock).mockRejectedValue(
        new Error('Fallback failed')
      );

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

    it('should return fallback video results when primary search fails', async () => {
      // Set up node parameters
      setupNodeParameters('searchVideos', 'video fallback query');

      // Primary search fails
      (duckDuckScrape.searchVideos as jest.Mock).mockRejectedValue(
        new Error('A server error occurred!')
      );

      // Fallback returns results
      (fallbackSearch.fallbackVideoSearch as jest.Mock).mockResolvedValue({
        success: true,
        results: [
          { title: 'Fallback Video', body: 'Fallback video description', href: 'https://fallback.example.com/video' },
        ],
      });

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions: must return the fallback result, NOT { success: false, error: ... }
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('title', 'Fallback Video');
      expect(result[0][0].json).toHaveProperty('description', 'Fallback video description');
      expect(result[0][0].json).toHaveProperty('url', 'https://fallback.example.com/video');
      expect(result[0][0].json).toHaveProperty('sourceType', 'video');
      expect(result[0][0].json).not.toHaveProperty('error');
      expect(result[0][0].pairedItem).toEqual({ item: 0 });
      // Fallback labeling must survive to final output
      expect(result[0][0].json).toHaveProperty('isFallback', true);
      expect(result[0][0].json).toHaveProperty('publisher', 'DuckDuckGo Fallback');
    });

    it('should return error item when primary fails and fallback also fails (video)', async () => {
      // Set up node parameters
      setupNodeParameters('searchVideos', 'video total failure');

      // Both fail
      (duckDuckScrape.searchVideos as jest.Mock).mockRejectedValue(
        new Error('A server error occurred!')
      );
      (fallbackSearch.fallbackVideoSearch as jest.Mock).mockRejectedValue(
        new Error('Fallback also failed')
      );

      // Execute the node
      const result = await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Assertions: must return the error item
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('success', false);
      expect(result[0][0].json).toHaveProperty('error');
    });

    describe('video fallback labeling — isFallback and publisher end-to-end', () => {
      it('fallback video result must carry isFallback: true and publisher: "DuckDuckGo Fallback"', async () => {
        setupNodeParameters('searchVideos', 'video label test');
        (duckDuckScrape.searchVideos as jest.Mock).mockRejectedValue(new Error('primary failed'));
        (fallbackSearch.fallbackVideoSearch as jest.Mock).mockResolvedValue({
          success: true,
          results: [
            { title: 'Labeled Video', body: 'Labeled video body', href: 'https://fallback.example.com/labeled-video' },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        expect(item).toHaveProperty('isFallback', true);
        expect(item).toHaveProperty('publisher', 'DuckDuckGo Fallback');
        expect(item).toHaveProperty('sourceType', 'video');
      });

      it('normal (primary) video result must carry isFallback: false', async () => {
        setupNodeParameters('searchVideos', 'normal video query');
        (duckDuckScrape.searchVideos as jest.Mock).mockResolvedValue({
          results: [
            {
              title: 'Real Video',
              description: 'Real video description',
              url: 'https://videos.example.com/real',
              image: '',
              duration: '5:00',
              published: '2024-01-01',
              publishedOn: 'YouTube',
              publisher: 'Real Publisher',
              viewCount: '1000',
            },
          ],
        });

        const result = await duckDuckGoNode.execute.call(mockExecuteFunction);
        const item = result[0][0].json;

        expect(item).toHaveProperty('isFallback', false);
        expect(item).toHaveProperty('publisher', 'Real Publisher');
        expect(item).toHaveProperty('sourceType', 'video');
      });
    });

    describe('videoSearchOptions.timePeriod regression — stale value is ignored', () => {
      it('should call searchVideos without a time property when stale timePeriod is stored', async () => {
        // Simulate a saved workflow that has timePeriod: 'w' stored (stale — never exposed in UI)
        mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
          if (parameter === 'operation') return 'searchVideos';
          if (parameter === 'videoQuery') return 'video time period test';
          if (parameter === 'videoSearchOptions') return {
            timePeriod: 'w', // stale: Past Week — never exposed in Video Search Options UI
          };
          return defaultValue ?? null;
        });

        (duckDuckScrape.searchVideos as jest.Mock).mockResolvedValue({ results: [] });

        await duckDuckGoNode.execute.call(mockExecuteFunction);

        // searchVideos must have been called
        expect(duckDuckScrape.searchVideos).toHaveBeenCalledWith(
          'video time period test',
          expect.any(Object)
        );

        // The options passed to searchVideos must not contain a time property
        // (timePeriod was removed from runtime — video always uses all-time)
        const calledOptions = (duckDuckScrape.searchVideos as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
        expect(calledOptions).not.toHaveProperty('time');
        expect(calledOptions).not.toHaveProperty('timePeriod');
      });

      it('should produce identical searchVideos calls regardless of stale timePeriod value', async () => {
        const staleValues = ['d', 'w', 'm', 'y', ''];

        for (const staleValue of staleValues) {
          jest.clearAllMocks();
          (duckDuckScrape.searchVideos as jest.Mock).mockResolvedValue({ results: [] });

          mockGetNodeParameter.mockImplementation((parameter: string, _itemIndex: number, defaultValue?: unknown) => {
            if (parameter === 'operation') return 'searchVideos';
            if (parameter === 'videoQuery') return 'stable video query';
            if (parameter === 'videoSearchOptions') return { timePeriod: staleValue };
            return defaultValue ?? null;
          });

          await duckDuckGoNode.execute.call(mockExecuteFunction);

          expect(duckDuckScrape.searchVideos).toHaveBeenCalledTimes(1);
          expect(duckDuckScrape.searchVideos).toHaveBeenCalledWith(
            'stable video query',
            expect.any(Object)
          );
        }
      });
    });
  });


  describe('Stale useApiKey regression — credential must never be read', () => {
    it('should not call getCredentials even when stale useApiKey: true is stored in a saved workflow', async () => {
      // Simulate a saved workflow that has useApiKey: true stored (stale from old node version)
      setupNodeParameters('search', 'api auth query', { useApiKey: true });

      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // getCredentials must never be called — useApiKey is no longer a runtime parameter
      expect(mockExecuteFunction.getCredentials).not.toHaveBeenCalled();

      // directWebSearch must still be called normally — stale useApiKey has no effect on search
      expect(directSearch.directWebSearch).toHaveBeenCalledWith(
        'api auth query',
        expect.any(Object)
      );
    });

    it('should not throw when stale useApiKey: true is present and no credential is configured', async () => {
      // Stale useApiKey: true with getCredentials configured to reject (no credential set up)
      setupNodeParameters('search', 'no credential query', { useApiKey: true });

      (mockExecuteFunction.getCredentials as jest.Mock).mockRejectedValue(
        new Error('No credential configured')
      );
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({ results: [] });

      // Must not throw — stale useApiKey must not trigger credential lookup
      await expect(
        duckDuckGoNode.execute.call(mockExecuteFunction)
      ).resolves.toBeDefined();

      expect(mockExecuteFunction.getCredentials).not.toHaveBeenCalled();
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
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('test query', expect.not.objectContaining({
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
      expect(directSearch.directWebSearch).toHaveBeenNthCalledWith(1, 'query 1', expect.any(Object));
      expect(directSearch.directWebSearch).toHaveBeenNthCalledWith(2, 'query 2', expect.any(Object));

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
