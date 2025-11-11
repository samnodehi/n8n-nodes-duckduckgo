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
  VideoDefinition,
  VideoDuration,
  VideoLicense,
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

import {
  reportEvent,
  ITelemetryEventData
} from './telemetry';

import {
  getGlobalReliabilityManager,
  IReliabilityConfig,
} from './reliabilityManager';

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
 * Convert video definition string to VideoDefinition enum
 */
function getVideoDefinition(value?: string): VideoDefinition {
  switch (value) {
    case 'high':
    case 'hd':
      return VideoDefinition.HIGH;
    case 'standard':
    case 'sd':
      return VideoDefinition.STANDARD;
    default:
      return VideoDefinition.ANY;
  }
}

/**
 * Convert video duration string to VideoDuration enum
 */
function getVideoDuration(value?: string): VideoDuration {
  switch (value) {
    case 'short':
    case 'SHORT':
      return VideoDuration.SHORT;
    case 'medium':
    case 'MEDIUM':
      return VideoDuration.MEDIUM;
    case 'long':
    case 'LONG':
      return VideoDuration.LONG;
    default:
      return VideoDuration.ANY;
  }
}

/**
 * Convert video license string to VideoLicense enum
 */
function getVideoLicense(value?: string): VideoLicense {
  switch (value) {
    case 'creativeCommon':
    case 'cc':
      return VideoLicense.CREATIVE_COMMONS;
    case 'youtube':
    case 'yt':
      return VideoLicense.YOUTUBE;
    default:
      return VideoLicense.ANY;
  }
}

/**
 * Enhanced query builder for improved search quality
 */
