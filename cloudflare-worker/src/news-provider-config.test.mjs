import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInterleavedPairs, NEWS_CATEGORIES } from './news-provider-config.mjs';

test('interleaved pairs are category-major', () => {
  const pairs = buildInterleavedPairs(['gnews', 'bing']);
  assert.equal(pairs.length, 14);
  assert.deepEqual(pairs.slice(0, 4), [
    { provider: 'gnews', category: 'all' },
    { provider: 'bing', category: 'all' },
    { provider: 'gnews', category: 'childcare' },
    { provider: 'bing', category: 'childcare' }
  ]);
  // Every category block holds every provider before the next category starts.
  for (let c = 0; c < NEWS_CATEGORIES.length; c++) {
    assert.equal(pairs[c * 2].category, NEWS_CATEGORIES[c]);
    assert.equal(pairs[c * 2 + 1].category, NEWS_CATEGORIES[c]);
  }
});

test('interleaved pairs cover all 42 provider-category pairs and skip unknowns', () => {
  const pairs = buildInterleavedPairs(['gnews', 'bing', 'newsdata', 'thenewsapi', 'worldnewsapi', 'reddit', 'nope']);
  assert.equal(pairs.length, 42);
  assert.equal(new Set(pairs.map(p => `${p.provider}/${p.category}`)).size, 42);
});
