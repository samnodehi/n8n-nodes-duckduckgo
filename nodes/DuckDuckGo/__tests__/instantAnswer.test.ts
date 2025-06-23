import { IExecuteFunctions } from 'n8n-workflow';
import { getInstantAnswer, formatInstantAnswer } from '../instantAnswer';
import { IDuckDuckGoInstantAnswer } from '../types';

// Mock the IExecuteFunctions
const mockExecuteFunctions: Partial<IExecuteFunctions> = {
  getNodeParameter: jest.fn(),
  getNode: jest.fn(() => ({
    id: 'test-node-id',
    name: 'DuckDuckGo',
    type: 'n8n-nodes-duckduckgo.duckDuckGo',
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  } as any)),
  helpers: {
    request: jest.fn(),
  } as any,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
  } as any,
};

describe('Instant Answer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstantAnswer', () => {
    it('should fetch instant answer successfully', async () => {
      const mockResponse: IDuckDuckGoInstantAnswer = {
        Abstract: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
        AbstractText: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
        AbstractSource: 'Wikipedia',
        AbstractURL: 'https://en.wikipedia.org/wiki/Node.js',
        Heading: 'Node.js',
        Type: 'A',
      };

      (mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(false);
      (mockExecuteFunctions.helpers!.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getInstantAnswer.call(
        mockExecuteFunctions as IExecuteFunctions,
        'nodejs',
        {}
      );

      expect(result).toEqual(mockResponse);
      expect(mockExecuteFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'GET',
        url: expect.stringContaining('https://api.duckduckgo.com/?q=nodejs'),
        headers: {
          'User-Agent': 'n8n-nodes-duckduckgo/1.0',
        },
        json: true,
      });
    });

    it('should handle empty query error', async () => {
      await expect(
        getInstantAnswer.call(
          mockExecuteFunctions as IExecuteFunctions,
          '',
          {}
        )
      ).rejects.toThrow('Query parameter is required');
    });

    it('should handle API errors gracefully', async () => {
      (mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(false);
      (mockExecuteFunctions.helpers!.request as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        getInstantAnswer.call(
          mockExecuteFunctions as IExecuteFunctions,
          'test',
          {}
        )
      ).rejects.toThrow();
    });

    it('should handle options correctly', async () => {
      const mockResponse: IDuckDuckGoInstantAnswer = { Type: 'A' };

      (mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(false);
      (mockExecuteFunctions.helpers!.request as jest.Mock).mockResolvedValue(mockResponse);

      await getInstantAnswer.call(
        mockExecuteFunctions as IExecuteFunctions,
        'test query',
        {
          noRedirect: true,
          noHtml: true,
          skipDisambig: true,
        }
      );

      expect(mockExecuteFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'GET',
        url: expect.stringContaining('no_redirect=1&no_html=1&skip_disambig=1'),
        headers: {
          'User-Agent': 'n8n-nodes-duckduckgo/1.0',
        },
        json: true,
      });
    });
  });

  describe('formatInstantAnswer', () => {
    it('should format answer response correctly', () => {
      const answer: IDuckDuckGoInstantAnswer = {
        Answer: '42',
        AnswerType: 'calc',
        Heading: 'The Answer',
      };

      const formatted = formatInstantAnswer(answer);

      expect(formatted).toEqual({
        sourceType: 'instantAnswer',
        answer: '42',
        answerType: 'calc',
        heading: 'The Answer',
        responseType: 'unknown',
      });
    });

    it('should format abstract response correctly', () => {
      const answer: IDuckDuckGoInstantAnswer = {
        Abstract: 'This is an abstract',
        AbstractText: 'This is the full abstract text',
        AbstractSource: 'Wikipedia',
        AbstractURL: 'https://wikipedia.org',
        Type: 'A',
      };

      const formatted = formatInstantAnswer(answer);

      expect(formatted).toHaveProperty('abstract', {
        text: 'This is the full abstract text',
        source: 'Wikipedia',
        url: 'https://wikipedia.org',
      });
      expect(formatted.responseType).toBe('A');
    });

    it('should format definition response correctly', () => {
      const answer: IDuckDuckGoInstantAnswer = {
        Definition: 'A test definition',
        DefinitionSource: 'Dictionary',
        DefinitionURL: 'https://dictionary.com',
      };

      const formatted = formatInstantAnswer(answer);

      expect(formatted).toHaveProperty('definition', {
        text: 'A test definition',
        source: 'Dictionary',
        url: 'https://dictionary.com',
      });
    });

    it('should handle related topics correctly', () => {
      const answer: IDuckDuckGoInstantAnswer = {
        RelatedTopics: [
          {
            Text: 'Related topic 1',
            FirstURL: 'https://example1.com',
            Icon: { URL: 'https://icon1.com' },
          },
          {
            Text: 'Related topic 2',
            FirstURL: 'https://example2.com',
          },
        ],
      };

      const formatted = formatInstantAnswer(answer);

      expect(formatted.relatedTopics).toEqual([
        {
          text: 'Related topic 1',
          url: 'https://example1.com',
          icon: 'https://icon1.com',
        },
        {
          text: 'Related topic 2',
          url: 'https://example2.com',
          icon: '',
        },
      ]);
    });
  });
});
