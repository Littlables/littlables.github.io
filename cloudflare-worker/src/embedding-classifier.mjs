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
      // Workers AI returns { shape, data } for embedding models
      const vector = result?.data || result?.embedding;
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
 * Clear the in-memory category embedding cache (useful for tests).
 */
export function clearEmbeddingCache() {
  cachedCategoryEmbeddings = null;
}

/**
 * Validate a batch of stories: classify each and flag mismatches.
 *
 * @param {object} env - Worker env (needs AI binding)
 * @param {Array<{id: number, title: string, description: string, category: string}>} stories
 * @returns {Promise<Array<{id: number, queryCategory: string, embeddingCategory: string|null, confidence: number, mismatch: boolean}>>}
 */
export async function validateStoryCategories(env, stories) {
  const categoryVectors = await getCategoryEmbeddings(env);
  if (!categoryVectors) return stories.map((s) => ({
    id: s.id,
    title: s.title,
    queryCategory: s.category,
    embeddingCategory: null,
    confidence: 0,
    mismatch: false,
    error: 'embedding unavailable',
  }));

  // Embed all stories in parallel (bounded to avoid overwhelming the API)
  const BATCH_SIZE = 10;
  const results = [];
  for (let i = 0; i < stories.length; i += BATCH_SIZE) {
    const batch = stories.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (story) => {
        const text = `${story.title || ''} ${story.description || ''}`.trim();
        const storyVector = await embedText(env, text);
        if (!storyVector) {
          return {
            id: story.id,
            title: story.title,
            queryCategory: story.category,
            embeddingCategory: null,
            confidence: 0,
            mismatch: false,
            error: 'embedding failed',
          };
        }
        let bestCategory = null;
        let bestScore = -1;
        const scores = {};
        for (const [cat, catVector] of categoryVectors) {
          const sim = cosineSimilarity(storyVector, catVector);
          scores[cat] = Math.round(sim * 10000) / 10000;
          if (sim > bestScore) {
            bestScore = sim;
            bestCategory = cat;
          }
        }
        // 'all' is a catch-all; only flag mismatch if embedding is confident
        // about a specific category different from the query category
        const mismatch = bestCategory !== story.category
          && story.category !== 'all'
          && bestScore >= 0.35;
        return {
          id: story.id,
          title: story.title,
          queryCategory: story.category,
          embeddingCategory: bestCategory,
          confidence: Math.round(bestScore * 10000) / 10000,
          scores,
          mismatch,
        };
      })
    );
    results.push(...batchResults);
  }
  return results;
}
