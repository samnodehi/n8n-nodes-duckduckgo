/**
 * Processing logic for DuckDuckGo node operations
 */

import {
  INodeExecutionData,
  IDataObject,
} from 'n8n-workflow';

import { decodeHtmlEntities, formatDate } from './utils';
import {
  IDuckDuckGoSearchResult,
  IDuckDuckGoImageResult,
  IDuckDuckGoNewsResult,
  IDuckDuckGoVideoResult,
} from './types';

/**
 * Processes web search results with enhanced rich data support
 *
 * @param results - Web search results to process
 * @param itemIndex - Index of the input item
 * @param rawResponse - Raw response data for enhanced processing
 * @returns Processed node execution data
 */
export function processWebSearchResults(
  results: IDuckDuckGoSearchResult[],
  itemIndex: number,
  rawResponse?: any,
): INodeExecutionData[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  const processedResults: INodeExecutionData[] = [];

  // Process main organic results with enhanced data
  const organicResults = results
    .filter(item => item && typeof item === 'object' && item.title && item.url)
    .map((item, index) => ({
      json: {
        position: index + 1,
        title: decodeHtmlEntities(item.title || '') || '',
        description: decodeHtmlEntities(item.description || '') || '',
        snippet: decodeHtmlEntities(item.description || '') || '',
        url: item.url || '',
        hostname: item.hostname || '',
        favicon: item.icon || '',
        sourceType: 'web',
        // Enhanced metadata
        raw_description: item.description || '',
        // Additional context if available
        ...(rawResponse?.vqd && { vqd: rawResponse.vqd }),
        // Enhanced search context
        search_metadata: {
          engine: 'duckduckgo',
          timestamp: new Date().toISOString(),
          result_type: 'organic'
        }
      } as IDataObject,
      pairedItem: {
        item: itemIndex,
      },
    }));

  processedResults.push(...organicResults);

  // Add Knowledge Graph if available in rawResponse
  if (rawResponse?.knowledge_graph) {
    const kg = rawResponse.knowledge_graph;
    processedResults.push({
      json: {
        sourceType: 'knowledge_graph',
        title: kg.title || '',
        subtitle: kg.subtitle || '',
        description: kg.description || '',
        website: kg.website || '',
        facts: kg.facts || {},
        profiles: kg.profiles || [],
        people_also_search_for: kg.people_also_search_for || [],
        thumbnail: kg.thumbnail || '',
        search_metadata: {
          engine: 'duckduckgo',
          timestamp: new Date().toISOString(),
          result_type: 'knowledge_graph'
        }
      } as IDataObject,
      pairedItem: { item: itemIndex }
    });
  }

  // Add AI Overview if available
  if (rawResponse?.ai_overview) {
    const ai = rawResponse.ai_overview;
    processedResults.push({
      json: {
        sourceType: 'ai_overview',
        answer: ai.answer || '',
        sources: ai.sources || [],
        search_metadata: {
          engine: 'duckduckgo',
          timestamp: new Date().toISOString(),
          result_type: 'ai_overview'
        }
      } as IDataObject,
      pairedItem: { item: itemIndex }
    });
  }

  // Add Top Stories if available
  if (rawResponse?.top_stories && Array.isArray(rawResponse.top_stories)) {
    rawResponse.top_stories.forEach((story: any, index: number) => {
      processedResults.push({
        json: {
          sourceType: 'top_story',
          position: index + 1,
          title: story.title || '',
          link: story.link || '',
          source: story.source || '',
          date: story.date || '',
          snippet: story.snippet || '',
          thumbnail: story.thumbnail || '',
          search_metadata: {
            engine: 'duckduckgo',
            timestamp: new Date().toISOString(),
            result_type: 'top_story'
          }
        } as IDataObject,
        pairedItem: { item: itemIndex }
      });
    });
  }

  // Add Related Searches if available
  if (rawResponse?.related_searches && Array.isArray(rawResponse.related_searches)) {
    processedResults.push({
      json: {
        sourceType: 'related_searches',
        searches: rawResponse.related_searches.map((search: any) => ({
          query: search.query || '',
          link: search.link || ''
        })),
        search_metadata: {
          engine: 'duckduckgo',
          timestamp: new Date().toISOString(),
          result_type: 'related_searches'
        }
      } as IDataObject,
      pairedItem: { item: itemIndex }
    });
  }

  return processedResults;
}

/**
 * Processes image search results
 *
 * @param results - Image search results to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processImageSearchResults(
  results: IDuckDuckGoImageResult[],
  itemIndex: number,
): INodeExecutionData[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  return results
    .filter(item => item && typeof item === 'object' && item.image)
    .map((item) => ({
      json: {
        title: decodeHtmlEntities(item.title || '') || '',
        description: null,
        url: item.url || '',
        imageUrl: item.image || '',
        thumbnailUrl: item.thumbnail || '',
        width: item.width || null,
        height: item.height || null,
        source: item.source || '',
        sourceType: 'image',
      } as IDataObject,
      pairedItem: {
        item: itemIndex,
      },
    }));
}

/**
 * Processes news search results
 *
 * @param results - News search results to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processNewsSearchResults(
  results: IDuckDuckGoNewsResult[],
  itemIndex: number,
): INodeExecutionData[] {
  return results.map((item) => ({
    json: {
      title: decodeHtmlEntities(item.title),
      description: decodeHtmlEntities(item.excerpt),
      url: item.url,
      imageUrl: item.image,
      date: formatDate(item.date),
      relativeTime: item.relativeTime,
      syndicate: item.syndicate,
      isOld: item.isOld,
      sourceType: 'news',
    } as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }));
}

/**
 * Processes video search results
 *
 * @param results - Video search results to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processVideoSearchResults(
  results: IDuckDuckGoVideoResult[],
  itemIndex: number,
): INodeExecutionData[] {
  return results.map((item) => ({
    json: {
      title: decodeHtmlEntities(item.title),
      description: decodeHtmlEntities(item.description),
      url: item.url,
      imageUrl: item.image,
      duration: item.duration,
      published: item.published,
      publishedOn: item.publishedOn,
      publisher: item.publisher,
      viewCount: item.viewCount,
      sourceType: 'video',
    } as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }));
}



/**
 * Processes error results
 *
 * @param error - Error object
 * @param itemData - Original input data
 * @param itemIndex - Index of the input item
 * @param debug - Whether debug mode is enabled
 * @param operation - Optional operation name for better context
 * @param options - Optional request options for debugging
 * @returns Error node execution data
 */
export function processError(
  error: Error,
  itemData: IDataObject,
  itemIndex: number,
  debug: boolean = false,
  operation?: string,
  options?: IDataObject,
): INodeExecutionData {
  const errorMessage = error.message || 'Unknown error occurred';
  const errorObject: IDataObject = {
    ...itemData,
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };

  // Add operation name if available for better context
  if (operation) {
    errorObject.operation = operation;
  }

  // Add detailed debugging information if debug mode is enabled
  if (debug) {
    errorObject.errorDetails = {
      stack: error.stack,
      name: error.name,
      cause: (error as any).cause,
    };

    // Include request options for API call debugging
    if (options) {
      errorObject.requestOptions = options;
    }
  }

  return {
    json: errorObject,
    pairedItem: {
      item: itemIndex,
    },
  };
}




