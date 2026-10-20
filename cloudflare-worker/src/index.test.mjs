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
  assert.match(page, /Disapprove/);
  assert.match(page, /Ignore/);
  assert.match(page, /Ban/);
  assert.match(page, /Undo/);
  assert.match(page, /Banned stories/);
  assert.match(page, /id="custom-link"/);
  assert.match(page, /id="approval-provider"/);
  assert.match(page, /All providers/);
  assert.match(page, /story\.provider === state\.activeProvider/);
  assert.match(page, /'\?provider=' \+ encodeURIComponent\(state\.activeProvider\)/);
  assert.match(page, /providerFilterEl\.addEventListener\('change', \(\) => \{\s*state\.activeProvider = providerFilterEl\.value;\s*refreshData\(\);/);
  assert.match(page, /textContent = state\.busy\.has\(provider\.id\) \? 'Updating…' : 'Update'/);
  assert.match(page, /id="providers-toggle"[^>]*aria-expanded="false" aria-controls="providers"/);
  assert.match(page, /id="providers" class="providers"[^>]*hidden/);
  assert.match(page, /providersEl\.hidden = !expanded/);
  assert.match(page, /preview-dialog/);
  assert.match(page, /Add to approved stories/);
  assert.match(page, /Save &amp; approve|Save & approve/);
  assert.match(page, /openStoryPreview\(story\)/);
  assert.match(page, /AI summary source content/);
  assert.match(page, /editableField\(aiSummary, 'aiSummary', 'AI summary'/);
  assert.match(page, /Generate AI summary/);
  assert.match(page, /Generate AI image/);
  assert.match(page, /generatePreviewImage/);
  assert.match(page, /Total stories saved:/);
  assert.match(page, /Childcare & Family/);
  assert.match(page, /Future Tech & AI/);
  assert.match(page, /meta-provider/);
  assert.match(page, /meta-domain/);
  assert.match(page, /Last updated:/);
  assert.match(page, /formatElapsed/);
  assert.match(page, /status-succeeded/);
  assert.match(page, /provider-setup/);
  assert.match(page, /Set Worker secret/);
  assert.match(page, /Topics:/);
  assert.match(page, /between topic requests/);
  assert.match(page, /History/);
  assert.match(page, /id="history-categories"/);
  assert.match(page, /id="history-provider"/);
  assert.match(page, /decisions-toggle/);
  assert.match(page, /aria-expanded="false" aria-controls="stories"/);
  assert.match(page, /aria-expanded="false" aria-controls="banned-stories"/);
  assert.ok(page.indexOf('Saved story records:') < page.indexOf('id="providers-title"'));
  assert.ok(page.indexOf('id="custom-title"') < page.indexOf('id="providers-title"'));
  assert.match(page, /const PAGE_SIZE_OPTIONS = \[5, 10, 20, 50, 100\];/);
  assert.match(page, /littlables_admin_section_order_v1/);
  assert.match(page, /littlables_admin_collapsed_v1/);
  assert.match(page, /lockModalScroll\(\)/);
  assert.match(page, /closeInlineEditor\(\)/);
  assert.doesNotMatch(page, /Close preview/);
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

test('admin status rejects unknown provider filters', async () => {
  const cookie = await adminCookie();
  const response = await worker.fetch(
    new Request('https://worker.example/admin/api/status?provider=unknown', {
      headers: { Cookie: cookie.split(';')[0] }
    }),
    authEnv
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Unknown news provider' });
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

test('public feed API reads approved and unapproved stories while excluding banned stories', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const requested = new URL(String(input));
    requests.push(requested);
    assert.equal(options.headers.apikey, 'service-secret');
    if (requested.searchParams.get('approved') === 'eq.false') {
      return Response.json([{
        provider: 'gnews',
        category: 'childcare',
        title: 'Unapproved family update',
        article_url: 'https://publisher.example/unapproved',
        approved: false,
        published_at: '2026-10-17T11:00:00Z'
      }]);
    }
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
    assert.equal(requests.length, 2);
    assert.ok(requests.every(requested => requested.pathname === '/rest/v1/news_stories'));
    assert.ok(requests.every(requested => requested.searchParams.get('removed') === 'eq.false'));
    assert.deepEqual(new Set(requests.map(requested => requested.searchParams.get('approved'))), new Set(['eq.true', 'eq.false']));
    assert.equal(result.items[0].link, 'https://publisher.example/family');
    assert.equal(result.items[0].approved, true);
    assert.equal(result.items[1].approved, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom preview parses public article metadata for a homepage card', async () => {
  const originalFetch = globalThis.fetch;
  let fetched;
  globalThis.fetch = async (input, options) => {
    fetched = { url: String(input), options };
    return new Response(`<!doctype html>
      <html><head>
      <meta property="og:title" content="A &amp; B story">
      <meta name="description" content="A useful article description.">
      <meta property="og:image" content="/images/story.jpg">
      <meta property="article:published_time" content="2026-10-17T12:00:00Z">
      </head></html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/preview', {
        method: 'POST',
        headers: {
          Origin: 'https://worker.example',
          Cookie: (await adminCookie()).split(';')[0],
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: 'https://publisher.example/story' })
      }),
      {
        ...authEnv,
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    assert.equal(response.status, 200);
    assert.equal(fetched.url, 'https://publisher.example/story');
    assert.equal(fetched.options.redirect, 'manual');
    assert.deepEqual(await response.json(), {
      title: 'A & B story',
      description: 'A useful article description.',
      image: 'https://publisher.example/images/story.jpg',
      link: 'https://publisher.example/story',
      source: 'publisher.example',
      pubDate: '2026-10-17T12:00:00.000Z'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom preview rejects private URLs and cross-origin requests without fetching', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('Must not fetch');
  };
  try {
    const cookie = (await adminCookie()).split(';')[0];
    const privateUrl = await worker.fetch(
      new Request('https://worker.example/admin/api/preview', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: cookie },
        body: JSON.stringify({ url: 'http://127.0.0.1/admin' })
      }),
      authEnv
    );
    const crossOrigin = await worker.fetch(
      new Request('https://worker.example/admin/api/preview', {
        method: 'POST',
        headers: { Origin: 'https://attacker.example', Cookie: cookie },
        body: JSON.stringify({ url: 'https://publisher.example/story' })
      }),
      authEnv
    );
    assert.equal(privateUrl.status, 400);
    assert.equal(crossOrigin.status, 403);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin summary generates from current draft when article scraping fails', async () => {
  const originalFetch = globalThis.fetch;
  let aiInput;
  globalThis.fetch = async () => {
    throw new Error('publisher blocks automated access');
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/summary', {
        method: 'POST',
        headers: {
          Origin: 'https://worker.example',
          Cookie: (await adminCookie()).split(';')[0],
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Edited family story title',
          category: 'childcare',
          link: 'https://publisher.example/story',
          image: '',
          description: 'Edited description contains enough detail to create a useful neutral summary for our family news story.',
          content: 'This is the edited publisher source content that should be included in the request to the language model.',
          aiSummary: '',
          pubDate: '',
          source: 'Publisher'
        })
      }),
      {
        ...authEnv,
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: {
          run: async (model, input) => {
            aiInput = { model, input };
            return { response: 'Generated summary from edited details.' };
          }
        }
      }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { summary: 'Generated summary from edited details.' });
    assert.equal(aiInput.model, '@cf/meta/llama-3.2-3b-instruct');
    assert.match(aiInput.input.messages[1].content, /Edited family story title/);
    assert.match(aiInput.input.messages[1].content, /Edited description contains enough detail/);
    assert.match(aiInput.input.messages[1].content, /edited publisher source content/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin summary reports Workers AI failures clearly and enforces same-origin requests', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('page unavailable'); };
  const body = JSON.stringify({
    title: 'A story',
    category: 'all',
    link: 'https://publisher.example/story',
    image: '',
    description: 'A sufficiently long description with relevant story facts for creating a useful summary.',
    content: '',
    pubDate: '',
    source: 'Publisher'
  });
  try {
    const failed = await worker.fetch(
      new Request('https://worker.example/admin/api/summary', {
        method: 'POST',
        headers: {
          Origin: 'https://worker.example',
          Cookie: (await adminCookie()).split(';')[0],
          'Content-Type': 'application/json'
        },
        body
      }),
      {
        ...authEnv,
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: { run: async () => { throw new Error('model unavailable'); } }
      }
    );
    const rejected = await worker.fetch(
      new Request('https://worker.example/admin/api/summary', {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
          Cookie: (await adminCookie()).split(';')[0],
          'Content-Type': 'application/json'
        },
        body
      }),
      {
        ...authEnv,
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: { run: async () => ({ response: 'not called' }) }
      }
    );
    assert.equal(failed.status, 502);
    assert.match((await failed.json()).error, /Workers AI could not generate the summary/);
    assert.equal(rejected.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom story endpoint inserts an approved homepage story', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  let saved;
  globalThis.fetch = async (input, options) => {
    requested = { url: new URL(String(input)), options };
    saved = JSON.parse(options.body)[0];
    return Response.json([{ id: 25 }]);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories', {
        method: 'POST',
        headers: {
          Origin: 'https://worker.example',
          Cookie: (await adminCookie()).split(';')[0],
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Edited custom title',
          category: 'childcare',
          link: 'https://publisher.example/story',
          image: 'https://images.example/story.jpg',
          description: 'Edited description',
          content: 'Edited context',
          aiSummary: 'The saved AI brief.',
          pubDate: '',
          source: 'Publisher'
        })
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 25, approved: true });
    assert.equal(requested.url.pathname, '/rest/v1/news_stories');
    assert.equal(saved.provider, 'custom');
    assert.equal(saved.approved, true);
    assert.equal(saved.category, 'childcare');
    assert.equal(saved.title, 'Edited custom title');
    assert.equal(saved.image_url, 'https://images.example/story.jpg');
    assert.equal(saved.ai_summary, 'The saved AI brief.');
    assert.ok(Number.isFinite(Date.parse(saved.published_at)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('story edit endpoint updates card details without changing moderation state', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  let update;
  globalThis.fetch = async (input, options) => {
    requested = { url: new URL(String(input)), options };
    update = JSON.parse(options.body);
    return Response.json([{ id: 25 }]);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/25', {
        method: 'PATCH',
        headers: {
          Origin: 'https://worker.example',
          Cookie: (await adminCookie()).split(';')[0],
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Edited title',
          category: 'arts',
          link: 'https://publisher.example/updated',
          image: '',
          description: 'Description',
          content: 'Context',
          aiSummary: 'Edited AI brief',
          pubDate: '',
          source: 'Publisher'
        })
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    assert.equal(response.status, 200);
    assert.equal(requested.url.searchParams.get('id'), 'eq.25');
    assert.equal(requested.options.method, 'PATCH');
    assert.equal(update.title, 'Edited title');
    assert.equal(update.category, 'arts');
    assert.equal(update.ai_summary, 'Edited AI brief');
    assert.equal(Object.hasOwn(update, 'approved'), false);
    assert.equal(Object.hasOwn(update, 'removed'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('story publishing rejects unsafe links and cross-origin edits before saving', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('Supabase must not be called');
  };
  try {
    const cookie = (await adminCookie()).split(';')[0];
    const unsafe = await worker.fetch(
      new Request('https://worker.example/admin/api/stories', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Unsafe link',
          category: 'all',
          link: 'http://127.0.0.1/private',
          image: '',
          description: '',
          content: '',
          pubDate: '',
          source: ''
        })
      }),
      authEnv
    );
    const crossOrigin = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/25', {
        method: 'PATCH',
        headers: { Origin: 'https://attacker.example', Cookie: cookie, 'Content-Type': 'application/json' },
        body: '{}'
      }),
      authEnv
    );
    assert.equal(unsafe.status, 400);
    assert.equal(crossOrigin.status, 403);
    assert.equal(called, false);
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

test('admin ban route hides an unapproved story after same-origin check', async () => {
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
      new Request('https://worker.example/admin/api/stories/12/ban', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: (await adminCookie()).split(';')[0] }
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requested.searchParams.get('id'), 'eq.12');
    assert.equal(requested.searchParams.get('approved'), 'eq.false');
    assert.equal(requested.searchParams.get('removed'), 'eq.false');
    assert.equal(update.removed, true);
    assert.equal(update.decision_action, 'ban');
    assert.equal(update.removed_by, 'littlables');
    assert.equal(result.action, 'ban');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin ban route rejects cross-origin requests without updating Supabase', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('Supabase should not be called');
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/12/ban', {
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

test('admin disapprove route unapproves a story without banning it', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: new URL(String(input)), options });
    return requests.length === 1
      ? Response.json([{ id: 12, approved: true, removed: false }])
      : Response.json([{ id: 12 }]);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/12/disapprove', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: (await adminCookie()).split(';')[0] }
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requests[1].url.searchParams.get('approved'), 'eq.true');
    assert.equal(requests[1].url.searchParams.get('removed'), 'eq.false');
    const update = JSON.parse(requests[1].options.body);
    assert.equal(update.approved, false);
    assert.equal(update.removed, undefined);
    assert.equal(update.decision_action, 'disapprove');
    assert.equal(result.action, 'disapprove');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin undo route restores a story previous decision', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let update;
  globalThis.fetch = async (input, options = {}) => {
    requestCount += 1;
    if (requestCount === 1) {
      return Response.json([{
        id: 12,
        approved: false,
        removed: true,
        decision_action: 'ban',
        decision_at: '2026-10-17T12:00:00Z',
        previous_approved: false,
        previous_removed: false
      }]);
    }
    update = JSON.parse(options.body);
    return Response.json([{ id: 12 }]);
  };
  try {
    const response = await worker.fetch(
      new Request('https://worker.example/admin/api/stories/12/undo', {
        method: 'POST',
        headers: { Origin: 'https://worker.example', Cookie: (await adminCookie()).split(';')[0] }
      }),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret'
      }
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(requestCount, 2);
    assert.equal(update.approved, false);
    assert.equal(update.removed, false);
    assert.equal(update.decision_action, 'undo');
    assert.equal(result.action, 'undo');
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

      test('provider update reports missing credentials before claiming a run', async () => {
        const originalFetch = globalThis.fetch;
        let claimed = false;
        globalThis.fetch = async input => {
          const url = new URL(String(input));
          if (url.pathname.endsWith('/rpc/claim_news_provider_sync')) claimed = true;
          throw new Error(`Unexpected fetch: ${url.href}`);
        };
        try {
          const response = await worker.fetch(
            new Request('https://worker.example/admin/api/providers/newsdata/update', {
              method: 'POST',
              headers: { Origin: 'https://worker.example', Cookie: (await adminCookie()).split(';')[0] }
            }),
            {
              ...authEnv,
              SUPABASE_URL: 'https://supabase.example',
              SUPABASE_SECRET_KEY: 'service-secret',
              SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
            }
          );
          assert.equal(response.status, 503);
          assert.match((await response.json()).error, /NEWSDATA_API_KEY/);
          assert.equal(claimed, false);
        } finally {
          globalThis.fetch = originalFetch;
        }
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

test('admin ads API returns ads list and allows editing and creation', async () => {
  const cookie = (await adminCookie()).split(';')[0];
  
  // 1. GET /admin/api/ads
  const getResponse = await worker.fetch(
    new Request('https://worker.example/admin/api/ads', {
      headers: { Cookie: cookie }
    }),
    authEnv
  );
  assert.equal(getResponse.status, 200);
  const data = await getResponse.json();
  assert.ok(Array.isArray(data.ads));
  assert.ok(data.ads.length > 0);
  const firstAd = data.ads[0];

  // 2. PATCH /admin/api/ads/:id (edit an ad)
  const patchResponse = await worker.fetch(
    new Request(`https://worker.example/admin/api/ads/${encodeURIComponent(firstAd.id)}`, {
      method: 'PATCH',
      headers: {
        Origin: 'https://worker.example',
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Updated Test Ad Title',
        desc: 'Updated test ad description with more details.'
      })
    }),
    authEnv
  );
  assert.equal(patchResponse.status, 200);
  const patchData = await patchResponse.json();
  assert.equal(patchData.updated, true);
  assert.equal(patchData.ad.title, 'Updated Test Ad Title');

  // 3. POST /admin/api/ads (create new ad)
  const postResponse = await worker.fetch(
    new Request('https://worker.example/admin/api/ads', {
      method: 'POST',
      headers: {
        Origin: 'https://worker.example',
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Brand New Showcase Product',
        desc: 'Exciting learning product.',
        sponsor: 'Creator Labs',
        cta: 'Get Now →',
        category: 'childcare',
        network: 'Partner'
      })
    }),
    authEnv
  );
  assert.equal(postResponse.status, 200);
  const postData = await postResponse.json();
  assert.equal(postData.created, true);
  assert.equal(postData.ad.title, 'Brand New Showcase Product');
});

test('admin AI image endpoint creates a fun Littlables-themed prompt from story details and caches the generated image', async () => {
  const aiCalls = [];
  // Minimal valid JPEG header bytes in base64 (0xFF, 0xD8, 0xFF, 0xD9)
  const fakeJpegBase64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xd9));
  const cookie = (await adminCookie()).split(';')[0];

  const response = await worker.fetch(
    new Request('https://worker.example/admin/api/image', {
      method: 'POST',
      headers: {
        Origin: 'https://worker.example',
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Baby Sea Otters Learn to Juggle Shells at the Aquarium',
        category: 'animals',
        link: 'https://publisher.example/otters',
        image: '',
        description: 'Playful rescued sea otter pups practice dexterity with colorful seashells in a warm coastal habitat.',
        content: 'Caretakers introduced enrichment toys and shells to help the young otters build foraging skills.',
        aiSummary: 'Rescued sea otter pups are learning foraging skills through playful shell games.',
        pubDate: '2026-10-19T12:00:00Z',
        source: 'Ocean Wire'
      })
    }),
    {
      ...authEnv,
      SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) },
      AI: {
        run: async (model, input) => {
          aiCalls.push({ model, input });
          if (model === '@cf/meta/llama-3.2-3b-instruct') {
            return {
              response: 'Cheerful sea otter pups floating on cozy turquoise waves while juggling pastel seashells under warm sunlight.'
            };
          }
          return { image: fakeJpegBase64 };
        }
      }
    }
  );

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.image.startsWith('https://worker.example/ai-image?prompt='));
  assert.match(data.prompt, /Create a fun image based around the story details that fit the theme of Littlables/i);
  assert.match(data.prompt, /sea otter/i);
  assert.equal(aiCalls.length, 2);
  assert.equal(aiCalls[0].model, '@cf/meta/llama-3.2-3b-instruct');
  assert.match(aiCalls[0].input.messages[1].content, /Create a fun image based around these story details that fit the theme of Littlables/);
  assert.match(aiCalls[0].input.messages[1].content, /Baby Sea Otters Learn to Juggle Shells/);
  assert.equal(aiCalls[1].model, '@cf/black-forest-labs/flux-1-schnell');

  // Verify GET /ai-image serves the cached image without re-invoking AI
  const imageGetResponse = await worker.fetch(new Request(data.image), {});
  assert.equal(imageGetResponse.status, 200);
  assert.equal(imageGetResponse.headers.get('Content-Type'), 'image/jpeg');
  const servedBytes = new Uint8Array(await imageGetResponse.arrayBuffer());
  assert.deepEqual(Array.from(servedBytes), [0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(aiCalls.length, 2);
});

