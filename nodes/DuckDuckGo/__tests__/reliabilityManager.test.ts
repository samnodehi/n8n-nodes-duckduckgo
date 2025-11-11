/**
 * Tests for Reliability Manager
 */

import {
  ReliabilityManager,
  CircuitState,
  getGlobalReliabilityManager,
  resetGlobalReliabilityManager,
} from '../reliabilityManager';

describe('ReliabilityManager', () => {
  let manager: ReliabilityManager;

  beforeEach(() => {
    manager = new ReliabilityManager({
      emptyResultThreshold: 3,
      initialBackoffMs: 1000,
      maxBackoffMs: 10000,
      backoffMultiplier: 2,
      minJitterMs: 100,
      maxJitterMs: 500,
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
  });

  afterEach(() => {
    resetGlobalReliabilityManager();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new ReliabilityManager();
      const metrics = defaultManager.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.emptyResponses).toBe(0);
      expect(metrics.consecutiveEmptyResponses).toBe(0);
      expect(defaultManager.getCircuitState()).toBe(CircuitState.CLOSED);
    });

    it('should initialize with custom configuration', () => {
      const customManager = new ReliabilityManager({
        emptyResultThreshold: 5,
        initialBackoffMs: 2000,
      });

      expect(customManager).toBeDefined();
    });
  });

  describe('metrics tracking', () => {
    it('should record successful requests with results', () => {
      manager.recordSuccess(100, 10);
      const metrics = manager.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.emptyResponses).toBe(0);
      expect(metrics.consecutiveEmptyResponses).toBe(0);
      expect(metrics.averageResponseTimeMs).toBe(100);
    });

    it('should record successful requests with empty results', () => {
      manager.recordSuccess(100, 0);
      const metrics = manager.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.emptyResponses).toBe(1);
      expect(metrics.consecutiveEmptyResponses).toBe(1);
    });

    it('should reset consecutive empty responses on successful result', () => {
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 10); // Non-empty result
      const metrics = manager.getMetrics();

      expect(metrics.emptyResponses).toBe(2);
      expect(metrics.consecutiveEmptyResponses).toBe(0);
    });

    it('should record failed requests', () => {
      manager.recordFailure(100, new Error('Test error'));
      const metrics = manager.getMetrics();

      expect(metrics.totalRequests).toBe(1);
    });

    it('should track average response time', () => {
      manager.recordSuccess(100, 10);
      manager.recordSuccess(200, 10);
      manager.recordSuccess(300, 10);
      const metrics = manager.getMetrics();

      expect(metrics.averageResponseTimeMs).toBe(200);
    });
  });

  describe('adaptive backoff', () => {
    it('should not trigger backoff below threshold', () => {
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      const backoff = manager.calculateBackoffDelay();

      expect(backoff).toBe(0);
    });

    it('should trigger backoff at threshold', () => {
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      const backoff = manager.calculateBackoffDelay();

      expect(backoff).toBeGreaterThan(0);
      expect(backoff).toBe(1000); // Initial backoff
    });

    it('should apply exponential backoff', () => {
      // Trigger threshold
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      let backoff = manager.calculateBackoffDelay();
      expect(backoff).toBe(1000);

      // Add more empty results
      manager.recordSuccess(100, 0);
      backoff = manager.calculateBackoffDelay();
      expect(backoff).toBe(2000);

      manager.recordSuccess(100, 0);
      backoff = manager.calculateBackoffDelay();
      expect(backoff).toBe(4000);
    });

    it('should cap backoff at maximum', () => {
      // Trigger many empty results
      for (let i = 0; i < 20; i++) {
        manager.recordSuccess(100, 0);
      }

      const backoff = manager.calculateBackoffDelay();
      expect(backoff).toBeLessThanOrEqual(10000);
    });
  });

  describe('jitter calculation', () => {
    it('should calculate jitter within range', () => {
      const jitter = manager.calculateJitter();

      expect(jitter).toBeGreaterThanOrEqual(100);
      expect(jitter).toBeLessThanOrEqual(500);
    });

    it('should produce different jitter values', () => {
      const jitters = new Set();
      for (let i = 0; i < 100; i++) {
        jitters.add(manager.calculateJitter());
      }

      // Should have multiple different values
      expect(jitters.size).toBeGreaterThan(1);
    });
  });

  describe('total delay calculation', () => {
    it('should combine backoff and jitter', async () => {
      // Trigger backoff
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);

      const delay = await manager.getDelay();
      expect(delay).toBeGreaterThanOrEqual(1100); // 1000 backoff + 100 min jitter
      expect(delay).toBeLessThanOrEqual(1500); // 1000 backoff + 500 max jitter
    });

    it('should track backoff activations', async () => {
      // Trigger backoff
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);
      manager.recordSuccess(100, 0);

      await manager.getDelay();
      const metrics = manager.getMetrics();

      expect(metrics.backoffActivations).toBe(1);
    });
  });

  describe('circuit breaker', () => {
    it('should start in CLOSED state', () => {
      expect(manager.getCircuitState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after failure threshold', () => {
      // Record failures to hit threshold
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(100, new Error('Test error'));
      }

      expect(manager.getCircuitState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests when circuit is OPEN', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(100, new Error('Test error'));
      }

      const result = await manager.shouldAllowRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Use a short timeout for testing
      const shortTimeoutManager = new ReliabilityManager({
        failureThreshold: 2,
        resetTimeoutMs: 100, // 100ms timeout
      });

      // Open the circuit
      shortTimeoutManager.recordFailure(100, new Error('Test error'));
      shortTimeoutManager.recordFailure(100, new Error('Test error'));
      expect(shortTimeoutManager.getCircuitState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should allow request and transition to HALF_OPEN
      const result = await shortTimeoutManager.shouldAllowRequest();
      expect(result.allowed).toBe(true);
      expect(shortTimeoutManager.getCircuitState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit on success in HALF_OPEN state', () => {
      const shortManager = new ReliabilityManager({
        failureThreshold: 2,
        resetTimeoutMs: 100,
      });

      // Open circuit
      shortManager.recordFailure(100, new Error('Test error'));
      shortManager.recordFailure(100, new Error('Test error'));

      // Manually transition to HALF_OPEN for testing
      shortManager['circuitState'] = CircuitState.HALF_OPEN;

      // Record success
      shortManager.recordSuccess(100, 10);

      expect(shortManager.getCircuitState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in HALF_OPEN state', () => {
      const shortManager = new ReliabilityManager({
        failureThreshold: 2,
        resetTimeoutMs: 100,
      });

      // Open circuit
      shortManager.recordFailure(100, new Error('Test error'));
      shortManager.recordFailure(100, new Error('Test error'));

      // Manually transition to HALF_OPEN
      shortManager['circuitState'] = CircuitState.HALF_OPEN;
      shortManager['circuitOpenedAt'] = 0;

      // Record failure
      shortManager.recordFailure(100, new Error('Test error'));

      expect(shortManager.getCircuitState()).toBe(CircuitState.OPEN);
    });

    it('should track circuit breaker trips', () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(100, new Error('Test error'));
      }

      const metrics = manager.getMetrics();
      expect(metrics.circuitBreakerTrips).toBeGreaterThan(0);
    });
  });

  describe('executeWithRetry', () => {
    it('should execute function successfully on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue({ results: [1, 2, 3] });
      const isSuccess = (result: any) => result.results.length > 0;

      const result = await manager.executeWithRetry(mockFn, isSuccess);

      expect(result).toEqual({ results: [1, 2, 3] });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on empty results', async () => {
      const mockFn = jest
        .fn()
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce({ results: [1, 2, 3] });

      const isSuccess = (result: any) => result.results.length > 0;

      const result = await manager.executeWithRetry(mockFn, isSuccess);

      expect(result).toEqual({ results: [1, 2, 3] });
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should retry on failures', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ results: [1, 2, 3] });

      const isSuccess = (result: any) => result.results.length > 0;

      const result = await manager.executeWithRetry(mockFn, isSuccess);

      expect(result).toEqual({ results: [1, 2, 3] });
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));
      const isSuccess = (result: any) => result.results.length > 0;

      await expect(manager.executeWithRetry(mockFn, isSuccess)).rejects.toThrow('Persistent error');
      expect(mockFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000);

    it('should track retry attempts', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce({ results: [1, 2, 3] });

      const isSuccess = (result: any) => result.results.length > 0;

      await manager.executeWithRetry(mockFn, isSuccess);

      const metrics = manager.getMetrics();
      expect(metrics.retriesExecuted).toBe(1);
    });

    it('should respect circuit breaker', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(100, new Error('Test error'));
      }

      const mockFn = jest.fn().mockResolvedValue({ results: [1, 2, 3] });
      const isSuccess = (result: any) => result.results.length > 0;

      await expect(manager.executeWithRetry(mockFn, isSuccess)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );
    });
  });

  describe('reset', () => {
    it('should reset all metrics and state', () => {
      // Generate some activity
      manager.recordSuccess(100, 10);
      manager.recordFailure(100, new Error('Test error'));

      // Reset
      manager.reset();

      const metrics = manager.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.emptyResponses).toBe(0);
      expect(manager.getCircuitState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('getSummary', () => {
    it('should return a human-readable summary', () => {
      manager.recordSuccess(100, 10);
      manager.recordSuccess(100, 0);

      const summary = manager.getSummary();

      expect(summary).toContain('Circuit: CLOSED');
      expect(summary).toContain('Requests: 2');
      expect(summary).toContain('Empty: 1');
    });
  });

  describe('global instance', () => {
    it('should create and return global instance', () => {
      const instance1 = getGlobalReliabilityManager();
      const instance2 = getGlobalReliabilityManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset global instance', () => {
      const instance = getGlobalReliabilityManager();
      instance.recordSuccess(100, 10);

      resetGlobalReliabilityManager();

      const metrics = instance.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('parallel request handling', () => {
    it('should handle concurrent requests with jitter', async () => {
      const promises = [];

      // Simulate parallel requests
      for (let i = 0; i < 10; i++) {
        promises.push(manager.applyDelay());
      }

      await Promise.all(promises);

      // Should have applied jitter to each request
      const metrics = manager.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('stress test', () => {
    it('should handle high request volume', async () => {
      const requests = 1000;

      for (let i = 0; i < requests; i++) {
        const resultCount = Math.random() > 0.1 ? 10 : 0; // 90% success, 10% empty
        manager.recordSuccess(Math.random() * 1000, resultCount);
      }

      const metrics = manager.getMetrics();
      expect(metrics.totalRequests).toBe(requests);
      expect(metrics.averageResponseTimeMs).toBeGreaterThan(0);
    });

    it('should handle mixed success and failure patterns', () => {
      // Simulate realistic pattern
      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) {
          // 10% failures
          manager.recordFailure(100, new Error('Test error'));
        } else if (i % 5 === 0) {
          // 10% empty results
          manager.recordSuccess(100, 0);
        } else {
          // 80% successes
          manager.recordSuccess(100, 10);
        }
      }

      const metrics = manager.getMetrics();
      expect(metrics.totalRequests).toBe(100);
      expect(manager.getCircuitState()).toBe(CircuitState.CLOSED); // Should not trip with this pattern
    });
  });
});
