// Jest setup shared by every suite.

import { resetChallengeCooldown } from '../challengeCooldown';

// The bot-challenge back-off is module-level state, so a test that produces a
// challenge would otherwise make later tests fail fast without a request.
// Clearing it before each test keeps suites independent regardless of order.
beforeEach(() => {
  resetChallengeCooldown();
});

export {};
