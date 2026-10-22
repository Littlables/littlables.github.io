/**
 * Tests for the embedding-based content classifier.
 * The cosine similarity math is tested directly; the Workers AI calls
 * (embedText, classifyStoryByEmbedding) are tested with a mocked env.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cosineSimilarity,
  classifyStoryByEmbedding,
  validateStoryCategories,
  getCategoryEmbeddings,
  getKeywordEmbeddings,
  classifyStoryKeywords,
  clearEmbeddingCache,
  CATEGORY_DESCRIPTIONS,
  EMBEDDING_MODEL,
} from './embedding-classifier.mjs';
import {
  INTEREST_KEYWORDS,
  getInterestKeyword,
  isValidInterestKeyword,
  normalizeInterestKeywords,
} from './interest-keywords.mjs';

describe('embedding-classifier', () => {
  it('exposes descriptions for all six content categories', () => {
    const cats = Object.keys(CATEGORY_DESCRIPTIONS).sort();
    assert.deepEqual(cats, ['animals', 'arts', 'childcare', 'tech', 'uplifting', 'world']);
    for (const desc of Object.values(CATEGORY_DESCRIPTIONS)) {
      assert.ok(desc.length > 20, 'descriptions should be phrases, not bare IDs');
    }
  });

  it('cosineSimilarity: identical vectors score 1', () => {
    assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
  });

  it('cosineSimilarity: orthogonal vectors score 0', () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it('cosineSimilarity: opposite vectors score -1', () => {
    assert.ok(Math.abs(cosineSimilarity([1, 1], [-1, -1]) - -1) < 1e-9);
  });

  it('cosineSimilarity: handles mismatched/empty vectors', () => {
    assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
    assert.equal(cosineSimilarity([], []), 0);
    assert.equal(cosineSimilarity(null, [1]), 0);
  });

  it('classifyStoryByEmbedding returns null without an AI binding', async () => {
    clearEmbeddingCache();
    const result = await classifyStoryByEmbedding({}, { title: 'Cute puppy', description: 'A dog' });
    assert.equal(result, null);
  });

  it('classifyStoryByEmbedding picks the closest category with a mocked AI', async () => {
    clearEmbeddingCache();
    // Mock env.AI.run: return a fixed vector per input text.
    // "animals…" description and the puppy story share a vector; others differ.
    const animalVec = [1, 0, 0];
    const otherVec = [0, 1, 0];
    const storyVec = [0.9, 0.1, 0]; // closest to animalVec
    const mockEnv = {
      AI: {
        run: async (model, { text }) => {
          assert.equal(model, EMBEDDING_MODEL);
          if (text.includes('Cute puppy')) return { data: storyVec };
          if (text.startsWith('animals,')) return { data: animalVec };
          return { data: otherVec };
        },
      },
    };
    const result = await classifyStoryByEmbedding(mockEnv, {
      title: 'Cute puppy learns to swim',
      description: 'A golden retriever puppy takes its first swimming lesson',
    });
    assert.ok(result);
    assert.equal(result.category, 'animals');
    assert.ok(result.confidence > 0.9, `expected high confidence, got ${result.confidence}`);
    assert.ok(result.scores.animals > result.scores.tech, 'animals should outscore tech');
    clearEmbeddingCache();
  });

  it('getCategoryEmbeddings caches across calls', async () => {
    clearEmbeddingCache();
    let calls = 0;
    const mockEnv = {
      AI: { run: async () => { calls++; return { data: [0.1, 0.2] }; } },
    };
    await getCategoryEmbeddings(mockEnv);
    await getCategoryEmbeddings(mockEnv);
    // 6 categories embedded once, second call served from cache
    assert.equal(calls, 6);
    clearEmbeddingCache();
  });

  it('validateStoryCategories treats "all" as null — confident AI picks flag as mismatches', async () => {
    clearEmbeddingCache();
    const animalVec = [1, 0];
    const otherVec = [0, 1];
    const mockEnv = {
      AI: {
        run: async (model, { text }) => {
          if (text.startsWith('animals,')) return { data: [animalVec] };
          if (text.includes('Cute puppy')) return { data: [animalVec] };
          return { data: [otherVec] };
        },
      },
    };
    const results = await validateStoryCategories(mockEnv, [
      { id: 1, title: 'Cute puppy plays', description: '', category: 'all' },
      { id: 2, title: 'Cute puppy plays', description: '', category: 'animals' },
    ]);
    const allStory = results.find(r => r.id === 1);
    assert.equal(allStory.embeddingCategory, 'animals');
    assert.equal(allStory.mismatch, true, '"all" with a confident AI pick should flag as mismatch');
    const matchStory = results.find(r => r.id === 2);
    assert.equal(matchStory.embeddingCategory, 'animals');
    assert.equal(matchStory.mismatch, false);
    clearEmbeddingCache();
  });

  it('interest keywords: list has 100 entries with unique ids', () => {
    assert.equal(INTEREST_KEYWORDS.length, 100);
    const ids = INTEREST_KEYWORDS.map(k => k.id);
    assert.equal(new Set(ids).size, 100);
    for (const kw of INTEREST_KEYWORDS) {
      assert.ok(kw.label.length > 0);
      assert.ok(kw.icon.length > 0);
      assert.ok(kw.group.length > 0);
      assert.ok(kw.description.length > 20, 'descriptions should be phrases for embedding quality');
    }
  });

  it('interest keywords: lookup and normalization helpers', () => {
    assert.equal(getInterestKeyword('Space').id, 'space');
    assert.equal(getInterestKeyword('OCEAN-LIFE').label, 'Ocean Life');
    assert.equal(getInterestKeyword('nope'), null);
    assert.equal(isValidInterestKeyword('food'), true);
    assert.equal(isValidInterestKeyword('childcare'), false, 'categories are not keywords');
    assert.deepEqual(normalizeInterestKeywords(['Space', 'food', 'space', 'bogus']), ['space', 'food']);
    assert.equal(normalizeInterestKeywords([]), null);
    assert.equal(normalizeInterestKeywords(null), null);
  });

  it('getKeywordEmbeddings caches across calls', async () => {
    clearEmbeddingCache();
    let calls = 0;
    const mockEnv = {
      AI: { run: async () => { calls++; return { data: [0.1, 0.2] }; } },
    };
    await getKeywordEmbeddings(mockEnv);
    await getKeywordEmbeddings(mockEnv);
    assert.equal(calls, 100, '100 keyword descriptions embedded once, second call from cache');
    clearEmbeddingCache();
  });

  it('classifyStoryKeywords returns matches above threshold, best first, capped', () => {
    const storyVec = [1, 0];
    const keywordVectors = new Map([
      ['space', [0.99, 0.14]],   // ~0.99 similarity
      ['dinosaurs', [0.9, 0.44]], // ~0.90 similarity
      ['food', [0, 1]],           // 0 similarity
    ]);
    const matches = classifyStoryKeywords(storyVec, keywordVectors, { threshold: 0.35, maxKeywords: 2 });
    assert.equal(matches.length, 2);
    assert.equal(matches[0].id, 'space');
    assert.equal(matches[1].id, 'dinosaurs');
    assert.ok(matches[0].confidence >= matches[1].confidence, 'best first');
    // Cap respected
    const capped = classifyStoryKeywords(storyVec, keywordVectors, { threshold: 0.35, maxKeywords: 1 });
    assert.equal(capped.length, 1);
    assert.equal(capped[0].id, 'space');
    // High threshold filters everything
    assert.deepEqual(classifyStoryKeywords(storyVec, keywordVectors, { threshold: 0.999 }), []);
    // Missing inputs
    assert.deepEqual(classifyStoryKeywords(null, keywordVectors), []);
    assert.deepEqual(classifyStoryKeywords(storyVec, new Map()), []);
  });

  it('validateStoryCategories tags keywords for stories missing them', async () => {
    clearEmbeddingCache();
    const storyVec = [1, 0];
    const mockEnv = {
      AI: {
        run: async (model, { text }) => {
          // Category descriptions and keyword descriptions get distinct vectors;
          // the story matches the "space" keyword description.
          if (text.includes('rockets and planets')) return { data: [storyVec] };
          if (text.startsWith('animals,')) return { data: [[0, 1]] };
          return { data: [[0, 1]] };
        },
      },
    };
    const keywordVectors = new Map(INTEREST_KEYWORDS.map(kw =>
      kw.id === 'space' ? [kw.id, [0.99, 0.14]] : [kw.id, [0, 1]]
    ));
    const results = await validateStoryCategories(mockEnv, [
      { id: 1, title: 'rockets and planets', description: '', category: 'tech', interest_keywords: null },
      { id: 2, title: 'rockets and planets', description: '', category: 'tech', interest_keywords: ['food'] },
    ], { keywordVectors });
    const tagged = results.find(r => r.id === 1);
    assert.equal(tagged.keywordsClassified, true);
    assert.ok(tagged.keywordMatches.some(m => m.id === 'space'), 'space keyword matched');
    assert.deepEqual(tagged.interestKeywords, null, 'stored keywords unchanged until endpoint PATCHes');
    const alreadyTagged = results.find(r => r.id === 2);
    assert.equal(alreadyTagged.keywordsClassified, false, 'stories with keywords are not re-tagged');
    assert.deepEqual(alreadyTagged.keywordMatches, []);
    clearEmbeddingCache();
  });
});
