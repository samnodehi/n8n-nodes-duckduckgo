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

  describe('how an HTTP status is recognised', () => {
    it.each([
      'Request failed with status code 403',
      'Request failed with status code 403.',
      'Web search failed: Request failed with status code 403',
      'DuckDuckGo image search returned 403 Forbidden. The search token (VQD) may have expired.',
      'DuckDuckGo did not return a search token for news search (HTTP 403).',
      'HTTP 403',
      'status: 403',
      'tunneling socket could not be established, statusCode=403',
    ])('treats "%s" as a 403', (message) => {
      expect(parseApiError(new Error(message), 'web search')).toContain('Access denied');
    });

    it.each([
      'Request failed with status code 429',
      'DuckDuckGo refused the news search request (HTTP 429).',
      'HTTP 429',
      '429 Too Many Requests',
    ])('treats "%s" as a rate limit', (message) => {
      expect(parseApiError(new Error(message), 'web search')).toContain('rate limit');
    });

    it.each([
      'Request failed with status code 400',
      '400 Bad Request',
    ])('treats "%s" as a bad request', (message) => {
      expect(parseApiError(new Error(message), 'web search')).toContain('Invalid search query');
    });

    // A number that only contains 400, 403 or 429 is not that status. The first
    // is a real shape (an OpenSSL error with a thread id); the rest are built to
    // cover longer codes, ports, counts and wording that only resembles a status.
    it.each([
      'write EPROTO 140403288340288:error:0A000126:SSL routines::unexpected eof while reading',
      'Asked DuckDuckGo for 429 news results and returned 400: x',
      'response 400 bytes too large',
      'status 403.5 is not a status',
      'Request failed with status code 14030',
      'Request failed with status code 40012',
      'Request failed with status code 4290',
      'connect to proxy on port 4030 failed',
      'item 1429 of 2000 could not be parsed',
      'Request failed with status code 500',
    ])('does not treat "%s" as 400, 403 or 429', (message) => {
      const result = parseApiError(new Error(message), 'web search');
      expect(result).toBe(`Error during web search: ${message}`);
    });
  });

  describe('messages that carry other text', () => {
    // The 429 check is not limited to search operations.
    it('treats a 429 in an operation that is not a search as a rate limit', () => {
      expect(parseApiError(new Error('Request failed with status code 429'), 'extract content')).toContain('rate limit');
    });

    // The cooldown message ends with a number of seconds, which can be 403 or 429.
    it.each(['403s', '429s', '1429s'])('does not read "resume automatically in %s" as a status', (seconds) => {
      const message = `DuckDuckGo showed a bot-detection challenge moments ago, so this request was not sent. Requests resume automatically in ${seconds}.`;
      expect(parseApiError(new Error(message), 'web search')).toBe(`Error during web search: ${message}`);
    });

    // The message can echo what a user or a model typed. A long run of spaces
    // after a keyword must not take quadratic time (it took half a minute).
    it('answers at once for a long run of spaces after a keyword', () => {
      const start = Date.now();
      for (const keyword of ['status', 'status code', 'HTTP', '403', '429']) {
        const message = `Invalid region: ${keyword}${' '.repeat(100000)}x`;
        expect(parseApiError(new Error(message), 'web search')).toBe(`Error during web search: ${message}`);
      }
      expect(Date.now() - start).toBeLessThan(1000);
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
