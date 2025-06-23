import { IExecuteFunctions } from 'n8n-workflow';
import { IDuckDuckGoDictionaryResult } from './types';
import { reportEvent } from './telemetry';
import { getCached, setCache } from './cache';
import { getGlobalRateLimiter } from './rateLimiter';
import { handleDuckDuckGoError, DuckDuckGoError, DuckDuckGoErrorType } from './errors';

const DDG = require('duck-duck-scrape');

/**
 * Get dictionary definition for a word
 */
export async function getDictionaryDefinition(
  word: string,
  context: IExecuteFunctions,
  itemIndex: number
): Promise<IDuckDuckGoDictionaryResult[]> {
  const cacheKey = `dictionary:${word}`;
  const cachedData = getCached<IDuckDuckGoDictionaryResult[]>(cacheKey);

  if (cachedData) {
    context.logger.info(`Using cached dictionary data for word: ${word}`);
    return cachedData;
  }

    try {
    context.logger.info(`Getting dictionary definition for word: ${word}`);

    // Apply rate limiting
    const rateLimiter = getGlobalRateLimiter();
    const canProceed = await rateLimiter.checkAndWait('dictionary', context, itemIndex);

    if (!canProceed) {
      throw new DuckDuckGoError(
        'Rate limit exceeded for dictionary operation',
        DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED,
        {
          userMessage: 'Too many dictionary lookups. Please wait a moment before trying again.',
        }
      );
    }

    const startTime = Date.now();
    const definitions = await DDG.dictionaryDefinition(word);

    await reportEvent(context, 'dictionary_lookup', {
      operation: 'dictionary',
      durationMs: Date.now() - startTime,
      resultCount: definitions?.length || 0,
      parameters: { word }
    });

    if (!definitions || definitions.length === 0) {
      context.logger.warn(`No dictionary definitions found for word: ${word}`);
      return [];
    }

    const results = formatDictionaryResults(definitions);
    setCache(cacheKey, results, 300); // Cache for 5 minutes

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error(`Dictionary error for word ${word}: ${errorMessage}`);

    // Use improved error handling
    throw handleDuckDuckGoError(error, 'dictionary lookup', {
      debugMode: true,
    });
  }
}

/**
 * Format dictionary results from duck-duck-scrape to our interface
 */
function formatDictionaryResults(definitions: any[]): IDuckDuckGoDictionaryResult[] {
  return definitions.map(def => ({
    word: def.word || null,
    partOfSpeech: def.partOfSpeech || null,
    definition: def.text || def.definition || null,
    examples: def.exampleUses?.map((ex: any) => ex.text) || null,
    synonyms: def.relatedWords?.find((rw: any) => rw.relationshipType === 'synonym')?.words || null,
    antonyms: def.relatedWords?.find((rw: any) => rw.relationshipType === 'antonym')?.words || null,
    attributionText: def.attributionText || null,
    attributionUrl: def.attributionUrl || null,
    wordnikUrl: def.wordnikUrl || null,
  }));
}
