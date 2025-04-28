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
    ],
  };

  /**
   * Main execution method
   */
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

    const enableCache = cacheSettings.enableCache !== false;
    const cacheTTL = cacheSettings.cacheTTL || 300; // Default to 5 minutes if not specified

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
          };

          // Set up search options - timePeriod is supported by duck-duck-scrape
          const searchOptions = {
            safeSearch: options.safeSearch ?? DEFAULT_PARAMETERS.SAFE_SEARCH,
            locale: options.region ?? globalLocale ?? DEFAULT_PARAMETERS.REGION,
          } as SearchOptions;

          // Add API key to search options if provided
          if (apiKey) {
            (searchOptions as any).headers = {
              Authorization: `Bearer ${apiKey}`,
            };
          }

          // Add time period if provided
          if (options.timePeriod) {
            (searchOptions as any).timePeriod = options.timePeriod;
          }

          // Create a cache key based on operation and parameters
          const cacheKey = JSON.stringify({
            operation,
            query,
            options: searchOptions,
          });

          // Track operation start time for telemetry
          const startTime = Date.now();

          // Report search_started telemetry event
          const telemetryData: ITelemetryEventData = {
            operation,
            query,
            searchOptions,
          };
          await reportEvent(this, 'search_started', telemetryData);

          // Try to get cached result if cache is enabled
          let result;
          if (enableCache) {
            const cachedResult = getCached<any>(cacheKey);

            if (cachedResult) {
              // Log cache hit if debug is enabled
              if (debugMode) {
                const logEntry = createLogEntry(
                  LogLevel.INFO,
                  `Cache hit for web search: ${query}`,
                  operation,
                  { query, options: searchOptions, cacheKey }
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
                  `Executing web search for: ${query}`,
                  operation,
                  { query, options: searchOptions, cacheEnabled: enableCache }
                );
                console.log(JSON.stringify(logEntry));
              }

              // Execute search
              result = await search(query, searchOptions);

              // For maxResults > 10, we need to fetch additional results
              // Note: duck-duck-scrape library has a limit of ~10 results per request
              const maxResults = options.maxResults ?? DEFAULT_PARAMETERS.MAX_RESULTS;
              if (maxResults > 10 && result.results && result.results.length > 0) {
                // Only attempt to get more results if we got some results initially
                // and we need more than the default ~10 results
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
                      `Fetching additional results (page ${page}) for: ${query}`,
                      operation,
                      { query, options: searchOptions, page }
                    );
                    console.log(JSON.stringify(logEntry));
                  }

                  try {
                    // For subsequent requests, we need the vqd parameter from the first request
                    if (result.vqd) {
                      // Add offset parameter to indicate we want the next page
                      const nextPageOptions = {
                        ...searchOptions,
                        offset: (page - 1) * 10,
                        vqd: result.vqd,
                      };

                      // Make the additional request
                      const nextPageResult = await search(query, nextPageOptions);

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
                        `Error fetching additional results: ${pageError.message}`,
                        operation,
                        { query, options: searchOptions, page }
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
                    `Cached web search result for: ${query}`,
                    operation,
                    { query, options: searchOptions, cacheTTL, cacheKey }
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
                  `No results found for web search query: ${query}`,
                  operation,
                  { query, options: searchOptions }
                );
                console.log(JSON.stringify(logEntry));
              }

              results = [{
                json: {
                  success: true,
                  query,
                  count: 0,
                  results: [],
                  ...(debugMode ? { requestOptions: searchOptions, fromCache: result !== undefined } : {}),
                },
                pairedItem: {
                  item: itemIndex,
                },
              }];

              // Report search_completed with zero results
              await reportEvent(this, 'search_completed', {
                operation,
                query,
                durationMs: Date.now() - startTime,
                resultCount: 0,
                fromCache: !!result,
              });
            } else {
              // Return raw results if requested
              if (options.returnRawResults || debugMode) {
                results = [{
                  json: {
                    success: true,
                    query,
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
              await reportEvent(this, 'search_completed', {
                operation,
                query,
                durationMs: Date.now() - startTime,
                resultCount,
                fromCache: result !== undefined && !result.fromCache,
              });
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
                { query, options: searchOptions },
                error instanceof Error ? error : new Error(String(error))
              );
              console.error(JSON.stringify(logEntry));
            }

            results = [{
              json: {
                success: false,
                error: errorMessage,
                query,
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
            await reportEvent(this, 'search_failed', {
              operation,
              query,
              durationMs: Date.now() - startTime,
              error: errorMessage,
              errorType: error?.constructor?.name || 'Error',
            });
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
          const searchOptions = {
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
          await reportEvent(this, 'search_started', telemetryData);

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
              if (maxResults > 10 && result.results && result.results.length > 0) {
                // Only attempt to get more results if we got some results initially
                // and we need more than the default ~10 results
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
                      // Add offset parameter to indicate we want the next page
                      const nextPageOptions = {
                        ...searchOptions,
                        offset: (page - 1) * 10,
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
              await reportEvent(this, 'search_completed', {
                operation,
                query: imageQuery,
                durationMs: Date.now() - startTime,
                resultCount: 0,
                fromCache: !!result,
              });
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
              await reportEvent(this, 'search_completed', {
                operation,
                query: imageQuery,
                durationMs: Date.now() - startTime,
                resultCount,
                fromCache: result !== undefined && !result.fromCache,
              });
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
            await reportEvent(this, 'search_failed', {
              operation,
              query: imageQuery,
              durationMs: Date.now() - startTime,
              error: errorMessage,
              errorType: error?.constructor?.name || 'Error',
            });
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
          const searchOptions = {
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
          await reportEvent(this, 'search_started', telemetryData);

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
              if (maxResults > 10 && result.results && result.results.length > 0) {
                // Only attempt to get more results if we got some results initially
                // and we need more than the default ~10 results
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
                      // Add offset parameter to indicate we want the next page
                      const nextPageOptions = {
                        ...searchOptions,
                        offset: (page - 1) * 10,
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
              await reportEvent(this, 'search_completed', {
                operation,
                query: newsQuery,
                durationMs: Date.now() - startTime,
                resultCount: 0,
                fromCache: !!result,
              });
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
              await reportEvent(this, 'search_completed', {
                operation,
                query: newsQuery,
                durationMs: Date.now() - startTime,
                resultCount,
                fromCache: result !== undefined && !result.fromCache,
              });
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
            await reportEvent(this, 'search_failed', {
              operation,
              query: newsQuery,
              durationMs: Date.now() - startTime,
              error: errorMessage,
              errorType: error?.constructor?.name || 'Error',
            });
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
          const searchOptions = {
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
          await reportEvent(this, 'search_started', telemetryData);

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
              if (maxResults > 10 && result.results && result.results.length > 0) {
                // Only attempt to get more results if we got some results initially
                // and we need more than the default ~10 results
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
                      // Add offset parameter to indicate we want the next page
                      const nextPageOptions = {
                        ...searchOptions,
                        offset: (page - 1) * 10,
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
              await reportEvent(this, 'search_completed', {
                operation,
                query: videoQuery,
                durationMs: Date.now() - startTime,
                resultCount: 0,
                fromCache: !!result,
              });
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
              await reportEvent(this, 'search_completed', {
                operation,
                query: videoQuery,
                durationMs: Date.now() - startTime,
                resultCount,
                fromCache: result !== undefined && !result.fromCache,
              });
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
            await reportEvent(this, 'search_failed', {
              operation,
              query: videoQuery,
              durationMs: Date.now() - startTime,
              error: errorMessage,
              errorType: error?.constructor?.name || 'Error',
            });
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
        await reportEvent(this, 'node_error', {
          error: error instanceof Error ? error.message : String(error),
          errorType: error?.constructor?.name || 'Error',
        });

        throw new NodeOperationError(this.getNode(), error, { itemIndex });
      }
    }

    return [returnData];
  }
}
