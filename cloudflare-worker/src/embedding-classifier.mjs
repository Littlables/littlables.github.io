/**
 * Embedding-based content classifier (prototype).
 *
 * Uses Cloudflare Workers AI text embeddings to classify stories into
 * Littlables categories via cosine similarity — the same approach as
 * sentence-transformers' all-MiniLM-L6-v2, but running on Workers AI
 * instead of locally in Python.
 *
 * How it works:
 * 1. Each category has a natural-language description (better than a bare ID
 *    for embedding quality).
 * 2. Category descriptions are embedded once and cached (in-memory + KV optional).
 * 3. Each story's title + description is embedded at classification time.
 * 4. Cosine similarity against each category vector picks the best match.
 *
 * Model: @cf/baai/bge-base-en-v1.5 (768-dim, English, strong on semantic similarity)
 */

import { INTEREST_KEYWORDS } from './interest-keywords.mjs';

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

// Natural-language descriptions — embeddings capture meaning better from
// phrases than from bare category IDs like "childcare".
export const CATEGORY_DESCRIPTIONS = Object.freeze({
  childcare: 'parenting, childcare, raising children, family life, kids activities, pregnancy, babies, toddlers',
  animals: 'animals, wildlife, pets, dogs, cats, nature, conservation, endangered species, zoos',
  arts: 'arts, creativity, music, painting, crafts, theater, dance, literature, culture, artists',
  tech: 'technology, artificial intelligence, gadgets, innovation, robots, space, science, future tech',
  world: 'world news, global events, international affairs, countries, politics, climate, economy',
  uplifting: 'uplifting news, positive stories, heartwarming, inspiring, kindness, community heroes, good news',
});

// In-memory cache for category embeddings (per worker isolate).
// For production, persist these to KV so cold starts don't re-embed.
let cachedCategoryEmbeddings = null;

/**
 * Generate an embedding vector for a text string via Workers AI.
 * Retries up to 3 times with exponential backoff on failure.
 * @returns {Promise<number[]|null>} 768-dim vector, or null on failure.
 */
export async function embedText(env, text, retries = 3) {
  if (!env?.AI) return null;
  const input = (text || '').trim().slice(0, 2000);
  if (!input) return null;
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await env.AI.run(EMBEDDING_MODEL, { text: input });
      // Workers AI returns { shape, data } for embedding models.
      // BGE models return a 2D array [[...]] even for single strings — flatten to 1D.
      let vector = result?.data || result?.embedding;
      if (Array.isArray(vector) && vector.length > 0 && Array.isArray(vector[0])) {
        vector = vector[0];
      }
      if (Array.isArray(vector) && vector.length > 0) return vector;
      lastError = new Error('Empty embedding vector returned');
    } catch (err) {
      lastError = err;
      console.warn(`Embedding attempt ${attempt + 1}/${retries} failed:`, err?.message || err);
    }
    // Exponential backoff: 500ms, 1s, 2s
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  console.warn('Embedding generation failed after retries:', lastError?.message || lastError);
  return null;
}

/**
 * Batch embed multiple texts in a single AI call.
 * @returns {Promise<Array<number[]|null>>} Array of vectors (null for failures), same order as input.
 */
