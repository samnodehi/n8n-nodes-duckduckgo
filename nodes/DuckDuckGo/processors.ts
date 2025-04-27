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
 * Processes web search results
 *
 * @param results - Web search results to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processWebSearchResults(
  results: IDuckDuckGoSearchResult[],
  itemIndex: number,
): INodeExecutionData[] {
  return results.map((item) => ({
    json: {
      title: decodeHtmlEntities(item.title),
      description: decodeHtmlEntities(item.description),
      url: item.url,
      hostname: item.hostname,
      favicon: item.icon,
      sourceType: 'web',
    } as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }));
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
  return results.map((item) => ({
    json: {
      title: decodeHtmlEntities(item.title),
      description: null,
      url: item.url,
      imageUrl: item.image,
      thumbnailUrl: item.thumbnail,
      width: item.width,
      height: item.height,
      source: item.source,
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