test('public feed and ads endpoints search stories and ads when custom topic keywords are used', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    const requested = new URL(String(input));
    requests.push(requested);
    assert.equal(options.headers.apikey, 'service-secret');
    if (requested.searchParams.get('approved') === 'eq.true') {
      return Response.json([{
        provider: 'gnews',
        category: 'animals',
        title: 'Playful Puppy Learns New Tricks',
        article_url: 'https://publisher.example/puppy-tricks',
        approved: true,
        published_at: '2026-10-19T12:00:00Z'
      }]);
    }
    return Response.json([]);
  };

  try {
    const feedRes = await worker.fetch(
      new Request('https://worker.example/feed?category=puppy'),
      {
        ...authEnv,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_SECRET_KEY: 'service-secret',
        SUMMARY_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    );
    assert.equal(feedRes.status, 200);
    const feedData = await feedRes.json();
    assert.equal(feedData.topic, 'puppy');
    assert.equal(feedData.items.length, 1);
    assert.equal(feedData.items[0].title, 'Playful Puppy Learns New Tricks');
    assert.ok(Array.isArray(feedData.ads));
    assert.ok(feedData.ads.length > 0);
    assert.ok(feedData.ads.some(ad => /puppy/i.test(ad.title + ' ' + ad.desc)));
    assert.equal(requests.length, 2);
    assert.ok(requests.every(req => req.searchParams.get('or')?.includes('title.ilike.*puppy*')));

    const adsRes = await worker.fetch(new Request('https://worker.example/ads?q=puppy'), {});
    assert.equal(adsRes.status, 200);
    const adsData = await adsRes.json();
    assert.ok(Array.isArray(adsData.ads));
    assert.ok(adsData.ads.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


