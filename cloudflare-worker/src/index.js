import { resolveGoogleNewsUrls } from './google-news-resolver.mjs';

const MAX_REQUEST_BYTES = 16_000;
const MAX_LINKS = 10;
const MAX_PAGE_BYTES = 1_000_000;
const MAX_PAGE_TEXT = 16_000;
const MAX_REDIRECTS = 4;
const SUMMARY_TABLE = 'ai_summaries';
const MODEL = '@cf/meta/llama-3.1-8b-instruct';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
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

function collectStoryUrls(description, articleUrl) {
  const links = [];
  if (isPublicWebUrl(articleUrl)) links.push(articleUrl);

  const linkPattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
  for (const match of description.matchAll(linkPattern)) {
    const value = decodeHtml(match[1] || match[2] || match[3] || '');
    try {
      const url = new URL(value, articleUrl).href;
      if (isPublicWebUrl(url) && !links.includes(url)) links.push(url);
    } catch {
      continue;
    }
  }
  return links;
}

async function resolveStoryUrls(urls) {
  return resolveGoogleNewsUrls(urls, { isAllowedUrl: isPublicWebUrl });
}

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    'Content-Type': 'application/json'
  };
}

function supabaseUrl(env, query) {
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${SUMMARY_TABLE}?${query}`;
}

async function findSavedSummary(env, articleUrl, language) {
  const query = new URLSearchParams({
    article_url: `eq.${articleUrl}`,
    language: `eq.${language}`,
    select: 'summary',
    limit: '1'
  });
  const response = await fetch(supabaseUrl(env, query), { headers: supabaseHeaders(env) });
  if (!response.ok) throw new Error(`Summary database lookup failed (HTTP ${response.status})`);
  const rows = await response.json();
  return rows[0]?.summary || null;
}

async function saveSummary(env, articleUrl, language, summary) {
  const response = await fetch(supabaseUrl(env, 'on_conflict=article_url%2Clanguage'), {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env),
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify({ article_url: articleUrl, language, summary })
  });
  if (!response.ok) throw new Error(`Summary database save failed (HTTP ${response.status})`);
}

async function summarize(request, env) {
  const requestSize = Number(request.headers.get('Content-Length') || 0);
  if (requestSize > MAX_REQUEST_BYTES) return jsonResponse({ error: 'Request is too large' }, 413);

  const reader = request.body?.getReader();
  if (!reader) return jsonResponse({ error: 'Request body is required' }, 400);
  const requestChunks = [];
  let actualRequestSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    actualRequestSize += value.byteLength;
    if (actualRequestSize > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return jsonResponse({ error: 'Request is too large' }, 413);
    }
    requestChunks.push(value);
  }
  const requestBytes = new Uint8Array(actualRequestSize);
  let requestOffset = 0;
  for (const chunk of requestChunks) {
    requestBytes.set(chunk, requestOffset);
    requestOffset += chunk.byteLength;
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(requestBytes));
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
  }

  const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 500) : '';
  const description = typeof payload.description === 'string' ? payload.description.slice(0, 12_000) : '';
  const articleUrl = typeof payload.articleUrl === 'string' ? payload.articleUrl : '';
  const language = typeof payload.language === 'string' && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(payload.language)
    ? payload.language
    : 'en';
  if (!title || !isPublicWebUrl(articleUrl)) {
    return jsonResponse({ error: 'A title and public HTTP(S) article URL are required' }, 400);
  }
  if (!env.AI || !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return jsonResponse({ error: 'AI or summary database service is not configured' }, 503);
  }

  try {
    const limit = await env.SUMMARY_RATE_LIMITER.limit({
      key: request.headers.get('CF-Connecting-IP') || 'unknown'
    });
    if (!limit.success) return jsonResponse({ error: 'Summary request rate limit exceeded' }, 429);

    const storyUrls = collectStoryUrls(description, articleUrl);
    if (storyUrls.length > MAX_LINKS) {
      return jsonResponse({ error: `Articles may include at most ${MAX_LINKS} linked sources` }, 413);
    }
    const { urls: publisherUrls, failedUrls } = await resolveStoryUrls(storyUrls);
    const resolutionError = failedUrls.length
      ? `${failedUrls.length} article link${failedUrls.length === 1 ? '' : 's'} could not be resolved to publisher URLs`
      : null;
    for (const url of failedUrls) {
      console.warn(`Could not resolve Google News article URL: ${url}`);
    }
    if (!publisherUrls.length) {
      return jsonResponse({
        error: resolutionError || 'Could not resolve any article links to publisher URLs',
        unresolvedUrls: failedUrls
      }, 502);
    }

    const primaryArticleUrl = publisherUrls[0];
    const savedSummary = await findSavedSummary(env, primaryArticleUrl, language);
    if (savedSummary) {
      return jsonResponse({
        summary: savedSummary,
        cached: true,
        ...(resolutionError ? { error: resolutionError, unresolvedUrls: failedUrls } : {})
      });
    }

    const pages = await Promise.all(publisherUrls.map(async url => {
      try {
        const page = await fetchPublicPage(url);
        const text = extractPageText(page.content);
        return text ? { url: page.url, text } : null;
      } catch (err) {
        console.warn(`Unable to read article source ${url}:`, err);
        return null;
      }
    }));
    const sourceText = pages.filter(Boolean)
      .map((page, index) => `Source ${index + 1} (${page.url}):\n${page.text}`)
      .join('\n\n');
    if (!sourceText) {
      return jsonResponse({ error: 'Could not retrieve readable content from the article links' }, 502);
    }

    const generated = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content: `Write one accurate, neutral paragraph summarizing the supplied news article content in ${language}. Use only facts from the sources. Do not add a headline, preamble, bullets, or claims that are not supported by the sources.`
        },
        {
          role: 'user',
          content: `Article title: ${title}\n\nArticle sources:\n${sourceText}`
        }
      ],
      max_tokens: 220,
      temperature: 0.2
    });
    const summary = typeof generated?.response === 'string'
      ? generated.response.trim().replace(/\s*\n+\s*/g, ' ')
      : '';
    if (!summary) throw new Error('Workers AI returned an empty summary');

    await saveSummary(env, primaryArticleUrl, language, summary);
    return jsonResponse({
      summary,
      cached: false,
      ...(resolutionError ? { error: resolutionError, unresolvedUrls: failedUrls } : {})
    });
  } catch (err) {
    console.error('AI summary request failed:', err);
    return jsonResponse({ error: 'Unable to generate or save the article summary' }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    return summarize(request, env);
  }
};
