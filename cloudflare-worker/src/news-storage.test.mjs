import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveNewsStory,
  banNewsStory,
  claimNewsProviderSync,
  finishNewsProviderSync,
  getNewsAdminSnapshot,
  getStoredNewsFeed,
  undoNewsStoryDecision,
  unapproveNewsStory,
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
        approved: false
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
      published_at: '2026-10-17T12:00:00Z',
      source_name: 'Example'
    }]);
  };
  try {
    const feed = await getStoredNewsFeed(env, 'childcare');
    assert.equal(requestUrls.length, 2);
    assert.ok(requestUrls.every(requestUrl => requestUrl.pathname === '/rest/v1/news_stories'));
    assert.ok(requestUrls.every(requestUrl => requestUrl.searchParams.get('category') === 'eq.childcare'));
    assert.ok(requestUrls.every(requestUrl => requestUrl.searchParams.get('removed') === 'eq.false'));
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
      source: 'Example',
      approved: true
    });
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
      return new Response('[{"id":1}]', {
        status: 206,
        headers: { 'Content-Range': '0-0/42' }
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
    const snapshot = await getNewsAdminSnapshot(env, [{ id: 'gnews', name: 'GNews', categories: ['all'] }]);
    assert.equal(snapshot.totalStories, 42);
    assert.equal(snapshot.recentStories[0].id, 8);
    assert.equal(snapshot.recentStories[0].decisionAction, 'approve');
    assert.equal(snapshot.recentStories[0].previousApproved, false);
    assert.equal(snapshot.pendingStories[0].id, 7);
    assert.equal(snapshot.pendingStories[0].approved, false);
    assert.equal(snapshot.pendingStories[0].updatedAt, '2026-10-17T12:00:00Z');
    assert.equal(snapshot.providers[0].status, 'succeeded');
    assert.equal(snapshot.providers[0].stories_saved, 7);
    assert.equal(requests.length, 4);
    assert.ok(requests.every(({ options }) => options.headers.apikey === env.SUPABASE_SECRET_KEY));
    assert.equal(requests.find(({ url }) => url.searchParams.get('decision_at') === 'not.is.null').url.searchParams.get('limit'), '10');
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

test('remove unapproves an approved story so it stays in the feed below approved stories', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (input, options) => {
    requestUrl = new URL(String(input));
    requestOptions = options;
    return Response.json([{ id: 7 }]);
  };
  try {
    assert.equal(await unapproveNewsStory(env, '7', 'littlables'), true);
    assert.equal(requestUrl.pathname, '/rest/v1/news_stories');
    assert.equal(requestUrl.searchParams.get('id'), 'eq.7');
    assert.equal(requestUrl.searchParams.get('approved'), 'eq.true');
    assert.equal(requestUrl.searchParams.get('removed'), 'eq.false');
    assert.equal(requestOptions.method, 'PATCH');
    const payload = JSON.parse(requestOptions.body);
    assert.equal(payload.approved, false);
    assert.equal(payload.removed, undefined);
    assert.equal(payload.decision_action, 'unapprove');
    assert.equal(payload.previous_approved, true);
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
