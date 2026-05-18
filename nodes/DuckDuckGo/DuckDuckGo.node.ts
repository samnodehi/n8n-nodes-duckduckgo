/**
 * DuckDuckGo n8n node
 */
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  NodeConnectionType,
} from 'n8n-workflow';

// Import types from duck-duck-scrape for compatibility, but use fallback functions
import {
  searchNews,
  searchVideos,
  SearchOptions,
  ImageSearchOptions,
  NewsSearchOptions,
  VideoSearchOptions,
  SafeSearchType,
  SearchTimeType,
} from 'duck-duck-scrape';

// Import our direct search implementations
import { directWebSearch, directImageSearch, getSafeSearchString } from './directSearch';

// Use duck-duck-scrape types directly

import {
  DuckDuckGoOperation,
  SafeSearchLevel,
  TimePeriod,
} from './types';

import {
  processWebSearchResults,
  processImageSearchResults,
  processNewsSearchResults,
  processVideoSearchResults,
} from './processors';

import { DEFAULT_PARAMETERS, NODE_INFO, REGIONS, BROWSER_USER_AGENT } from './constants';

import {
  parseApiError,
  createLogEntry,
  LogLevel,
} from './utils';

import {
  getCached,
  setCache,
} from './cache';


import { buildSearchQuery, validateSearchOperators, OPERATOR_INFO, ISearchOperators } from './searchOperators';
import { paginateWithVqd, DEFAULT_PAGINATION_CONFIG } from './vqdPagination';
import { fallbackNewsSearch, fallbackVideoSearch } from './fallbackSearch';

// Add locale options constant
const LOCALE_OPTIONS = [
  { name: 'English (US)', value: 'en-us' },
  { name: 'English (UK)', value: 'uk-en' },
  { name: 'Spanish (Spain)', value: 'es-es' },
  { name: 'French (France)', value: 'fr-fr' },
  { name: 'German (Germany)', value: 'de-de' },
  { name: 'Italian (Italy)', value: 'it-it' },
  { name: 'Japanese (Japan)', value: 'jp-jp' },
  { name: 'Russian (Russia)', value: 'ru-ru' },
  { name: 'Chinese (China)', value: 'zh-cn' },
  { name: 'Portuguese (Brazil)', value: 'br-pt' },
  { name: 'Dutch (Netherlands)', value: 'nl-nl' },
  { name: 'Polish (Poland)', value: 'pl-pl' },
  { name: 'Swedish (Sweden)', value: 'se-sv' },
  { name: 'Korean (Korea)', value: 'kr-ko' },
  { name: 'Turkish (Turkey)', value: 'tr-tr' },
  { name: 'Arabic (Saudi Arabia)', value: 'sa-ar' },
  { name: 'Hebrew (Israel)', value: 'il-he' },
	{ name: 'Persian (Iran)', value: 'ir-fa' },
];

// Sleep for a fixed amount of time
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Convert numeric safe search value to SafeSearchType enum
 */
function getSafeSearchType(value: number): SafeSearchType {
  switch (value) {
    case 0:
      return SafeSearchType.STRICT;
    case -1:
      return SafeSearchType.MODERATE;
    case -2:
      return SafeSearchType.OFF;
    default:
      return SafeSearchType.MODERATE; // Default to moderate
  }
}

/**
 * Convert time period string to SearchTimeType enum
 */
function getSearchTimeType(value?: string): SearchTimeType {
  switch (value) {
    case 'pastDay':
    case 'd':
      return SearchTimeType.DAY;
    case 'pastWeek':
    case 'w':
      return SearchTimeType.WEEK;
    case 'pastMonth':
    case 'm':
      return SearchTimeType.MONTH;
    case 'pastYear':
    case 'y':
      return SearchTimeType.YEAR;
    case 'anyTime':
    case 'a':
    default:
      return SearchTimeType.ALL; // Default to all time
  }
}


/**
 * Enhanced query builder for improved search quality
 */
function enhanceSearchQuery(query: string, searchType: string = 'web'): string {
  // Clean and prepare query — do not mutate the user query beyond trimming
  const enhancedQuery = query.trim();

  // Note: pattern-based year injection was removed. The query is returned as-is.
  // Explicit search operators are handled upstream via buildSearchQuery().
  void searchType; // parameter retained for API compatibility

  return enhancedQuery;
}


/**
 * DuckDuckGo node implementation with cleanly separated operations
 */
