/**
 * DuckDuckGo n8n node - Simplified version
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
  searchImages,
  searchNews,
  searchVideos,
  SafeSearchType,
  SearchTimeType,
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

function getSafeSearchType(value: number): SafeSearchType {
  switch (value) {
    case 0:
      return SafeSearchType.STRICT;
    case -1:
      return SafeSearchType.MODERATE;
    case -2:
      return SafeSearchType.OFF;
    default:
      return SafeSearchType.MODERATE;
  }
}

function getSearchTimeType(value?: string): SearchTimeType {
  switch (value) {
    case 'd':
      return SearchTimeType.DAY;
    case 'w':
      return SearchTimeType.WEEK;
    case 'm':
      return SearchTimeType.MONTH;
    case 'y':
      return SearchTimeType.YEAR;
    default:
      return SearchTimeType.ALL;
  }
}

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
    properties: [
      // Operation
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: DuckDuckGoOperation.Search,
        noDataExpression: true,
        required: true,
        description: 'Type of search to perform',
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
            description: 'Discover news articles',
            action: 'Search for news',
          },
          {
            name: 'Video Search',
            value: DuckDuckGoOperation.SearchVideos,
            description: 'Find videos from various sources',
            action: 'Search for videos',
          },
        ],
      },
      // Locale
      {
        displayName: 'Locale',
        name: 'locale',
        type: 'options',
        default: 'en-us',
        description: 'Search language/region locale',
        options: LOCALE_OPTIONS,
      },
      // Search Query
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        required: true,
        default: '',
        description: 'The search terms to look for',
        placeholder: 'Enter your search query',
      },
      // Maximum Results
      {
        displayName: 'Maximum Results',
        name: 'maxResults',
        type: 'number',
        default: DEFAULT_PARAMETERS.MAX_RESULTS,
        description: 'Maximum number of results to return',
        typeOptions: {
          minValue: 1,
          maxValue: 50,
        },
      },
      // Region
      {
        displayName: 'Region',
        name: 'region',
        type: 'options',
        default: DEFAULT_PARAMETERS.REGION,
        description: 'Geographic region for search results',
        options: REGIONS,
      },
      // Safe Search
      {
        displayName: 'Safe Search',
        name: 'safeSearch',
        type: 'options',
        default: DEFAULT_PARAMETERS.SAFE_SEARCH,
        description: 'Content filtering level',
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
          },
        ],
      },
      // Time Period
      {
        displayName: 'Time Period',
        name: 'timePeriod',
        type: 'options',
        default: TimePeriod.AllTime,
        description: 'Time range for search results',
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
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as DuckDuckGoOperation;
        const query = this.getNodeParameter('query', itemIndex) as string;
        const locale = this.getNodeParameter('locale', itemIndex) as string;
        const maxResults = this.getNodeParameter('maxResults', itemIndex) as number;
        const region = this.getNodeParameter('region', itemIndex) as string;
        const safeSearch = this.getNodeParameter('safeSearch', itemIndex) as number;
        const timePeriod = this.getNodeParameter('timePeriod', itemIndex) as string;

        if (!query || query.trim() === '') {
          throw new NodeOperationError(this.getNode(), 'Search query cannot be empty', { itemIndex });
        }

        let results: INodeExecutionData[] = [];

        if (operation === DuckDuckGoOperation.Search) {
          const searchResult = await search(query, {
            safeSearch: getSafeSearchType(safeSearch),
            locale: region || locale,
            time: getSearchTimeType(timePeriod),
          });

          if (searchResult?.results?.length) {
            results = processWebSearchResults(searchResult.results as any, itemIndex, searchResult).slice(0, maxResults);
          } else {
            results = [{
              json: { success: true, query, count: 0, results: [] },
              pairedItem: { item: itemIndex },
            }];
          }
        } else if (operation === DuckDuckGoOperation.SearchImages) {
          const searchResult = await searchImages(query, {
            safeSearch: getSafeSearchType(safeSearch),
            locale: region || locale,
          });

          if (searchResult?.results?.length) {
            results = processImageSearchResults(searchResult.results as any, itemIndex).slice(0, maxResults);
          } else {
            results = [{
              json: { success: true, query, count: 0, results: [] },
              pairedItem: { item: itemIndex },
            }];
          }
        } else if (operation === DuckDuckGoOperation.SearchNews) {
          const searchResult = await searchNews(query, {
            safeSearch: getSafeSearchType(safeSearch),
            locale: region || locale,
            time: getSearchTimeType(timePeriod),
          });

          if (searchResult?.results?.length) {
            results = processNewsSearchResults(searchResult.results as any, itemIndex).slice(0, maxResults);
          } else {
            results = [{
              json: { success: true, query, count: 0, results: [] },
              pairedItem: { item: itemIndex },
            }];
          }
        } else if (operation === DuckDuckGoOperation.SearchVideos) {
          const searchResult = await searchVideos(query, {
            safeSearch: getSafeSearchType(safeSearch),
            locale: region || locale,
          });

          if (searchResult?.results?.length) {
            results = processVideoSearchResults(searchResult.results as any, itemIndex).slice(0, maxResults);
          } else {
            results = [{
              json: { success: true, query, count: 0, results: [] },
              pairedItem: { item: itemIndex },
            }];
          }
        } else {
          throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex });
        }

        returnData.push(...results);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              ...items[itemIndex].json,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error, { itemIndex });
      }
    }

    return [returnData];
  }
}