function enhanceSearchQuery(query: string, searchType: string = 'web'): string {
  // Clean and prepare query
  let enhancedQuery = query.trim();

  // Smart query enhancements based on patterns
  if (searchType === 'web') {
    // Detect question patterns and enhance them
    if (/^(what|how|why|when|where|who|which|can|could|should|would|will|is|are|do|does|did)\s/i.test(enhancedQuery)) {
      // Question detected - no change needed, questions work well as-is
    }
    // Detect product/service searches
    else if (/\b(buy|purchase|price|cost|review|compare|best|top|vs)\b/i.test(enhancedQuery)) {
      // Commercial intent detected - add specificity
      if (!enhancedQuery.includes('2025') && !enhancedQuery.includes('2024')) {
        enhancedQuery += ' 2025';
      }
    }
    // Detect technical searches
    else if (/\b(error|fix|solution|tutorial|guide|how to|install|setup|config)\b/i.test(enhancedQuery)) {
      // Technical intent - add recent year for updated solutions
      if (!enhancedQuery.includes('2025') && !enhancedQuery.includes('2024')) {
        enhancedQuery += ' 2025';
      }
    }
    // Detect news/current events
    else if (/\b(news|latest|recent|update|today|now|current)\b/i.test(enhancedQuery)) {
      // News intent - ensure recent results
      if (!enhancedQuery.includes('2025')) {
        enhancedQuery += ' 2025';
      }
    }
    // For short queries (1-2 words), add context
    else if (enhancedQuery.split(' ').length <= 2 && enhancedQuery.length > 2) {
      // Add context for better results
      if (!/\b(definition|meaning|what is)\b/i.test(enhancedQuery)) {
        // Don't modify if it's already a definition query
        enhancedQuery = `"${enhancedQuery}"`;
      }
    }
  }

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
    credentials: [
      {
        name: 'duckDuckGoApi',
        required: false,
        displayOptions: {
          show: {
            useApiKey: [true],
          },
        },
      },
    ],
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

      // API Key Authentication Option
      {
        displayName: 'Use API Key',
        name: 'useApiKey',
        type: 'boolean',
        default: false,
        description: 'Whether to use API key authentication for DuckDuckGo API access',
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
            displayName: 'Time Period',
            name: 'timePeriod',
            type: 'options',
            default: TimePeriod.AllTime,
            description: 'Time range for web search results',
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
          {
            displayName: 'Search Backend',
            name: 'searchBackend',
            type: 'options',
            default: 'auto',
            description: 'Choose which search backend to use for better reliability',
            options: [
              {
                name: 'Auto (Recommended)',
                value: 'auto',
                description: 'Automatically tries multiple backends for best results',
              },
              {
                name: 'Duck-Duck-Scrape',
                value: 'duck-duck-scrape',
                description: 'Primary search engine library',
              },
              {
                name: 'SearchAPI',
                value: 'search-api',
                description: 'Alternative API-based search',
              },
              {
                name: 'HTML Backend',
                value: 'html',
                description: 'Direct HTML parsing from html.duckduckgo.com',
              },
              {
                name: 'Lite Backend',
                value: 'lite',
                description: 'Lightweight search from lite.duckduckgo.com',
              },
            ],
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

      // Telemetry settings
      {
        displayName: 'Enable Telemetry',
        name: 'enableTelemetry',
        type: 'boolean',
        default: false,
        description: 'Whether to send anonymous usage data to help improve the node (no personal data is collected)',
      },

      // Reliability settings
      {
        displayName: 'Reliability Settings',
        name: 'reliabilitySettings',
        type: 'collection',
        placeholder: 'Add Reliability Setting',
        default: {},
        description: 'Advanced reliability and performance settings for handling parallel requests and rate limits',
        options: [
          {
            displayName: 'Enable Reliability Features',
            name: 'enableReliability',
            type: 'boolean',
            default: true,
            description: 'Whether to enable adaptive backoff, jitter, and circuit breaking for robust operation',
          },
          {
            displayName: 'Empty Result Threshold',
            name: 'emptyResultThreshold',
            type: 'number',
            default: 3,
            description: 'Number of consecutive empty results before triggering adaptive backoff',
            typeOptions: {
              minValue: 1,
              maxValue: 10,
            },
          },
          {
            displayName: 'Initial Backoff (ms)',
            name: 'initialBackoffMs',
            type: 'number',
            default: 1000,
            description: 'Initial backoff delay in milliseconds when empty results are detected',
            typeOptions: {
              minValue: 100,
              maxValue: 10000,
            },
          },
          {
            displayName: 'Max Backoff (ms)',
            name: 'maxBackoffMs',
            type: 'number',
            default: 30000,
            description: 'Maximum backoff delay in milliseconds',
            typeOptions: {
              minValue: 1000,
              maxValue: 120000,
            },
          },
          {
            displayName: 'Min Jitter (ms)',
            name: 'minJitterMs',
            type: 'number',
            default: 100,
            description: 'Minimum random jitter delay to prevent thundering herd',
            typeOptions: {
              minValue: 0,
              maxValue: 5000,
            },
          },
          {
            displayName: 'Max Jitter (ms)',
            name: 'maxJitterMs',
            type: 'number',
            default: 500,
            description: 'Maximum random jitter delay',
            typeOptions: {
              minValue: 100,
              maxValue: 10000,
            },
          },
          {
            displayName: 'Failure Threshold',
            name: 'failureThreshold',
            type: 'number',
            default: 5,
            description: 'Number of consecutive failures before opening circuit breaker',
            typeOptions: {
              minValue: 2,
              maxValue: 20,
            },
          },
          {
            displayName: 'Circuit Reset Timeout (ms)',
            name: 'resetTimeoutMs',
            type: 'number',
            default: 60000,
            description: 'Time to wait before attempting to close circuit breaker',
            typeOptions: {
              minValue: 10000,
              maxValue: 300000,
            },
          },
          {
            displayName: 'Max Retries',
            name: 'maxRetries',
            type: 'number',
            default: 3,
            description: 'Maximum number of retry attempts per request',
            typeOptions: {
              minValue: 0,
              maxValue: 10,
            },
          },
          {
            displayName: 'Retry Delay (ms)',
            name: 'retryDelayMs',
            type: 'number',
            default: 1000,
            description: 'Base delay between retry attempts',
            typeOptions: {
              minValue: 100,
              maxValue: 10000,
            },
          },
        ],
      },

      // Proxy Settings
      {
        displayName: 'Proxy Settings',
        name: 'proxySettings',
        type: 'collection',
        placeholder: 'Add Proxy Setting',
        default: {},
        description: 'Configure proxy for all requests',
        options: [
          {
            displayName: 'Use Proxy',
            name: 'useProxy',
            type: 'boolean',
            default: false,
            description: 'Whether to use a proxy for requests',
          },
          {
            displayName: 'Proxy Type',
            name: 'proxyType',
            type: 'options',
            default: 'http',
            description: 'Type of proxy to use',
            options: [
              {
                name: 'HTTP',
                value: 'http',
              },
              {
                name: 'HTTPS',
                value: 'https',
              },
              {
                name: 'SOCKS4',
                value: 'socks4',
              },
              {
                name: 'SOCKS5',
                value: 'socks5',
              },
            ],
            displayOptions: {
              show: {
                useProxy: [true],
              },
            },
          },
          {
            displayName: 'Proxy Host',
            name: 'proxyHost',
            type: 'string',
            default: '',
            placeholder: 'proxy.example.com',
            description: 'Hostname or IP address of the proxy server',
            displayOptions: {
              show: {
                useProxy: [true],
              },
            },
          },
          {
            displayName: 'Proxy Port',
            name: 'proxyPort',
            type: 'number',
            default: 8080,
            description: 'Port number of the proxy server',
            typeOptions: {
              minValue: 1,
              maxValue: 65535,
            },
            displayOptions: {
              show: {
                useProxy: [true],
              },
            },
          },
          {
            displayName: 'Proxy Authentication',
            name: 'proxyAuth',
            type: 'boolean',
            default: false,
            description: 'Whether the proxy requires authentication',
            displayOptions: {
              show: {
                useProxy: [true],
              },
            },
          },
          {
            displayName: 'Proxy Username',
            name: 'proxyUsername',
            type: 'string',
            default: '',
            description: 'Username for proxy authentication',
            displayOptions: {
              show: {
                useProxy: [true],
                proxyAuth: [true],
              },
            },
          },
          {
            displayName: 'Proxy Password',
            name: 'proxyPassword',
            type: 'string',
            typeOptions: {
              password: true,
            },
            default: '',
            description: 'Password for proxy authentication',
            displayOptions: {
              show: {
                useProxy: [true],
                proxyAuth: [true],
              },
            },
          },
        ],
      },

      // Search Filter Settings
      {
        displayName: 'Search Filters',
        name: 'searchFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        description: 'Advanced search filters for more precise results',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Search,
            ],
          },
        },
        options: [
          {
            displayName: 'Region Filter',
            name: 'useRegionFilter',
            type: 'boolean',
            default: false,
            description: 'Whether to filter results by region',
          },
          {
            displayName: 'Region',
            name: 'region',
            type: 'options',
            default: 'wt-wt',
            description: 'Region to filter results',
            options: [
              { name: 'No Region', value: 'wt-wt' },
              { name: 'United States', value: 'us-en' },
              { name: 'United Kingdom', value: 'uk-en' },
              { name: 'Canada', value: 'ca-en' },
              { name: 'Australia', value: 'au-en' },
              { name: 'Germany', value: 'de-de' },
              { name: 'France', value: 'fr-fr' },
              { name: 'Spain', value: 'es-es' },
              { name: 'Italy', value: 'it-it' },
              { name: 'Netherlands', value: 'nl-nl' },
              { name: 'Brazil', value: 'br-pt' },
              { name: 'Mexico', value: 'mx-es' },
              { name: 'Russia', value: 'ru-ru' },
              { name: 'Japan', value: 'jp-jp' },
              { name: 'China', value: 'cn-zh' },
              { name: 'India', value: 'in-en' },
              { name: 'South Korea', value: 'kr-kr' },
              { name: 'Turkey', value: 'tr-tr' },
              { name: 'Saudi Arabia', value: 'sa-ar' },
              { name: 'United Arab Emirates', value: 'ae-ar' },
            ],
            displayOptions: {
              show: {
                useRegionFilter: [true],
              },
            },
          },
          {
            displayName: 'Language Filter',
            name: 'useLanguageFilter',
            type: 'boolean',
            default: false,
            description: 'Whether to filter results by language',
          },
          {
            displayName: 'Language',
            name: 'language',
            type: 'options',
            default: '',
            description: 'Language to filter results',
            options: [
              { name: 'All Languages', value: '' },
              { name: 'English', value: 'en' },
              { name: 'Spanish', value: 'es' },
              { name: 'French', value: 'fr' },
              { name: 'German', value: 'de' },
              { name: 'Italian', value: 'it' },
              { name: 'Portuguese', value: 'pt' },
              { name: 'Dutch', value: 'nl' },
              { name: 'Russian', value: 'ru' },
              { name: 'Japanese', value: 'ja' },
              { name: 'Korean', value: 'ko' },
              { name: 'Chinese', value: 'zh' },
              { name: 'Arabic', value: 'ar' },
              { name: 'Hindi', value: 'hi' },
              { name: 'Turkish', value: 'tr' },
            ],
            displayOptions: {
              show: {
                useLanguageFilter: [true],
              },
            },
          },
          {
            displayName: 'Date Filter',
            name: 'useDateFilter',
            type: 'boolean',
            default: false,
            description: 'Whether to filter results by date',
          },
          {
            displayName: 'Date Range',
            name: 'dateRangeType',
            type: 'options',
            default: 'month',
            description: 'Time period for results',
            options: [
              { name: 'Last Day', value: 'day' },
              { name: 'Last Week', value: 'week' },
              { name: 'Last Month', value: 'month' },
              { name: 'Last Year', value: 'year' },
              { name: 'Custom Range', value: 'custom' },
            ],
            displayOptions: {
              show: {
                useDateFilter: [true],
              },
            },
          },
          {
            displayName: 'Date From',
            name: 'dateFrom',
            type: 'string',
            default: '',
            placeholder: 'YYYY-MM-DD',
            description: 'Start date for custom range',
            displayOptions: {
              show: {
                useDateFilter: [true],
                dateRangeType: ['custom'],
              },
            },
          },
          {
            displayName: 'Date To',
            name: 'dateTo',
            type: 'string',
            default: '',
            placeholder: 'YYYY-MM-DD',
            description: 'End date for custom range',
            displayOptions: {
              show: {
                useDateFilter: [true],
                dateRangeType: ['custom'],
              },
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
		const enableTelemetry = this.getNodeParameter('enableTelemetry', 0, false) as boolean;

    // Get cache settings
    const cacheSettings = this.getNodeParameter('cacheSettings', 0, {
      enableCache: true,
      cacheTTL: 300,
    }) as {
      enableCache?: boolean;
      cacheTTL?: number;
    };

    // Get reliability settings
    const reliabilitySettings = this.getNodeParameter('reliabilitySettings', 0, {
      enableReliability: true,
    }) as {
      enableReliability?: boolean;
      emptyResultThreshold?: number;
      initialBackoffMs?: number;
      maxBackoffMs?: number;
      minJitterMs?: number;
      maxJitterMs?: number;
      failureThreshold?: number;
      resetTimeoutMs?: number;
      maxRetries?: number;
      retryDelayMs?: number;
    } | null;

    // Initialize reliability manager if enabled
    let reliabilityManager: ReturnType<typeof getGlobalReliabilityManager> | null = null;
    if (reliabilitySettings && reliabilitySettings.enableReliability !== false) {
      const reliabilityConfig: Partial<IReliabilityConfig> = {
        emptyResultThreshold: reliabilitySettings.emptyResultThreshold,
        initialBackoffMs: reliabilitySettings.initialBackoffMs,
        maxBackoffMs: reliabilitySettings.maxBackoffMs,
        minJitterMs: reliabilitySettings.minJitterMs,
        maxJitterMs: reliabilitySettings.maxJitterMs,
        failureThreshold: reliabilitySettings.failureThreshold,
        resetTimeoutMs: reliabilitySettings.resetTimeoutMs,
        maxRetries: reliabilitySettings.maxRetries,
        retryDelayMs: reliabilitySettings.retryDelayMs,
      };
      reliabilityManager = getGlobalReliabilityManager(reliabilityConfig);

      // Log reliability status if debug is enabled
      if (debugMode) {
        const logEntry = createLogEntry(
          LogLevel.INFO,
          `Reliability Manager initialized: ${reliabilityManager.getSummary()}`,
          'execute',
          { config: reliabilityConfig }
        );
        console.log(JSON.stringify(logEntry));
      }
    }

    // Check if using API key
    const useApiKey = this.getNodeParameter('useApiKey', 0, false) as boolean;
    let apiKey: string | undefined;

    // Get API key from credentials if enabled
    if (useApiKey) {
      try {
        const credentials = await this.getCredentials('duckDuckGoApi');
        apiKey = credentials.apiKey as string;
      } catch (error) {
        throw new NodeOperationError(this.getNode(), 'API key is required when "Use API Key" is enabled!');
      }
    }

    const enableCache = cacheSettings?.enableCache !== false;
    const cacheTTL = cacheSettings?.cacheTTL || 300; // Default to 5 minutes if not specified

    // Get the global locale setting
    const globalLocale = this.getNodeParameter('locale', 0, 'en-us') as string;

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
            timePeriod?: string;
            returnRawResults?: boolean;
            searchBackend?: string;
            useSearchOperators?: boolean;
            searchOperators?: ISearchOperators;
          };

          // Enhanced query processing for better results
          let enhancedQuery = query;

                     // Apply search operators if enabled
           if (options.useSearchOperators && options.searchOperators) {
             const validationErrors = validateSearchOperators(options.searchOperators);
             if (validationErrors.length === 0) {
               enhancedQuery = buildSearchQuery(query, options.searchOperators);
             } else {
               throw new NodeOperationError(
                 this.getNode(),
                 `Invalid search operators: ${validationErrors.join(', ')}`,
                 { itemIndex }
               );
             }
           } else {
             // Apply smart query enhancement for better results
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
            time: options.timePeriod ?? DEFAULT_PARAMETERS.TIME_PERIOD,
          };

          // Add API key to search options if provided
          if (apiKey) {
            (searchOptions as any).headers = {
              Authorization: `Bearer ${apiKey}`,
            };
          }

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: enhancedQuery,
            options: searchOptions,
          });

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report search_started telemetry event
          const telemetryData: ITelemetryEventData = {
            operation,
            query: enhancedQuery,
            searchOptions,
          };
          if (enableTelemetry) {
            await reportEvent(this, 'search_started', telemetryData);
          }

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

              // Execute search with reliability manager if enabled
              const executeSearch = async () => {
                const requestStartTime = Date.now();

                try {
                  // SIMPLIFIED: Execute search directly using our direct implementation
                  const directResults = await directWebSearch(enhancedQuery, {
                    locale: searchOptions.locale || 'us-en',
                    safeSearch: getSafeSearchString(options.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
                    maxResults: undefined, // Let it fetch all available results
                  });

                  // Format results to match duck-duck-scrape structure
                  const searchResult = {
                    results: directResults.results.map(r => ({
                      title: r.title,
                      url: r.url,
                      description: r.description,
                      hostname: new URL(r.url).hostname,
                    })),
                    noResults: directResults.results.length === 0,
                  };

                  // Record success with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordSuccess(responseTime, searchResult.results.length);
                  }

                  return searchResult;
                } catch (error) {
                  // Record failure with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordFailure(responseTime, error as Error);
                  }
                  throw error;
                }
              };

              // Execute with retry logic if reliability manager is enabled
              if (reliabilityManager) {
                result = await reliabilityManager.executeWithRetry(
                  executeSearch,
                  (res) => res.results && res.results.length > 0,
                  `web search: ${enhancedQuery}`
                );
              } else {
                result = await executeSearch();
              }

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

              // Report search_completed with zero results
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: enhancedQuery,
                  durationMs: Date.now() - startTime,
                  resultCount: 0,
                  fromCache: !!result,
                });
              }
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

              // Report search_completed with result count
              const resultCount = Array.isArray(result.results) ? result.results.length : 0;
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: enhancedQuery,
                  durationMs: Date.now() - startTime,
                  resultCount,
                  fromCache: result !== undefined && !(result as any).fromCache,
                });
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

            // Report search_failed telemetry
            if (enableTelemetry) {
              await reportEvent(this, 'search_failed', {
                operation,
                query: enhancedQuery,
                durationMs: Date.now() - startTime,
                error: errorMessage,
                errorType: error?.constructor?.name || 'Error',
              });
            }
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
            size?: string;
            color?: string;
            type?: string;
            layout?: string;
            license?: string;
          };

          // Set up search options with correct API according to duck-duck-scrape documentation
          const searchOptions: ImageSearchOptions = {
            safeSearch: getSafeSearchType(imageSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
            locale: imageSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
            size: imageSearchOptions.size as any,
            color: imageSearchOptions.color as any,
            type: imageSearchOptions.type as any,
            layout: imageSearchOptions.layout as any,
            license: imageSearchOptions.license as any,
          };

          // Add API key to search options if provided
          if (apiKey) {
            (searchOptions as any).headers = {
              Authorization: `Bearer ${apiKey}`,
            };
          }

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: imageQuery,
            options: searchOptions,
          });

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report search_started telemetry event
          const telemetryData: ITelemetryEventData = {
            operation,
            query: imageQuery,
            searchOptions,
          };
          if (enableTelemetry) {
            await reportEvent(this, 'search_started', telemetryData);
          }

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

              // Execute image search with reliability manager if enabled
              const executeImageSearch = async () => {
                const requestStartTime = Date.now();

                try {
                  // SIMPLIFIED: Execute image search directly using our direct implementation
                  const directImageResults = await directImageSearch(imageQuery, {
                    locale: searchOptions.locale || 'us-en',
                    safeSearch: getSafeSearchString(imageSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
                    maxResults: undefined, // Let it fetch all available results
                  });

                  // Format results to match duck-duck-scrape structure
                  const searchResult = {
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

                  // Record success with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordSuccess(responseTime, searchResult.results.length);
                  }

                  return searchResult;
                } catch (error) {
                  // Record failure with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordFailure(responseTime, error as Error);
                  }
                  throw error;
                }
              };

              // Execute with retry logic if reliability manager is enabled
              if (reliabilityManager) {
                result = await reliabilityManager.executeWithRetry(
                  executeImageSearch,
                  (res) => res.results && res.results.length > 0,
                  `image search: ${imageQuery}`
                );
              } else {
                result = await executeImageSearch();
              }

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

              // Report search_completed with zero results
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: imageQuery,
                  durationMs: Date.now() - startTime,
                  resultCount: 0,
                  fromCache: !!result,
                });
              }
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

              // Report search_completed with result count
              const resultCount = Array.isArray(result.results) ? result.results.length : 0;
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: imageQuery,
                  durationMs: Date.now() - startTime,
                  resultCount,
                  fromCache: result !== undefined && !result.fromCache,
                });
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

            // Report search_failed telemetry
            if (enableTelemetry) {
              await reportEvent(this, 'search_failed', {
                operation,
                query: imageQuery,
                durationMs: Date.now() - startTime,
                error: errorMessage,
                errorType: error?.constructor?.name || 'Error',
              });
            }
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

          // Add API key to search options if provided
          if (apiKey) {
            (searchOptions as any).headers = {
              Authorization: `Bearer ${apiKey}`,
            };
          }

          // Note: maxResults is handled during processing, not in search options
          const maxResults = newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: newsQuery,
            options: searchOptions,
          });

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report search_started telemetry event
          const telemetryData: ITelemetryEventData = {
            operation,
            query: newsQuery,
            searchOptions,
          };
          if (enableTelemetry) {
            await reportEvent(this, 'search_started', telemetryData);
          }

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

              // Execute news search with reliability manager if enabled
              const executeNewsSearch = async () => {
                const requestStartTime = Date.now();

                try {
                  // Execute news search
                  const searchResult = await searchNews(newsQuery, searchOptions);

                  // Record success with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordSuccess(responseTime, searchResult.results?.length || 0);
                  }

                  return searchResult;
                } catch (error) {
                  // Record failure with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordFailure(responseTime, error as Error);
                  }
                  throw error;
                }
              };

              // Execute with retry logic if reliability manager is enabled
              if (reliabilityManager) {
                result = await reliabilityManager.executeWithRetry(
                  executeNewsSearch,
                  (res) => res.results && res.results.length > 0,
                  `news search: ${newsQuery}`
                );
              } else {
                result = await executeNewsSearch();
              }

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

              // Report search_completed with zero results
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: newsQuery,
                  durationMs: Date.now() - startTime,
                  resultCount: 0,
                  fromCache: !!result,
                });
              }
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

              // Report search_completed with result count
              const resultCount = Array.isArray(result.results) ? result.results.length : 0;
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: newsQuery,
                  durationMs: Date.now() - startTime,
                  resultCount,
                  fromCache: result !== undefined && !result.fromCache,
                });
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
                  date: Date.now(), // Use current timestamp as fallback
                  title: item.title,
                  body: item.body,
                  url: item.href,
                  image: '',
                  source: 'DuckDuckGo Fallback',
                }));

                results = processNewsSearchResults(newsResults, itemIndex).slice(0, newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS);

                // Report successful fallback
                if (enableTelemetry) {
                  await reportEvent(this, 'search_completed', {
                    operation,
                    query: newsQuery,
                    durationMs: Date.now() - startTime,
                    resultCount: newsResults.length,
                    fromCache: false,
                    fallbackUsed: true,
                  });
                }
                // Don't return early, let it continue with normal flow
              }
            } catch (fallbackError) {
              console.error('Fallback news search also failed:', fallbackError);
            }

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

            // Report search_failed telemetry
            if (enableTelemetry) {
              await reportEvent(this, 'search_failed', {
                operation,
                query: newsQuery,
                durationMs: Date.now() - startTime,
                error: errorMessage,
                errorType: error?.constructor?.name || 'Error',
              });
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
            timePeriod?: string;
            length?: string;
            quality?: string;
            resolution?: string;
          };

          // Set up search options with correct API according to duck-duck-scrape documentation
          const searchOptions: VideoSearchOptions = {
            safeSearch: getSafeSearchType(videoSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH),
            locale: videoSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
            time: getSearchTimeType(videoSearchOptions.timePeriod ?? DEFAULT_PARAMETERS.TIME_PERIOD),
            definition: getVideoDefinition(videoSearchOptions.quality),
            duration: getVideoDuration(videoSearchOptions.length),
            license: getVideoLicense(videoSearchOptions.resolution), // Map resolution to license for now
          };

          // Note: maxResults is handled during processing, not in search options
          const maxResults = videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

          // Add API key to search options if provided
          if (apiKey) {
            (searchOptions as any).headers = {
              Authorization: `Bearer ${apiKey}`,
            };
          }

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: videoQuery,
            options: searchOptions,
          });

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report search_started telemetry event
          const telemetryData: ITelemetryEventData = {
            operation,
            query: videoQuery,
            searchOptions,
          };
          if (enableTelemetry) {
            await reportEvent(this, 'search_started', telemetryData);
          }

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

              // Execute video search with reliability manager if enabled
              const executeVideoSearch = async () => {
                const requestStartTime = Date.now();

                try {
                  // Execute video search
                  const searchResult = await searchVideos(videoQuery, searchOptions);

                  // Record success with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordSuccess(responseTime, searchResult.results?.length || 0);
                  }

                  return searchResult;
                } catch (error) {
                  // Record failure with reliability manager
                  if (reliabilityManager) {
                    const responseTime = Date.now() - requestStartTime;
                    reliabilityManager.recordFailure(responseTime, error as Error);
                  }
                  throw error;
                }
              };

              // Execute with retry logic if reliability manager is enabled
              if (reliabilityManager) {
                result = await reliabilityManager.executeWithRetry(
                  executeVideoSearch,
                  (res) => res.results && res.results.length > 0,
                  `video search: ${videoQuery}`
                );
              } else {
                result = await executeVideoSearch();
              }

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

              // Report search_completed with zero results
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: videoQuery,
                  durationMs: Date.now() - startTime,
                  resultCount: 0,
                  fromCache: !!result,
                });
              }
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

              // Report search_completed with result count
              const resultCount = Array.isArray(result.results) ? result.results.length : 0;
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: videoQuery,
                  durationMs: Date.now() - startTime,
                  resultCount,
                  fromCache: result !== undefined && !result.fromCache,
                });
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
                  publisher: 'Web',
                  statistics: { viewCount: 0 },
                  title: item.title,
                  uploader: 'Web',
                }));

                results = processVideoSearchResults(videoResults, itemIndex).slice(0, videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS);

                // Report successful fallback
                if (enableTelemetry) {
                  await reportEvent(this, 'search_completed', {
                    operation,
                    query: videoQuery,
                    durationMs: Date.now() - startTime,
                    resultCount: videoResults.length,
                    fromCache: false,
                    fallbackUsed: true,
                  });
                }
                // Don't return early, let it continue with normal flow
              }
            } catch (fallbackError) {
              console.error('Fallback video search also failed:', fallbackError);
            }

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

            // Report search_failed telemetry
            if (enableTelemetry) {
              await reportEvent(this, 'search_failed', {
                operation,
                query: videoQuery,
                durationMs: Date.now() - startTime,
                error: errorMessage,
                errorType: error?.constructor?.name || 'Error',
              });
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

        // Report node_error telemetry for unexpected errors
        if (enableTelemetry) {
          await reportEvent(this, 'node_error', {
            error: error instanceof Error ? error.message : String(error),
            errorType: error?.constructor?.name || 'Error',
          });
        }

        throw new NodeOperationError(this.getNode(), error, { itemIndex });
      }
    }

    return [returnData];
  }
}
