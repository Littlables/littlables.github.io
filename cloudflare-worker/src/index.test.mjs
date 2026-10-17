import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';
import { createAdminSessionCookie } from './github-auth.mjs';

const authEnv = {
  GITHUB_ALLOWED_USER: 'littlables',
  GITHUB_SESSION_SECRET: 'test-session-secret-that-is-long-enough'
};

async function adminCookie(login = 'littlables') {
  return createAdminSessionCookie(login, authEnv.GITHUB_SESSION_SECRET);
}

test('admin page offers GitHub sign-in when there is no valid session', async () => {
  const response = await worker.fetch(new Request('https://worker.example/admin'), {}, {});
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Continue with GitHub/);
});

test('admin page requires an authenticated GitHub session', async () => {
  const cookie = await adminCookie();
  const response = await worker.fetch(
    new Request('https://worker.example/admin', { headers: { Cookie: cookie.split(';')[0] } }),
    authEnv
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  const page = await response.text();
  assert.match(page, /Verifying GitHub session/);
  assert.match(page, /Stories awaiting approval/);
  assert.match(page, /Approve/);
  assert.match(page, /Last 10 saved stories/);
});

test('admin APIs reject missing and non-allowlisted GitHub sessions', async () => {
  const missing = await worker.fetch(new Request('https://worker.example/admin/api/status'), {}, {});
  const otherCookie = await adminCookie('someone-else');
  const other = await worker.fetch(
    new Request('https://worker.example/admin/api/status', {
      headers: { Cookie: otherCookie.split(';')[0] }
    }),
    authEnv
  );
  assert.equal(missing.status, 401);
  assert.equal(other.status, 401);
});

test('GitHub OAuth login uses configured callback and sets an HttpOnly state cookie', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/admin/auth/login', {
      headers: { 'CF-Connecting-IP': '192.0.2.10' }
    }),
    {
      ...authEnv,
      GITHUB_CLIENT_ID: 'github-client',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GITHUB_OAUTH_CALLBACK_URL: 'https://worker.example/admin/auth/callback',
      SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
    }
  );
  const location = new URL(response.headers.get('Location'));
  assert.equal(response.status, 302);
  assert.equal(location.hostname, 'github.com');
  assert.equal(location.searchParams.get('client_id'), 'github-client');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://worker.example/admin/auth/callback');
  assert.ok(response.headers.get('Set-Cookie').includes('HttpOnly'));
  assert.ok(response.headers.get('Set-Cookie').includes('SameSite=Lax'));
});

