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

import {
  search,
  searchNews,
  searchImages,
  searchVideos,
  SearchOptions,
  ImageSearchOptions,
  NewsSearchOptions,
  VideoSearchOptions,
} from 'duck-duck-scrape';

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
  processInstantAnswerResult,
  processDictionaryResults,
  processStockResult,
  processCurrencyResult,
} from './processors';

import { DEFAULT_PARAMETERS, NODE_INFO, REGIONS } from './constants';

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
  getInstantAnswer,
} from './instantAnswer';

import { getDictionaryDefinition } from './dictionary';
import { getStockInfo } from './stocks';
import { convertCurrency } from './currency';

import { buildSearchQuery, validateSearchOperators, OPERATOR_INFO, ISearchOperators } from './searchOperators';
import { paginateWithVqd, DEFAULT_PAGINATION_CONFIG } from './vqdPagination';

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

function getRandomUserAgent(): string {
	const userAgents = [
		// Mobile
		'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
		'Mozilla/5.0 (Linux; Android 11; SM-G998U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.98 Mobile Safari/537.36',
		// Desktop
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
		'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/117.0',
	];
	return userAgents[Math.floor(Math.random() * userAgents.length)];
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
          },
          {
            name: 'Instant Answer',
            value: DuckDuckGoOperation.InstantAnswer,
            description: 'Get instant answers, definitions, and summaries',
            action: 'Get instant answer',
          },
          {
            name: 'Dictionary',
            value: DuckDuckGoOperation.Dictionary,
            description: 'Get word definitions, synonyms, and examples',
            action: 'Look up dictionary',
          },
          {
            name: 'Stock Quote',
            value: DuckDuckGoOperation.Stocks,
            description: 'Get real-time stock market information',
            action: 'Get stock quote',
          },
          {
            name: 'Currency Conversion',
            value: DuckDuckGoOperation.Currency,
            description: 'Convert between currencies with live exchange rates',
            action: 'Convert currency',
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

      // ----------------------------------------
      // Instant Answer Operation Parameters
      // ----------------------------------------
      {
        displayName: 'Instant Answer Query',
        name: 'instantAnswerQuery',
        type: 'string',
        required: true,
        default: '',
        description: 'The query to get instant answer for',
        placeholder: 'Enter your question or search term',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.InstantAnswer,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // Instant Answer Configuration
      {
        displayName: 'Instant Answer Options',
        name: 'instantAnswerOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.InstantAnswer,
            ],
          },
        },
        options: [
          {
            displayName: 'No Redirect',
            name: 'noRedirect',
            type: 'boolean',
            default: true,
            description: 'Whether to skip redirects to external sources',
          },
          {
            displayName: 'No HTML',
            name: 'noHtml',
            type: 'boolean',
            default: true,
            description: 'Whether to return plain text instead of HTML formatted content',
          },
          {
            displayName: 'Skip Disambiguation',
            name: 'skipDisambig',
            type: 'boolean',
            default: false,
            description: 'Whether to skip disambiguation pages',
          },
        ],
      },

      // ----------------------------------------
      // Dictionary Operation Parameters
      // ----------------------------------------
      {
        displayName: 'Word',
        name: 'dictionaryWord',
        type: 'string',
        required: true,
        default: '',
        description: 'The word to look up in the dictionary',
        placeholder: 'Enter a word',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Dictionary,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // ----------------------------------------
      // Stock Operation Parameters
      // ----------------------------------------
      {
        displayName: 'Stock Symbol',
        name: 'stockSymbol',
        type: 'string',
        required: true,
        default: '',
        description: 'The stock ticker symbol to get information for',
        placeholder: 'e.g. AAPL, GOOGL, TSLA',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Stocks,
            ],
          },
        },
        typeOptions: {
          minLength: 1,
        },
      },

      // ----------------------------------------
      // Currency Operation Parameters
      // ----------------------------------------
      {
        displayName: 'From Currency',
        name: 'currencyFrom',
        type: 'string',
        required: true,
        default: 'USD',
        description: 'The currency code to convert from',
        placeholder: 'e.g. USD, EUR, GBP',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Currency,
            ],
          },
        },
        typeOptions: {
          minLength: 3,
          maxLength: 3,
        },
      },
      {
        displayName: 'To Currency',
        name: 'currencyTo',
        type: 'string',
        required: true,
        default: 'EUR',
        description: 'The currency code to convert to',
        placeholder: 'e.g. USD, EUR, GBP',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Currency,
            ],
          },
        },
        typeOptions: {
          minLength: 3,
          maxLength: 3,
        },
      },
      {
        displayName: 'Amount',
        name: 'currencyAmount',
        type: 'number',
        required: true,
        default: 1,
        description: 'The amount to convert',
        displayOptions: {
          show: {
            operation: [
              DuckDuckGoOperation.Currency,
            ],
          },
        },
        typeOptions: {
          minValue: 0,
          numberPrecision: 2,
        },
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
   */
  private async webSearchWithSuperPagination(
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

    // Use the enhanced VQD pagination
    const paginationResult = await paginateWithVqd(
      query,
      {
        safeSearch: options.safeSearch,
        locale: options.locale,
        timePeriod: options.timePeriod,
      } as any,
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
              'User-Agent': getRandomUserAgent(),
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
          const options = this.getNodeParameter('webSearchOptions', itemIndex, {}) as {
            maxResults?: number;
            region?: string;
            safeSearch?: number;
            timePeriod?: string;
            returnRawResults?: boolean;
            useSearchOperators?: boolean;
            searchOperators?: ISearchOperators;
          };

          // Process search operators if enabled
          let enhancedQuery = query;
          if (options.useSearchOperators && options.searchOperators) {
            // Convert OR string to array if needed
            const operators = { ...options.searchOperators };
            if (operators.or && typeof operators.or === 'string') {
              operators.or = (operators.or as string).split(',').map(term => term.trim()).filter(term => term);
            }

            // Validate search operators
            const validationErrors = validateSearchOperators(operators);
            if (validationErrors.length > 0) {
              throw new NodeOperationError(
                this.getNode(),
                `Invalid search operators: ${validationErrors.join('; ')}`
              );
            }

            // Build enhanced query with operators
            enhancedQuery = buildSearchQuery(query, operators);

            // Log enhanced query if debug is enabled
            if (debugMode) {
              const logEntry = createLogEntry(
                LogLevel.INFO,
                `Enhanced search query with operators: ${enhancedQuery}`,
                operation,
                { originalQuery: query, enhancedQuery, operators }
              );
              console.log(JSON.stringify(logEntry));
            }
          }

					const maxResults = options.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

          // Set up search options - timePeriod is supported by duck-duck-scrape
          const searchOptions = {
						maxResults: maxResults,
            safeSearch: options.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH,
            locale: options.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
						timePeriod:  options.timePeriod  ?? DEFAULT_PARAMETERS.TIME_PERIOD,
          } as SearchOptions;

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

              // Execute primary search
              result = await search(enhancedQuery, searchOptions);

              // For maxResults > 10, we need to use our enhanced method
              if (maxResults > DEFAULT_PARAMETERS.MAX_RESULTS && result.results && result.results.length > 0) {
                try {
                  // Use the webSearchWithSuperPagination method for better pagination
                  const rawResults = await (this as unknown as DuckDuckGo).webSearchWithSuperPagination.call(
                    this,
                    enhancedQuery,
                    {
                      maxResults: maxResults,
                      safeSearch: options.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH,
                      locale: options.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
                      timePeriod: options.timePeriod ?? DEFAULT_PARAMETERS.TIME_PERIOD,
                    }
                  );

                  // Update results with enhanced pagination results
                  result.results = rawResults;
                } catch (fallbackError) {
                  // Log fallback error if debug is enabled
                  if (debugMode) {
                    const logEntry = createLogEntry(
                      LogLevel.ERROR,
                      `Enhanced pagination error: ${fallbackError.message}. Falling back to standard pagination.`,
                      operation,
                      { query: enhancedQuery, options: searchOptions }
                    );
                    console.error(JSON.stringify(logEntry));
                  }

                  // Fall back to standard pagination code
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
                        `Fetching additional results (page ${page}) for: ${enhancedQuery}`,
                        operation,
                        { query: enhancedQuery, options: searchOptions, page }
                      );
                      console.log(JSON.stringify(logEntry));
                    }

                    try {
                      // Original pagination code with vqd
                      if (result.vqd) {
                        const startPosition = (page - 1) * 30;
                        const nextPageOptions = {
                          ...searchOptions,
                          s: startPosition.toString(),
                          dc: (startPosition + 1).toString(),
                          v: 'l',
                          o: 'json',
                          api: '/d.js',
                          vqd: result.vqd,
                        };

                        const nextPageResult = await search(enhancedQuery, nextPageOptions);

                        if (nextPageResult.results && nextPageResult.results.length > 0) {
                          allResults.push(...nextPageResult.results);
                        } else {
                          break;
                        }
                      } else {
                        break;
                      }
                    } catch (pageError) {
                      if (debugMode) {
                        const logEntry = createLogEntry(
                          LogLevel.ERROR,
                          `Error fetching additional results: ${pageError.message}`,
                          operation,
                          { query: enhancedQuery, options: searchOptions, page }
                        );
                        console.error(JSON.stringify(logEntry));
                      }
                      break;
                    }

                    page++;
                  }

                  // Update results with what we collected
                  result.results = allResults;
                }
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
                // Process and return the results
                const maxResults = options.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
                results = processWebSearchResults(result.results as any, itemIndex).slice(0, maxResults);

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
                  fromCache: result !== undefined && !result.fromCache,
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

          // Set up search options with defaults for any missing values
          const maxResults = imageSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
          const searchOptions = {
            maxResults: maxResults,
            safeSearch: imageSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH,
            locale: imageSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          } as ImageSearchOptions;

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

              // Execute image search
              result = await searchImages(imageQuery, searchOptions);

              // For maxResults > 10, we need to fetch additional results
              // Note: duck-duck-scrape library has a limit of ~10 results per request
              const maxResults = imageSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

              // Check if user explicitly set maxResults (not using default)
              // Always attempt pagination if user explicitly requested a specific number of results
              if (imageSearchOptions.maxResults !== undefined && result.results && result.results.length > 0) {
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
                      `Fetching additional image results (page ${page}) for: ${imageQuery}`,
                      operation,
                      { query: imageQuery, options: searchOptions, page }
                    );
                    console.log(JSON.stringify(logEntry));
                  }

                  try {
                    // For subsequent requests, we need the vqd parameter from the first request
                    if (result.vqd) {
                      // Add start parameter to indicate the page we want
                      // DuckDuckGo uses increments of 30 for pagination
                      const startPosition = (page - 1) * 30;
                      const nextPageOptions = {
                        ...searchOptions,
                        s: startPosition.toString(), // Add start parameter for pagination
                        dc: (startPosition + 1).toString(), // Add additional dc parameter required for pagination
                        v: 'l', // Required for pagination
                        o: 'json', // Required for pagination
                        api: '/d.js', // Required for pagination
                        vqd: result.vqd,
                      };

                      // Make the additional request
                      const nextPageResult = await searchImages(imageQuery, nextPageOptions);

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
                        `Error fetching additional image results: ${pageError.message}`,
                        operation,
                        { query: imageQuery, options: searchOptions, page }
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

          // Set up search options with defaults for any missing values
          const maxResults = newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
          const searchOptions = {
            maxResults: maxResults,
            safeSearch: newsSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH,
            locale: newsSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          } as NewsSearchOptions;

          // Add API key to search options if provided
          if (apiKey) {
            (searchOptions as any).headers = {
              Authorization: `Bearer ${apiKey}`,
            };
          }

          // Add time period if provided
          if (newsSearchOptions.timePeriod) {
            (searchOptions as any).timePeriod = newsSearchOptions.timePeriod;
          }

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

              // Execute news search
              result = await searchNews(newsQuery, searchOptions);

              // For maxResults > 10, we need to fetch additional results
              // Note: duck-duck-scrape library has a limit of ~10 results per request
              const maxResults = newsSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

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
                      // Add start parameter to indicate the page we want
                      // DuckDuckGo uses increments of 30 for pagination
                      const startPosition = (page - 1) * 30;
                      const nextPageOptions = {
                        ...searchOptions,
                        s: startPosition.toString(), // Add start parameter for pagination
                        dc: (startPosition + 1).toString(), // Add additional dc parameter required for pagination
                        v: 'l', // Required for pagination
                        o: 'json', // Required for pagination
                        api: '/d.js', // Required for pagination
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

          // Set up search options with defaults for any missing values
          const maxResults = videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
          const searchOptions = {
            maxResults: maxResults,
            safeSearch: videoSearchOptions.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH,
            locale: videoSearchOptions.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          } as VideoSearchOptions;

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

              // Execute video search
              result = await searchVideos(videoQuery, searchOptions);

              // For maxResults > 10, we need to fetch additional results
              // Note: duck-duck-scrape library has a limit of ~10 results per request
              const maxResults = videoSearchOptions.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;

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
                      // Add start parameter to indicate the page we want
                      // DuckDuckGo uses increments of 30 for pagination
                      const startPosition = (page - 1) * 30;
                      const nextPageOptions = {
                        ...searchOptions,
                        s: startPosition.toString(), // Add start parameter for pagination
                        dc: (startPosition + 1).toString(), // Add additional dc parameter required for pagination
                        v: 'l', // Required for pagination
                        o: 'json', // Required for pagination
                        api: '/d.js', // Required for pagination
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
                 else if (operation === DuckDuckGoOperation.InstantAnswer) {
           // Get instant answer specific parameters
           const instantAnswerQuery = this.getNodeParameter('instantAnswerQuery', itemIndex) as string;
           const instantAnswerOptions = this.getNodeParameter('instantAnswerOptions', itemIndex, {}) as {
             noRedirect?: boolean;
             noHtml?: boolean;
             skipDisambig?: boolean;
           };

          // Set up search options with defaults for any missing values
          const searchOptions = {
            locale: globalLocale,
          } as SearchOptions;

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query: instantAnswerQuery,
            options: searchOptions,
          });

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report search_started telemetry event
          const telemetryData: ITelemetryEventData = {
            operation,
            query: instantAnswerQuery,
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
                  `Cache hit for instant answer: ${instantAnswerQuery}`,
                  operation,
                  { query: instantAnswerQuery, options: searchOptions, cacheKey }
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
                  `Executing instant answer for: ${instantAnswerQuery}`,
                  operation,
                  { query: instantAnswerQuery, options: searchOptions, cacheEnabled: enableCache }
                );
                console.log(JSON.stringify(logEntry));
              }

                             // Execute instant answer
               result = await getInstantAnswer.call(this, instantAnswerQuery, instantAnswerOptions);

              // Cache the result if cache is enabled
              if (enableCache && result) {
                setCache(cacheKey, result, cacheTTL);

                // Log cache store if debug is enabled
                if (debugMode) {
                  const logEntry = createLogEntry(
                    LogLevel.INFO,
                    `Cached instant answer result for: ${instantAnswerQuery}`,
                    operation,
                    { query: instantAnswerQuery, options: searchOptions, cacheTTL, cacheKey }
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
                  `No results found for instant answer query: ${instantAnswerQuery}`,
                  operation,
                  { query: instantAnswerQuery, options: searchOptions }
                );
                console.log(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: true,
                  query: instantAnswerQuery,
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
                  query: instantAnswerQuery,
                  durationMs: Date.now() - startTime,
                  resultCount: 0,
                  fromCache: !!result,
                });
              }
            } else {
              // Return raw results if requested
              if (debugMode) {
                results = [{
                  json: {
                    success: true,
                    query: instantAnswerQuery,
                    result,
                    ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                  },
                  pairedItem: {
                    item: itemIndex,
                  },
                }];
              } else {
                // Process and return the results
                results = [processInstantAnswerResult(result, itemIndex)];
              }

              // Report search_completed with result count
              const resultCount = Array.isArray(result.results) ? result.results.length : 0;
              if (enableTelemetry) {
                await reportEvent(this, 'search_completed', {
                  operation,
                  query: instantAnswerQuery,
                  durationMs: Date.now() - startTime,
                  resultCount,
                  fromCache: result !== undefined && !result.fromCache,
                });
              }
            }
          } catch (error) {
            // Create a user-friendly error message
            const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'instant answer');

            // Log detailed error if debug is enabled
            if (debugMode) {
              const logEntry = createLogEntry(
                LogLevel.ERROR,
                `Instant answer error: ${errorMessage}`,
                operation,
                { query: instantAnswerQuery, options: searchOptions },
                error instanceof Error ? error : new Error(String(error))
              );
              console.error(JSON.stringify(logEntry));
            }

            results = [{
              json: {
                success: false,
                error: errorMessage,
                query: instantAnswerQuery,
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
                query: instantAnswerQuery,
                durationMs: Date.now() - startTime,
                error: errorMessage,
                errorType: error?.constructor?.name || 'Error',
              });
            }
          }
        }
        else if (operation === DuckDuckGoOperation.Dictionary) {
          // Get dictionary specific parameters
          const word = this.getNodeParameter('dictionaryWord', itemIndex) as string;

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report operation started telemetry event
          if (enableTelemetry) {
            await reportEvent(this, 'dictionary_started', {
              operation,
              word,
            });
          }

          try {
            // Execute dictionary lookup
            const dictionaryResults = await getDictionaryDefinition(word, this, itemIndex);

            if (!dictionaryResults || dictionaryResults.length === 0) {
              results = [{
                json: {
                  success: true,
                  word,
                  count: 0,
                  definitions: [],
                  sourceType: 'dictionary',
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];
            } else {
              // Process and return the results
              results = processDictionaryResults(dictionaryResults, itemIndex);
            }

            // Report operation completed
            if (enableTelemetry) {
              await reportEvent(this, 'dictionary_completed', {
                operation,
                word,
                durationMs: Date.now() - startTime,
                resultCount: dictionaryResults.length,
              });
            }
          } catch (error) {
            const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'dictionary lookup');

            results = [{
              json: {
                success: false,
                error: errorMessage,
                word,
                sourceType: 'dictionary',
                ...(debugMode ? {
                  errorDetails: error instanceof Error ? error.stack : String(error),
                } : {}),
              },
              pairedItem: {
                item: itemIndex,
              },
            }];

            // Report operation failed
            if (enableTelemetry) {
              await reportEvent(this, 'dictionary_failed', {
                operation,
                word,
                durationMs: Date.now() - startTime,
                error: errorMessage,
              });
            }
          }
        }
        else if (operation === DuckDuckGoOperation.Stocks) {
          // Get stock specific parameters
          const symbol = this.getNodeParameter('stockSymbol', itemIndex) as string;

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report operation started telemetry event
          if (enableTelemetry) {
            await reportEvent(this, 'stock_started', {
              operation,
              symbol,
            });
          }

          try {
            // Execute stock lookup
            const stockResult = await getStockInfo(symbol, this, itemIndex);

            // Process and return the result
            results = [processStockResult(stockResult, itemIndex)];

            // Report operation completed
            if (enableTelemetry) {
              await reportEvent(this, 'stock_completed', {
                operation,
                symbol,
                durationMs: Date.now() - startTime,
                hasData: !!stockResult.price,
              });
            }
          } catch (error) {
            const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'stock lookup');

            results = [{
              json: {
                success: false,
                error: errorMessage,
                symbol,
                sourceType: 'stock',
                ...(debugMode ? {
                  errorDetails: error instanceof Error ? error.stack : String(error),
                } : {}),
              },
              pairedItem: {
                item: itemIndex,
              },
            }];

            // Report operation failed
            if (enableTelemetry) {
              await reportEvent(this, 'stock_failed', {
                operation,
                symbol,
                durationMs: Date.now() - startTime,
                error: errorMessage,
              });
            }
          }
        }
        else if (operation === DuckDuckGoOperation.Currency) {
          // Get currency specific parameters
          const from = this.getNodeParameter('currencyFrom', itemIndex) as string;
          const to = this.getNodeParameter('currencyTo', itemIndex) as string;
          const amount = this.getNodeParameter('currencyAmount', itemIndex) as number;

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report operation started telemetry event
          if (enableTelemetry) {
            await reportEvent(this, 'currency_started', {
              operation,
              from,
              to,
              amount,
            });
          }

          try {
            // Execute currency conversion
            const currencyResult = await convertCurrency(from, to, amount, this, itemIndex);

            // Process and return the result
            results = [processCurrencyResult(currencyResult, itemIndex)];

            // Report operation completed
            if (enableTelemetry) {
              await reportEvent(this, 'currency_completed', {
                operation,
                from,
                to,
                amount,
                durationMs: Date.now() - startTime,
                hasData: !!currencyResult.convertedAmount,
              });
            }
          } catch (error) {
            const errorMessage = parseApiError(error instanceof Error ? error : new Error(String(error)), 'currency conversion');

            results = [{
              json: {
                success: false,
                error: errorMessage,
                from,
                to,
                amount,
                sourceType: 'currency',
                ...(debugMode ? {
                  errorDetails: error instanceof Error ? error.stack : String(error),
                } : {}),
              },
              pairedItem: {
                item: itemIndex,
              },
            }];

            // Report operation failed
            if (enableTelemetry) {
              await reportEvent(this, 'currency_failed', {
                operation,
                from,
                to,
                amount,
                durationMs: Date.now() - startTime,
                error: errorMessage,
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
