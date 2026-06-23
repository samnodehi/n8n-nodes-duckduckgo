/**
 * Unit tests for cache.ts — in-memory TTL cache.
 *
 * TTL expiry is tested with Jest modern fake timers (jest.setSystemTime),
 * which also controls Date.now() used inside the cache.
 */

import {
  getCached,
  setCache,
  clearCache,
  getCacheSize,
  pruneExpiredEntries,
} from '../cache';

describe('cache', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns undefined for a missing key', () => {
    expect(getCached('missing')).toBeUndefined();
  });

  it('stores and retrieves a value within the TTL window', () => {
    setCache('k', { a: 1 }, 300);
    expect(getCached<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('overwrites an existing key without growing the store', () => {
    setCache('k', 'v1', 300);
    setCache('k', 'v2', 300);
    expect(getCached('k')).toBe('v2');
    expect(getCacheSize()).toBe(1);
  });

  it('still returns the value one second before expiry', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setCache('k', 'v', 60);
    jest.setSystemTime(new Date('2026-01-01T00:00:59Z')); // +59s
    expect(getCached('k')).toBe('v');
  });

  it('returns undefined once the TTL has elapsed', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setCache('k', 'v', 60);
    jest.setSystemTime(new Date('2026-01-01T00:01:01Z')); // +61s
    expect(getCached('k')).toBeUndefined();
  });

  it('deletes an expired entry when it is accessed', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    setCache('k', 'v', 1);
    expect(getCacheSize()).toBe(1);
    jest.setSystemTime(2000); // +2s, past the 1s TTL
    expect(getCached('k')).toBeUndefined();
    expect(getCacheSize()).toBe(0);
  });

  it('clearCache empties the store', () => {
    setCache('a', 1, 300);
    setCache('b', 2, 300);
    expect(getCacheSize()).toBe(2);
    clearCache();
    expect(getCacheSize()).toBe(0);
  });

  it('pruneExpiredEntries removes only expired entries and returns the count', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    setCache('short', 'v', 1); // expires at 1000ms
    setCache('long', 'v', 100); // expires at 100000ms
    jest.setSystemTime(2000); // past short, before long
    expect(pruneExpiredEntries()).toBe(1);
    expect(getCacheSize()).toBe(1);
    expect(getCached('long')).toBe('v');
  });
});