export async function embedTexts(env, texts, retries = 2) {
  if (!env?.AI) return texts.map(() => null);
  const inputs = texts.map(t => (t || '').trim().slice(0, 2000));
  if (inputs.every(t => !t)) return texts.map(() => null);
  
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // BGE models accept array input for batch embedding
      const result = await env.AI.run(EMBEDDING_MODEL, { text: inputs });
      let vectors = result?.data || result?.embeddings;
      // Handle various response formats:
      // - Batch: [[...], [...], ...] (array of vectors)
      // - Single: [...] (single vector, for mocks or single input)
      if (Array.isArray(vectors) && vectors.length > 0) {
        if (Array.isArray(vectors[0])) {
          // Batch output: array of vectors
          // Pad with nulls if fewer vectors than inputs
          const out = [];
          for (let i = 0; i < inputs.length; i++) {
            out.push(i < vectors.length && Array.isArray(vectors[i]) ? vectors[i] : null);
          }
          return out;
        } else {
          // Single vector returned — replicate for all inputs (mock compatibility)
          return inputs.map(() => vectors);
        }
      }
      lastError = new Error('Empty embedding vectors returned');
    } catch (err) {
      lastError = err;
      console.warn(`Batch embedding attempt ${attempt + 1}/${retries} failed:`, err?.message || err);
    }
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  console.warn('Batch embedding failed after retries:', lastError?.message || lastError);
  return texts.map(() => null);
}

/**
 * Get (or generate + cache) embeddings for all category descriptions.
 * @returns {Promise<Map<string, number[]>|null>}
 */
export async function getCategoryEmbeddings(env) {
  if (cachedCategoryEmbeddings) return cachedCategoryEmbeddings;
  const entries = Object.entries(CATEGORY_DESCRIPTIONS);
  const vectors = await Promise.all(
    entries.map(([cat, desc]) => embedText(env, desc))
  );
  const map = new Map();
  entries.forEach(([cat], i) => {
    if (vectors[i]) map.set(cat, vectors[i]);
  });
  if (map.size === 0) return null;
  cachedCategoryEmbeddings = map;
  return map;
}

// In-memory cache for interest keyword embeddings (per worker isolate).
let cachedKeywordEmbeddings = null;

/**
 * Get (or generate + cache) embeddings for all interest keyword descriptions.
 * @returns {Promise<Map<string, number[]>|null>} keyword id -> vector
 */
export async function getKeywordEmbeddings(env) {
  if (cachedKeywordEmbeddings) return cachedKeywordEmbeddings;
  const vectors = await Promise.all(
    INTEREST_KEYWORDS.map((kw) => embedText(env, kw.description))
  );
  const map = new Map();
  INTEREST_KEYWORDS.forEach((kw, i) => {
    if (vectors[i]) map.set(kw.id, vectors[i]);
  });
  if (map.size === 0) return null;
  cachedKeywordEmbeddings = map;
  return map;
}

/** Minimum cosine similarity for a keyword to be tagged onto a story. */
export const KEYWORD_MATCH_THRESHOLD = 0.45;
/** Max keywords auto-tagged per story. */
export const KEYWORD_MAX_PER_STORY = 3;

/**
 * Tag a story with interest keywords via embedding similarity.
 *
 * Takes a precomputed story embedding vector (so callers validating categories
 * can reuse the same vector — no extra AI calls per keyword).
 *
 * @param {number[]} storyVector - 768-dim embedding of the story text
 * @param {Map<string, number[]>} keywordVectors - from getKeywordEmbeddings()
 * @param {object} [options] - { threshold, maxKeywords }
 * @returns {Array<{id: string, label: string, confidence: number}>}
 *   matches at/above threshold, best first, capped at maxKeywords.
 */
export function classifyStoryKeywords(storyVector, keywordVectors, options = {}) {
  const threshold = options.threshold ?? KEYWORD_MATCH_THRESHOLD;
  const maxKeywords = options.maxKeywords ?? KEYWORD_MAX_PER_STORY;
  if (!storyVector || !keywordVectors || keywordVectors.size === 0) return [];
  const matches = [];
  for (const kw of INTEREST_KEYWORDS) {
    const kwVector = keywordVectors.get(kw.id);
    if (!kwVector) continue;
    const sim = cosineSimilarity(storyVector, kwVector);
    if (sim >= threshold) {
      matches.push({
        id: kw.id,
        label: kw.label,
        confidence: Math.round(sim * 10000) / 10000,
      });
    }
  }
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches.slice(0, maxKeywords);
}

