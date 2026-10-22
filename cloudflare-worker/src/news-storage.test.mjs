import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveNewsStory,
  banNewsStory,
  claimNewsProviderSync,
  createApprovedCustomNewsStory,
  effectiveDisplayCategories,
  finishNewsProviderSync,
  getNewsAdminSnapshot,
  getStoredNewsFeed,
  disapproveNewsStory,
  resetNewsProviderSync,
  setStoryDisplayCategories,
  setStoryInterestKeywords,
  getStoriesByKeyword,
  getPersistedKeywordEmbeddings,
  clearKeywordVectorCache,
  undoNewsStoryDecision,
  updateNewsStory,
  upsertNewsStories
} from './news-storage.mjs';

const env = {
  SUPABASE_URL: 'https://supabase.example',
  SUPABASE_SECRET_KEY: 'service-secret'
};

test('stored feed query returns normalized publisher story shape', async () => {
  const originalFetch = globalThis.fetch;
  const requestUrls = [];
  globalThis.fetch = async (input, options) => {
    const requestUrl = new URL(String(input));
    requestUrls.push(requestUrl);
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    if (requestUrl.searchParams.get('approved') === 'eq.false') {
      return Response.json([{
        provider: 'gnews',
        category: 'childcare',
        title: 'Pending family story',
        article_url: 'https://publisher.example/pending',
        approved: false,
        fetched_at: '2026-10-17T13:00:00Z'
      }]);
    }
    return Response.json([{
      provider: 'gnews',
      category: 'childcare',
      title: 'Family story',
      article_url: 'https://publisher.example/family',
      approved: true,
      image_url: 'https://images.example/family.jpg',
      description: 'Description',
      content: 'Article excerpt',
      ai_summary: 'A saved brief.',
      published_at: '2026-10-17T12:00:00Z',
      source_name: 'Example'
    }]);
  };
  try {
    const feed = await getStoredNewsFeed(env, 'childcare');
    assert.equal(requestUrls.length, 2);
    assert.ok(requestUrls.every(requestUrl => requestUrl.pathname === '/rest/v1/news_stories'));
    assert.ok(requestUrls.every(requestUrl => requestUrl.searchParams.get('or') === '(and(category.eq.childcare,display_categories.is.null),display_categories.cs.{childcare})'));
    assert.ok(requestUrls.every(requestUrl => requestUrl.searchParams.get('removed') === 'eq.false'));
    assert.equal(feed.provider, 'supabase');
    assert.deepEqual(feed.items[0], {
      provider: 'gnews',
      category: 'childcare',
      displayCategories: null,
      interestKeywords: null,
      title: 'Family story',
      link: 'https://publisher.example/family',
      image: 'https://images.example/family.jpg',
      description: 'Description',
      content: 'Article excerpt',
      aiSummary: 'A saved brief.',
      pubDate: '2026-10-17T12:00:00Z',
      fetchedAt: '',
      source: 'Example',
      approved: true
    });
    assert.equal(feed.items[1].pubDate, '');
    assert.equal(feed.items[1].fetchedAt, '2026-10-17T13:00:00Z');
    assert.equal(feed.items[0].approved, true);
    assert.equal(feed.items[1].approved, false);
    assert.deepEqual(new Set(requestUrls.map(requestUrl => requestUrl.searchParams.get('approved'))), new Set(['eq.true', 'eq.false']));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider update claim calls the service-only atomic lock RPC', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestBody = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, `Bearer ${env.SUPABASE_SECRET_KEY}`);
    return Response.json(true);
  };
  try {
    assert.equal(await claimNewsProviderSync(env, 'gnews', 'admin@example.com'), true);
    assert.equal(requestUrl.pathname, '/rest/v1/rpc/claim_news_provider_sync');
    assert.deepEqual(requestBody, { p_provider: 'gnews', p_updated_by: 'admin@example.com' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('upsert uses the unique provider/category/publisher URL key', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return new Response(null, { status: 204 });
  };
  try {
    await upsertNewsStories(env, 'gnews', 'childcare', [{
      title: 'Family story',
      link: 'https://publisher.example/family',
      image: 'https://images.example/family.jpg',
      description: 'Description',
      content: 'Article excerpt',
      pubDate: '2026-10-17T12:00:00Z',
      source: 'Example'
    }]);
    assert.equal(requestUrl.pathname, '/rest/v1/news_stories');
    assert.equal(requestUrl.searchParams.get('on_conflict'), 'provider,category,article_url');
    assert.match(requestOptions.headers.Prefer, /resolution=merge-duplicates/);
    const [row] = JSON.parse(requestOptions.body);
    assert.equal(row.article_url, 'https://publisher.example/family');
    assert.equal(row.category, 'childcare');
    assert.equal(Object.hasOwn(row, 'approved'), false);
    assert.equal(Object.hasOwn(row, 'removed'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin snapshot includes exact total, latest ten, and provider status', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    requests.push({ url, options });
    if (url.pathname.endsWith('/news_stories') && options.headers.Range) {
      const total = url.searchParams.has('provider') ? 17 : 42;
      return new Response('[{"id":1}]', {
        status: 206,
        headers: { 'Content-Range': `0-0/${total}` }
      });
    }
    if (
      url.pathname.endsWith('/news_stories') &&
      url.searchParams.get('decision_at') === 'not.is.null'
    ) {
      return Response.json([{
        id: 8,
        provider: 'gnews',
        category: 'childcare',
        title: 'Recent decision',
        article_url: 'https://publisher.example/recent',
        approved: true,
        removed: false,
        fetched_at: '2026-10-17T12:05:00Z',
        decision_action: 'approve',
        decision_by: 'littlables',
        decision_at: '2026-10-17T12:06:00Z',
        previous_approved: false,
        previous_removed: false
      }]);
    }
    if (
      url.pathname.endsWith('/news_stories') &&
      url.searchParams.get('approved') === 'eq.false' &&
      url.searchParams.get('removed') === 'eq.false'
    ) {
      return Response.json([{
        id: 7,
        provider: 'gnews',
        category: 'childcare',
        title: 'Pending story',
        article_url: 'https://publisher.example/pending',
        approved: false,
        removed: false,
        fetched_at: '2026-10-17T12:00:00Z'
      }]);
    }
    if (url.pathname.endsWith('/news_stories')) return Response.json([]);
    return Response.json([{
      provider: 'gnews',
      status: 'succeeded',
      last_success_at: '2026-10-17T12:00:00Z',
      stories_saved: 7
    }]);
  };
  try {
    const snapshot = await getNewsAdminSnapshot(
      env,
      [{ id: 'gnews', name: 'GNews', categories: ['all'] }],
      'gnews'
    );
    assert.equal(snapshot.totalStories, 42);
    assert.equal(snapshot.recentStories[0].id, 8);
    assert.equal(snapshot.recentStories[0].decisionAction, 'approve');
    assert.equal(snapshot.recentStories[0].previousApproved, false);
    assert.equal(snapshot.pendingStories[0].id, 7);
    assert.equal(snapshot.pendingStories[0].approved, false);
    assert.equal(snapshot.pendingStories[0].updatedAt, '2026-10-17T12:00:00Z');
    assert.equal(snapshot.providers[0].status, 'succeeded');
    assert.equal(snapshot.providers[0].stories_saved, 7);
    assert.equal(snapshot.providers[0].total_stories_saved, 17);
    assert.equal(requests.length, 14);
    assert.ok(requests.every(({ options }) => options.headers.apikey === env.SUPABASE_SECRET_KEY));
    assert.equal(requests.find(({ url }) => url.searchParams.get('decision_at') === 'not.is.null').url.searchParams.get('limit'), null);
    assert.ok(requests.some(({ url }) =>
      url.searchParams.get('approved') === 'eq.false' &&
      url.searchParams.get('removed') === 'eq.false'
    ));
    assert.equal(
      requests.find(({ url }) => url.searchParams.get('approved') === 'eq.false')
        .url.searchParams.get('provider'),
      'eq.gnews'
    );
    assert.ok(requests.some(({ url }) =>
      url.searchParams.get('removed') === 'eq.true' &&
      url.searchParams.get('limit') === '100'
    ));
    assert.equal(
      requests.find(({ url }) => url.searchParams.has('or')).url.searchParams.get('or'),
      '(decision_action.is.null,decision_action.eq.undo)'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('approval only transitions an unapproved story and records the admin identity', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return Response.json([{ id: 7 }]);
  };
  try {
    assert.equal(await approveNewsStory(env, '7', 'admin@example.com'), true);
    assert.equal(requestUrl.pathname, '/rest/v1/news_stories');
    assert.equal(requestUrl.searchParams.get('id'), 'eq.7');
    assert.equal(requestUrl.searchParams.get('approved'), 'eq.false');
    assert.equal(requestUrl.searchParams.get('removed'), 'eq.false');
    assert.equal(requestOptions.method, 'PATCH');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.approved, true);
    assert.equal(payload.approved_by, 'admin@example.com');
    assert.ok(Number.isFinite(Date.parse(payload.approved_at)));
    assert.equal(payload.decision_action, 'approve');
    assert.equal(payload.previous_approved, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom story publish saves editable card fields as an approved custom row', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return Response.json([{ id: 71 }]);
  };
  try {
    const id = await createApprovedCustomNewsStory(env, {
      title: 'A custom story',
      category: 'childcare',
      link: 'https://publisher.example/story',
      image: 'https://images.example/story.jpg',
      description: 'Description',
      content: 'Summary context',
      aiSummary: 'A custom brief',
      pubDate: '2026-10-17T12:00:00.000Z',
      source: 'Publisher'
    }, 'littlables');
    assert.equal(id, 71);
    assert.equal(requestUrl.searchParams.get('on_conflict'), 'provider,category,article_url');
    const [row] = JSON.parse(requestOptions.body);
    assert.equal(row.provider, 'custom');
    assert.equal(row.article_url, 'https://publisher.example/story');
    assert.equal(row.image_url, 'https://images.example/story.jpg');
    assert.equal(row.approved, true);
    assert.equal(row.approved_by, 'littlables');
    assert.equal(row.decision_action, 'approve');
    assert.equal(row.previous_approved, false);
    assert.equal(row.ai_summary, 'A custom brief');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('story detail updates do not change moderation state', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return Response.json([{ id: 71 }]);
  };
  try {
    assert.equal(await updateNewsStory(env, '71', {
      title: 'Edited story',
      category: 'arts',
      link: 'https://publisher.example/edited',
      image: '',
      description: 'Edited description',
      content: 'Edited context',
      aiSummary: 'An edited brief',
      pubDate: '',
      source: 'Publisher'
    }), true);
    assert.equal(requestUrl.searchParams.get('id'), 'eq.71');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.title, 'Edited story');
    assert.equal(payload.category, 'arts');
    assert.equal(payload.article_url, 'https://publisher.example/edited');
    assert.equal(payload.image_url, null);
    assert.equal(payload.ai_summary, 'An edited brief');
    assert.equal(Object.hasOwn(payload, 'approved'), false);
    assert.equal(Object.hasOwn(payload, 'removed'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('disapprove keeps a story in the feed without treating it as approved', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const requestUrl = new URL(String(input));
    requests.push({ requestUrl, options });
    return requests.length === 1
      ? Response.json([{ id: 7, approved: true, removed: false }])
      : Response.json([{ id: 7 }]);
  };
  try {
    assert.equal(await disapproveNewsStory(env, '7', 'littlables'), true);
    assert.equal(requests.length, 2);
    const [lookup, update] = requests;
    assert.equal(lookup.requestUrl.searchParams.get('id'), 'eq.7');
    assert.equal(lookup.requestUrl.searchParams.get('removed'), 'eq.false');
    assert.equal(update.requestUrl.pathname, '/rest/v1/news_stories');
    assert.equal(update.requestUrl.searchParams.get('id'), 'eq.7');
    assert.equal(update.requestUrl.searchParams.get('approved'), 'eq.true');
    assert.equal(update.requestUrl.searchParams.get('removed'), 'eq.false');
    assert.equal(update.options.method, 'PATCH');
    const payload = JSON.parse(update.options.body);
    assert.equal(payload.approved, false);
    assert.equal(payload.removed, undefined);
    assert.equal(payload.decision_action, 'disapprove');
    assert.equal(payload.previous_approved, true);
    assert.equal(payload.previous_removed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ban hides an unapproved story while preserving its database row', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return Response.json([{ id: 7 }]);
  };
  try {
    assert.equal(await banNewsStory(env, '7', 'littlables'), true);
    assert.equal(requestUrl.searchParams.get('approved'), 'eq.false');
    assert.equal(requestUrl.searchParams.get('removed'), 'eq.false');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.removed, true);
    assert.equal(payload.decision_action, 'ban');
    assert.equal(payload.previous_removed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('undo restores the prior story state and only applies to the current decision', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    requests.push({ url, options });
    if (!options.method) {
      return Response.json([{
        id: 7,
        approved: false,
        removed: true,
        decision_action: 'ban',
        decision_at: '2026-10-17T12:00:00Z',
        previous_approved: false,
        previous_removed: false
      }]);
    }
    return Response.json([{ id: 7 }]);
  };
  try {
    assert.equal(await undoNewsStoryDecision(env, '7', 'littlables'), true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].url.searchParams.get('decision_action'), 'eq.ban');
    assert.equal(requests[1].url.searchParams.get('decision_at'), 'eq.2026-10-17T12:00:00Z');
    const payload = JSON.parse(requests[1].options.body);
    assert.equal(payload.approved, false);
    assert.equal(payload.removed, false);
    assert.equal(payload.previous_approved, null);
    assert.equal(payload.decision_action, 'undo');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider update completion stores status and clears the running lock', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return new Response(null, { status: 204 });
  };
  try {
    await finishNewsProviderSync(env, 'gnews', {
      status: 'partial',
      storiesSaved: 12,
      error: 'arts: request failed'
    });
    assert.equal(requestUrl.pathname, '/rest/v1/news_provider_sync');
    assert.equal(requestUrl.searchParams.get('provider'), 'eq.gnews');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.status, 'partial');
    assert.equal(payload.stories_saved, 12);
    assert.equal(payload.started_at, null);
    assert.equal(payload.last_error, 'arts: request failed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider sync reset clears a stuck running lock', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const requestUrl = new URL(String(input));
    requests.push({ url: requestUrl, options });
    if (!options.method) {
      return Response.json([{ provider: 'gnews', status: 'running', started_at: '2026-10-20T00:00:00Z' }]);
    }
    return new Response(null, { status: 204 });
  };
  try {
    const result = await resetNewsProviderSync(env, 'gnews', 'admin@example.com');
    assert.deepEqual(result, { provider: 'gnews', reset: true, previousStatus: 'running' });
    assert.equal(requests.length, 2);
    const patch = requests[1];
    assert.equal(patch.url.pathname, '/rest/v1/news_provider_sync');
    assert.equal(patch.url.searchParams.get('provider'), 'eq.gnews');
    assert.equal(patch.options.method, 'PATCH');
    const payload = JSON.parse(patch.options.body);
    assert.equal(payload.status, 'failed');
    assert.equal(payload.started_at, null);
    assert.equal(payload.updated_by, 'admin@example.com');
    assert.ok(payload.last_error.includes('admin@example.com'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider sync reset leaves a non-running provider untouched', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async (input) => {
    requestCount += 1;
    return Response.json([{ provider: 'gnews', status: 'succeeded', started_at: null }]);
  };
  try {
    const result = await resetNewsProviderSync(env, 'gnews', 'admin@example.com');
    assert.deepEqual(result, { provider: 'gnews', reset: false, previousStatus: 'succeeded' });
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('setStoryDisplayCategories validates, dedupes, and clears overrides', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (input, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json([{ id: 99 }]);
  };
  try {
    // Valid multi-category override, with duplicates and casing normalized
    let result = await setStoryDisplayCategories(env, 99, ['Animals', 'childcare', 'animals']);
    assert.equal(result.ok, true);
    assert.deepEqual(result.displayCategories, ['animals', 'childcare']);
    assert.deepEqual(requestBody, { display_categories: ['animals', 'childcare'] });

    // Empty list clears the override (NULL, not empty array)
    result = await setStoryDisplayCategories(env, 99, []);
    assert.equal(result.ok, true);
    assert.equal(result.displayCategories, null);
    assert.deepEqual(requestBody, { display_categories: null });

    // null clears too
    result = await setStoryDisplayCategories(env, 99, null);
    assert.equal(result.ok, true);
    assert.equal(result.displayCategories, null);

    // Unknown categories are rejected, nothing is written
    result = await setStoryDisplayCategories(env, 99, ['childcare', 'nonsense']);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Unknown category in override list');

    // 'all' is not an overridable display category
    result = await setStoryDisplayCategories(env, 99, ['all']);
    assert.equal(result.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('effectiveDisplayCategories prefers the override list', () => {
  assert.deepEqual(
    effectiveDisplayCategories({ category: 'tech', display_categories: ['childcare', 'animals'] }),
    ['childcare', 'animals']
  );
  assert.deepEqual(
    effectiveDisplayCategories({ category: 'tech', display_categories: [] }),
    ['tech']
  );
  assert.deepEqual(
    effectiveDisplayCategories({ category: 'tech', display_categories: null }),
    ['tech']
  );
  assert.deepEqual(
    effectiveDisplayCategories({ category: 'tech', displayCategories: ['arts'] }),
    ['arts']
  );
});

test('setStoryInterestKeywords validates, dedupes, and clears keyword tags', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (input, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json([{ id: 99 }]);
  };
  try {
    // Valid keywords, with duplicates and casing normalized
    let result = await setStoryInterestKeywords(env, 99, ['Space', 'food', 'space']);
    assert.equal(result.ok, true);
    assert.deepEqual(result.interestKeywords, ['space', 'food']);
    assert.deepEqual(requestBody, { interest_keywords: ['space', 'food'] });

    // Empty list clears the tags (NULL, not empty array)
    result = await setStoryInterestKeywords(env, 99, []);
    assert.equal(result.ok, true);
    assert.equal(result.interestKeywords, null);
    assert.deepEqual(requestBody, { interest_keywords: null });

    // Unknown keywords are rejected, nothing is written
    result = await setStoryInterestKeywords(env, 99, ['space', 'nonsense']);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Unknown interest keyword');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getStoriesByKeyword queries the interest_keywords array column', async () => {
  const originalFetch = globalThis.fetch;
  const requestUrls = [];
  globalThis.fetch = async (input) => {
    requestUrls.push(new URL(input));
    return Response.json([]);
  };
  try {
    const feed = await getStoriesByKeyword(env, 'space');
    assert.equal(feed.provider, 'supabase');
    assert.deepEqual(feed.items, []);
    assert.equal(requestUrls.length, 2);
    assert.ok(requestUrls.every(u => u.searchParams.get('interest_keywords') === 'cs.{space}'));
    assert.ok(requestUrls.every(u => u.searchParams.get('removed') === 'eq.false'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getPersistedKeywordEmbeddings returns incomplete status without an AI binding', async () => {
  clearKeywordVectorCache();
  const result = await getPersistedKeywordEmbeddings(env);
  assert.equal(result.vectors, null);
  assert.equal(result.complete, false);
  clearKeywordVectorCache();
});

test('getPersistedKeywordEmbeddings loads vectors from Supabase without AI calls', async () => {
  clearKeywordVectorCache();
  const { INTEREST_KEYWORDS } = await import('./interest-keywords.mjs');
  const originalFetch = globalThis.fetch;
  let aiCalls = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/keyword_embeddings') {
      return Response.json(
        INTEREST_KEYWORDS.map((kw) => ({
          keyword_id: kw.id,
          embedding: [0.1, 0.2, 0.3],
          model: '@cf/baai/bge-base-en-v1.5',
        }))
      );
    }
    throw new Error('unexpected fetch: ' + url.pathname);
  };
  const aiEnv = {
    ...env,
    AI: { run: async () => { aiCalls++; return { data: [[0.1]] }; } },
  };
  try {
    const result = await getPersistedKeywordEmbeddings(aiEnv);
    assert.equal(result.complete, true);
    const map = result.vectors;
    assert.ok(map instanceof Map);
    assert.equal(map.size, 100);
    assert.deepEqual(map.get('space'), [0.1, 0.2, 0.3]);
    assert.equal(aiCalls, 0, 'no AI calls when all vectors are stored');
    // Second call served from in-memory cache (no fetches at all)
    let fetches = 0;
    globalThis.fetch = async () => { fetches++; return Response.json([]); };
    const cached = await getPersistedKeywordEmbeddings(aiEnv);
    assert.equal(cached.vectors, map);
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
    clearKeywordVectorCache();
  }
});

test('getPersistedKeywordEmbeddings backfills missing vectors and is all-or-nothing', async () => {
  clearKeywordVectorCache();
  const { INTEREST_KEYWORDS } = await import('./interest-keywords.mjs');
  const originalFetch = globalThis.fetch;
  // 99 of 100 vectors stored; the last one fails to embed -> incomplete -> null
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/keyword_embeddings') {
      if (options && options.method === 'POST') return Response.json([]);
      return Response.json(
        INTEREST_KEYWORDS.slice(0, 99).map((kw) => ({
          keyword_id: kw.id,
          embedding: [0.1],
          model: '@cf/baai/bge-base-en-v1.5',
        }))
      );
    }
    throw new Error('unexpected fetch: ' + url.pathname);
  };
  const failingAiEnv = {
    ...env,
    AI: { run: async () => { throw new Error('AI down'); } },
  };
  try {
    const result = await getPersistedKeywordEmbeddings(failingAiEnv);
    assert.equal(result.vectors, null, 'partial backfill must not enable tagging');
    assert.equal(result.complete, false);
    assert.equal(result.done, 99);
    assert.equal(result.total, 100);
  } finally {
    globalThis.fetch = originalFetch;
    clearKeywordVectorCache();
  }
});
