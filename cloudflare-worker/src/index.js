import { getAdminLoginPage, getAdminPage } from './admin-page.mjs';
import { getNewsFeed, getNewsProviders } from './news-feeds.mjs';
import { getNewsProviderConfig, NEWS_CATEGORIES } from './news-provider-config.mjs';
import {
  clearAdminSessionCookie,
  clearOAuthStateCookie,
  createAdminSessionCookie,
  createOAuthState,
  createOAuthStateCookie,
  getAdminIdentity,
  getOAuthState,
  isSameOrigin
} from './github-auth.mjs';
import {
  claimNewsProviderSync,
  finishNewsProviderSync,
  approveNewsStory,
  createApprovedCustomNewsStory,
  banNewsStory,
  disapproveNewsStory,
  getNewsAdminSnapshot,
  getStoredNewsFeed,
  undoNewsStoryDecision,
  updateNewsStory,
  upsertNewsStories
} from './news-storage.mjs';

const MAX_REQUEST_BYTES = 16_000;
const MAX_PAGE_BYTES = 1_000_000;
const MAX_PAGE_TEXT = 16_000;
const MAX_REDIRECTS = 4;
const MODEL = '@cf/meta/llama-3.2-3b-instruct';
const ADMIN_MARKET = 'en-US';
const NEWS_CATEGORY_SET = new Set(NEWS_CATEGORIES);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function serveNewsFeed(request, env) {
  const url = new URL(request.url);
  try {
    const limit = await env.SUMMARY_RATE_LIMITER.limit({
      key: request.headers.get('CF-Connecting-IP') || 'unknown'
    });
    if (!limit.success) return jsonResponse({ error: 'News feed request rate limit exceeded' }, 429);

    const category = url.searchParams.get('category') || 'all';
    if (!NEWS_CATEGORY_SET.has(category)) return jsonResponse({ error: 'Unknown news category' }, 400);
    const feed = await getStoredNewsFeed(env, category);
    return jsonResponse(feed);
  } catch (err) {
    console.error('News feed request failed:', err);
    const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 502;
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unable to load news feed' }, status);
  }
}

async function updateNewsProvider(provider, updatedBy, env) {
  const config = getNewsProviderConfig(provider);
  if (!config) return jsonResponse({ error: 'Unknown news provider' }, 404);
  if (config.credential && !env[config.credential]) {
    return jsonResponse({
      error: `${config.label} is not configured. Set the ${config.credential} Worker secret.`
    }, 503);
  }

  const claimed = await claimNewsProviderSync(env, provider, updatedBy);
  if (!claimed) {
    return jsonResponse({ error: `${provider} is already being updated` }, 409);
  }

  let storiesSaved = 0;
  const errors = [];
  try {
    for (const [index, category] of Object.keys(config.categories).entries()) {
      if (index > 0) await new Promise(resolve => setTimeout(resolve, config.updatePauseMs));
      try {
        const feed = await getNewsFeed(provider, category, ADMIN_MARKET, {
          credentials: env,
          cache: false
        });
        const stories = feed.items.slice(0, 10);
        await upsertNewsStories(env, provider, category, stories);
        storiesSaved += stories.length;
      } catch (err) {
        const message = `${category}: ${err instanceof Error ? err.message : 'Unknown provider error'}`;
        console.error(`News provider update failed for ${provider}/${category}:`, err);
        errors.push(message);
      }
    }

    const status = errors.length === 0 ? 'succeeded' : storiesSaved > 0 ? 'partial' : 'failed';
    const errorMessage = errors.length ? errors.join('; ').slice(0, 2000) : null;
    await finishNewsProviderSync(env, provider, { status, storiesSaved, error: errorMessage });
    return jsonResponse({ provider, status, storiesSaved, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown provider update error';
    try {
      await finishNewsProviderSync(env, provider, { status: 'failed', storiesSaved, error: message });
    } catch (saveError) {
      console.error(`Could not save failed status for ${provider}:`, saveError);
    }
    throw err;
  }
}

function authConfigurationIsValid(env) {
  return env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET &&
    env.GITHUB_ALLOWED_USER &&
    env.GITHUB_OAUTH_CALLBACK_URL &&
    env.GITHUB_SESSION_SECRET;
}

function adminAuthError(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function beginGitHubLogin(request, env) {
  if (!authConfigurationIsValid(env)) {
    console.error('GitHub admin authentication is not fully configured');
    return adminAuthError('GitHub admin authentication is not configured', 503);
  }
  const limit = await env.SUMMARY_RATE_LIMITER.limit({
    key: `github-auth:${request.headers.get('CF-Connecting-IP') || 'unknown'}`
  });
  if (!limit.success) return adminAuthError('Too many sign-in attempts; try again later', 429);

  const state = createOAuthState();
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.GITHUB_OAUTH_CALLBACK_URL);
  authorizeUrl.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': createOAuthStateCookie(state),
      'Cache-Control': 'no-store'
    }
  });
}

