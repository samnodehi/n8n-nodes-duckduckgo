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
  IDuckDuckGoInstantAnswer,
  IDuckDuckGoDictionaryResult,
  IDuckDuckGoStockResult,
  IDuckDuckGoCurrencyResult,
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
 * Processes instant answer results
 *
 * @param answer - Instant answer result to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processInstantAnswerResult(
  answer: IDuckDuckGoInstantAnswer,
  itemIndex: number,
): INodeExecutionData {
  const processedData: IDataObject = {
    sourceType: 'instantAnswer',
  };

  // Main answer content
  if (answer.Answer) {
    processedData.answer = decodeHtmlEntities(answer.Answer);
    processedData.answerType = answer.AnswerType || 'direct';
  }

  // Abstract/Summary
  if (answer.Abstract || answer.AbstractText) {
    processedData.abstract = {
      text: decodeHtmlEntities(answer.AbstractText || answer.Abstract || ''),
      source: answer.AbstractSource || '',
      url: answer.AbstractURL || '',
    };
  }

  // Definition
  if (answer.Definition) {
    processedData.definition = {
      text: decodeHtmlEntities(answer.Definition),
      source: answer.DefinitionSource || '',
      url: answer.DefinitionURL || '',
    };
  }

  // Heading and image
  if (answer.Heading) {
    processedData.heading = decodeHtmlEntities(answer.Heading);
  }

  if (answer.Image) {
    processedData.imageUrl = answer.Image;
  }

  // Related topics
  if (answer.RelatedTopics && answer.RelatedTopics.length > 0) {
    processedData.relatedTopics = answer.RelatedTopics
      .filter(topic => topic.Text || topic.FirstURL)
      .map(topic => ({
        text: decodeHtmlEntities(topic.Text || ''),
        url: topic.FirstURL || '',
        icon: topic.Icon?.URL || '',
      }));
  }

  // Direct results
  if (answer.Results && answer.Results.length > 0) {
    processedData.results = answer.Results
      .filter(result => result.Text || result.FirstURL)
      .map(result => ({
        text: decodeHtmlEntities(result.Text || ''),
        url: result.FirstURL || '',
        icon: result.Icon?.URL || '',
      }));
  }

  // Response type
  processedData.responseType = answer.Type || 'unknown';

  // Add a flag to indicate if we got any meaningful answer
  processedData.hasAnswer = !!(
    answer.Answer ||
    answer.Abstract ||
    answer.Definition ||
    (answer.Results && answer.Results.length > 0)
  );

  return {
    json: processedData,
    pairedItem: {
      item: itemIndex,
    },
  };
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

/**
 * Processes dictionary results
 *
 * @param results - Dictionary results to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processDictionaryResults(
  results: IDuckDuckGoDictionaryResult[],
  itemIndex: number,
): INodeExecutionData[] {
  return results.map((item) => ({
    json: {
      word: item.word,
      partOfSpeech: item.partOfSpeech,
      definition: decodeHtmlEntities(item.definition),
      examples: item.examples?.map(ex => decodeHtmlEntities(ex)),
      synonyms: item.synonyms,
      antonyms: item.antonyms,
      attributionText: item.attributionText,
      attributionUrl: item.attributionUrl,
      wordnikUrl: item.wordnikUrl,
      sourceType: 'dictionary',
    } as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  }));
}

/**
 * Processes stock result
 *
 * @param result - Stock result to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processStockResult(
  result: IDuckDuckGoStockResult,
  itemIndex: number,
): INodeExecutionData {
  return {
    json: {
      symbol: result.symbol,
      name: result.name,
      price: result.price,
      change: result.change,
      changePercent: result.changePercent,
      open: result.open,
      high: result.high,
      low: result.low,
      volume: result.volume,
      marketCap: result.marketCap,
      peRatio: result.peRatio,
      weekHigh52: result.weekHigh52,
      weekLow52: result.weekLow52,
      lastUpdated: result.lastUpdated,
      sourceType: 'stock',
    } as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  };
}

/**
 * Processes currency result
 *
 * @param result - Currency result to process
 * @param itemIndex - Index of the input item
 * @returns Processed node execution data
 */
export function processCurrencyResult(
  result: IDuckDuckGoCurrencyResult,
  itemIndex: number,
): INodeExecutionData {
  return {
    json: {
      from: result.from,
      to: result.to,
      amount: result.amount,
      convertedAmount: result.convertedAmount,
      exchangeRate: result.exchangeRate,
      fromName: result.fromName,
      toName: result.toName,
      lastUpdated: result.lastUpdated,
      sourceType: 'currency',
    } as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  };
}
