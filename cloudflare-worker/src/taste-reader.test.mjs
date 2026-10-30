import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { createTasteReaderRun, verifyTasteReaderAdmin } from './news-storage.mjs';

const env = {
  SUPABASE_URL: 'https://supabase.example',
  SUPABASE_SECRET_KEY: 'service-secret',
  SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
};

const NOW = new Date('2026-10-30T12:00:00Z');
const hourAgo = new Date(NOW.getTime() - 3600 * 1000).toISOString();
const twoHoursAgo = new Date(NOW.getTime() - 2 * 3600 * 1000).toISOString();
const threeHoursAgo = new Date(NOW.getTime() - 3 * 3600 * 1000).toISOString();

function row(id, { title, description, content, interestKeywords, displayCategories, publishedAt, url }) {
  return {
    id,
    provider: 'gnews',
    category: 'childcare',
    display_categories: displayCategories || null,
    interest_keywords: interestKeywords,
    title,
    article_url: url,
    image_url: 'https://images.example/story.jpg',
    description,
    content: content || '',
    ai_summary: '',
    published_at: publishedAt,
    source_name: 'Example',
    approved: false,
    removed: false,
    fetched_at: publishedAt,
    decision_action: null
  };
}

const candidateRows = {
  childcare: [
    row(10, {
      title: 'Bedtime stories for toddlers',
      description: 'A gentle bedtime story collection for toddlers and their families to enjoy together at night.',
      interestKeywords: ['bedtime-stories', 'toddlers'],
      publishedAt: hourAgo,
      url: 'https://publisher.example/bedtime'
    })
  ],
  animals: [
    row(11, {
      title: 'Puppy rescue at the shelter',
      description: 'A heartwarming puppy rescue story from the local animal shelter, with happy adoptions.',
      interestKeywords: ['pets', 'animal-rescues'],
      publishedAt: twoHoursAgo,
      url: 'https://publisher.example/puppy'
    }),
    // Same content id as the childcare pick, via a display override, but
    // with zero interest overlap for animals — dedupe must keep childcare.
    row(10, {
      title: 'Bedtime stories for toddlers',
      description: 'A gentle bedtime story collection for toddlers and their families to enjoy together at night.',
      interestKeywords: ['bedtime-stories', 'toddlers'],
      displayCategories: ['animals'],
      publishedAt: hourAgo,
      url: 'https://publisher.example/bedtime'
    })
  ],
  arts: [
    row(12, {
      title: 'Kids painting workshop',
      description: 'A colorful kids painting workshop where children learn to mix colors and paint together.',
      interestKeywords: ['painting'],
      publishedAt: threeHoursAgo,
      url: 'https://publisher.example/painting'
    })
  ],
  tech: [
    row(13, {
      title: 'Robot invention',
      description: 'A clever robot invention',
      // Muted words live ONLY in the full content. The reader scores
      // title + description, so these must not tank the score.
      content: 'gossip scandal lottery crash partisan clickbait rumor tragedy lawsuit',
      interestKeywords: ['robots-ai'],
      publishedAt: hourAgo,
      url: 'https://publisher.example/robot'
    })
  ],
  world: [],
  uplifting: []
};

function installMock({ admin = true, token = 'good-token' } = {}) {
  const originalFetch = globalThis.fetch;
  const captured = [];
  globalThis.fetch = async (input, options = {}) => {
    const requestUrl = new URL(String(input));
    captured.push({ requestUrl, options });
    const decoded = decodeURIComponent(String(input));
    if (requestUrl.pathname === '/auth/v1/user') {
      if (options.headers?.Authorization === `Bearer ${token}` && token === 'good-token') {
        return Response.json({ id: 'user-1' });
      }
      return new Response('unauthorized', { status: 401 });
    }
    if (requestUrl.pathname === '/rest/v1/profiles') {
      return Response.json([{ is_admin: admin }]);
    }
    if (requestUrl.pathname === '/rest/v1/news_stories') {
      if (requestUrl.searchParams.get('decision_at') !== null) return Response.json([]);
      if (requestUrl.searchParams.get('removed') === 'eq.true') return Response.json([]);
      const match = decoded.match(/display_categories\.cs\.\{(\w+)\}/);
      return Response.json(candidateRows[match ? match[1] : 'childcare'] || []);
    }
    if (requestUrl.pathname === '/rest/v1/taste_reader_runs' && options.method === 'POST') {
      return Response.json([{ id: 'run-1' }], { status: 201 });
    }
    if (requestUrl.pathname === '/rest/v1/taste_reader_run_items' && options.method === 'POST') {
      return new Response('', { status: 201 });
    }
    if (requestUrl.pathname === '/rest/v1/taste_reader_runs' && options.method === 'DELETE') {
      return new Response('', { status: 204 });
    }
    return new Response('not found', { status: 404 });
  };
  return { originalFetch, captured, restore: () => { globalThis.fetch = originalFetch; } };
}

function candidateUrls(captured) {
  return captured
    .filter(({ requestUrl }) => requestUrl.pathname === '/rest/v1/news_stories'
      && requestUrl.searchParams.get('decision_at') === null
      && requestUrl.searchParams.get('removed') !== 'eq.true')
    .map(({ requestUrl }) => requestUrl);
}