/**
 * Cosine similarity between two vectors. Returns 0–1 (higher = more similar).
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Classify a story into the best-matching Littlables category.
 *
 * @param {object} env - Worker env (needs AI binding)
 * @param {object} story - { title, description }
 * @returns {Promise<{category: string|null, confidence: number, scores: Record<string, number>}|null>}
 */
export async function classifyStoryByEmbedding(env, story) {
  const text = `${story?.title || ''} ${story?.description || ''}`.trim();
  if (!text) return null;

  const [storyVector, categoryVectors] = await Promise.all([
    embedText(env, text),
    getCategoryEmbeddings(env),
  ]);
  if (!storyVector || !categoryVectors) return null;

  const scores = {};
  let bestCategory = null;
  let bestScore = -1;
  for (const [cat, catVector] of categoryVectors) {
    const sim = cosineSimilarity(storyVector, catVector);
    scores[cat] = Math.round(sim * 10000) / 10000;
    if (sim > bestScore) {
      bestScore = sim;
      bestCategory = cat;
    }
  }

  return {
    category: bestCategory,
    confidence: Math.round(bestScore * 10000) / 10000,
    scores,
  };
}

/**
 * Clear the in-memory embedding caches (useful for tests).
 */
export function clearEmbeddingCache() {
  cachedCategoryEmbeddings = null;
  cachedKeywordEmbeddings = null;
}

/**
 * Validate a batch of stories: classify each and flag mismatches.
 *
 * Also tags stories with interest keywords when keyword vectors are provided.
 * Each story is only processed for what it's missing:
 *   - category validation when `embedding_category` is null
 *   - keyword tagging when `interest_keywords` is null/empty
 * (checked against the raw row fields).
 *
 * @param {object} env - Worker env (needs AI binding)
 * @param {Array<object>} stories - raw news_stories rows
 * @param {object} [options] - { keywordVectors: Map<string, number[]> }
 * @returns {Promise<Array<object>>} results with embeddingCategory, confidence,
 *   mismatch, keywordMatches ([{id, label, confidence}]), interestKeywords ([id])
 */
