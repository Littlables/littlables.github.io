/**
 * Keyword-based ad matching (client-side).
 * Matches ads to stories by overlapping interest keywords.
 * Ported from cloudflare-worker/src/ad-keyword-matcher.mjs.
 */

/** Keywords that should never match (flagged/excluded content). */
const EXCLUDED_KEYWORDS = new Set([
  'stocks', 'cryptocurrency', 'business-news', 'clickbait',
  'politics', 'elections', 'government',
]);

export interface AdMatchResult {
  score: number;
  matchedKeywords: string[];
}

/**
 * Score how well an ad matches a story. Higher is better.
 */
export function scoreAdForStory(
  storyKeywords: string[] | undefined,
  ad: { keywords?: string[]; category?: string },
  storyCategory?: string
): AdMatchResult {
  const storySet = new Set(
    (Array.isArray(storyKeywords) ? storyKeywords : []).filter(
      (id) => typeof id === 'string' && !EXCLUDED_KEYWORDS.has(id)
    )
  );
  const adKeywords = Array.isArray(ad?.keywords)
    ? ad.keywords.filter((id) => typeof id === 'string' && !EXCLUDED_KEYWORDS.has(id))
    : [];

  const matched = adKeywords.filter((id) => storySet.has(id));

  // Keyword overlap is the primary signal: 10 pts per overlapping keyword.
  let score = matched.length * 10;

  // Fallback: same-category ads get a small score when nothing overlaps,
  // preserving today's category-based behavior during migration.
  if (score === 0 && adKeywords.length === 0 && storyCategory && ad?.category) {
    if (ad.category === storyCategory || ad.category === 'all') {
      score = 1;
    }
  }

  return { score, matchedKeywords: matched };
}

/**
 * Rank ads for a story, best match first.
 * Ads scoring 0 are dropped unless includeZeroScore is set.
 */
export function matchAdsToStory<T extends { keywords?: string[]; category?: string }>(
  story: { interest_keywords?: string[]; interestKeywords?: string[]; category?: string },
  ads: T[],
  options: { includeZeroScore?: boolean } = {}
): (T & { _matchScore: number; _matchedKeywords: string[] })[] {
  const storyKeywords = story?.interest_keywords || story?.interestKeywords || [];
  return (Array.isArray(ads) ? ads : [])
    .map((ad) => {
      const { score, matchedKeywords } = scoreAdForStory(storyKeywords, ad, story?.category);
      return { ad, score, matchedKeywords };
    })
    .filter((r) => options.includeZeroScore || r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ ...r.ad, _matchScore: r.score, _matchedKeywords: r.matchedKeywords }));
}
