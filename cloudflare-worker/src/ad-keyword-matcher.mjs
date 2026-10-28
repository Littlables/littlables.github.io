import { cosineSimilarity } from './embedding-classifier.mjs';

/**
 * Keyword-based ad matching (branch: keyword-ad-matching — early groundwork).
 *
 * Matches ads to stories by overlapping interest keywords:
 *   story.interest_keywords ∩ ad.keywords
 *
 * Scoring:
 *   - Each overlapping keyword scores points; excluded ("Flagged") keywords
 *     never match (an ad should not target stocks/crypto content).
 *   - Ads with no keywords fall back to category matching (existing behavior).
 *
 * This module is pure logic (no I/O) so it can run in the worker or be
 * unit-tested in isolation. Wiring into /feed and the frontend comes later.
 */

/**
 * Score how well an ad matches a story. Higher is better.
 *
 * @param {string[]} storyKeywords - story's interest_keywords (ids)
 * @param {object} ad - ad object, may have .keywords (ids) and .category
 * @param {object} [options]
 * @param {Set<string>} [options.excludedKeywordIds] - never match these
 * @param {string} [options.storyCategory] - fallback category match
 * @returns {{score: number, matchedKeywords: string[]}}
 */
export function scoreAdForStory(storyKeywords, ad, options = {}) {
  const excluded = options.excludedKeywordIds || new Set();
  const storySet = new Set(
    (Array.isArray(storyKeywords) ? storyKeywords : []).filter(
      (id) => typeof id === 'string' && !excluded.has(id)
    )
  );
  const adKeywords = Array.isArray(ad?.keywords)
    ? ad.keywords.filter((id) => typeof id === 'string' && !excluded.has(id))
    : [];

  const matched = adKeywords.filter((id) => storySet.has(id));

  // Keyword overlap is the primary signal.
  let score = matched.length * 10;

  // Fallback: same-category ads get a small score when nothing overlaps,
  // preserving today's category-based behavior.
  if (score === 0 && adKeywords.length === 0 && options.storyCategory && ad?.category) {
    if (ad.category === options.storyCategory || ad.category === 'all') {
      score = 1;
    }
  }

  return { score, matchedKeywords: matched };
}

/**
 * Rank ads for a story, best match first. Ads scoring 0 are dropped unless
 * includeZeroScore is set (useful for debugging).
 *
 * @param {object} story - story with interest_keywords and category
 * @param {object[]} ads - candidate ads
 * @param {object} [options]
 * @returns {object[]} ads sorted by descending score, each with _matchScore
 */
export function matchAdsToStory(story, ads, options = {}) {
  const storyKeywords = story?.interest_keywords || story?.interestKeywords || [];
  const results = (Array.isArray(ads) ? ads : [])
    .map((ad) => {
      const { score, matchedKeywords } = scoreAdForStory(storyKeywords, ad, {
        excludedKeywordIds: options.excludedKeywordIds,
        storyCategory: story?.category,
      });
      return { ad, score, matchedKeywords };
    })
    .filter((r) => options.includeZeroScore || r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ ...r.ad, _matchScore: r.score, _matchedKeywords: r.matchedKeywords }));
  return results;
}
/**
 * Rank ads by the closest tagged interest when a story has no exact tag match.
 * Returns only ads with a usable, non-zero embedding similarity.
 */
export function rankAdsByEmbeddingSimilarity(storyVector, ads, keywordVectors, options = {}) {
  const excluded = options.excludedKeywordIds || new Set();
  if (!storyVector || !(keywordVectors instanceof Map)) return [];
  return (Array.isArray(ads) ? ads : [])
    .map((ad) => {
      const similarity = (Array.isArray(ad?.keywords) ? ad.keywords : [])
        .filter((id) => typeof id === 'string' && !excluded.has(id))
        .map((id) => keywordVectors.get(id))
        .filter(Boolean)
        .reduce((best, vector) => Math.max(best, cosineSimilarity(storyVector, vector)), 0);
      return { ...ad, _matchScore: similarity };
    })
    .filter((ad) => ad._matchScore > 0)
    .sort((a, b) => b._matchScore - a._matchScore);
}