export async function validateStoryCategories(env, stories, options = {}) {
  const keywordVectors = options.keywordVectors || null;
  // Fields the admin panel needs to render full story rows.
  const storyDisplayFields = (s) => ({
    imageUrl: s.image_url || null,
    provider: s.provider || null,
    articleUrl: s.article_url || null,
    description: s.description || null,
    publishedAt: s.published_at || null,
    fetchedAt: s.fetched_at || null,
    displayCategories: Array.isArray(s.display_categories) && s.display_categories.length > 0
      ? s.display_categories.filter(c => typeof c === 'string')
      : null,
    interestKeywords: Array.isArray(s.interest_keywords) && s.interest_keywords.length > 0
      ? s.interest_keywords.filter(k => typeof k === 'string')
      : null,
  });
  const hasKeywords = (s) => Array.isArray(s.interest_keywords) && s.interest_keywords.length > 0;
  const categoryVectors = await getCategoryEmbeddings(env);
  if (!categoryVectors) return stories.map((s) => ({
    id: s.id,
    title: s.title,
    queryCategory: s.category,
    embeddingCategory: s.embedding_category || null,
    confidence: Number(s.embedding_confidence) || 0,
    mismatch: false,
    categoryValidated: false,
    keywordMatches: [],
    keywordsClassified: false,
    error: 'embedding unavailable',
    ...storyDisplayFields(s),
  }));

  // Embed stories in batches using single AI call per batch (saves subrequests)
  const BATCH_SIZE = 20;
  const results = [];
  for (let i = 0; i < stories.length; i += BATCH_SIZE) {
    const batch = stories.slice(i, i + BATCH_SIZE);
    // Collect texts needing embedding
    const textsToEmbed = [];
    const textIndices = [];
    batch.forEach((story, idx) => {
      const needsCategory = story.embedding_category == null;
      const needsKeywords = !hasKeywords(story) && !!keywordVectors;
      if (needsCategory || needsKeywords) {
        textsToEmbed.push(`${story.title || ''} ${story.description || ''}`.trim());
        textIndices.push(idx);
      }
    });
    // Batch embed in single AI call
    const vectors = textsToEmbed.length > 0 ? await embedTexts(env, textsToEmbed) : [];
    const vectorByIndex = {};
    textIndices.forEach((storyIdx, vecIdx) => {
      vectorByIndex[storyIdx] = vectors[vecIdx];
    });
    
    const batchResults = await Promise.all(
      batch.map(async (story, batchIdx) => {
        const needsCategory = story.embedding_category == null;
        const needsKeywords = !hasKeywords(story) && !!keywordVectors;
        const storyVector = vectorByIndex[batchIdx] || null;
        if ((needsCategory || needsKeywords) && !storyVector) {
          return {
            id: story.id,
            title: story.title,
            queryCategory: story.category,
            embeddingCategory: story.embedding_category || null,
            confidence: Number(story.embedding_confidence) || 0,
            mismatch: false,
            categoryValidated: false,
            keywordMatches: [],
            keywordsClassified: false,
            error: 'embedding failed',
            ...storyDisplayFields(story),
          };
        }
        let bestCategory = story.embedding_category || null;
        let bestScore = Number(story.embedding_confidence) || 0;
        let mismatch = false;
        const scores = {};
        if (needsCategory) {
          bestScore = -1;
          for (const [cat, catVector] of categoryVectors) {
            const sim = cosineSimilarity(storyVector, catVector);
            scores[cat] = Math.round(sim * 10000) / 10000;
            if (sim > bestScore) {
              bestScore = sim;
              bestCategory = cat;
            }
          }
          // 'all' is a catch-all with no real category signal — treat it as null, so a
          // confident AI prediction for an 'all' story flags as a mismatch.
          mismatch = bestCategory !== story.category && bestScore >= 0.35;
        }
        let keywordMatches = [];
        if (needsKeywords) {
          keywordMatches = classifyStoryKeywords(storyVector, keywordVectors);
          // If provider gave us a country, ensure the corresponding country interest is tagged.
          // Maps ISO → interest ID (reverse of COUNTRY_KEYWORD_TO_ISO).
          const providerCountry = (story.provider_country || '').toUpperCase();
          if (providerCountry) {
            const isoToInterest = {
              'US': 'country-us', 'GB': 'country-uk', 'CA': 'country-canada',
              'AU': 'country-australia', 'NZ': 'country-nz', 'IE': 'country-ireland',
              'FR': 'country-france', 'DE': 'country-germany', 'IT': 'country-italy',
              'ES': 'country-spain', 'NL': 'country-netherlands', 'SE': 'country-sweden',
              'CN': 'country-china', 'JP': 'country-japan', 'IN': 'country-india',
              'KR': 'country-korea', 'MX': 'country-mexico', 'BR': 'country-brazil',
              'ZA': 'country-south-africa', 'EG': 'country-egypt',
            };
            const interestId = isoToInterest[providerCountry];
            if (interestId && !keywordMatches.some(m => m.id === interestId)) {
              // Add with high confidence (provider data is authoritative)
              keywordMatches.unshift({ id: interestId, label: interestId, confidence: 0.95 });
              // Keep max 3
              keywordMatches = keywordMatches.slice(0, 3);
            }
          }
        }
        return {
          id: story.id,
          title: story.title,
          queryCategory: story.category,
          embeddingCategory: bestCategory,
          confidence: Math.round(bestScore * 10000) / 10000,
          scores,
          mismatch,
          categoryValidated: needsCategory,
          keywordMatches,
          keywordsClassified: needsKeywords && keywordMatches.length > 0,
          ...storyDisplayFields(story),
        };
      })
    );
    results.push(...batchResults);
  }
  return results;
}
