/**
 * DuckDuckGo Instant Answer API implementation
 */

import {
  IExecuteFunctions,
  IDataObject,
  NodeApiError,
} from 'n8n-workflow';

import {
  IDuckDuckGoInstantAnswer,
} from './types';

import {
  createLogEntry,
  LogLevel,
} from './utils';

import { getGlobalRateLimiter } from './rateLimiter';
import { handleDuckDuckGoError, DuckDuckGoError, DuckDuckGoErrorType } from './errors';

const INSTANT_ANSWER_API_URL = 'https://api.duckduckgo.com/';

/**
 * Get instant answer from DuckDuckGo API
 *
 * @param this - The execute functions context
 * @param query - The search query
 * @param options - Additional options
 * @returns Promise with the instant answer response
 */
export async function getInstantAnswer(
  this: IExecuteFunctions,
  query: string,
  options: {
    noRedirect?: boolean;
    noHtml?: boolean;
    skipDisambig?: boolean;
  } = {}
): Promise<IDuckDuckGoInstantAnswer> {
  const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;
  const itemIndex = 0; // Default item index for rate limiting

  if (!query || query.trim() === '') {
    throw new NodeApiError(this.getNode(), {
      message: 'Query parameter is required',
      description: 'Please provide a search query for instant answer',
    });
  }

  // Apply rate limiting
  const rateLimiter = getGlobalRateLimiter();
  const canProceed = await rateLimiter.checkAndWait('instantAnswer', this, itemIndex);

  if (!canProceed) {
    throw new DuckDuckGoError(
      'Rate limit exceeded for instant answers',
      DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED,
      {
        userMessage: 'Too many instant answer requests. Please wait a moment before trying again.',
      }
    );
  }

  // Build query parameters
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    pretty: '0',
    no_redirect: options.noRedirect ? '1' : '0',
    no_html: options.noHtml ? '1' : '0',
    skip_disambig: options.skipDisambig ? '1' : '0',
  });

  const url = `${INSTANT_ANSWER_API_URL}?${params.toString()}`;

  if (debugMode) {
    const logEntry = createLogEntry(
      LogLevel.INFO,
      `Fetching instant answer for query: ${query}`,
      'instantAnswer',
      { query, url, options }
    );
    console.log(JSON.stringify(logEntry));
  }

  try {
    // Make the API request
    const response = await this.helpers.request({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'n8n-nodes-duckduckgo/1.0',
      },
      json: true,
    });

    if (debugMode) {
      const logEntry = createLogEntry(
        LogLevel.INFO,
        `Instant answer received successfully`,
        'instantAnswer',
        {
          query,
          hasAbstract: !!response.Abstract,
          hasAnswer: !!response.Answer,
          hasDefinition: !!response.Definition,
          type: response.Type,
        }
      );
      console.log(JSON.stringify(logEntry));
    }

    return response as IDuckDuckGoInstantAnswer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    if (debugMode) {
      const logEntry = createLogEntry(
        LogLevel.ERROR,
        `Instant answer error: ${errorMessage}`,
        'instantAnswer',
        { query, error: errorMessage }
      );
      console.error(JSON.stringify(logEntry));
    }

    // Use improved error handling
    if (error instanceof DuckDuckGoError) {
      throw error.toNodeOperationError(this.getNode(), itemIndex);
    }

    throw handleDuckDuckGoError(error, 'instant answer', {
      node: this.getNode(),
      itemIndex,
      debugMode,
    });
  }
}

/**
 * Format instant answer for output
 *
 * @param answer - The instant answer response
 * @returns Formatted output object
 */
export function formatInstantAnswer(answer: IDuckDuckGoInstantAnswer): IDataObject {
  const formatted: IDataObject = {
    sourceType: 'instantAnswer',
  };

  // Main answer content
  if (answer.Answer) {
    formatted.answer = answer.Answer;
    formatted.answerType = answer.AnswerType || 'direct';
  }

  // Abstract/Summary
  if (answer.Abstract || answer.AbstractText) {
    formatted.abstract = {
      text: answer.AbstractText || answer.Abstract || '',
      source: answer.AbstractSource || '',
      url: answer.AbstractURL || '',
    };
  }

  // Definition
  if (answer.Definition) {
    formatted.definition = {
      text: answer.Definition,
      source: answer.DefinitionSource || '',
      url: answer.DefinitionURL || '',
    };
  }

  // Heading and image
  if (answer.Heading) {
    formatted.heading = answer.Heading;
  }

  if (answer.Image) {
    formatted.imageUrl = answer.Image;
  }

  // Related topics
  if (answer.RelatedTopics && answer.RelatedTopics.length > 0) {
    formatted.relatedTopics = answer.RelatedTopics.map(topic => ({
      text: topic.Text || '',
      url: topic.FirstURL || '',
      icon: topic.Icon?.URL || '',
    }));
  }

  // Direct results
  if (answer.Results && answer.Results.length > 0) {
    formatted.results = answer.Results.map(result => ({
      text: result.Text || '',
      url: result.FirstURL || '',
      icon: result.Icon?.URL || '',
    }));
  }

  // Response type
  formatted.responseType = answer.Type || 'unknown';

  return formatted;
}
