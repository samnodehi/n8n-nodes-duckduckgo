/**
 * Result processing for DuckDuckGo node
 */

import { INodeExecutionData, IDataObject } from 'n8n-workflow';
import { decodeHtmlEntities, formatDate } from './utils';
import {
  IDuckDuckGoSearchResult,
  IDuckDuckGoImageResult,
  IDuckDuckGoNewsResult,
  IDuckDuckGoVideoResult,
} from './types';

export function processWebSearchResults(
  results: IDuckDuckGoSearchResult[],
  itemIndex: number,
  rawResponse?: any,
): INodeExecutionData[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  return results
    .filter(item => item && typeof item === 'object' && item.title && item.url)
    .map((item, index) => ({
      json: {
        position: index + 1,
        title: decodeHtmlEntities(item.title || '') || '',
        description: decodeHtmlEntities(item.description || '') || '',
        url: item.url || '',
        hostname: item.hostname || '',
        sourceType: 'web',
      } as IDataObject,
      pairedItem: { item: itemIndex },
    }));
}

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
        url: item.url || '',
        imageUrl: item.image || '',
        thumbnailUrl: item.thumbnail || '',
        width: item.width || null,
        height: item.height || null,
        source: item.source || '',
        sourceType: 'image',
      } as IDataObject,
      pairedItem: { item: itemIndex },
    }));
}

export function processNewsSearchResults(
  results: IDuckDuckGoNewsResult[],
  itemIndex: number,
): INodeExecutionData[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  return results.map((item) => ({
    json: {
      title: decodeHtmlEntities(item.title),
      description: decodeHtmlEntities(item.excerpt),
      url: item.url,
      imageUrl: item.image,
      date: formatDate(item.date),
      relativeTime: item.relativeTime,
      syndicate: item.syndicate,
      sourceType: 'news',
    } as IDataObject,
    pairedItem: { item: itemIndex },
  }));
}

export function processVideoSearchResults(
  results: IDuckDuckGoVideoResult[],
  itemIndex: number,
): INodeExecutionData[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  return results.map((item) => ({
    json: {
      title: decodeHtmlEntities(item.title),
      description: decodeHtmlEntities(item.description),
      url: item.url,
      imageUrl: item.image,
      duration: item.duration,
      published: item.published,
      publisher: item.publisher,
      viewCount: item.viewCount,
      sourceType: 'video',
    } as IDataObject,
    pairedItem: { item: itemIndex },
  }));
}