async function completeGitHubLogin(request, env) {
  const url = new URL(request.url);
  const sentState = url.searchParams.get('state');
  const storedState = getOAuthState(request);
  if (!sentState || !storedState || sentState !== storedState) {
    return adminAuthError('GitHub sign-in could not be verified. Please try again.', 400);
  }
  if (url.searchParams.has('error') || !url.searchParams.get('code')) {
    return adminAuthError('GitHub sign-in was cancelled or did not complete.', 400);
  }
  if (!authConfigurationIsValid(env)) {
    console.error('GitHub admin authentication is not fully configured');
    return adminAuthError('GitHub admin authentication is not configured', 503);
  }
  const limit = await env.SUMMARY_RATE_LIMITER.limit({
    key: `github-auth:${request.headers.get('CF-Connecting-IP') || 'unknown'}`
  });
  if (!limit.success) return adminAuthError('Too many sign-in attempts; try again later', 429);

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Littlables-News-Admin'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: url.searchParams.get('code'),
        redirect_uri: env.GITHUB_OAUTH_CALLBACK_URL
      })
    });
    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange failed (HTTP ${tokenResponse.status})`);
    }
    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
      throw new Error('GitHub did not return an access token');
    }
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Littlables-News-Admin',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!userResponse.ok) throw new Error(`GitHub account lookup failed (HTTP ${userResponse.status})`);
    const user = await userResponse.json();
    if (
      typeof user.login !== 'string' ||
      user.login.toLowerCase() !== env.GITHUB_ALLOWED_USER.toLowerCase()
    ) {
      return adminAuthError('This GitHub account is not allowed to administer this site.', 403);
    }

    const headers = new Headers({
      Location: new URL('/admin', url.origin).toString(),
      'Cache-Control': 'no-store'
    });
    headers.append('Set-Cookie', await createAdminSessionCookie(user.login, env.GITHUB_SESSION_SECRET));
    headers.append('Set-Cookie', clearOAuthStateCookie());
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error('GitHub admin sign-in failed:', error);
    return adminAuthError('GitHub sign-in failed. Please try again.', 502);
  }
}

async function serveAdmin(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/admin/auth/login' && request.method === 'GET') {
    return beginGitHubLogin(request, env);
  }
  if (url.pathname === '/admin/auth/callback' && request.method === 'GET') {
    return completeGitHubLogin(request, env);
  }
  if (url.pathname === '/admin/logout' && request.method === 'POST') {
    if (!isSameOrigin(request)) return jsonResponse({ error: 'Logout must be requested from the admin origin' }, 403);
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL('/admin', url.origin).toString(),
        'Set-Cookie': clearAdminSessionCookie(),
        'Cache-Control': 'no-store'
      }
    });
  }
  let identity;
  try {
    identity = await getAdminIdentity(request, env);
  } catch (error) {
    console.error('GitHub admin session validation failed:', error);
    return adminAuthError('GitHub admin authentication is not configured', 503);
  }

  if (request.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
    if (!identity) {
      return new Response(getAdminLoginPage(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
        }
      });
    }
    return new Response(getAdminPage(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; connect-src 'self'; img-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      }
    });
  }
  if (!identity) return jsonResponse({ error: 'GitHub authentication is required' }, 401);
  if (url.pathname === '/admin/api/identity' && request.method === 'GET') {
    return jsonResponse({ login: identity.login });
  }
  if (url.pathname === '/admin/api/status' && request.method === 'GET') {
    try {
      return jsonResponse(await getNewsAdminSnapshot(env, getNewsProviders(env)));
    } catch (err) {
      console.error('News admin status request failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not load news admin status' }, 502);
    }
  }

  if (url.pathname === '/admin/api/preview' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Page previews must be requested from the admin origin' }, 403);
    }
    try {
      const contentLength = Number(request.headers.get('Content-Length') || 0);
      if (contentLength > 4_000) return jsonResponse({ error: 'Preview request is too large' }, 413);
      const bodyText = await request.text();
      if (bodyText.length > 4_000) return jsonResponse({ error: 'Preview request is too large' }, 413);
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch {
        return jsonResponse({ error: 'Preview request must be valid JSON' }, 400);
      }
      if (typeof body.url !== 'string' || body.url.length > 2_000 || !isPublicWebUrl(body.url)) {
        return jsonResponse({ error: 'Enter a public HTTP or HTTPS article URL' }, 400);
      }
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin-preview:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Preview rate limit exceeded' }, 429);
      const page = await fetchPublicPage(body.url);
      const metadata = extractPageMetadata(page.content, page.url);
      return jsonResponse(metadata);
    } catch (err) {
      console.error('Custom article preview failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not parse this article page' }, 502);
    }
  }

  if (url.pathname === '/admin/api/summary' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Summary generation must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await readAdminStoryPayload(request);
      if (payload instanceof Response) return payload;
      if (!env.AI) return jsonResponse({ error: 'Workers AI is not configured for this Worker' }, 503);
      if (!env.SUMMARY_RATE_LIMITER) {
        return jsonResponse({ error: 'Summary rate limiter is not configured for this Worker' }, 503);
      }
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin-summary:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Summary generation rate limit exceeded' }, 429);
      return jsonResponse({ summary: await generateAdminSummary(payload, env) });
    } catch (err) {
      console.error('Admin AI summary generation failed:', err);
      return jsonResponse({
        error: err instanceof Error ? err.message : 'Could not generate an AI summary'
      }, 502);
    }
  }

  if (url.pathname === '/admin/api/stories' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Story publishing must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await readAdminStoryPayload(request);
      if (payload instanceof Response) return payload;
      const id = await createApprovedCustomNewsStory(env, payload, identity.login);
      return jsonResponse({ id, approved: true });
    } catch (err) {
      console.error('Custom story publishing failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not publish custom story' }, 502);
    }
  }

  const storyEditMatch = url.pathname.match(/^\/admin\/api\/stories\/(\d+)$/);
  if (storyEditMatch && request.method === 'PATCH') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Story updates must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await readAdminStoryPayload(request);
      if (payload instanceof Response) return payload;
      const updated = await updateNewsStory(env, storyEditMatch[1], payload);
      if (!updated) return jsonResponse({ error: 'Story was not found' }, 404);
      return jsonResponse({ id: Number(storyEditMatch[1]), updated: true });
    } catch (err) {
      console.error('News story detail update failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update story details' }, 502);
    }
  }

  const approvalMatch = url.pathname.match(/^\/admin\/api\/stories\/(\d+)\/approve$/);
  if (approvalMatch && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Story approval must be requested from the admin origin' }, 403);
    }
    try {
      const approved = await approveNewsStory(env, approvalMatch[1], identity.login);
      if (!approved) return jsonResponse({ error: 'Story was not found or is already approved' }, 404);
      return jsonResponse({ id: Number(approvalMatch[1]), approved: true });
    } catch (err) {
      console.error('News story approval failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not approve story' }, 502);
    }
  }

  const decisionMatch = url.pathname.match(/^\/admin\/api\/stories\/(\d+)\/(disapprove|ban|undo)$/);
  if (decisionMatch && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Story decision must be requested from the admin origin' }, 403);
    }
    try {
      const [, storyId, action] = decisionMatch;
      const changed = action === 'disapprove'
        ? await disapproveNewsStory(env, storyId, identity.login)
        : action === 'ban'
          ? await banNewsStory(env, storyId, identity.login)
          : await undoNewsStoryDecision(env, storyId, identity.login);
      if (!changed) return jsonResponse({ error: 'Story was not found or its decision has changed' }, 404);
      return jsonResponse({ id: Number(storyId), action });
    } catch (err) {
      console.error(`News story ${decisionMatch[2]} failed:`, err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update story decision' }, 502);
    }
  }

  const updateMatch = url.pathname.match(/^\/admin\/api\/providers\/([a-z0-9-]+)\/update$/);
  if (updateMatch && request.method === 'POST') {
    try {
      if (!isSameOrigin(request)) {
        return jsonResponse({ error: 'Provider updates must be requested from the admin origin' }, 403);
      }
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Admin update rate limit exceeded' }, 429);
      return await updateNewsProvider(updateMatch[1], identity.login, env);
    } catch (err) {
      console.error('News admin provider update failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update news provider' }, 502);
    }
  }
  if (url.pathname.startsWith('/admin/api/')) {
    return jsonResponse({ error: 'Admin API route not found' }, 404);
  }
  return jsonResponse({ error: 'Admin route not found' }, 404);
}

async function readAdminStoryPayload(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: 'Story details are too large' }, 413);
  }
  const bodyText = await request.text();
  if (bodyText.length > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: 'Story details are too large' }, 413);
  }
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: 'Story details must be valid JSON' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Story details must be an object' }, 400);
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const link = typeof body.link === 'string' ? body.link.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const aiSummary = typeof body.aiSummary === 'string' ? body.aiSummary.trim() : '';
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const pubDate = typeof body.pubDate === 'string' ? body.pubDate.trim() : '';

  if (!title || title.length > 500) {
    return jsonResponse({ error: 'A title of 1-500 characters is required' }, 400);
  }
  if (!isPublicWebUrl(link) || link.length > 2_000) {
    return jsonResponse({ error: 'Enter a public HTTP or HTTPS article URL' }, 400);
  }
  if (image && (!isPublicWebUrl(image) || image.length > 2_000)) {
    return jsonResponse({ error: 'Image must be a public HTTP or HTTPS URL' }, 400);
  }
  if (!NEWS_CATEGORY_SET.has(category)) {
    return jsonResponse({ error: 'Select a valid story category' }, 400);
  }
  if (description.length > 4_000 || content.length > 4_000 || aiSummary.length > 4_000 || source.length > 500) {
    return jsonResponse({ error: 'A story field exceeds its maximum length' }, 400);
  }
  if (pubDate && !Number.isFinite(Date.parse(pubDate))) {
    return jsonResponse({ error: 'Enter a valid publication date' }, 400);
  }

  return {
    title,
    link: new URL(link).href,
    image: image ? new URL(image).href : '',
    description,
    content,
    aiSummary,
    pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    source: source || new URL(link).hostname.replace(/^www\./i, ''),
    category
  };
}

function isPublicWebUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) return false;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  ) return false;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (
      ipv4.slice(1).some(part => Number(part) > 255) ||
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) return false;
  }

  return true;
}

async function fetchPublicPage(value) {
  let currentUrl = value;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!isPublicWebUrl(currentUrl)) throw new Error('The page URL is not allowed');
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
        'User-Agent': 'LittlablesSummaryBot/1.0'
      }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location || redirects === MAX_REDIRECTS) throw new Error('Too many redirects while loading an article');
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    if (!response.ok) throw new Error(`Article page request failed (HTTP ${response.status})`);

    const contentType = response.headers.get('Content-Type') || '';
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      throw new Error('Article URL did not return readable text');
    }
    const contentLength = Number(response.headers.get('Content-Length') || 0);
    if (contentLength > MAX_PAGE_BYTES) throw new Error('Article page is too large');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Article page had no readable response body');
    const chunks = [];
    let byteCount = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      byteCount += chunk.byteLength;
      if (byteCount > MAX_PAGE_BYTES) {
        await reader.cancel();
        throw new Error('Article page is too large');
      }
      chunks.push(chunk);
    }

    const bytes = new Uint8Array(byteCount);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { url: currentUrl, content: new TextDecoder().decode(bytes) };
  }
  throw new Error('Could not load article page');
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(parseInt(code, 16)));
}

function decodeCodePoint(codePoint) {
  return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
}

function getHtmlAttributes(tag) {
  const attributes = new Map();
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function extractPageMetadata(html, pageUrl) {
  const metadata = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = getHtmlAttributes(match[0]);
    const name = (attributes.get('property') || attributes.get('name') || '').toLowerCase();
    const content = attributes.get('content');
    if (name && content && !metadata.has(name)) metadata.set(name, decodeHtml(content).trim());
  }
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = metadata.get('og:title') ||
    metadata.get('twitter:title') ||
    (titleTag ? extractPageText(titleTag[1]) : '');
  const description = metadata.get('og:description') ||
    metadata.get('twitter:description') ||
    metadata.get('description') ||
    '';
  const imageValue = metadata.get('og:image') || metadata.get('twitter:image') || '';
  let image = '';
  try {
    const candidate = new URL(imageValue, pageUrl).href;
    if (isPublicWebUrl(candidate)) image = candidate;
  } catch {}
  const publishedAt = metadata.get('article:published_time') ||
    metadata.get('og:published_time') ||
    metadata.get('date') ||
    '';
  return {
    title: title.slice(0, 500),
    description: description.slice(0, 2_000),
    image,
    link: pageUrl,
    source: new URL(pageUrl).hostname.replace(/^www\./i, ''),
    pubDate: Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : ''
  };
}

function extractPageText(html) {
  const text = decodeHtml(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/(p|div|article|section|li|h[1-6]|br|tr)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, MAX_PAGE_TEXT);
}

function isReadableArticleText(text) {
  return text.length >= 120 &&
    !/\b(?:enable javascript|verify you are human|access denied|request blocked|checking your browser|robot or human)\b/i.test(text);
}

async function generateAdminSummary(story, env) {
  const suppliedText = [story.description, story.content]
    .map(value => extractPageText(decodeHtml(value)))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_PAGE_TEXT);
  let articleText = '';
  try {
    const page = await fetchPublicPage(story.link);
    const scrapedText = extractPageText(page.content);
    if (isReadableArticleText(scrapedText)) articleText = scrapedText;
  } catch (err) {
    console.warn(`Could not scrape article while preparing admin summary ${story.link}:`, err);
  }
  const summarySourceText = [
    suppliedText ? `Current edited story details:\n${suppliedText}` : '',
    articleText ? `Scraped article content:\n${articleText}` : ''
  ].filter(Boolean).join('\n\n').slice(0, MAX_PAGE_TEXT);
  if (summarySourceText.replace(/\s+/g, ' ').trim().length < 40) {
    throw new Error('Add more story description or source content before generating a summary');
  }

  let generated;
  try {
    generated = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content: 'Write one accurate, neutral paragraph summarizing the supplied news article. Use only facts in the provided material. Do not add a headline, preamble, bullets, or unsupported claims.'
        },
        {
          role: 'user',
          content: `Article title: ${story.title}\nPublisher: ${story.source}\n\nCurrent article URL: ${story.link}\n\n${summarySourceText}`
        }
      ],
      max_tokens: 220,
      temperature: 0.2
    });
  } catch (err) {
    console.error('Workers AI summary generation failed:', err);
    const details = err instanceof Error ? `: ${err.message.slice(0, 250)}` : '';
    throw new Error(`Workers AI could not generate the summary${details}`);
  }
  const summary = typeof generated?.response === 'string'
    ? generated.response.trim().replace(/\s*\n+\s*/g, ' ')
    : '';
  if (!summary) throw new Error('Workers AI returned an empty summary. Try again or revise the story details.');
  return summary.slice(0, 4_000);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const pathname = new URL(request.url).pathname;
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return serveAdmin(request, env);
    }
    if (request.method === 'GET' && new URL(request.url).pathname === '/feed') {
      return serveNewsFeed(request, env);
    }
    return jsonResponse({ error: 'Route not found' }, 404);
  }
};
