import {
  DuckDuckGoError,
  DuckDuckGoErrorType,
  ErrorSeverity,
  RateLimitError,
  NetworkError,
  ValidationError,
  APIError,
  handleDuckDuckGoError,
} from '../errors';
import { NodeOperationError } from 'n8n-workflow';

describe('DuckDuckGo Error Classes', () => {
  describe('DuckDuckGoError', () => {
    it('should create error with default values', () => {
      const error = new DuckDuckGoError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.errorType).toBe(DuckDuckGoErrorType.UNKNOWN_ERROR);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.isRetryable).toBe(false);
      expect(error.userMessage).toBe('Test error');
    });

    it('should create error with custom values', () => {
      const error = new DuckDuckGoError('Network failed', DuckDuckGoErrorType.NETWORK_ERROR, {
        severity: ErrorSeverity.HIGH,
        isRetryable: true,
        userMessage: 'Custom user message',
        technicalDetails: { code: 'ECONNREFUSED' },
      });

      expect(error.errorType).toBe(DuckDuckGoErrorType.NETWORK_ERROR);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.isRetryable).toBe(true);
      expect(error.userMessage).toBe('Custom user message');
      expect(error.technicalDetails).toEqual({ code: 'ECONNREFUSED' });
    });

    it('should determine retryability based on error type', () => {
      const networkError = new DuckDuckGoError('Error', DuckDuckGoErrorType.NETWORK_ERROR);
      const validationError = new DuckDuckGoError('Error', DuckDuckGoErrorType.INVALID_INPUT);

      expect(networkError.isRetryable).toBe(true);
      expect(validationError.isRetryable).toBe(false);
    });

    it('should generate appropriate user messages', () => {
      const rateLimitError = new DuckDuckGoError('Error', DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED);
      const networkError = new DuckDuckGoError('Error', DuckDuckGoErrorType.NETWORK_ERROR);

      expect(rateLimitError.userMessage).toContain('Too many requests');
      expect(networkError.userMessage).toContain('Network connection failed');
    });

    it('should convert to NodeOperationError', () => {
      const error = new DuckDuckGoError('Test error', DuckDuckGoErrorType.API_ERROR);
      const mockNode = { name: 'DuckDuckGo' };

      const nodeError = error.toNodeOperationError(mockNode, 0);

      expect(nodeError).toBeInstanceOf(NodeOperationError);
      expect(nodeError.message).toContain('DuckDuckGo API returned an error');
      expect((nodeError as any).errorType).toBe(DuckDuckGoErrorType.API_ERROR);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry information', () => {
      const error = new RateLimitError('Rate limit hit', {
        retryAfter: 30000,
        remaining: 0,
        limit: 100,
      });

      expect(error.errorType).toBe(DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED);
      expect(error.isRetryable).toBe(true);
      expect(error.retryAfter).toBe(30000);
      expect(error.userMessage).toContain('Please wait 30 seconds');
    });

    it('should handle missing retry after', () => {
      const error = new RateLimitError('Rate limit hit');

      expect(error.userMessage).toBe('Rate limit exceeded. Please wait before making more requests.');
    });
  });

  describe('NetworkError', () => {
    it('should detect timeout errors', () => {
      const timeoutError = new Error('Request timeout ETIMEDOUT');
      const error = new NetworkError('Network failed', timeoutError);

      expect(error.errorType).toBe(DuckDuckGoErrorType.TIMEOUT);
      expect(error.isRetryable).toBe(true);
    });

    it('should detect connection refused errors', () => {
      const connError = new Error('connect ECONNREFUSED');
      const error = new NetworkError('Network failed', connError);

      expect(error.errorType).toBe(DuckDuckGoErrorType.CONNECTION_REFUSED);
    });

    it('should detect DNS errors', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND');
      const error = new NetworkError('Network failed', dnsError);

      expect(error.errorType).toBe(DuckDuckGoErrorType.DNS_ERROR);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field information', () => {
      const error = new ValidationError('Invalid email format', {
        field: 'email',
        value: 'not-an-email',
        validationRule: 'Must be a valid email address',
      });

      expect(error.errorType).toBe(DuckDuckGoErrorType.INVALID_INPUT);
      expect(error.isRetryable).toBe(false);
      expect(error.field).toBe('email');
      expect(error.userMessage).toContain('Invalid value for field "email"');
    });
  });

  describe('APIError', () => {
    it('should handle 429 status code as rate limit', () => {
      const error = new APIError('Too many requests', {
        statusCode: 429,
        responseBody: { error: 'rate_limited' },
      });

      expect(error.errorType).toBe(DuckDuckGoErrorType.TOO_MANY_REQUESTS);
      expect(error.isRetryable).toBe(true);
    });

    it('should handle 5xx errors as high severity', () => {
      const error = new APIError('Server error', {
        statusCode: 503,
      });

      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.isRetryable).toBe(true);
    });

    it('should handle 4xx errors as medium severity', () => {
      const error = new APIError('Bad request', {
        statusCode: 400,
      });

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('handleDuckDuckGoError', () => {
    const mockNode = {
      name: 'DuckDuckGo',
      id: 'test-node-id',
      typeVersion: 1,
      type: 'n8n-nodes-duckduckgo.duckDuckGo',
      position: [0, 0] as [number, number],
      parameters: {}
    };

    it('should pass through DuckDuckGoError', () => {
      const duckError = new DuckDuckGoError('Test', DuckDuckGoErrorType.API_ERROR);
      const result = handleDuckDuckGoError(duckError, 'test operation', {
        node: mockNode,
        itemIndex: 0,
      });

      expect(result).toBeInstanceOf(NodeOperationError);
      expect((result as any).errorType).toBe(DuckDuckGoErrorType.API_ERROR);
    });

    it('should pass through NodeOperationError', () => {
      const nodeError = new NodeOperationError(mockNode, 'Test error');
      const result = handleDuckDuckGoError(nodeError, 'test operation', {
        node: mockNode,
      });

      expect(result).toBe(nodeError);
    });

    it('should handle network errors', () => {
      const error = new Error('connect ECONNREFUSED');
      (error as any).code = 'ECONNREFUSED';

      const result = handleDuckDuckGoError(error, 'test operation', {
        node: mockNode,
      });

      expect(result).toBeInstanceOf(NodeOperationError);
      expect(result.message).toContain('Unable to connect to DuckDuckGo servers');
    });

    it('should handle rate limit errors', () => {
      const error = new Error('429: rate limit exceeded');

      const result = handleDuckDuckGoError(error, 'test operation', {
        node: mockNode,
      });

      expect(result).toBeInstanceOf(NodeOperationError);
      expect(result.message).toContain('Too many requests');
    });

    it('should handle validation errors', () => {
      const error = new Error('validation failed: invalid input');

      const result = handleDuckDuckGoError(error, 'test operation', {
        node: mockNode,
      });

      expect(result).toBeInstanceOf(NodeOperationError);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');

      const result = handleDuckDuckGoError(error, 'test operation', {
        node: mockNode,
        debugMode: false,
      });

      expect(result).toBeInstanceOf(NodeOperationError);
      expect(result.message).toContain('Error during test operation');
    });

    it('should include technical details in debug mode', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      const result = handleDuckDuckGoError(error, 'test operation', {
        node: mockNode,
        debugMode: true,
      });

      expect((result as any).technicalDetails).toBeDefined();
    });
  });
});
