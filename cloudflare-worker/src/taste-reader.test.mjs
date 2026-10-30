import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { createTasteReaderRun, verifyTasteReaderAdmin, recordTasteReaderWordScore, saveTasteReaderNote, normalizeTasteReaderWord } from './news-storage.mjs';

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
    if (requestUrl.pathname === '/rest/v1/taste_reader_word_scores' && options.method === 'POST') {
      return Response.json([{ id: 'score-1' }], { status: 201 });
    }
    if (requestUrl.pathname === '/rest/v1/taste_reader_notes' && options.method === 'POST') {
      return Response.json([{ id: 'note-1' }], { status: 201 });
    }
    if (requestUrl.pathname === '/rest/v1/taste_reader_run_items' && options.method === 'PATCH') {
      return new Response('', { status: 204 });
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

test('normalizeTasteReaderWord lowercases and trims punctuation', () => {
  assert.equal(normalizeTasteReaderWord('Dinosaurs,'), 'dinosaurs');
  assert.equal(normalizeTasteReaderWord('"Hello!"'), 'hello');
  assert.equal(normalizeTasteReaderWord('---'), '');
});

test('recordTasteReaderWordScore applies the locked deltas and skips the balloon on next/ignore/ban', async () => {
  const mock = installMock();
  try {
    const up = await recordTasteReaderWordScore(env, {
      userId: 'user-1', contentId: 10, runId: 'run-1',
      wordDisplay: 'Dinosaurs,', source: 'title', wordPosition: 0, action: 'up'
    });
    assert.deepEqual(up, { ok: true, scoreDelta: 1, wordNormalized: 'dinosaurs' });

    const ignore = await recordTasteReaderWordScore(env, {
      userId: 'user-1', contentId: 10, runId: 'run-1',
      wordDisplay: 'boring', source: 'description', wordPosition: 3, action: 'ignore'
    });
    assert.equal(ignore.scoreDelta, -3);

    const scoreInserts = mock.captured.filter(({ requestUrl, options }) =>
      requestUrl.pathname === '/rest/v1/taste_reader_word_scores' && options.method === 'POST');
    assert.equal(scoreInserts.length, 2);
    const firstBody = JSON.parse(scoreInserts[0].options.body);
    assert.equal(firstBody.word_display, 'Dinosaurs,');
    assert.equal(firstBody.word_normalized, 'dinosaurs');
    assert.equal(firstBody.source, 'title');

    // Up leaves the run item alone; ignore marks it skipped.
    const patches = mock.captured.filter(({ requestUrl, options }) =>
      requestUrl.pathname === '/rest/v1/taste_reader_run_items' && options.method === 'PATCH');
    assert.equal(patches.length, 1);
    assert.equal(JSON.parse(patches[0].options.body).status, 'skipped');
    assert.equal(patches[0].requestUrl.searchParams.get('content_id'), 'eq.10');

    assert.deepEqual(
      await recordTasteReaderWordScore(env, {
        userId: 'user-1', contentId: 10, runId: null,
        wordDisplay: 'word', source: 'title', wordPosition: 0, action: 'maybe'
      }),
      { error: 'Unknown word action' }
    );
    assert.deepEqual(
      await recordTasteReaderWordScore(env, {
        userId: 'user-1', contentId: 10, runId: null,
        wordDisplay: '---', source: 'title', wordPosition: 0, action: 'up'
      }),
      { error: 'That word has no letters or digits to score' }
    );
  } finally {
    mock.restore();
  }
});

test('saveTasteReaderNote validates kind and body, then inserts', async () => {
  const mock = installMock();
  try {
    assert.deepEqual(await saveTasteReaderNote(env, {
      userId: 'user-1', contentId: 10, runId: 'run-1',
      kind: 'user_note', body: '  too grim for toddlers  ',
      actionContext: 'viewed', stoppedWordNormalized: 'grim', stoppedPosition: 2, aiModel: null
    }), { ok: true });
    const insert = mock.captured.find(({ requestUrl, options }) =>
      requestUrl.pathname === '/rest/v1/taste_reader_notes' && options.method === 'POST');
    assert.equal(JSON.parse(insert.options.body).body, 'too grim for toddlers');
    assert.deepEqual(await saveTasteReaderNote(env, {
      userId: 'user-1', contentId: 10, kind: 'user_note', body: '   '
    }), { error: 'A note needs some text' });
  } finally {
    mock.restore();
  }
});

test('POST /api/taste-reader/score and /note gate on site auth; /reason uses Workers AI', async () => {
  const mock = installMock();
  const aiEnv = {
    ...env,
    AI: { run: async () => ({ choices: [{ message: { content: 'It is too grim for young readers.' } }] }) }
  };
  try {
    const noToken = await worker.fetch(new Request('https://worker.example/api/taste-reader/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: 10, wordDisplay: 'grim', source: 'title', wordPosition: 0, action: 'down' })
    }), env, {});
    assert.equal(noToken.status, 401);

    const scored = await worker.fetch(new Request('https://worker.example/api/taste-reader/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
      body: JSON.stringify({ contentId: 10, runId: 'run-1', wordDisplay: 'grim', source: 'title', wordPosition: 0, action: 'down' })
    }), env, {});
    assert.equal(scored.status, 200);
    assert.deepEqual(await scored.json(), { ok: true, scoreDelta: -1, wordNormalized: 'grim' });

    const reasoned = await worker.fetch(new Request('https://worker.example/api/taste-reader/reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
      body: JSON.stringify({ title: 'A grim story', description: 'Something sad happened.' })
    }), aiEnv, {});
    assert.equal(reasoned.status, 200);
    const reasonBody = await reasoned.json();
    assert.equal(reasonBody.reason, 'It is too grim for young readers.');
    assert.equal(reasonBody.model, '@cf/meta/llama-3.2-3b-instruct');
  } finally {
    mock.restore();
  }
});