export class DuckDuckGo implements INodeType {
  description: INodeTypeDescription = {
    displayName: NODE_INFO.DISPLAY_NAME,
    name: NODE_INFO.NAME,
    icon: 'file:duckduckgo.svg',
    group: ['transform'],
    version: NODE_INFO.VERSION,
    subtitle: '={{$parameter["operation"]}}',
    description: NODE_INFO.DESCRIPTION,
    defaults: {
      name: NODE_INFO.DISPLAY_NAME,
    },
    inputs: ['main' as NodeConnectionType],
    outputs: ['main' as NodeConnectionType],
    // @ts-ignore - Enable this node to be used as an AI Agent tool
    usableAsTool: true,
    credentials: [],
    properties: [
      // Operation Selection - The first parameter per requirements
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: DuckDuckGoOperation.Search,
        noDataExpression: true,
        required: true,
        description: 'Type of search to perform with DuckDuckGo',
        options: [
          {
            name: 'Web Search',
            value: DuckDuckGoOperation.Search,
            description: 'Search websites and web content',
            action: 'Search the web',
          },
          {
            name: 'Image Search',
            value: DuckDuckGoOperation.SearchImages,
            description: 'Find images across the web',
            action: 'Search for images',
          },
          {
            name: 'News Search',
            value: DuckDuckGoOperation.SearchNews,
            description: 'Discover news articles and updates',
            action: 'Search for news',
          },
          {
            name: 'Video Search',
            value: DuckDuckGoOperation.SearchVideos,
            description: 'Find videos from various sources',
            action: 'Search for videos',
          }
        ],
      },

      // Locale Parameter - For multi-language search
      {
        displayName: 'Locale',
        name: 'locale',
        type: 'options',
        default: 'en-us',
        description: 'Specify the search language/region locale',
        options: LOCALE_OPTIONS,
      },


      // ----------------------------------------
      // Web Search Operation Parameters
      // ----------------------------------------
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        required: true,
        default: '',
        description: 'The search terms to look for on the web',
        placeholder: 'Enter your search query',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Search,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // Web Search Configuration
      {
        displayName: 'Web Search Options',
        name: 'webSearchOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {
          maxResults: DEFAULT_PARAMETERS.MAX_RESULTS,
          region: DEFAULT_PARAMETERS.REGION,
          safeSearch: DEFAULT_PARAMETERS.SAFE_SEARCH,
        },
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Search,
            ],
          },
        },
        options: [
          {
            displayName: 'Maximum Results',
            name: 'maxResults',
            type: 'number',
            default: DEFAULT_PARAMETERS.MAX_RESULTS,
            description: 'Maximum number of search results to return',
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
          },
          {
            displayName: 'Region',
            name: 'region',
            type: 'options',
            default: DEFAULT_PARAMETERS.REGION,
            description: 'The region to target for web search results',
            options: REGIONS,
          },
          {
            displayName: 'Safe Search',
            name: 'safeSearch',
            type: 'options',
            default: DEFAULT_PARAMETERS.SAFE_SEARCH,
            description: 'Content filtering level for web search',
            options: [
              {
                name: 'Strict',
                value: SafeSearchLevel.Strict,
                description: 'Filter explicit content',
              },
              {
                name: 'Moderate',
                value: SafeSearchLevel.Moderate,
                description: 'Default filtering level',
              },
              {
                name: 'Off',
                value: SafeSearchLevel.Off,
                description: 'No content filtering',
              }
            ],
          },

          {
            displayName: 'Return Raw Results',
            name: 'returnRawResults',
            type: 'boolean',
            default: false,
            description: 'Whether to return the raw API response instead of processed results',
          },
          {
            displayName: 'Use Search Operators',
            name: 'useSearchOperators',
            type: 'boolean',
            default: false,
            description: 'Whether to enable advanced search operators',
          },
          {
            displayName: 'Search Operators',
            name: 'searchOperators',
            type: 'collection',
            placeholder: 'Add Search Operator',
            default: {},
            displayOptions: {
              show: {
                useSearchOperators: [true],
              },
            },
            description: 'Advanced search operators to refine your search',
            options: [
              {
                displayName: 'Site',
                name: 'site',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.site.placeholder,
                description: `${OPERATOR_INFO.site.description}. Example: ${OPERATOR_INFO.site.example}`,
              },
              {
                displayName: 'File Type',
                name: 'filetype',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.filetype.placeholder,
                description: `${OPERATOR_INFO.filetype.description}. Example: ${OPERATOR_INFO.filetype.example}`,
              },
              {
                displayName: 'In Title',
                name: 'intitle',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.intitle.placeholder,
                description: `${OPERATOR_INFO.intitle.description}. Example: ${OPERATOR_INFO.intitle.example}`,
              },
              {
                displayName: 'In URL',
                name: 'inurl',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.inurl.placeholder,
                description: `${OPERATOR_INFO.inurl.description}. Example: ${OPERATOR_INFO.inurl.example}`,
              },
              {
                displayName: 'In Body',
                name: 'inbody',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.inbody.placeholder,
                description: `${OPERATOR_INFO.inbody.description}. Example: ${OPERATOR_INFO.inbody.example}`,
              },
              {
                displayName: 'Exclude Words',
                name: 'exclude',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.exclude.placeholder,
                description: `${OPERATOR_INFO.exclude.description}. Example: ${OPERATOR_INFO.exclude.example}`,
              },
              {
                displayName: 'Exact Phrase',
                name: 'exact',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.exact.placeholder,
                description: `${OPERATOR_INFO.exact.description}. Example: ${OPERATOR_INFO.exact.example}`,
              },
              {
                displayName: 'OR Terms',
                name: 'or',
                type: 'string',
                default: '',
                placeholder: 'term1, term2, term3',
                description: 'Search for any of these terms (comma-separated). Example: python, javascript, typescript',
              },
              {
                displayName: 'Related',
                name: 'related',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.related.placeholder,
                description: `${OPERATOR_INFO.related.description}. Example: ${OPERATOR_INFO.related.example}`,
              },
              {
                displayName: 'Cache',
                name: 'cache',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.cache.placeholder,
                description: `${OPERATOR_INFO.cache.description}. Example: ${OPERATOR_INFO.cache.example}`,
              },
              {
                displayName: 'Define',
                name: 'define',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.define.placeholder,
                description: `${OPERATOR_INFO.define.description}. Example: ${OPERATOR_INFO.define.example}`,
              },
              {
                displayName: 'All In Title',
                name: 'allintitle',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.allintitle.placeholder,
                description: `${OPERATOR_INFO.allintitle.description}. Example: ${OPERATOR_INFO.allintitle.example}`,
              },
              {
                displayName: 'All In URL',
                name: 'allinurl',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.allinurl.placeholder,
                description: `${OPERATOR_INFO.allinurl.description}. Example: ${OPERATOR_INFO.allinurl.example}`,
              },
              {
                displayName: 'All In Text',
                name: 'allintext',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.allintext.placeholder,
                description: `${OPERATOR_INFO.allintext.description}. Example: ${OPERATOR_INFO.allintext.example}`,
              },
              {
                displayName: 'Location',
                name: 'location',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.location.placeholder,
                description: `${OPERATOR_INFO.location.description}. Example: ${OPERATOR_INFO.location.example}`,
              },
              {
                displayName: 'Language Code',
                name: 'language',
                type: 'string',
                default: '',
                placeholder: OPERATOR_INFO.language.placeholder,
                description: `${OPERATOR_INFO.language.description}. Example: ${OPERATOR_INFO.language.example}`,
              },
            ],
          },
        ],
      },

      // ----------------------------------------
      // Image Search Operation Parameters
      // ----------------------------------------
      {
        displayName: 'Image Search Query',
        name: 'imageQuery',
        type: 'string',
        required: true,
        default: '',
        description: 'The search terms to find images for',
        placeholder: 'Enter image search query',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.SearchImages,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // Image Search Configuration
      {
        displayName: 'Image Search Options',
        name: 'imageSearchOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {
          maxResults: DEFAULT_PARAMETERS.MAX_RESULTS,
          region: DEFAULT_PARAMETERS.REGION,
          safeSearch: DEFAULT_PARAMETERS.SAFE_SEARCH,
        },
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.SearchImages,
            ],
          },
        },
        options: [
          {
            displayName: 'Maximum Results',
            name: 'maxResults',
            type: 'number',
            default: DEFAULT_PARAMETERS.MAX_RESULTS,
            description: 'Maximum number of image results to return',
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
          },
          {
            displayName: 'Region',
            name: 'region',
            type: 'options',
            default: DEFAULT_PARAMETERS.REGION,
            description: 'The region to target for image search',
            options: REGIONS,
          },
          {
            displayName: 'Safe Search',
            name: 'safeSearch',
            type: 'options',
            default: DEFAULT_PARAMETERS.SAFE_SEARCH,
            description: 'Content filtering level for images',
            options: [
              {
                name: 'Strict',
                value: SafeSearchLevel.Strict,
                description: 'Filter explicit images',
              },
              {
                name: 'Moderate',
                value: SafeSearchLevel.Moderate,
                description: 'Default filtering level',
              },
              {
                name: 'Off',
                value: SafeSearchLevel.Off,
                description: 'No image filtering',
              }
            ],
          },
          {
            displayName: 'Return Raw Results',
            name: 'returnRawResults',
            type: 'boolean',
            default: false,
            description: 'Whether to return the raw API response instead of processed results',
          },
        ],
      },

      // ----------------------------------------
      // News Search Operation Parameters
      // ----------------------------------------
      {
        displayName: 'News Search Query',
        name: 'newsQuery',
        type: 'string',
        required: true,
        default: '',
        description: 'The search terms to find news articles for',
        placeholder: 'Enter news search query',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.SearchNews,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // News Search Configuration
      {
        displayName: 'News Search Options',
        name: 'newsSearchOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {
          maxResults: DEFAULT_PARAMETERS.MAX_RESULTS,
          region: DEFAULT_PARAMETERS.REGION,
          safeSearch: DEFAULT_PARAMETERS.SAFE_SEARCH,
        },
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.SearchNews,
            ],
          },
        },
        options: [
          {
            displayName: 'Maximum Results',
            name: 'maxResults',
            type: 'number',
            default: DEFAULT_PARAMETERS.MAX_RESULTS,
            description: 'Maximum number of news articles to return',
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
          },
          {
            displayName: 'Region',
            name: 'region',
            type: 'options',
            default: DEFAULT_PARAMETERS.REGION,
            description: 'The region to target for news',
            options: REGIONS,
          },
          {
            displayName: 'Safe Search',
            name: 'safeSearch',
            type: 'options',
            default: DEFAULT_PARAMETERS.SAFE_SEARCH,
            description: 'Content filtering level for news articles',
            options: [
              {
                name: 'Strict',
                value: SafeSearchLevel.Strict,
                description: 'Filter explicit content',
              },
              {
                name: 'Moderate',
                value: SafeSearchLevel.Moderate,
                description: 'Default filtering level',
              },
              {
                name: 'Off',
                value: SafeSearchLevel.Off,
                description: 'No content filtering',
              }
            ],
          },
          {
            displayName: 'Time Period',
            name: 'timePeriod',
            type: 'options',
            default: TimePeriod.PastWeek,
            description: 'Time range for news articles',
            options: [
              {
                name: 'All Time',
                value: TimePeriod.AllTime,
                description: 'No time restriction',
              },
              {
                name: 'Past Day',
                value: TimePeriod.PastDay,
                description: 'Last 24 hours',
              },
              {
                name: 'Past Week',
                value: TimePeriod.PastWeek,
                description: 'Last 7 days',
              },
              {
                name: 'Past Month',
                value: TimePeriod.PastMonth,
                description: 'Last 30 days',
              },
              {
                name: 'Past Year',
                value: TimePeriod.PastYear,
                description: 'Last 365 days',
              },
            ],
          },
          {
            displayName: 'Return Raw Results',
            name: 'returnRawResults',
            type: 'boolean',
            default: false,
            description: 'Whether to return the raw API response instead of processed results',
          },
        ],
      },

      // ----------------------------------------
      // Video Search Operation Parameters
      // ----------------------------------------
      {
        displayName: 'Video Search Query',
        name: 'videoQuery',
        type: 'string',
        required: true,
        default: '',
        description: 'The search terms to find videos for',
        placeholder: 'Enter video search query',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.SearchVideos,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // Video Search Configuration
      {
        displayName: 'Video Search Options',
        name: 'videoSearchOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {
          maxResults: DEFAULT_PARAMETERS.MAX_RESULTS,
          region: DEFAULT_PARAMETERS.REGION,
          safeSearch: DEFAULT_PARAMETERS.SAFE_SEARCH,
        },
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.SearchVideos,
            ],
          },
        },
        options: [
          {
            displayName: 'Maximum Results',
            name: 'maxResults',
            type: 'number',
            default: DEFAULT_PARAMETERS.MAX_RESULTS,
            description: 'Maximum number of videos to return',
            typeOptions: {
              minValue: 1,
              maxValue: 100,
            },
          },
          {
            displayName: 'Region',
            name: 'region',
            type: 'options',
            default: DEFAULT_PARAMETERS.REGION,
            description: 'The region to target for videos',
            options: REGIONS,
          },
          {
            displayName: 'Safe Search',
            name: 'safeSearch',
            type: 'options',
            default: DEFAULT_PARAMETERS.SAFE_SEARCH,
            description: 'Content filtering level for videos',
            options: [
              {
                name: 'Strict',
                value: SafeSearchLevel.Strict,
                description: 'Filter explicit videos',
              },
              {
                name: 'Moderate',
                value: SafeSearchLevel.Moderate,
                description: 'Default filtering level',
              },
              {
                name: 'Off',
                value: SafeSearchLevel.Off,
                description: 'No video filtering',
              }
            ],
          },
          {
            displayName: 'Return Raw Results',
            name: 'returnRawResults',
            type: 'boolean',
            default: false,
            description: 'Whether to return the raw API response instead of processed results',
          },
        ],
      },

      // Common Options for all operations
      {
        displayName: 'Error Handling',
        name: 'errorHandling',
        type: 'options',
        default: 'continueOnFail',
        description: 'How errors should be handled',
        options: [
          {
            name: 'Break on Error',
            value: 'breakOnError',
            description: 'Stop executing when an error occurs',
          },
          {
            name: 'Continue on Error',
            value: 'continueOnFail',
            description: 'Continue execution even when errors occur',
          },
        ],
      },
      {
        displayName: 'Debug Mode',
        name: 'debugMode',
        type: 'boolean',
        default: false,
        description: 'When enabled, includes detailed request and response information for troubleshooting',
      },

      // Cache settings
      {
        displayName: 'Cache Settings',
        name: 'cacheSettings',
        type: 'collection',
        placeholder: 'Add Cache Setting',
        default: {
          cacheTTL: 300,
          enableCache: true,
        },
        options: [
          {
            displayName: 'Enable Cache',
            name: 'enableCache',
            type: 'boolean',
            default: true,
            description: 'Whether to cache search results to improve performance for repeated queries',
          },
          {
            displayName: 'Cache TTL',
            name: 'cacheTTL',
            type: 'number',
            default: 300,
            description: 'Time in seconds to keep results in cache (Time-To-Live)',
            typeOptions: {
              minValue: 60,
              maxValue: 86400, // 24 hours
            },
          },
        ],
      },


    ],
  };

  /**
   * Advanced search method with super pagination capabilities
   * Uses both JSON API and HTML scraping with intelligent pagination
   * NOTE: Currently unused due to simplified web search implementation
   */
  // @ts-ignore - kept for potential future use
  private async _webSearchWithSuperPagination(
    this: IExecuteFunctions,
    query: string,
    options: {
      maxResults: number;
      safeSearch: number;
      locale: string;
      timePeriod?: string;
    },
  ): Promise<Array<any>> {
    const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

    // Use the enhanced VQD pagination with corrected SearchOptions
    const paginationResult = await paginateWithVqd(
      query,
      {
        safeSearch: getSafeSearchType(options.safeSearch),
        locale: options.locale,
        time: options.timePeriod,
      } as SearchOptions,
      {
        maxResults: options.maxResults,
        pageSize: DEFAULT_PAGINATION_CONFIG.pageSize,
        maxPages: Math.min(DEFAULT_PAGINATION_CONFIG.maxPages, Math.ceil(options.maxResults / DEFAULT_PAGINATION_CONFIG.pageSize)),
        delayBetweenRequests: DEFAULT_PAGINATION_CONFIG.delayBetweenRequests,
        debugMode,
      }
    );

    // If VQD pagination didn't get enough results and we still need more, try HTML fallback
    if (paginationResult.results.length < options.maxResults && paginationResult.totalFetched < options.maxResults) {
      const { parseHtmlResults } = await import('./htmlParser');
      const remainingNeeded = options.maxResults - paginationResult.results.length;
      const htmlResults: any[] = [];
      let offsetHtml = 0;
      let hasMoreHtml = true;
      const pageSizeHtml = 10;

      // Try to get remaining results from HTML
      while (htmlResults.length < remainingNeeded && hasMoreHtml) {
        const htmlUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${offsetHtml}`;

        try {
          const html = await this.helpers.httpRequest({
            url: htmlUrl,
            method: 'GET',
            headers: {
              'User-Agent': BROWSER_USER_AGENT,
            },
          });
          const page = parseHtmlResults(html);

          if (!page.length) {
            hasMoreHtml = false;
            break;
          }

          const convertedResults = page.map(item => ({
            title: item.title,
            url: item.url,
            description: item.snippet,
            rawDescription: item.snippet,
            hostname: new URL(item.url).hostname,
            icon: '', // HTML results don't have icons
          }));

          htmlResults.push(...convertedResults);
          if (page.length < pageSizeHtml) {
            hasMoreHtml = false;
          }

          offsetHtml += pageSizeHtml;
        } catch (error) {
          hasMoreHtml = false;
          if (debugMode) {
            const logEntry = createLogEntry(
              LogLevel.ERROR,
              `HTML fallback error: ${error.message}`,
              'webSearchWithSuperPagination',
              { query, error: error.message }
            );
            console.error(JSON.stringify(logEntry));
          }
          break;
        }

        await sleep(DEFAULT_PAGINATION_CONFIG.delayBetweenRequests);
      }

      // Combine VQD results with HTML results
      return [...paginationResult.results, ...htmlResults].slice(0, options.maxResults);
    }

    return paginationResult.results;
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;


    // Get cache settings
    const cacheSettings = this.getNodeParameter('cacheSettings', 0, {
      enableCache: true,
      cacheTTL: 300,
    }) as {
      enableCache?: boolean;
      cacheTTL?: number;
    };


    const enableCache = cacheSettings?.enableCache !== false;
    const cacheTTL = cacheSettings?.cacheTTL || 300; // Default to 5 minutes if not specified

    // Get the global locale setting
    const globalLocale = this.getNodeParameter('locale', 0, 'en-us') as string;

    // Per-execution VQD cache for image search.
    // Keyed by normalised query (trim + lowercase). Avoids a redundant page GET
    // when multiple input items carry the same imageQuery in one execute() run.
    // This Map is strictly local: it is not exported, not stored in cache.ts,
    // and is garbage-collected when execute() returns.
    const vqdCache = new Map<string, string>();

    // Loop through input items
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        // Get the operation type
        const operation = this.getNodeParameter('operation', itemIndex) as DuckDuckGoOperation;
        let results: INodeExecutionData[] = [];

        // Handle operations
        if (operation === DuckDuckGoOperation.Search) {
          // Get web search specific parameters
          const query = this.getNodeParameter('query', itemIndex) as string;

          // Validate query is not empty
          if (!query || query.trim() === '') {
            throw new NodeOperationError(
              this.getNode(),
              'Query is required for search operation',
              { itemIndex }
            );
          }

          const options = this.getNodeParameter('webSearchOptions', itemIndex, {}) as {
            maxResults?: number;
            region?: string;
            safeSearch?: number;
            returnRawResults?: boolean;
            useSearchOperators?: boolean;
            searchOperators?: ISearchOperators;
          };

          // Enhanced query processing for better results
          let enhancedQuery = query;
          const operators = options.searchOperators;
          const hasOperatorValues = operators && Object.values(operators).some(v => v != null && String(v).trim() !== '');

          if ((options.useSearchOperators || hasOperatorValues) && operators) {
            const validationErrors = validateSearchOperators(operators);
            if (validationErrors.length === 0) {
              enhancedQuery = buildSearchQuery(query, operators);
            } else if (options.useSearchOperators) {
              throw new NodeOperationError(
                this.getNode(),
                `Invalid search operators: ${validationErrors.join(', ')}`,
                { itemIndex }
              );
            } else {
              enhancedQuery = enhanceSearchQuery(query, 'web');
            }
          } else {
            enhancedQuery = enhanceSearchQuery(query, 'web');
          }

          // Log enhanced query if debug is enabled
          if (debugMode) {
            const logEntry = createLogEntry(
              LogLevel.INFO,
              `Enhanced search query with operators: ${enhancedQuery}`,
              operation,
              { originalQuery: query, enhancedQuery, operators: options.searchOperators }
            );
            console.log(JSON.stringify(logEntry));
          }

          // Set up search options with correct API according to duck-duck-scrape documentation
          const searchOptions: SearchOptions = {
            safeSearch: getSafeSearchType(options.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
            locale: options.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          };


          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: enhancedQuery,
            options: searchOptions,
          });


          // Try to get cached result if cache is enabled
          let result;
          if (enableCache) {
            const cachedResult = getCached<any>(cacheKey);

            if (cachedResult) {
              // Log cache hit if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Cache hit for web search: ${enhancedQuery}`,
                  operation,
                  { query: enhancedQuery, options: searchOptions, cacheKey }
                );
                console.log(JSON.stringify(logEntry));
              }

              result = cachedResult;
            }
          }

          try {
            // If result is not in cache, execute the search
            if (!result) {
              // Log request attempt if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Executing web search for: ${enhancedQuery}`,
                  operation,
                  { query: enhancedQuery, options: searchOptions, cacheEnabled: enableCache }
                );
                console.log(JSON.stringify(logEntry));
              }

              // SIMPLIFIED: Execute search directly using our direct implementation
              const directResults = await directWebSearch(enhancedQuery, {
                locale: searchOptions.locale || 'us-en',
                safeSearch: getSafeSearchString(options.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
                maxResults: undefined, // Let it fetch all available results
              });

              // Format results to match duck-duck-scrape structure
              result = {
                results: directResults.results.map(r => ({
                  title: r.title,
                  url: r.url,
                  description: r.description,
                  hostname: new URL(r.url).hostname,
                })),
                noResults: directResults.results.length === 0,
              };

              // Note: Direct search doesn't support pagination without VQD token
              // Limit results to what we got from the first request
              const maxResults = options.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
              if (result.results && result.results.length > maxResults) {
                result.results = result.results.slice(0, maxResults);
              }

              // Cache the result if cache is enabled
              if (enableCache && result) {
                setCache(cacheKey, result, cacheTTL);

                // Log cache store if debug is enabled
                if (debugMode) {
                  const logEntry = createLogEntry(
                    LogLevel.INFO,
                    `Cached web search result for: ${enhancedQuery}`,
                    operation,
                    { query: enhancedQuery, options: searchOptions, cacheTTL, cacheKey }
                  );
                  console.log(JSON.stringify(logEntry));
                }
              }
            }

            if (!result || !result.results || !result.results.length) {
              // Log empty results if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `No results found for web search query: ${enhancedQuery}`,
                  operation,
                  { query: enhancedQuery, options: searchOptions }
                );
                console.log(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: true,
                  query: enhancedQuery,
                  count: 0,
                  results: [],
                  ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

            } else {
              // Return raw results if requested
              if (options.returnRawResults || debugMode) {
                results = [{
                  json: {
                    success: true,
                    query: enhancedQuery,
                    result,
                    ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                  },
                  pairedItem: {
                    item: itemIndex,
                  },
                }];
              } else {
                // Process and return the results with enhanced data
                const maxResults = options.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
                results = processWebSearchResults(result.results as any, itemIndex, result).slice(0, maxResults);

                // Add cache information to the first result if in debug mode
                if (debugMode && results.length > 0) {
                  results[0].json.fromCache = result !== undefined;
                }
              }

            }
          } catch (error) {
            // Create a user-friendly error message
            const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'web search');

            // Log detailed error if debug is enabled
            if (debugMode) {
              const logEntry = createLogEntry(
                LogLevel.ERROR,
                `Web search error: ${errorMessage}`,
                operation,
                { query: enhancedQuery, options: searchOptions },
                error instanceof Error ? error : new Error(String(error))
              );
              console.error(JSON.stringify(logEntry));
            }

            results = [{
              json: {
                success: false,
                error: errorMessage,
                query: enhancedQuery,
                ...(debugMode ? {
                  errorDetails: error instanceof Error ? error.stack : String(error),
                  requestOptions: searchOptions,
                } : {}),
              },
              pairedItem: {
                item: itemIndex,
              },
            }];

          }
        }
        else if (operation === DuckDuckGoOperation.SearchImages) {
          // Get image search specific parameters
          const imageQuery = this.getNodeParameter('imageQuery', itemIndex) as string;
          const imageSearchOptions = this.getNodeParameter('imageSearchOptions', itemIndex, {}) as {
            maxResults?: number;
            safeSearch?: number;
            region?: string;
            returnRawResults?: boolean;
          };

          // Set up search options with correct API according to duck-duck-scrape documentation
          const searchOptions: ImageSearchOptions = {
            safeSearch: getSafeSearchType(imageSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
            locale: imageSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          };


          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: imageQuery,
            options: searchOptions,
          });


          // Try to get cached result if cache is enabled
          let result;
          if (enableCache) {
            const cachedResult = getCached<any>(cacheKey);

            if (cachedResult) {
              // Log cache hit if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Cache hit for image search: ${imageQuery}`,
                  operation,
                  { query: imageQuery, options: searchOptions, cacheKey }
                );
                console.log(JSON.stringify(logEntry));
              }

              result = cachedResult;
            }
          }

          try {
            // If result is not in cache, execute the search
            if (!result) {
              // Log request attempt if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Executing image search for: ${imageQuery}`,
                  operation,
                  { query: imageQuery, options: searchOptions, cacheEnabled: enableCache }
                );
                console.log(JSON.stringify(logEntry));
              }

              // Execute image search, reusing VQD for the same query within
              // this execution run to avoid a redundant page GET.
              const vqdKey = imageQuery.trim().toLowerCase();
              const cachedVqd = vqdCache.get(vqdKey);

              const directImageResults = await directImageSearch(
                imageQuery,
                {
                  locale: searchOptions.locale || 'us-en',
                  safeSearch: getSafeSearchString(imageSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
                  maxResults: undefined, // Let it fetch all available results
                },
                cachedVqd, // undefined on first call for this query; reused on subsequent calls
              );

              // Store the VQD returned by this call so later items with the
              // same query can skip the page GET.
              if (directImageResults.vqd) {
                vqdCache.set(vqdKey, directImageResults.vqd);
              }

              // Format results to match duck-duck-scrape structure
              result = {
                results: directImageResults.results.map(r => ({
                  title: r.title,
                  image: r.url,
                  thumbnail: r.thumbnail,
                  url: r.source,
                  height: r.height,
                  width: r.width,
                })),
                noResults: directImageResults.results.length === 0,
              };

              // Note: Direct image search doesn't support pagination without VQD token
              // Limit results to what we got from the first request
              const maxResults = imageSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
              if (result.results && result.results.length > maxResults) {
                result.results = result.results.slice(0, maxResults);
              }

              // Cache the result if cache is enabled
              if (enableCache && result) {
                setCache(cacheKey, result, cacheTTL);

                // Log cache store if debug is enabled
                if (debugMode) {
                  const logEntry = createLogEntry(
                    LogLevel.INFO,
                    `Cached image search result for: ${imageQuery}`,
                    operation,
                    { query: imageQuery, options: searchOptions, cacheTTL, cacheKey }
                  );
                  console.log(JSON.stringify(logEntry));
                }
              }
            }

            if (!result || !result.results || !result.results.length) {
              // Log empty results if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `No results found for image search query: ${imageQuery}`,
                  operation,
                  { query: imageQuery, options: searchOptions }
                );
                console.log(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: true,
                  query: imageQuery,
                  count: 0,
                  results: [],
                  ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

            } else {
              // Return raw results if requested
              if (imageSearchOptions.returnRawResults || debugMode) {
                results = [{
                  json: {
                    success: true,
                    query: imageQuery,
                    result,
                    ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                  },
                  pairedItem: {
                    item: itemIndex,
                  },
                }];
              } else {
                // Process and return the results
                const maxResults = imageSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
                results = processImageSearchResults(result.results as any, itemIndex).slice(0, maxResults);

                // Add cache information to the first result if in debug mode
                if (debugMode && results.length > 0) {
                  results[0].json.fromCache = result !== undefined;
                }
              }

            }
          } catch (error) {
            // Create a user-friendly error message
            const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'image search');

            // Log detailed error if debug is enabled
            if (debugMode) {
              const logEntry = createLogEntry(
                LogLevel.ERROR,
                `Image search error: ${errorMessage}`,
                operation,
                { query: imageQuery, options: searchOptions },
                error instanceof Error ? error : new Error(String(error))
              );
              console.error(JSON.stringify(logEntry));
            }

            results = [{
              json: {
                success: false,
                error: errorMessage,
                query: imageQuery,
                ...(debugMode ? {
                  errorDetails: error instanceof Error ? error.stack : String(error),
                  requestOptions: searchOptions,
                } : {}),
              },
              pairedItem: {
                item: itemIndex,
              },
            }];

          }
        }
        else if (operation === DuckDuckGoOperation.SearchNews) {
          // Get news search specific parameters
          const newsQuery = this.getNodeParameter('newsQuery', itemIndex) as string;
          const newsSearchOptions = this.getNodeParameter('newsSearchOptions', itemIndex, {}) as {
            maxResults?: number;
            safeSearch?: number;
            region?: string;
            returnRawResults?: boolean;
            timePeriod?: string;
          };

          // Set up search options with correct API according to duck-duck-scrape documentation
          const searchOptions: NewsSearchOptions = {
            safeSearch: getSafeSearchType(newsSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
            locale: newsSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
            time: getSearchTimeType(newsSearchOptions.timePeriod ?? DEFAULT_PARAMETERS.TIME_PERIOD),
          };


          // Note: maxResults is handled during processing, not in search options
          const maxResults = newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: newsQuery,
            options: searchOptions,
          });


          // Try to get cached result if cache is enabled
          let result;
          if (enableCache) {
            const cachedResult = getCached<any>(cacheKey);

            if (cachedResult) {
              // Log cache hit if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Cache hit for news search: ${newsQuery}`,
                  operation,
                  { query: newsQuery, options: searchOptions, cacheKey }
                );
                console.log(JSON.stringify(logEntry));
              }

              result = cachedResult;
            }
          }

          try {
            // If result is not in cache, execute the search
            if (!result) {
              // Log request attempt if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Executing news search for: ${newsQuery}`,
                  operation,
                  { query: newsQuery, options: searchOptions, cacheEnabled: enableCache }
                );
                console.log(JSON.stringify(logEntry));
              }

              // Execute news search
              result = await searchNews(newsQuery, searchOptions);

              // For maxResults > 10, we need to fetch additional results
              // Note: duck-duck-scrape library has a limit of ~10 results per request

              // Check if user explicitly set maxResults (not using default)
              // Always attempt pagination if user explicitly requested a specific number of results
              if (newsSearchOptions.maxResults !== undefined && result.results && result.results.length > 0) {
                // Only attempt to get more results if we got some results initially
                let page = 2;
                const maxPages = Math.ceil(maxResults / 10);
                const allResults = [...result.results];

                // We need to limit to a reasonable number of pages to avoid abuse
                const maxPageLimit = 5; // Limit to 5 pages (approximately 50 results)
                const effectiveMaxPages = Math.min(maxPages, maxPageLimit);

                while (allResults.length < maxResults && page <= effectiveMaxPages) {
                  if (debugMode) {
                    const logEntry = createLogEntry(
                      LogLevel.INFO,
                      `Fetching additional news results (page ${page}) for: ${newsQuery}`,
                      operation,
                      { query: newsQuery, options: searchOptions, page }
                    );
                    console.log(JSON.stringify(logEntry));
                  }

                  try {
                    // For subsequent requests, we need the vqd parameter from the first request
                    if (result.vqd) {
                      // Use proper pagination with offset parameter for news search
                      const offset = (page - 1) * 10; // duck-duck-scrape typically returns ~10 results per page
                      const nextPageOptions: NewsSearchOptions = {
                        ...searchOptions,
                        offset: offset,
                        vqd: result.vqd,
                      };

                      // Make the additional request
                      const nextPageResult = await searchNews(newsQuery, nextPageOptions);

                      // If we got results, add them to our collection
                      if (nextPageResult.results && nextPageResult.results.length > 0) {
                        allResults.push(...nextPageResult.results);
                      } else {
                        // No more results available
                        break;
                      }
                    } else {
                      // Can't continue without vqd
                      break;
                    }
                  } catch (pageError) {
                    // Log the error but continue with what we have
                    if (debugMode) {
                      const logEntry = createLogEntry(
                        LogLevel.ERROR,
                        `Error fetching additional news results: ${pageError.message}`,
                        operation,
                        { query: newsQuery, options: searchOptions, page }
                      );
                      console.error(JSON.stringify(logEntry));
                    }
                    break;
                  }

                  page++;
                }

                // Update the result with all collected results
                result.results = allResults;
              }

              // Cache the result if cache is enabled
              if (enableCache && result) {
                setCache(cacheKey, result, cacheTTL);

                // Log cache store if debug is enabled
                if (debugMode) {
                  const logEntry = createLogEntry(
                    LogLevel.INFO,
                    `Cached news search result for: ${newsQuery}`,
                    operation,
                    { query: newsQuery, options: searchOptions, cacheTTL, cacheKey }
                  );
                  console.log(JSON.stringify(logEntry));
                }
              }
            }

            if (!result || !result.results || !result.results.length) {
              // Log empty results if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `No results found for news search query: ${newsQuery}`,
                  operation,
                  { query: newsQuery, options: searchOptions }
                );
                console.log(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: true,
                  query: newsQuery,
                  count: 0,
                  results: [],
                  ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

            } else {
              // Return raw results if requested
              if (newsSearchOptions.returnRawResults || debugMode) {
                results = [{
                  json: {
                    success: true,
                    query: newsQuery,
                    result,
                    ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                  },
                  pairedItem: {
                    item: itemIndex,
                  },
                }];
              } else {
                // Process and return the results
                const maxResults = newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
                results = processNewsSearchResults(result.results as any, itemIndex).slice(0, maxResults);

                // Add cache information to the first result if in debug mode
                if (debugMode && results.length > 0) {
                  results[0].json.fromCache = result !== undefined;
                }
              }

            }
          } catch (error) {
            // Try fallback search if duck-duck-scrape fails
            try {
              const fallbackResult = await fallbackNewsSearch(newsQuery, {
                locale: searchOptions.locale,
                safeSearch: searchOptions.safeSearch,
                time: searchOptions.time,
              });

              if (fallbackResult.success && fallbackResult.results.length > 0) {
                // Convert fallback results to news search format
                const newsResults = fallbackResult.results.map(item => ({
                  date: null, // fallback has no real publication date; Date.now() would be wrong (ms vs seconds)
                  title: item.title,
                  excerpt: item.body || null, // processNewsSearchResults reads description from excerpt
                  body: item.body,
                  url: item.href,
                  image: '',
                  syndicate: 'DuckDuckGo Fallback', // visible label via field that processor reads
                  isFallback: true,
                }));

                results = processNewsSearchResults(newsResults, itemIndex).slice(0, newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS);

                // Leave fallback results populated; the error item below is only emitted if fallback produced no results.
              }
            } catch (fallbackError) {
              console.error('Fallback news search also failed:', fallbackError);
            }

            // Only emit the error item when the fallback also produced nothing
            if (results.length === 0) {
              // Create a user-friendly error message
              const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'news search');

              // Log detailed error if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.ERROR,
                  `News search error: ${errorMessage}`,
                  operation,
                  { query: newsQuery, options: searchOptions },
                  error instanceof Error ? error : new Error(String(error))
                );
                console.error(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: false,
                  error: errorMessage,
                  query: newsQuery,
                  ...(debugMode ? {
                    errorDetails: error instanceof Error ? error.stack : String(error),
                    requestOptions: searchOptions,
                  } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

            }
          }
        }
        else if (operation === DuckDuckGoOperation.SearchVideos) {
          // Get video search specific parameters
          const videoQuery = this.getNodeParameter('videoQuery', itemIndex) as string;
          const videoSearchOptions = this.getNodeParameter('videoSearchOptions', itemIndex, {}) as {
            maxResults?: number;
            safeSearch?: number;
            region?: string;
            returnRawResults?: boolean;
          };

          // Set up search options with correct API according to duck-duck-scrape documentation
          const searchOptions: VideoSearchOptions = {
            safeSearch: getSafeSearchType(videoSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
            locale: videoSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          };

          // Note: maxResults is handled during processing, not in search options
          const maxResults = videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;


          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: videoQuery,
            options: searchOptions,
          });


          // Try to get cached result if cache is enabled
          let result;
          if (enableCache) {
            const cachedResult = getCached<any>(cacheKey);

            if (cachedResult) {
              // Log cache hit if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Cache hit for video search: ${videoQuery}`,
                  operation,
                  { query: videoQuery, options: searchOptions, cacheKey }
                );
                console.log(JSON.stringify(logEntry));
              }

              result = cachedResult;
            }
          }

          try {
            // If result is not in cache, execute the search
            if (!result) {
              // Log request attempt if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Executing video search for: ${videoQuery}`,
                  operation,
                  { query: videoQuery, options: searchOptions, cacheEnabled: enableCache }
                );
                console.log(JSON.stringify(logEntry));
              }

              // Execute video search
              result = await searchVideos(videoQuery, searchOptions);

              // For maxResults > 10, we need to fetch additional results
              // Note: duck-duck-scrape library has a limit of ~10 results per request

              // Check if user explicitly set maxResults (not using default)
              // Always attempt pagination if user explicitly requested a specific number of results
              if (videoSearchOptions.maxResults !== undefined && result.results && result.results.length > 0) {
                // Only attempt to get more results if we got some results initially
                let page = 2;
                const maxPages = Math.ceil(maxResults / 10);
                const allResults = [...result.results];

                // We need to limit to a reasonable number of pages to avoid abuse
                const maxPageLimit = 5; // Limit to 5 pages (approximately 50 results)
                const effectiveMaxPages = Math.min(maxPages, maxPageLimit);

                while (allResults.length < maxResults && page <= effectiveMaxPages) {
                  if (debugMode) {
                    const logEntry = createLogEntry(
                      LogLevel.INFO,
                      `Fetching additional video results (page ${page}) for: ${videoQuery}`,
                      operation,
                      { query: videoQuery, options: searchOptions, page }
                    );
                    console.log(JSON.stringify(logEntry));
                  }

                  try {
                    // For subsequent requests, we need the vqd parameter from the first request
                    if (result.vqd) {
                      // Use proper pagination with offset parameter according to duck-duck-scrape API
                      const offset = (page - 1) * 10; // duck-duck-scrape typically returns ~10 results per page
                      const nextPageOptions: VideoSearchOptions = {
                        ...searchOptions,
                        offset: offset,
                        vqd: result.vqd,
                      };

                      // Make the additional request
                      const nextPageResult = await searchVideos(videoQuery, nextPageOptions);

                      // If we got results, add them to our collection
                      if (nextPageResult.results && nextPageResult.results.length > 0) {
                        allResults.push(...nextPageResult.results);
                      } else {
                        // No more results available
                        break;
                      }
                    } else {
                      // Can't continue without vqd
                      break;
                    }
                  } catch (pageError) {
                    // Log the error but continue with what we have
                    if (debugMode) {
                      const logEntry = createLogEntry(
                        LogLevel.ERROR,
                        `Error fetching additional video results: ${pageError.message}`,
                        operation,
                        { query: videoQuery, options: searchOptions, page }
                      );
                      console.error(JSON.stringify(logEntry));
                    }
                    break;
                  }

                  page++;
                }

                // Update the result with all collected results
                result.results = allResults;
              }

              // Cache the result if cache is enabled
              if (enableCache && result) {
                setCache(cacheKey, result, cacheTTL);

                // Log cache store if debug is enabled
                if (debugMode) {
                  const logEntry = createLogEntry(
                    LogLevel.INFO,
                    `Cached video search result for: ${videoQuery}`,
                    operation,
                    { query: videoQuery, options: searchOptions, cacheTTL, cacheKey }
                  );
                  console.log(JSON.stringify(logEntry));
                }
              }
            }

            if (!result || !result.results || !result.results.length) {
              // Log empty results if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `No results found for video search query: ${videoQuery}`,
                  operation,
                  { query: videoQuery, options: searchOptions }
                );
                console.log(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: true,
                  query: videoQuery,
                  count: 0,
                  results: [],
                  ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

            } else {
              // Return raw results if requested
              if (videoSearchOptions.returnRawResults || debugMode) {
                results = [{
                  json: {
                    success: true,
                    query: videoQuery,
                    result,
                    ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                  },
                  pairedItem: {
                    item: itemIndex,
                  },
                }];
              } else {
                // Process and return the results
                const maxResults = videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
                results = processVideoSearchResults(result.results as any, itemIndex).slice(0, maxResults);

                // Add cache information to the first result if in debug mode
                if (debugMode && results.length > 0) {
                  results[0].json.fromCache = result !== undefined;
                }
              }

            }
          } catch (error) {
            // Try fallback search if duck-duck-scrape fails
            try {
              const fallbackResult = await fallbackVideoSearch(videoQuery, {
                locale: searchOptions.locale,
                safeSearch: searchOptions.safeSearch,
              });

              if (fallbackResult.success && fallbackResult.results.length > 0) {
                // Convert fallback results to video search format
                const videoResults = fallbackResult.results.map(item => ({
                  content: item.href,
                  url: item.href, // ensure url field is present for processVideoSearchResults
                  description: item.body,
                  duration: '',
                  embed_html: '',
                  embed_url: item.href,
                  image_token: '',
                  images: {
                    large: '',
                    medium: '',
                    motion: '',
                    small: '',
                  },
                  provider: 'DuckDuckGo Fallback',
                  published: '',
                  publisher: 'DuckDuckGo Fallback', // visible label via field that processor reads
                  statistics: { viewCount: 0 },
                  title: item.title,
                  uploader: 'Web',
                  isFallback: true,
                }));

                results = processVideoSearchResults(videoResults, itemIndex).slice(0, videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS);

                // Leave fallback results populated; the error item below is only emitted if fallback produced no results.
              }
            } catch (fallbackError) {
              console.error('Fallback video search also failed:', fallbackError);
            }

            // Only emit the error item when the fallback also produced nothing
            if (results.length === 0) {
              // Create a user-friendly error message
              const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'video search');

              // Log detailed error if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.ERROR,
                  `Video search error: ${errorMessage}`,
                  operation,
                  { query: videoQuery, options: searchOptions },
                  error instanceof Error ? error : new Error(String(error))
                );
                console.error(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: false,
                  error: errorMessage,
                  query: videoQuery,
                  ...(debugMode ? {
                    errorDetails: error instanceof Error ? error.stack : String(error),
                    requestOptions: searchOptions,
                  } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

            }
          }
        }
        else {
          throw new NodeOperationError(
            this.getNode(),
            `The operation "${operation}" is not supported!`,
            { itemIndex }
          );
        }

        returnData.push(...results);
      } catch (error) {
        // Check error handling preference
        const errorHandling = this.getNodeParameter('errorHandling', itemIndex, 'continueOnFail') as string;
        const debugMode = this.getNodeParameter('debugMode', itemIndex, false) as boolean;
        const operation = this.getNodeParameter('operation', itemIndex, 'unknown') as string;

        if (errorHandling === 'continueOnFail' || this.continueOnFail()) {
          // Create a user-friendly error message
          const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), operation);

          // Log the error in structured format
          if (debugMode) {
            const logEntry = createLogEntry(
              LogLevel.ERROR,
              `Operation failed: ${errorMessage}`,
              operation,
              {},
              error instanceof Error ? error : new Error(String(error))
            );
            console.error(JSON.stringify(logEntry));
          }

          returnData.push({
            json: {
              success: false,
              error: errorMessage,
              operation,
              ...(debugMode ? {
                errorDetails: error instanceof Error ? error.stack : String(error)
              } : {}),
              ...this.getInputData(itemIndex)[0].json,
            },
            pairedItem: {
              item: itemIndex,
            },
          });
          continue;
        }

        // If we should break on errors, throw NodeOperationError
        if (debugMode) {
          const logEntry = createLogEntry(
            LogLevel.ERROR,
            `Breaking execution due to error: ${error instanceof Error ? error.message : String(error)}`,
            operation,
            {},
            error instanceof Error ? error : new Error(String(error))
          );
          console.error(JSON.stringify(logEntry));
        }


        throw new NodeOperationError(this.getNode(), error, { itemIndex });
      }
    }

    return [returnData];
  }
}
