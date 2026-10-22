/**
 * Staggered topic sync scheduler (prototype).
 *
 * Instead of fetching all providers × all topics in a single hourly burst,
 * spreads the fetches evenly across the hour. With 6 providers × 7 topics = 42
 * fetches, running every 10 minutes processes 7 pairs per run.
 *
 * Benefits:
 * - Reduces burst load on provider APIs (fewer rate-limit hits)
 * - Shorter runs = less chance of worker dying mid-sync and orphaning locks
 * - More even story freshness throughout the hour
 *
 * Usage:
 * 1. Set cron to every-10-minutes (every 10 minutes)
 * 2. Each run calls `runStaggeredSync(env)` which processes the next batch
 *
 * The rotation is tracked in-memory. On cold starts it resets to the beginning,
 * which is harmless (some topics get synced slightly more often temporarily).
 */

import { NEWS_CATEGORIES } from './news-provider-config.mjs';

// Number of (provider, topic) pairs to sync per run.
// 42 total pairs / 6 runs per hour = 7 per 10-minute run.
export const PAIRS_PER_RUN = 7;

// In-memory rotation offset. Resets on cold start (harmless).
let rotationOffset = 0;

/**
 * Build the ordered queue of all (provider, category) pairs.
 * Ordered by category first, then provider — this interleaves providers
 * so no single provider gets hammered with back-to-back requests.
 *
 * @param {Array<{id: string}>} providers - Configured providers
 * @returns {Array<{provider: string, category: string}>}
 */
export function buildSyncQueue(providers) {
  const queue = [];
  // Skip 'all' for staggered sync — it's a catch-all, sync it less frequently
  // Actually, include it: every topic deserves regular updates
  for (const category of NEWS_CATEGORIES) {
    for (const provider of providers) {
      queue.push({ provider: provider.id, category });
    }
  }
  return queue;
}

/**
 * Get the next batch of (provider, category) pairs to sync.
 * Advances the rotation offset.
 *
 * @param {Array<{id: string}>} providers
 * @param {number} count - Pairs per run (default PAIRS_PER_RUN)
 * @returns {Array<{provider: string, category: string}>}
 */
export function getNextSyncBatch(providers, count = PAIRS_PER_RUN) {
  const queue = buildSyncQueue(providers);
  if (queue.length === 0) return [];
  const batch = [];
  for (let i = 0; i < count; i++) {
    const idx = (rotationOffset + i) % queue.length;
    batch.push(queue[idx]);
  }
  rotationOffset = (rotationOffset + count) % queue.length;
  return batch;
}

/**
 * Reset the rotation (useful for tests).
 */
export function resetRotation() {
  rotationOffset = 0;
}

/**
 * Get the current rotation offset (useful for monitoring).
 */
export function getRotationOffset() {
  return rotationOffset;
}
