import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveNewsStory,
  claimNewsProviderSync,
  finishNewsProviderSync,
  getNewsAdminSnapshot,
  getStoredNewsFeed,
  removeNewsStory,
  upsertNewsStories
} from './news-storage.mjs';

const env = {
  SUPABASE_URL: 'https://supabase.example',
  SUPABASE_SECRET_KEY: 'service-secret'
};

test('stored feed query returns normalized publisher story shape', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    return Response.json([{
      provider: 'gnews',
      category: 'childcare',
      title: 'Family story',
      article_url: 'https://publisher.example/family',
      approved: true,
      image_url: 'https://images.example/family.jpg',
      description: 'Description',
      content: 'Article excerpt',
      published_at: '2026-10-17T12:00:00Z',
      source_name: 'Example'
    }]);
  };
  try {
    const feed = await getStoredNewsFeed(env, 'childcare');
    assert.equal(requestUrl.pathname, '/rest/v1/news_stories');
    assert.equal(requestUrl.searchParams.get('category'), 'eq.childcare');
    assert.equal(requestUrl.searchParams.get('approved'), 'eq.true');
    assert.equal(requestUrl.searchParams.get('removed'), 'eq.false');
    assert.equal(feed.provider, 'supabase');
    assert.deepEqual(feed.items[0], {
      provider: 'gnews',
      category: 'childcare',
      title: 'Family story',
      link: 'https://publisher.example/family',
      image: 'https://images.example/family.jpg',
      description: 'Description',
      content: 'Article excerpt',
      pubDate: '2026-10-17T12:00:00Z',
      source: 'Example'
    });
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
      return new Response('[{"id":1}]', {
        status: 206,
        headers: { 'Content-Range': '0-0/42' }
      });
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
    if (url.pathname.endsWith('/news_stories')) return Response.json([{
      id: 8,
      provider: 'gnews',
      category: 'childcare',
      title: 'Recent story',
      article_url: 'https://publisher.example/recent',
      approved: false,
      removed: false,
      fetched_at: '2026-10-17T12:05:00Z'
    }]);
    return Response.json([{
      provider: 'gnews',
      status: 'succeeded',
      last_success_at: '2026-10-17T12:00:00Z',
      stories_saved: 7
    }]);
  };
  try {
    const snapshot = await getNewsAdminSnapshot(env, [{ id: 'gnews', name: 'GNews', categories: ['all'] }]);
    assert.equal(snapshot.totalStories, 42);
    assert.equal(snapshot.recentStories[0].updatedAt, '2026-10-17T12:05:00Z');
    assert.equal(snapshot.pendingStories[0].id, 7);
    assert.equal(snapshot.pendingStories[0].approved, false);
    assert.equal(snapshot.pendingStories[0].updatedAt, '2026-10-17T12:00:00Z');
    assert.equal(snapshot.providers[0].status, 'succeeded');
    assert.equal(snapshot.providers[0].stories_saved, 7);
    assert.equal(requests.length, 4);
    assert.ok(requests.every(({ options }) => options.headers.apikey === env.SUPABASE_SECRET_KEY));
    assert.equal(requests.find(({ url }) => url.searchParams.has('order') && url.pathname.endsWith('/news_stories')).url.searchParams.get('limit'), '50');
    assert.ok(requests.some(({ url }) =>
      url.searchParams.get('approved') === 'eq.false' &&
      url.searchParams.get('removed') === 'eq.false'
    ));
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
    assert.equal(requestOptions.method, 'PATCH');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.approved, true);
    assert.equal(payload.approved_by, 'admin@example.com');
    assert.ok(Number.isFinite(Date.parse(payload.approved_at)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('story removal soft-removes a pending story without deleting its database row', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return Response.json([{ id: 7 }]);
  };
  try {
    assert.equal(await removeNewsStory(env, '7', 'littlables'), true);
    assert.equal(requestUrl.pathname, '/rest/v1/news_stories');
    assert.equal(requestUrl.searchParams.get('id'), 'eq.7');
    assert.equal(requestUrl.searchParams.get('approved'), 'eq.false');
    assert.equal(requestUrl.searchParams.get('removed'), 'eq.false');
    assert.equal(requestOptions.method, 'PATCH');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.removed, true);
    assert.equal(payload.removed_by, 'littlables');
    assert.ok(Number.isFinite(Date.parse(payload.removed_at)));
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
