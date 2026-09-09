// Jest setup shared by every suite.

import { resetChallengeCooldown } from '../challengeCooldown';
import { clearCache } from '../cache';

// Module-level state outlives a test, so anything held there has to be cleared
// or suites stop being independent of the order they run in.
//
//   - the bot-challenge back-off: a test that produces a challenge would make
//     later tests fail fast without ever sending a request;
//   - the cache, which now holds VQD tokens: a token left behind would let a
//     later test skip the page GET it was written to assert.
beforeEach(() => {
  resetChallengeCooldown();
  clearCache();
});

export {};
