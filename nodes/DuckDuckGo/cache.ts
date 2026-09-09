/**
 * Simple in-memory cache implementation with TTL (Time-To-Live) support
 *
 * This cache stores values with an expiration time and automatically
 * invalidates them when they expire. It's used to optimize repeated
 * DuckDuckGo API calls with the same parameters.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// In-memory cache storage using Map
const cacheStore = new Map<string, CacheEntry<any>>();

/**
 * Retrieves a value from the cache if it exists and hasn't expired
 *
 * @param key - Unique identifier for the cached value
 * @returns The cached value or undefined if not found or expired
 */
export function getCached<T>(key: string): T | undefined {
  const entry = cacheStore.get(key);

  // If entry doesn't exist, return undefined
  if (!entry) {
    return undefined;
  }

  // If entry has expired, remove it and return undefined
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return undefined;
  }

  // Return the cached value
  return entry.value;
}

/**
 * Entry count at which a write first sweeps out anything expired.
 *
 * Expiry is otherwise only noticed when that exact key is read again, so a
 * stream of keys that are each written once and never read back — one VQD token
 * per distinct image query, for instance — would keep every entry it ever
 * created for the life of the process. Sweeping on write bounds the store to
 * what is actually still live, at the cost of an occasional pass over it.
 */
const PRUNE_THRESHOLD = 256;

/**
 * Shortest gap between sweeps. Size alone is not enough of a gate: once the
 * store holds 256 entries that are all still live, it stays above the threshold
 * and every further write would walk the whole map without removing anything,
 * turning n writes into O(n²) work. Time bounds it to one pass per interval
 * however busy the process is.
 */
const PRUNE_INTERVAL_MS = 60 * 1000;

let lastPrunedAt = 0;

/**
 * Stores a value in the cache with a specified TTL
 *
 * @param key - Unique identifier for the cached value
 * @param value - The value to cache
 * @param ttl - Time-to-live in seconds
 */
export function setCache<T>(key: string, value: T, ttl: number): void {
  const now = Date.now();

  if (cacheStore.size >= PRUNE_THRESHOLD && now - lastPrunedAt >= PRUNE_INTERVAL_MS) {
    lastPrunedAt = now;
    pruneExpiredEntries();
  }

  cacheStore.set(key, { value, expiresAt: now + ttl * 1000 });
}

/**
 * Removes a single entry from the cache
 *
 * @param key - Unique identifier for the cached value
 * @returns True when an entry was present and removed
 */
export function deleteCached(key: string): boolean {
  return cacheStore.delete(key);
}

/**
 * Clears all entries from the cache
 */
export function clearCache(): void {
  cacheStore.clear();
  lastPrunedAt = 0;
}

/**
 * Gets the current size of the cache (number of entries)
 *
 * @returns Number of entries in the cache
 */
export function getCacheSize(): number {
  return cacheStore.size;
}

/**
 * Removes expired entries from the cache
 *
 * @returns Number of entries removed
 */
export function pruneExpiredEntries(): number {
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key);
      removed++;
    }
  }

  return removed;
}