test('verifyTasteReaderAdmin requires a token, a valid user, and is_admin', async () => {
  const mock = installMock({ admin: true });
  try {
    assert.deepEqual(
      await verifyTasteReaderAdmin(env, new Request('https://worker.example/api/taste-reader/run')),
      { error: 'Supabase sign-in is required', status: 401 }
    );
    assert.deepEqual(
      await verifyTasteReaderAdmin(env, new Request('https://worker.example/api/taste-reader/run', {
        headers: { Authorization: 'Bearer bad-token' }
      })),
      { error: 'Supabase sign-in is required', status: 401 }
    );
    assert.deepEqual(
      await verifyTasteReaderAdmin(env, new Request('https://worker.example/api/taste-reader/run', {
        headers: { Authorization: 'Bearer good-token' }
      })),
      { userId: 'user-1' }
    );
  } finally {
    mock.restore();
  }

  const nonAdmin = installMock({ admin: false });
  try {
    assert.deepEqual(
      await verifyTasteReaderAdmin(env, new Request('https://worker.example/api/taste-reader/run', {
        headers: { Authorization: 'Bearer good-token' }
      })),
      { error: 'Taste Reader is for admins only', status: 403 }
    );
  } finally {
    nonAdmin.restore();
  }
});

test('createTasteReaderRun round-robins across spaces and dedupes by content id', async () => {
  const mock = installMock();
  try {
    const result = await createTasteReaderRun(env, { userId: 'user-1', now: NOW });
    assert.equal(result.runId, 'run-1');
    assert.equal(result.totalCount, 4);
    assert.equal(result.nextPosition, 4);
    // Round-robin in front-page order: childcare, animals, arts, tech.
    assert.deepEqual(result.items.map(item => item.contentId), [10, 11, 12, 13]);
    assert.deepEqual(result.items.map(item => item.space), ['childcare', 'animals', 'arts', 'tech']);
    // The duplicated id 10 kept its childcare assignment, not animals.
    assert.equal(result.items[0].space, 'childcare');

    const urls = candidateUrls(mock.captured);
    assert.equal(urls.length, 6);
    for (const requestUrl of urls) {
      assert.equal(requestUrl.searchParams.get('approved'), 'eq.false');
      assert.equal(requestUrl.searchParams.get('removed'), 'eq.false');
      assert.ok(requestUrl.searchParams.get('and')?.includes('decision_action.is.null'));
      assert.deepEqual(
        requestUrl.searchParams.getAll('published_at').sort(),
        [`gte.${new Date(NOW.getTime() - 24 * 3600 * 1000).toISOString()}`, `lte.${NOW.toISOString()}`].sort()
      );
      assert.equal(
        requestUrl.searchParams.get('not.and'),
        '(interest_keywords.not.is.null,interest_keywords.ov.{stocks,cryptocurrency,business-news,clickbait,death,politics,elections,government})'
      );
    }

    const runInsert = mock.captured.find(({ requestUrl, options }) =>
      requestUrl.pathname === '/rest/v1/taste_reader_runs' && options.method === 'POST');
    const runBody = JSON.parse(runInsert.options.body);
    assert.equal(runBody.user_id, 'user-1');
    assert.equal(runBody.interest_filter, null);
    assert.equal(runBody.total_count, 4);
    const itemsInsert = mock.captured.find(({ requestUrl, options }) =>
      requestUrl.pathname === '/rest/v1/taste_reader_run_items' && options.method === 'POST');
    const itemsBody = JSON.parse(itemsInsert.options.body);
    assert.deepEqual(itemsBody.map(item => item.content_id), [10, 11, 12, 13]);
    assert.deepEqual(itemsBody.map(item => item.position), [0, 1, 2, 3]);
    assert.ok(itemsBody.every(item => item.run_id === 'run-1' && item.status === 'queued'));
  } finally {
    mock.restore();
  }
});

test('createTasteReaderRun scores title and description only, not full content', async () => {
  const mock = installMock();
  try {
    const result = await createTasteReaderRun(env, { userId: 'user-1', now: NOW });
    const robot = result.items.find(item => item.contentId === 13);
    // Base 62 + image 5 - short description 6 + fresh 6 = 67, with no
    // muted-keyword penalty from the content-only gossip/scandal text.
    assert.ok(robot.score > 60, `expected robot score above 60, got ${robot.score}`);
  } finally {
    mock.restore();
  }
});

test('createTasteReaderRun filters by interest and rejects unknown interests', async () => {
  const mock = installMock();
  try {
    const filtered = await createTasteReaderRun(env, { userId: 'user-1', interestFilter: 'pets', now: NOW });
    assert.equal(filtered.totalCount, 1);
    assert.deepEqual(filtered.items.map(item => item.contentId), [11]);
    assert.equal(filtered.interestFilter, 'pets');
    assert.deepEqual(
      await createTasteReaderRun(env, { userId: 'user-1', interestFilter: 'nope-not-a-keyword', now: NOW }),
      { error: 'Unknown interest keyword' }
    );
  } finally {
    mock.restore();
  }
});

test('POST /api/taste-reader/run gates on site auth and returns the first page', async () => {
  const mock = installMock();
  try {
    const noToken = await worker.fetch(new Request('https://worker.example/api/taste-reader/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }), env, {});
    assert.equal(noToken.status, 401);

    const response = await worker.fetch(new Request('https://worker.example/api/taste-reader/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
      body: JSON.stringify({})
    }), env, {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.runId, 'run-1');
    assert.equal(body.totalCount, 4);
    assert.equal(body.items.length, 4);
  } finally {
    mock.restore();
  }
});
