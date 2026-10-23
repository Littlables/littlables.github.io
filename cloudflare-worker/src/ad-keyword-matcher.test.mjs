import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAdForStory, matchAdsToStory } from './ad-keyword-matcher.mjs';

const EXCLUDED = new Set(['stocks', 'cryptocurrency', 'business-news']);

test('scoreAdForStory scores keyword overlap', () => {
  const { score, matchedKeywords } = scoreAdForStory(
    ['dinosaurs', 'space'],
    { keywords: ['dinosaurs', 'toys'] },
    { excludedKeywordIds: EXCLUDED }
  );
  assert.equal(score, 10);
  assert.deepEqual(matchedKeywords, ['dinosaurs']);
});

test('scoreAdForStory ignores excluded keywords on both sides', () => {
  const { score } = scoreAdForStory(
    ['stocks', 'space'],
    { keywords: ['stocks'] },
    { excludedKeywordIds: EXCLUDED }
  );
  assert.equal(score, 0);
});

test('scoreAdForStory falls back to category when ad has no keywords', () => {
  const { score } = scoreAdForStory(
    ['dinosaurs'],
    { category: 'animals' },
    { excludedKeywordIds: EXCLUDED, storyCategory: 'animals' }
  );
  assert.equal(score, 1);
});

test('scoreAdForStory gives 0 when nothing matches', () => {
  const { score } = scoreAdForStory(
    ['dinosaurs'],
    { keywords: ['baking'], category: 'food' },
    { excludedKeywordIds: EXCLUDED, storyCategory: 'animals' }
  );
  assert.equal(score, 0);
});

test('matchAdsToStory ranks best match first and drops zero scores', () => {
  const story = { interest_keywords: ['dinosaurs', 'space'], category: 'animals' };
  const ads = [
    { id: 'a', keywords: ['baking'] },
    { id: 'b', keywords: ['dinosaurs', 'space'] },
    { id: 'c', keywords: ['dinosaurs'] },
    { id: 'd', category: 'animals' },
  ];
  const ranked = matchAdsToStory(story, ads, { excludedKeywordIds: EXCLUDED });
  assert.deepEqual(ranked.map((r) => r.id), ['b', 'c', 'd']);
  assert.equal(ranked[0]._matchScore, 20);
});
