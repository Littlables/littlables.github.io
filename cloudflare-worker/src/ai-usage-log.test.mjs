import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiUsageCounter } from './ai-usage-log.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'test-secret'
};

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    }
  };
}

test('counter aggregates multiple adds into one row per model and use', () => {
  const counter = createAiUsageCounter();
  counter.add('llama', 'curation', 1);
  counter.add('llama', 'curation', 2);
  counter.add('llama', 'curation', 0, 1);
  counter.add('bge', 'validation', 1);
  assert.equal(counter.size, 2);
  assert.deepEqual(counter.snapshot(), [
    { model: 'llama', use: 'curation', calls: 3, errors: 1 },
    { model: 'bge', use: 'validation', calls: 1, errors: 0 }
  ]);
});

test('counter ignores adds with no model, no use, or no counts', () => {
  const counter = createAiUsageCounter();
  counter.add('', 'curation', 1);
  counter.add('llama', '', 1);
  counter.add('llama', 'curation', 0, 0);
  counter.add('llama', 'curation', -1, -2);
  assert.equal(counter.size, 0);
});

test('flush posts a single batched RPC and clears the counter', async () => {
  const counter = createAiUsageCounter();
  counter.add('llama', 'curation', 3, 1);
  counter.add('flux', 'image', 1);
  const stub = stubFetch(() => ({ ok: true }));
  try {
    assert.equal(await counter.flush(env), true);
    assert.equal(stub.calls.length, 1);
    const call = stub.calls[0];
    assert.equal(call.url, 'https://example.supabase.co/rest/v1/rpc/increment_ai_usage');
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers.apikey, 'test-secret');
    assert.equal(call.options.headers.Authorization, 'Bearer test-secret');
    const body = JSON.parse(call.options.body);
    assert.match(body.p_day, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(body.p_rows, [
      { model: 'llama', usage_key: 'curation', calls: 3, errors: 1 },
      { model: 'flux', usage_key: 'image', calls: 1, errors: 0 }
    ]);
    assert.equal(counter.size, 0);
    // A second flush with nothing to send makes no request.
    assert.equal(await counter.flush(env), false);
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});

test('flush is a no-op without Supabase credentials', async () => {
  const counter = createAiUsageCounter();
  counter.add('llama', 'curation', 1);
  const stub = stubFetch(() => ({ ok: true }));
  try {
    assert.equal(await counter.flush({}), false);
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test('flush never throws when the RPC fails or fetch rejects', async () => {
  const failing = createAiUsageCounter();
  failing.add('llama', 'curation', 1);
  const stubFail = stubFetch(() => ({ ok: false, status: 500 }));
  try {
    assert.equal(await failing.flush(env), false);
  } finally {
    stubFail.restore();
  }

  const rejecting = createAiUsageCounter();
  rejecting.add('llama', 'curation', 1);
  const stubReject = stubFetch(() => {
    throw new Error('network down');
  });
  try {
    assert.equal(await rejecting.flush(env), false);
  } finally {
    stubReject.restore();
  }
});