test('GitHub OAuth callback only creates a session for the allowlisted GitHub login', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    if (String(input).includes('/login/oauth/access_token')) {
      return Response.json({ access_token: 'github-access-token' });
    }
    return Response.json({ login: 'littlables' });
  };
  try {
    const state = 'a'.repeat(43);
    const response = await worker.fetch(
      new Request(`https://worker.example/admin/auth/callback?code=oauth-code&state=${state}`, {
        headers: { Cookie: `littlables_oauth_state=${state}`, 'CF-Connecting-IP': '192.0.2.10' }
      }),
      {
        ...authEnv,
        GITHUB_CLIENT_ID: 'github-client',
        GITHUB_CLIENT_SECRET: 'github-secret',
        GITHUB_OAUTH_CALLBACK_URL: 'https://worker.example/admin/auth/callback',
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'https://worker.example/admin');
    assert.match(response.headers.get('Set-Cookie'), /__Host-littlables_admin=/);
    assert.ok(requests.some(({ url }) => url === 'https://api.github.com/user'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GitHub OAuth callback does not create a session for another account', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => String(input).includes('/login/oauth/access_token')
    ? Response.json({ access_token: 'github-access-token' })
    : Response.json({ login: 'someone-else' });
  try {
    const state = 'b'.repeat(43);
    const response = await worker.fetch(
      new Request(`https://worker.example/admin/auth/callback?code=oauth-code&state=${state}`, {
        headers: { Cookie: `littlables_oauth_state=${state}` }
      }),
      {
        ...authEnv,
        GITHUB_CLIENT_ID: 'github-client',
        GITHUB_CLIENT_SECRET: 'github-secret',
        GITHUB_OAUTH_CALLBACK_URL: 'https://worker.example/admin/auth/callback',
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Set-Cookie'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GitHub OAuth callback rejects an invalid state without contacting GitHub', async () => {
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('GitHub should not be contacted');
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/auth/callback?code=oauth-code&state=wrong', {
        headers: { Cookie: 'littlables_oauth_state=expected' }
      }),
      {
        ...authEnv,
        GITHUB_CLIENT_ID: 'github-client',
        GITHUB_CLIENT_SECRET: 'github-secret',
        GITHUB_OAUTH_CALLBACK_URL: 'https://worker.example/admin/auth/callback',
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    assert.equal(response.status, 400);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin logout clears the session and requires a same-origin request', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/admin/logout', {
      method: 'POST',
      headers: { Origin: 'https://worker.example' }
    }),
    {}
  );
  const crossOrigin = await worker.fetch(
    new Request('https://worker.example/admin/logout', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' }
    }),
    {}
  );
  assert.equal(response.status, 303);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(crossOrigin.status, 403);
});

test('public feed API reads saved Supabase stories, not a live feed provider', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (input, options) => {
    requested = new URL(String(input));
    assert.equal(options.headers.apikey, 'service-secret');
    return Response.json([{
      provider: 'gnews',
      category: 'childcare',
      title: 'Family update',
      article_url: 'https://publisher.example/family',
      approved: true,
      published_at: '2026-10-17T12:00:00Z'
    }]);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/feed?category=childcare'),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret',
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requested.pathname, '/rest/v1/news_stories');
    assert.equal(requested.searchParams.get('approved'), 'eq.true');
    assert.equal(result.items[0].link, 'https://publisher.example/family');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin approval route updates only a pending story after same-origin check', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  let update;
  globalThis.fetch = async (input, options) => {
    requested = new URL(String(input));
    update = JSON.parse(options.body);
    return Response.json([{ id: 12 }]);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/12/approve', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: (await adminCookie()).split(';')[0] }
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    assert.equal(response.status, 200);
    assert.equal(requested.searchParams.get('id'), 'eq.12');
    assert.equal(requested.searchParams.get('approved'), 'eq.false');
    assert.equal(update.approved, true);
    assert.equal(update.approved_by, 'littlables');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin approval route rejects cross-origin approval attempts', async () => {
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('should not be called');
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/12/approve', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
          Cookie: (await adminCookie()).split(';')[0]
        }
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    assert.equal(response.status, 403);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider update ingests all configured GNews categories and writes status', async () => {
  const originalFetch = globalThis.fetch;
  const apiCalls = [];
  const savedRows = [];
  const date = new Date().toISOString();
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'gnews.io') {
      apiCalls.push(url.searchParams.get('q') || url.searchParams.get('category'));
      assert.equal(options.headers['X-Api-Key'], 'gnews-secret');
      assert.equal(url.searchParams.has('apikey'), false);
      return Response.json({
        articles: [{
          title: 'Test story',
          description: 'Test story description.',
          content: 'Test story article excerpt.',
          url: `https://publisher.example/${encodeURIComponent(url.searchParams.get('q') || url.searchParams.get('category'))}`,
          image: 'https://images.example/test.jpg',
          publishedAt: date,
          source: { name: 'Example' }
        }]
      });
    }
    if (url.pathname.endsWith('/rpc/claim_news_provider_sync')) return Response.json(true);
    if (url.pathname.endsWith('/news_stories')) {
      savedRows.push(...JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith('/news_provider_sync')) return new Response(null, { status: 204 });
    throw new Error(`Unexpected fetch: ${url.href}`);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/providers/gnews/update', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: (await adminCookie()).split(';')[0] }
      }),
      {
        ...authEnv,
        GNEWS_API_KEY: 'gnews-secret',
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret',
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.status, 'succeeded');
    assert.equal(result.storiesSaved, 7);
    assert.equal(apiCalls.length, 7);
    assert.equal(savedRows.length, 7);
    assert.deepEqual(new Set(savedRows.map(row => row.category)), new Set([
      'all', 'childcare', 'animals', 'arts', 'tech', 'world', 'uplifting'
    ]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
