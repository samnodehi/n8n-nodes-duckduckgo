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
      helpers: {
        returnJsonArray: jest.fn((items: any[]) =>
          items.map((item: any, index: number) => ({ json: item, pairedItem: { item: index } })),
        ),
      },
      continueOnFail: jest.fn().mockReturnValue(false),
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    } as unknown as IExecuteFunctions;

    jest.clearAllMocks();
  });

  describe('Region / locale', () => {
    it('uses the per-operation region when specified (web search)', async () => {
      mockGetNodeParameter.mockImplementation(
        (parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'search';
            case 'query':
              return 'test query';
            case 'webSearchOptions':
              return { maxResults: 10, region: 'fr-fr', safeSearch: 1 };
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return { enableCache: false };
            default:
              return fallback;
          }
        },
      );

      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({
        results: [{ title: 'Test Result', url: 'https://example.com', description: 'Test description' }],
      });

      await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(directSearch.directWebSearch).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ locale: 'fr-fr', safeSearch: 'moderate' }),
      );
    });

    it('uses the per-operation region for other search types (image search)', async () => {
      mockGetNodeParameter.mockImplementation(
        (parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'searchImages';
            case 'imageQuery':
              return 'test image query';
            case 'imageSearchOptions':
              return { maxResults: 10, region: 'es-es', safeSearch: 1 };
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return { enableCache: false };
            default:
              return fallback;
          }
        },
      );

      (directSearch.directImageSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            title: 'Test Image Result',
            url: 'https://example.com/image.jpg',
            thumbnail: 'https://example.com/thumb.jpg',
            source: 'https://example.com',
          },
        ],
        vqd: '3-locale-test-vqd',
      });

      await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(directSearch.directImageSearch).toHaveBeenCalledWith(
        'test image query',
        expect.objectContaining({ locale: 'es-es' }),
        undefined, // no vqdHint on the first (and only) call
      );
    });

    it('falls back to the default region (wt-wt) when none is specified', async () => {
      mockGetNodeParameter.mockImplementation(
        (parameter: string, _itemIndex: number, fallback: any) => {
          switch (parameter) {
            case 'operation':
              return 'search';
            case 'query':
              return 'test query';
            case 'webSearchOptions':
              return { maxResults: 10, safeSearch: 1 }; // no region
            case 'debugMode':
              return false;
            case 'errorHandling':
              return 'continueOnFail';
            case 'cacheSettings':
              return { enableCache: false };
            default:
              return fallback;
          }
        },
      );

      (directSearch.directWebSearch as jest.Mock).mockResolvedValue({
        results: [{ title: 'Test Result', url: 'https://example.com', description: 'Test description' }],
      });

      await duckDuckGoNode.execute.call(mockExecuteFunction);

      expect(directSearch.directWebSearch).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ locale: 'wt-wt', safeSearch: 'moderate' }),
      );
    });
  });
});
