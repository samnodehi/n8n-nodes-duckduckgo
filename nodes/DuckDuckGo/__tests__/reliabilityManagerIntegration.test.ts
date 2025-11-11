/**
 * Integration tests for Reliability Manager with DuckDuckGo Search
 */

import { ReliabilityManager } from '../reliabilityManager';
import * as directSearch from '../directSearch';

// Mock the direct search module
jest.mock('../directSearch');

describe('Reliability Manager Integration', () => {
  let mockDirectWebSearch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDirectWebSearch = directSearch.directWebSearch as jest.Mock;
  });

  describe('executeWithRetry integration', () => {
    it('should call directWebSearch through reliability manager', async () => {
      const manager = new ReliabilityManager({
        maxRetries: 2,
        retryDelayMs: 100,
      });

      mockDirectWebSearch.mockResolvedValue({
        results: [
          { title: 'Result 1', url: 'https://example.com/1', description: 'Test' }
        ]
      });

      const executeSearch = async () => {
        const result = await mockDirectWebSearch('test query', {
          locale: 'us-en',
          safeSearch: 'moderate',
        });
        return {
          results: result.results,
          noResults: result.results.length === 0,
        };
      };

      const result = await manager.executeWithRetry(
        executeSearch,
        (res) => res.results && res.results.length > 0,
        'test search'
      );

      expect(mockDirectWebSearch).toHaveBeenCalledTimes(1);
      expect(result.results).toHaveLength(1);
      expect(manager.getMetrics().totalRequests).toBe(1);
      expect(manager.getMetrics().emptyResponses).toBe(0);
    });

    it('should retry on empty results', async () => {
      const manager = new ReliabilityManager({
        maxRetries: 3,
        retryDelayMs: 10,
        emptyResultThreshold: 2,
      });

      mockDirectWebSearch
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce({
          results: [
            { title: 'Result 1', url: 'https://example.com/1', description: 'Test' }
          ]
        });

      const executeSearch = async () => {
        const result = await mockDirectWebSearch('test query', {
          locale: 'us-en',
          safeSearch: 'moderate',
        });
        return {
          results: result.results,
          noResults: result.results.length === 0,
        };
      };

      const result = await manager.executeWithRetry(
        executeSearch,
        (res) => res.results && res.results.length > 0,
        'test search'
      );

      expect(mockDirectWebSearch).toHaveBeenCalledTimes(3);
      expect(result.results).toHaveLength(1);
      expect(manager.getMetrics().retriesExecuted).toBe(2);
    });

    it('should record failures and respect circuit breaker', async () => {
      const manager = new ReliabilityManager({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        maxRetries: 1,
        retryDelayMs: 10,
      });

      mockDirectWebSearch.mockRejectedValue(new Error('Network error'));

      const executeSearch = async () => {
        const result = await mockDirectWebSearch('test query', {
          locale: 'us-en',
          safeSearch: 'moderate',
        });
        return {
          results: result.results,
          noResults: result.results.length === 0,
        };
      };

      // First failure
      await expect(
        manager.executeWithRetry(
          executeSearch,
          (res) => res.results && res.results.length > 0,
          'test search'
        )
      ).rejects.toThrow('Network error');

      // Second failure - should trip circuit breaker
      await expect(
        manager.executeWithRetry(
          executeSearch,
          (res) => res.results && res.results.length > 0,
          'test search'
        )
      ).rejects.toThrow('Network error');

      // Circuit should now be OPEN
      expect(manager.getCircuitState()).toBe('open');
      expect(manager.getMetrics().circuitBreakerTrips).toBeGreaterThan(0);

      // Next request should be rejected by circuit breaker
      await expect(
        manager.executeWithRetry(
          executeSearch,
          (res) => res.results && res.results.length > 0,
          'test search'
        )
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should apply jitter and backoff on consecutive empty results', async () => {
      const manager = new ReliabilityManager({
        emptyResultThreshold: 2,
        initialBackoffMs: 100,
        minJitterMs: 10,
        maxJitterMs: 50,
        maxRetries: 0, // Don't retry, just test backoff
      });

      // Trigger consecutive empty results
      mockDirectWebSearch.mockResolvedValue({ results: [] });

      const executeSearch = async () => {
        const result = await mockDirectWebSearch('test query', {
          locale: 'us-en',
          safeSearch: 'moderate',
        });
        return {
          results: result.results,
          noResults: result.results.length === 0,
        };
      };

      // First empty result
      await manager.executeWithRetry(
        executeSearch,
        (res) => res.results && res.results.length > 0,
        'test search'
      );

      // Second empty result
      await manager.executeWithRetry(
        executeSearch,
        (res) => res.results && res.results.length > 0,
        'test search'
      );

      const metrics = manager.getMetrics();
      expect(metrics.consecutiveEmptyResponses).toBe(2);
      expect(metrics.emptyResponses).toBe(2);

      // Third request should trigger backoff
      const startTime = Date.now();
      await manager.executeWithRetry(
        executeSearch,
        (res) => res.results && res.results.length > 0,
        'test search'
      );
      const elapsed = Date.now() - startTime;

      // Should have applied delay (backoff + jitter)
      expect(elapsed).toBeGreaterThanOrEqual(100); // At least initial backoff
      expect(metrics.backoffActivations).toBeGreaterThan(0);
    });
  });

  describe('metrics tracking', () => {
    it('should track response times', async () => {
      const manager = new ReliabilityManager();

      mockDirectWebSearch.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { results: [{ title: 'Test', url: 'https://example.com', description: 'Test' }] };
      });

      const executeSearch = async () => {
        const result = await mockDirectWebSearch('test query', {
          locale: 'us-en',
          safeSearch: 'moderate',
        });
        return {
          results: result.results,
          noResults: result.results.length === 0,
        };
      };

      await manager.executeWithRetry(
        executeSearch,
        (res) => res.results && res.results.length > 0,
        'test search'
      );

      const metrics = manager.getMetrics();
      expect(metrics.averageResponseTimeMs).toBeGreaterThan(0);
      expect(metrics.totalRequests).toBe(1);
    });
  });
});
