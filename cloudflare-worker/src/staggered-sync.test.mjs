/**
 * Tests for the staggered topic sync scheduler.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSyncQueue,
  getNextSyncBatch,
  resetRotation,
  getRotationOffset,
  PAIRS_PER_RUN,
} from './staggered-sync.mjs';
import { NEWS_CATEGORIES } from './news-provider-config.mjs';

const mockProviders = [
  { id: 'gnews' },
  { id: 'bing' },
  { id: 'newsdata' },
];

describe('staggered-sync', () => {
  it('builds a queue with all provider/category pairs', () => {
    resetRotation();
    const queue = buildSyncQueue(mockProviders);
    // 3 providers × 7 categories = 21 pairs
    assert.equal(queue.length, 3 * NEWS_CATEGORIES.length);
  });

  it('interleaves providers (not all topics for one provider at once)', () => {
    resetRotation();
    const queue = buildSyncQueue(mockProviders);
    // First 3 should be different providers, same category
    assert.equal(queue[0].provider, 'gnews');
    assert.equal(queue[1].provider, 'bing');
    assert.equal(queue[2].provider, 'newsdata');
    assert.equal(queue[0].category, queue[1].category);
  });

  it('returns PAIRS_PER_RUN pairs per batch', () => {
    resetRotation();
    const batch = getNextSyncBatch(mockProviders);
    assert.equal(batch.length, PAIRS_PER_RUN);
  });

  it('advances rotation across batches', () => {
    resetRotation();
    const batch1 = getNextSyncBatch(mockProviders);
    const offset1 = getRotationOffset();
    const batch2 = getNextSyncBatch(mockProviders);
    // Batches should not overlap (unless queue is smaller than 2x batch)
    const ids1 = new Set(batch1.map((p) => `${p.provider}/${p.category}`));
    const ids2 = new Set(batch2.map((p) => `${p.provider}/${p.category}`));
    // With 21 pairs and 7 per batch, first 3 batches shouldn't overlap
    const overlap = [...ids1].filter((id) => ids2.has(id));
    assert.equal(overlap.length, 0, 'batches should not overlap');
    assert.ok(offset1 > 0, 'offset should advance');
  });

  it('wraps around when reaching the end', () => {
    resetRotation();
    const queue = buildSyncQueue(mockProviders);
    // Consume all pairs
    const batches = Math.ceil(queue.length / PAIRS_PER_RUN);
    for (let i = 0; i < batches; i++) {
      getNextSyncBatch(mockProviders);
    }
    // Next batch should wrap to the beginning
    const wrapped = getNextSyncBatch(mockProviders);
    assert.equal(wrapped[0].provider, queue[0].provider);
    assert.equal(wrapped[0].category, queue[0].category);
  });

  it('handles empty providers', () => {
    resetRotation();
    const batch = getNextSyncBatch([]);
    assert.deepEqual(batch, []);
  });
});
