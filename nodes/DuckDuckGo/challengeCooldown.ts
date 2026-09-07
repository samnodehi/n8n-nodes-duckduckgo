/**
 * Short back-off after a DuckDuckGo bot-detection challenge.
 *
 * The block behind a challenge is scoped to the requesting IP and lasts tens of
 * minutes, so every further request made during it is wasted, adds load to a
 * service that has just said stop, and prolongs the block for everyone sharing
 * that egress address — which on n8n Cloud or shared hosting is other tenants.
 *
 * Once a challenge is seen, requests are refused locally for a short window
 * instead of being sent. The window is deliberately much shorter than the block
 * itself: it throttles rather than blocks, so a single probe goes out roughly
 * once per window and the node recovers within a window of the block lifting,
 * rather than being sidelined for the block's full duration.
 *
 * State is module-level and therefore per n8n process. That is the correct
 * scope: the block follows the process's outbound IP, not the workflow or item.
 */

/** How long to refuse requests locally after a challenge. */
export const CHALLENGE_COOLDOWN_MS = 60_000;

let cooldownUntil = 0;

/** Record that a challenge was just observed, starting the back-off window. */
export function noteChallenge(now: number = Date.now()): void {
  cooldownUntil = now + CHALLENGE_COOLDOWN_MS;
}

/** Milliseconds left in the back-off window; 0 when requests may proceed. */
export function getRemainingCooldownMs(now: number = Date.now()): number {
  const remaining = cooldownUntil - now;
  return remaining > 0 ? remaining : 0;
}

/**
 * Human-readable reason to give when a request is refused locally, or null when
 * there is no active back-off.
 */
export function getCooldownReason(now: number = Date.now()): string | null {
  const remaining = getRemainingCooldownMs(now);
  if (remaining === 0) return null;
  const seconds = Math.ceil(remaining / 1000);
  return `DuckDuckGo served a bot-detection challenge moments ago, so this request was not sent. `
    + `The block applies to your n8n instance's IP address and typically lasts tens of minutes. `
    + `Requests resume automatically in ${seconds}s; reduce how frequently this node runs.`;
}

/** Clear the back-off window. Intended for tests. */
export function resetChallengeCooldown(): void {
  cooldownUntil = 0;
}
