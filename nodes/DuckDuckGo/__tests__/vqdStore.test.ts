/**
 * Tests for vqdStore.ts.
 *
 * The properties that matter are the ones that keep a bad token from spreading:
 * a token is bound to its query and to the client it was issued to, and it is
 * removed as it is handed out so a failed run leaves nothing behind.
 */

import { takeStoredVqd, storeVqd, VQD_TTL_SECONDS } from '../vqdStore';
import { clearCache, getCacheSize } from '../cache';

const UA = 'Mozilla/5.0 (Test)';
const OTHER_UA = 'Mozilla/5.0 (Other)';

describe('vqdStore', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns undefined when nothing is stored', () => {
    expect(takeStoredVqd('cats', UA)).toBeUndefined();
  });

  it('returns a token that was stored for the same query and client', () => {
    storeVqd('cats', UA, '3-123');
    expect(takeStoredVqd('cats', UA)).toBe('3-123');
  });

  it('removes the token as it hands it out', () => {
    // A run that fails after taking the token must not leave it behind for the
    // next one; the caller writes it back only once the request succeeded.
    storeVqd('cats', UA, '3-123');

    expect(takeStoredVqd('cats', UA)).toBe('3-123');
    expect(takeStoredVqd('cats', UA)).toBeUndefined();
  });

  it('does not hand a token to a different query', () => {
    // DuckDuckGo binds the token to the query and answers 403 otherwise.
    storeVqd('cats', UA, '3-123');
    expect(takeStoredVqd('dogs', UA)).toBeUndefined();
  });

  it('does not hand a token to a different client', () => {
    storeVqd('cats', UA, '3-123');
    expect(takeStoredVqd('cats', OTHER_UA)).toBeUndefined();
  });

  it('treats queries that differ only in case or surrounding space as the same', () => {
    storeVqd('  Cats  ', UA, '3-123');
    expect(takeStoredVqd('cats', UA)).toBe('3-123');
  });

  it('ignores an empty token rather than storing one that cannot work', () => {
    storeVqd('cats', UA, '');
    expect(getCacheSize()).toBe(0);
  });

  it('replaces an earlier token for the same query', () => {
    storeVqd('cats', UA, '3-old');
    storeVqd('cats', UA, '3-new');
    expect(takeStoredVqd('cats', UA)).toBe('3-new');
  });

  it('expires a token after its lifetime', () => {
    jest.useFakeTimers();
    try {
      storeVqd('cats', UA, '3-123');
      jest.advanceTimersByTime((VQD_TTL_SECONDS + 1) * 1000);
      expect(takeStoredVqd('cats', UA)).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('still holds a token just before its lifetime is up', () => {
    jest.useFakeTimers();
    try {
      storeVqd('cats', UA, '3-123');
      jest.advanceTimersByTime((VQD_TTL_SECONDS - 1) * 1000);
      expect(takeStoredVqd('cats', UA)).toBe('3-123');
    } finally {
      jest.useRealTimers();
    }
  });
});
