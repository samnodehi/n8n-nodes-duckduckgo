import { getDictionaryDefinition } from '../dictionary';
import { IExecuteFunctions } from 'n8n-workflow';

// Mock duck-duck-scrape
jest.mock('duck-duck-scrape', () => ({
  dictionaryDefinition: jest.fn(),
}));

// Mock cache
jest.mock('../cache', () => ({
  getCached: jest.fn(() => null),
  setCache: jest.fn(),
}));

// Mock telemetry
jest.mock('../telemetry', () => ({
  reportEvent: jest.fn(() => Promise.resolve()),
}));

import { getCached, setCache } from '../cache';

const mockContext = {
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as IExecuteFunctions;

describe('Dictionary', () => {
  const DDG = require('duck-duck-scrape');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDictionaryDefinition', () => {
    it('should get dictionary definition for a word', async () => {
      const mockDefinitions = [
        {
          word: 'test',
          partOfSpeech: 'noun',
          text: 'A procedure for critical evaluation',
          exampleUses: [
            { text: 'He passed the test' },
            { text: 'The test was difficult' },
          ],
          relatedWords: [
            {
              relationshipType: 'synonym',
              words: ['exam', 'trial', 'experiment'],
            },
            {
              relationshipType: 'antonym',
              words: ['failure'],
            },
          ],
          attributionText: 'Wordnik',
          attributionUrl: 'https://wordnik.com',
          wordnikUrl: 'https://wordnik.com/words/test',
        },
      ];

      DDG.dictionaryDefinition.mockResolvedValue(mockDefinitions);

      const result = await getDictionaryDefinition('test', mockContext, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        word: 'test',
        partOfSpeech: 'noun',
        definition: 'A procedure for critical evaluation',
        examples: ['He passed the test', 'The test was difficult'],
        synonyms: ['exam', 'trial', 'experiment'],
        antonyms: ['failure'],
        attributionText: 'Wordnik',
        attributionUrl: 'https://wordnik.com',
        wordnikUrl: 'https://wordnik.com/words/test',
      });

      expect(DDG.dictionaryDefinition).toHaveBeenCalledWith('test');
      expect(setCache).toHaveBeenCalledWith('dictionary:test', result, 300);
    });

    it('should return empty array when no definitions found', async () => {
      DDG.dictionaryDefinition.mockResolvedValue([]);

      const result = await getDictionaryDefinition('xyz123', mockContext, 0);

      expect(result).toEqual([]);
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        'No dictionary definitions found for word: xyz123'
      );
    });

    it('should handle errors gracefully', async () => {
      DDG.dictionaryDefinition.mockRejectedValue(new Error('API Error'));

      await expect(
        getDictionaryDefinition('test', mockContext, 0)
      ).rejects.toThrow('API Error');

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Dictionary error for word test: API Error'
      );
    });

    it('should use cached data when available', async () => {
      const cachedData = [
        {
          word: 'cached',
          definition: 'Stored in cache',
        },
      ];

      (getCached as jest.Mock).mockReturnValue(cachedData);

      const result = await getDictionaryDefinition('cached', mockContext, 0);

      expect(result).toEqual(cachedData);
      expect(DDG.dictionaryDefinition).not.toHaveBeenCalled();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Using cached dictionary data for word: cached'
      );
    });
  });
});
