import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startSyncRun,
  updateSyncRun,
  finishSyncRun,
  isSyncRunHeartbeatDue,
  summarizeProviderProgress,
  SYNC_RUN_HEARTBEAT_MIN_MS
} from './provider-sync-runs.mjs';

const ENV = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'test-key' };

function installFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body });
    return handler(url, options);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const okJson = (rows) => ({ ok: true, json: async () => rows });
const okEmpty = () => ({ ok: true, json: async () => { throw new Error('no body'); } });

test('startSyncRun posts a running row and returns its id', async () => {
  const { calls, restore } = installFetch(() => okJson([{ id: 'run-1' }]));
  try {
    const id = await startSyncRun(ENV, { trigger: 'admin_sync_all', provider: null, pairsTotal: 42 });
    assert.equal(id, 'run-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    assert.ok(calls[0].url.includes('/rest/v1/provider_sync_runs'));
    assert.equal(calls[0].headers.Prefer, 'return=representation');
    const body = JSON.parse(calls[0].body);
    assert.equal(body.trigger, 'admin_sync_all');
    assert.equal(body.provider, null);
    assert.equal(body.status, 'running');
    assert.equal(body.pairs_total, 42);
    assert.equal(body.pairs_done, 0);
  } finally { restore(); }
});

test('startSyncRun returns null on failure instead of throwing', async () => {
  const failing = installFetch(() => ({ ok: false, json: async () => [] }));
  try {
    assert.equal(await startSyncRun(ENV, { trigger: 'cron' }), null);
  } finally { failing.restore(); }
  const throwing = installFetch(() => { throw new Error('network down'); });
  try {
    assert.equal(await startSyncRun(ENV, { trigger: 'cron' }), null);
  } finally { throwing.restore(); }
});

test('updateSyncRun patches by id and stamps last activity', async () => {
  const { calls, restore } = installFetch(() => okEmpty());
  try {
    assert.equal(await updateSyncRun(ENV, 'run-1', { pairs_done: 7, current_provider: 'gnews', current_category: 'all' }), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'PATCH');
    assert.ok(calls[0].url.includes('id=eq.run-1'));
    const body = JSON.parse(calls[0].body);
    assert.equal(body.pairs_done, 7);
    assert.equal(body.current_provider, 'gnews');
    assert.equal(body.current_category, 'all');
    assert.ok(body.last_activity_at);
    assert.equal(await updateSyncRun(ENV, null, { pairs_done: 1 }), false);
    assert.equal(calls.length, 1);
  } finally { restore(); }
});

test('finishSyncRun closes the row with status, summary, and pairs done', async () => {
  const { calls, restore } = installFetch(() => okEmpty());
  try {
    assert.equal(await finishSyncRun(ENV, 'run-1', { status: 'partial', pairsDone: 42, summary: { totalStoriesSaved: 10 } }), true);
    const body = JSON.parse(calls[0].body);
    assert.equal(body.status, 'partial');
    assert.equal(body.pairs_done, 42);
    assert.deepEqual(body.summary, { totalStoriesSaved: 10 });
    assert.equal(body.current_provider, null);
    assert.equal(body.current_category, null);
    assert.ok(body.finished_at);
  } finally { restore(); }
});

test('finishSyncRun omits pairs_done when not provided', async () => {
  const { calls, restore } = installFetch(() => okEmpty());
  try {
    await finishSyncRun(ENV, 'run-1', { status: 'failed' });
    const body = JSON.parse(calls[0].body);
    assert.ok(!Object.hasOwn(body, 'pairs_done'));
  } finally { restore(); }
});

test('heartbeat is due on provider change or after 30s, not before', () => {
  assert.equal(SYNC_RUN_HEARTBEAT_MIN_MS, 30_000);
  assert.equal(isSyncRunHeartbeatDue({ lastHeartbeatMs: 1000, lastProvider: 'gnews', provider: 'bing', nowMs: 2000 }), true);
  assert.equal(isSyncRunHeartbeatDue({ lastHeartbeatMs: null, lastProvider: 'gnews', provider: 'gnews', nowMs: 2000 }), true);
  assert.equal(isSyncRunHeartbeatDue({ lastHeartbeatMs: 1000, lastProvider: 'gnews', provider: 'gnews', nowMs: 1000 + 29_999 }), false);
  assert.equal(isSyncRunHeartbeatDue({ lastHeartbeatMs: 1000, lastProvider: 'gnews', provider: 'gnews', nowMs: 1000 + 30_000 }), true);
});

test('provider progress summarizes attempted pairs and the last pair result', () => {
  assert.deepEqual(
    summarizeProviderProgress('gnews', 3, [
      { status: 'succeeded', category: 'all' },
      { status: 'succeeded', category: 'childcare' },
      { status: 'failed', category: 'animals' }
    ]),
    { provider: 'gnews', pairs: 3, lastStatus: 'failed', lastCategory: 'animals' }
  );
  assert.deepEqual(
    summarizeProviderProgress('reddit', 0, []),
    { provider: 'reddit', pairs: 0, lastStatus: null, lastCategory: null }
  );
});
