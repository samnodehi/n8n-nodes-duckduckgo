import { IExecuteFunctions } from 'n8n-workflow';
import { DuckDuckGo } from '../DuckDuckGo.node';
import * as directSearch from '../directSearch';

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

describe('DuckDuckGo Node - Locale Support', () => {
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

  describe('Locale Parameter', () => {
    it('should use global locale when region is not specified', async () => {
      // Mock the node parameters
      mockGetNodeParameter
        .mockImplementation((parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'search';
            case 'query':
              return 'test query';
            case 'locale':
              return 'fr-fr'; // Global locale: French
            case 'webSearchOptions':
              return {
                maxResults: 10,
                safeSearch: 1,
                // No region specified
              };
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return {
                enableCache: false,
              };
            case 'enableTelemetry':
              return false;
            case 'useApiKey':
              return false;
            default:
              return fallback;
          }
        });

      // Mock search result
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            description: 'Test description'
          }
        ]
      });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify the search was called with the global locale
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('"test query"', expect.objectContaining({
        locale: 'fr-fr',
        safeSearch: 'moderate',
      }));
    });

    it('should prioritize region-specific setting over global locale', async () => {
      // Mock the node parameters
      mockGetNodeParameter
        .mockImplementation((parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'search';
            case 'query':
              return 'test query';
            case 'locale':
              return 'fr-fr'; // Global locale: French
            case 'webSearchOptions':
              return {
                maxResults: 10,
                region: 'de-de', // Region specific: German
                safeSearch: 1,
              };
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return {
                enableCache: false,
              };
            case 'enableTelemetry':
              return false;
            case 'useApiKey':
              return false;
            default:
              return fallback;
          }
        });

      // Mock search result
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            description: 'Test description'
          }
        ]
      });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify the search was called with the region-specific locale (not global)
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('"test query"', expect.objectContaining({
        locale: 'de-de',
        safeSearch: 'moderate',
      }));
    });

    it('should work with different search types', async () => {
      // Mock the node parameters for image search
      mockGetNodeParameter
        .mockImplementation((parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'searchImages';
            case 'imageQuery':
              return 'test image query';
            case 'locale':
              return 'es-es'; // Global locale: Spanish
            case 'imageSearchOptions':
              return {
                maxResults: 10,
                safeSearch: 1,
                // No region specified
              };
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return {
                enableCache: false,
              };
            default:
              return fallback;
          }
        });

      // Mock search result for images
      (directSearch.directImageSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            title: 'Test Image Result',
            url: 'https://example.com/image.jpg',
            thumbnail: 'https://example.com/thumb.jpg',
            source: 'https://example.com',
          }
        ]
      });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify the search was called with the global locale for image search
      expect(directSearch.directImageSearch).toHaveBeenCalledWith('test image query', expect.objectContaining({
        locale: 'es-es',
      }));
    });

    it('should use default locale when neither global nor region is specified', async () => {
      // Mock the node parameters but don't specify locale or region
      mockGetNodeParameter
        .mockImplementation((parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'search';
            case 'query':
              return 'test query';
            // No locale specified, should use default
            case 'webSearchOptions':
              return {
                maxResults: 10,
                safeSearch: 1,
                // No region specified
              };
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return {
                enableCache: false,
              };
            case 'enableTelemetry':
              return false;
            case 'useApiKey':
              return false;
            default:
              return fallback;
          }
        });

      // Mock search result
      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            description: 'Test description'
          }
        ]
      });

      // Execute the node
      await duckDuckGoNode.execute.call(mockExecuteFunction);

      // Verify the default locale was passed to the search function
      expect(directSearch.directWebSearch).toHaveBeenCalledWith('"test query"', expect.objectContaining({
        locale: 'en-us',
        safeSearch: 'moderate',
      }));
    });
  });
});
