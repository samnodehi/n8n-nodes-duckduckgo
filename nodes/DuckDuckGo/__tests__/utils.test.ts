import { parseApiError } from '../utils';

describe('parseApiError', () => {
  describe('network errors', () => {
    it('should return connection error message for ECONNREFUSED', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
      const result = parseApiError(error, 'news search');
      expect(result).toContain('Unable to connect to DuckDuckGo servers');
    });

    it('should return connection error message for ENOTFOUND', () => {
      const error = new Error('getaddrinfo ENOTFOUND duckduckgo.com');
      const result = parseApiError(error, 'web search');
      expect(result).toContain('Unable to connect to DuckDuckGo servers');
    });
  });

  describe('timeout errors', () => {
    it('should return timeout message for timeout keyword', () => {
      const error = new Error('Network request timed out');
      const result = parseApiError(error, 'image search');
      expect(result).toContain('timed out');
    });

    it('should return timeout message for ETIMEDOUT', () => {
      const error = new Error('connect ETIMEDOUT 1.2.3.4:443');
      const result = parseApiError(error, 'video search');
      expect(result).toContain('timed out');
    });
  });

  describe('rate limit errors', () => {
    it('should return rate limit message for 429', () => {
      const error = new Error('Request failed with status 429');
      const result = parseApiError(error, 'news search');
      expect(result).toContain('rate limit');
    });

    it('should return rate limit message for too many requests', () => {
      const error = new Error('too many requests from this IP');
      const result = parseApiError(error, 'web search');
      expect(result).toContain('rate limit');
    });
  });

  describe('search-specific HTTP errors', () => {
    it('should return bad request message for 400', () => {
      const error = new Error('Request failed with status 400');
      const result = parseApiError(error, 'web search');
      expect(result).toContain('Invalid search query');
    });

    it('should return access denied message for 403', () => {
      const error = new Error('Request failed with status 403');
      const result = parseApiError(error, 'news search');
      expect(result).toContain('Access denied');
    });

    it('should NOT apply 400/403 branch for non-search operations', () => {
      const error = new Error('Request failed with status 400');
      const result = parseApiError(error, 'image fetch');
      // Falls through to the generic message
      expect(result).toContain('400');
    });
  });

  describe('duck-duck-scrape server error', () => {
    it('should return actionable message for exact duck-duck-scrape error string', () => {
      const error = new Error('A server error occurred!');
      const result = parseApiError(error, 'news search');
      expect(result).toBe(
        'DuckDuckGo returned a server error during news search. This may be a temporary DuckDuckGo issue, rate limit, or upstream scraper failure. Try again later or reduce request frequency.'
      );
    });

    it('should include the operation name in the message', () => {
      const error = new Error('A server error occurred!');
      expect(parseApiError(error, 'video search')).toContain('video search');
      expect(parseApiError(error, 'image search')).toContain('image search');
    });

    it('should NOT match if message has extra text', () => {
      // Only the exact string triggers the branch; partial matches fall through
      const error = new Error('A server error occurred! Please try again.');
      const result = parseApiError(error, 'news search');
      expect(result).toContain('Error during news search');
    });
  });

  describe('generic fallthrough', () => {
    it('should echo original message for unrecognised errors', () => {
      const error = new Error('Something unexpected went wrong');
      const result = parseApiError(error, 'web search');
      expect(result).toBe('Error during web search: Something unexpected went wrong');
    });
  });
});
