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
  resetNewsProviderSync,
  approveNewsStory,
  createApprovedCustomNewsStory,
  banNewsStory,
  disapproveNewsStory,
  getNewsAdminSnapshot,
  getStoredNewsFeed,
  getStoredKeywordNewsFeed,
  undoNewsStoryDecision,
  updateNewsStory,
  setStoryDisplayCategories,
  setStoryInterestKeywords,
  getStoriesByKeyword,
  getPersistedKeywordEmbeddings,
  OVERRIDABLE_CATEGORIES,
  effectiveDisplayCategories,
  upsertNewsStories,
  searchNewsStories,
  getProviderCooldownState,
  setProviderCooldownState,
  clearProviderCooldownState,
  getAutoSyncState,
  setAutoSyncState,
  recordNewsProviderFetchLog,
  getNewsProviderFetchLogs,
  clearNewsProviderFetchLogs,
  DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS,
  getAiCurationState,
  updateAiCurationConfig,
  runAiStoryCuration,
  bulkDecideNewsStories,
  recordEngagementEvent,
  STORIES_TABLE,
  supabaseHeaders,
  supabaseUrl
} from './news-storage.mjs';
import { getAds, getAdById, updateAd, createAd } from './ads-data.mjs';
import { syncAwin, getAwinAds } from './awin-sync.mjs';
import { validateStoryCategories } from './embedding-classifier.mjs';
import { getInterestKeyword, INTEREST_KEYWORDS } from './interest-keywords.mjs';
import { getNextSyncBatch, PAIRS_PER_RUN } from './staggered-sync.mjs';

const MAX_REQUEST_BYTES = 64_000;
const MAX_PAGE_BYTES = 1_000_000;
const MAX_PAGE_TEXT = 16_000;
const MAX_REDIRECTS = 4;
const MODEL = '@cf/meta/llama-3.2-3b-instruct';
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const FALLBACK_IMAGE_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
const MAX_IMAGE_CACHE_ENTRIES = 30;
const ADMIN_MARKET = 'en-US';
const NEWS_CATEGORY_SET = new Set(NEWS_CATEGORIES);
const imageMemoryCache = new Map();

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

async function handleEngagementEvent(request, env) {
  try {
    const body = await request.json();
    const result = await recordEngagementEvent(env, {
      url: body.url,
      title: body.title,
      category: body.category,
      eventType: body.eventType,
      sessionId: body.sessionId,
    });
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse({ ok: false, reason: 'bad-request' }, 400);
  }
}

async function serveNewsFeed(request, env) {
  const url = new URL(request.url);
  try {
    const limit = await env.SUMMARY_RATE_LIMITER.limit({
      key: request.headers.get('CF-Connecting-IP') || 'unknown'
    });
    if (!limit.success) return jsonResponse({ error: 'News feed request rate limit exceeded' }, 429);

    const rawCategory = (
      url.searchParams.get('category') ||
      url.searchParams.get('topic') ||
      url.searchParams.get('q') ||
      'all'
    ).trim();
    const normalizedCategory = rawCategory.toLowerCase();

    // Interest keyword feed (for custom boards). Keywords never appear as
    // categories; this is the dedicated read path for them.
    const keywordParam = (url.searchParams.get('keyword') || '').trim();
    if (keywordParam) {
      const kw = getInterestKeyword(keywordParam);
      if (!kw) return jsonResponse({ error: 'Unknown interest keyword' }, 400);
      const feed = await getStoriesByKeyword(env, kw.id);
      return jsonResponse({ ...feed, keyword: kw.id });
    }

    if (NEWS_CATEGORY_SET.has(normalizedCategory)) {
      const feed = await getStoredNewsFeed(env, normalizedCategory);
      return jsonResponse(feed);
    }

    const feed = await getStoredKeywordNewsFeed(env, rawCategory);
    const ads = getAds({ query: rawCategory });
    return jsonResponse({
      ...feed,
      topic: rawCategory,
      ads
    });
  } catch (err) {
    console.error('News feed request failed:', err);
    const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 502;
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unable to load news feed' }, status);
  }
}

function computeCooldownWindow(err) {
  const now = Date.now();
  let cooldownSeconds = null;
  if (Number.isFinite(err?.retryAfterSeconds) && err.retryAfterSeconds > 0) {
    cooldownSeconds = Math.ceil(err.retryAfterSeconds);
  } else if (err?.rateLimitReset) {
    const resetMs = Date.parse(err.rateLimitReset);
    if (Number.isFinite(resetMs) && resetMs > now) {
      cooldownSeconds = Math.ceil((resetMs - now) / 1000);
    }
  }
  if (!Number.isFinite(cooldownSeconds) || cooldownSeconds <= 0) {
    cooldownSeconds = DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS;
  }
  const boundedSeconds = Math.min(Math.max(cooldownSeconds, 30), 24 * 3600);
  const cooldownUntil = new Date(now + boundedSeconds * 1000).toISOString();
  return {
    cooldownSeconds: boundedSeconds,
    cooldownUntil,
    rateLimitResetAt: err?.rateLimitReset || cooldownUntil
  };
}

function selectFallbackProvider(failedProviderId, env, excluded = new Set()) {
  if (env?.DISABLE_PROVIDER_FAILOVER === 'true') return null;
  const allProviders = getNewsProviders(env);
  const candidates = allProviders.filter((p) => {
    if (p.id === failedProviderId || excluded.has(p.id)) return false;
    if (!p.configured) return false;
    if (getProviderCooldownState(p.id)) return false;
    return true;
  });
  if (!candidates.length) return null;
  // Prefer configured API providers first if credentials exist, then keyless RSS/Atom providers (bing, reddit)
  const withKey = candidates.find(c => Boolean(c.credential_name && env?.[c.credential_name]));
  return withKey || candidates[0];
}

async function runFailoverCategories(failedProviderId, remainingCategories, env, excludedProviders = new Set()) {
  if (!remainingCategories.length) {
    return { failoverProvider: null, failoverStoriesSaved: 0, failoverCategories: [] };
  }
  const fallback = selectFallbackProvider(failedProviderId, env, excludedProviders);
  if (!fallback) {
    return { failoverProvider: null, failoverStoriesSaved: 0, failoverCategories: [] };
  }
  const fallbackConfig = getNewsProviderConfig(fallback.id);
  if (!fallbackConfig) {
    return { failoverProvider: null, failoverStoriesSaved: 0, failoverCategories: [] };
  }

  let failoverStoriesSaved = 0;
  const coveredCategories = [];

  for (const [idx, category] of remainingCategories.entries()) {
    if (!Object.hasOwn(fallbackConfig.categories, category)) continue;
    if (idx > 0 && fallbackConfig.updatePauseMs > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(fallbackConfig.updatePauseMs, 500)));
    }
    let lastTelemetry = null;
    try {
      const feed = await getNewsFeed(fallback.id, category, ADMIN_MARKET, {
        credentials: env,
        cache: false,
        onFetchTelemetry: (t) => { lastTelemetry = t; }
      });
      const stories = feed.items.slice(0, 10);
      const upsertResult = await upsertNewsStories(env, fallback.id, category, stories);
      const savedCount = upsertResult?.savedCount ?? stories.length;
      failoverStoriesSaved += savedCount;
      coveredCategories.push(category);

      await recordNewsProviderFetchLog(env, {
        provider: fallback.id,
        providerLabel: fallbackConfig.label,
        category,
        triggerSource: 'failover',
        status: 'succeeded',
        httpStatus: lastTelemetry?.httpStatus ?? 200,
        durationMs: lastTelemetry?.durationMs ?? 0,
        attemptCount: lastTelemetry?.attemptCount ?? 1,
        itemsFetched: feed.items.length,
        storiesSaved: savedCount,
        duplicatesSkipped: upsertResult?.duplicatesSkipped ?? 0,
        retryAfterSeconds: lastTelemetry?.retryAfterSeconds ?? null,
        rateLimitRemaining: lastTelemetry?.rateLimitRemaining ?? null,
        rateLimitReset: lastTelemetry?.rateLimitReset ?? null,
        requestUrl: lastTelemetry?.requestUrl || fallbackConfig.endpoint || '',
        failoverProvider: failedProviderId,
        errorMessage: null
      });
    } catch (fallbackErr) {
      const isFallbackRateLimit = Boolean(fallbackErr?.isRateLimit || fallbackErr?.status === 429);
      await recordNewsProviderFetchLog(env, {
        provider: fallback.id,
        providerLabel: fallbackConfig.label,
        category,
        triggerSource: 'failover',
        status: isFallbackRateLimit ? 'rate_limited' : 'failed',
        httpStatus: fallbackErr?.status ?? lastTelemetry?.httpStatus ?? null,
        durationMs: fallbackErr?.durationMs ?? lastTelemetry?.durationMs ?? 0,
        attemptCount: fallbackErr?.attemptCount ?? lastTelemetry?.attemptCount ?? 1,
        itemsFetched: 0,
        storiesSaved: 0,
        retryAfterSeconds: fallbackErr?.retryAfterSeconds ?? null,
        rateLimitRemaining: fallbackErr?.rateLimitRemaining ?? null,
        rateLimitReset: fallbackErr?.rateLimitReset ?? null,
        requestUrl: fallbackErr?.requestUrl || lastTelemetry?.requestUrl || fallbackConfig.endpoint || '',
        failoverProvider: failedProviderId,
        errorMessage: `Failover from ${failedProviderId} failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
      });
      if (isFallbackRateLimit) break;
    }
  }

  return {
    failoverProvider: coveredCategories.length > 0 ? fallback.id : null,
    failoverStoriesSaved,
    failoverCategories: coveredCategories
  };
}

async function executeProviderSync(provider, updatedBy, env, {
  triggerSource = 'manual',
  force = false,
  allowFailover = true,
  excludedFailoverProviders = new Set()
} = {}) {
  const config = getNewsProviderConfig(provider);
  if (!config) return { httpStatus: 404, body: { error: 'Unknown news provider' } };
  if (config.credential && !env[config.credential]) {
    return {
      httpStatus: 503,
      body: {
        error: `${config.label} is not configured. Set the ${config.credential} Worker secret.`
      }
    };
  }

  const activeCooldown = !force ? getProviderCooldownState(provider) : null;
  if (activeCooldown) {
    const remainingSec = Math.max(1, Math.ceil((Date.parse(activeCooldown.cooldownUntil) - Date.now()) / 1000));
    const cooldownMsg = `${config.label} is in rate-limit cooldown for ${remainingSec}s (until ${activeCooldown.cooldownUntil})`;
    await recordNewsProviderFetchLog(env, {
      provider,
      providerLabel: config.label,
      category: 'all',
      triggerSource,
      status: 'skipped_cooldown',
      httpStatus: 429,
      durationMs: 0,
      attemptCount: 0,
      itemsFetched: 0,
      storiesSaved: 0,
      retryAfterSeconds: remainingSec,
      rateLimitRemaining: activeCooldown.rateLimitRemaining,
      rateLimitReset: activeCooldown.rateLimitResetAt,
      requestUrl: config.endpoint || '',
      failoverProvider: activeCooldown.failoverProvider,
      errorMessage: cooldownMsg
    });
    return {
      httpStatus: 200,
      body: {
        provider,
        status: 'rate_limited',
        storiesSaved: 0,
        cooldownUntil: activeCooldown.cooldownUntil,
        failoverProvider: activeCooldown.failoverProvider || null,
        errors: [cooldownMsg]
      }
    };
  }

  const claimed = await claimNewsProviderSync(env, provider, updatedBy);
  if (!claimed) {
    return { httpStatus: 409, body: { error: `${provider} is already being updated` } };
  }

  let storiesSaved = 0;
  let failoverStoriesSaved = 0;
  let failoverProvider = null;
  let failoverCategories = [];
  let cooldownUntil = null;
  let hitRateLimit = false;
  const errors = [];
  const categories = Object.keys(config.categories);

  try {
    for (const [index, category] of categories.entries()) {
      if (index > 0) await new Promise(resolve => setTimeout(resolve, config.updatePauseMs));
      let lastTelemetry = null;
      try {
        const feed = await getNewsFeed(provider, category, ADMIN_MARKET, {
          credentials: env,
          cache: false,
          onFetchTelemetry: (t) => { lastTelemetry = t; }
        });
        const stories = feed.items.slice(0, 10);
        const upsertResult = await upsertNewsStories(env, provider, category, stories);
        const savedCount = upsertResult?.savedCount ?? stories.length;
        storiesSaved += savedCount;

        await recordNewsProviderFetchLog(env, {
          provider,
          providerLabel: config.label,
          category,
          triggerSource,
          status: 'succeeded',
          httpStatus: lastTelemetry?.httpStatus ?? 200,
          durationMs: lastTelemetry?.durationMs ?? 0,
          attemptCount: lastTelemetry?.attemptCount ?? 1,
          itemsFetched: feed.items.length,
          storiesSaved: savedCount,
          duplicatesSkipped: upsertResult?.duplicatesSkipped ?? 0,
          retryAfterSeconds: lastTelemetry?.retryAfterSeconds ?? null,
          rateLimitRemaining: lastTelemetry?.rateLimitRemaining ?? null,
          rateLimitReset: lastTelemetry?.rateLimitReset ?? null,
          requestUrl: lastTelemetry?.requestUrl || config.endpoint || '',
          errorMessage: null
        });
      } catch (err) {
        const isRateLimit = Boolean(err?.isRateLimit || err?.status === 429);
        const rawErrMsg = err instanceof Error ? err.message : 'Unknown provider error';
        const message = `${category}: ${rawErrMsg}`;
        console.error(`News provider update failed for ${provider}/${category}:`, err);
        errors.push(message);

        if (isRateLimit) {
          hitRateLimit = true;
          const windowInfo = computeCooldownWindow(err);
          cooldownUntil = windowInfo.cooldownUntil;
          const remainingCategories = categories.slice(index);

          if (allowFailover && remainingCategories.length > 0) {
            excludedFailoverProviders.add(provider);
            const failoverResult = await runFailoverCategories(
              provider,
              remainingCategories,
              env,
              excludedFailoverProviders
            );
            failoverProvider = failoverResult.failoverProvider;
            failoverStoriesSaved = failoverResult.failoverStoriesSaved;
            failoverCategories = failoverResult.failoverCategories;
          }

          setProviderCooldownState(provider, {
            cooldownUntil,
            rateLimitResetAt: windowInfo.rateLimitResetAt,
            retryAfterSeconds: windowInfo.cooldownSeconds,
            rateLimitRemaining: err?.rateLimitRemaining ?? lastTelemetry?.rateLimitRemaining ?? '0',
            lastError: message,
            failoverProvider,
            failoverCategories
          });

          await recordNewsProviderFetchLog(env, {
            provider,
            providerLabel: config.label,
            category,
            triggerSource,
            status: 'rate_limited',
            httpStatus: err?.status ?? lastTelemetry?.httpStatus ?? 429,
            durationMs: err?.durationMs ?? lastTelemetry?.durationMs ?? 0,
            attemptCount: err?.attemptCount ?? lastTelemetry?.attemptCount ?? 1,
            itemsFetched: 0,
            storiesSaved: 0,
            retryAfterSeconds: windowInfo.cooldownSeconds,
            rateLimitRemaining: err?.rateLimitRemaining ?? lastTelemetry?.rateLimitRemaining ?? '0',
            rateLimitReset: windowInfo.rateLimitResetAt,
            requestUrl: err?.requestUrl || lastTelemetry?.requestUrl || config.endpoint || '',
            failoverProvider,
            errorMessage: `${message}${failoverProvider ? ` · Failed over [${failoverCategories.join(', ')}] to ${failoverProvider} (+${failoverStoriesSaved} stories)` : ''}`
          });

          if (failoverProvider) {
            errors.push(`failover: routed remaining topics (${failoverCategories.join(', ')}) to ${failoverProvider} (+${failoverStoriesSaved} stories saved)`);
          }
          // Stop querying remaining categories on the rate-limited provider immediately
          break;
        } else {
          await recordNewsProviderFetchLog(env, {
            provider,
            providerLabel: config.label,
            category,
            triggerSource,
            status: 'failed',
            httpStatus: err?.status ?? lastTelemetry?.httpStatus ?? null,
            durationMs: err?.durationMs ?? lastTelemetry?.durationMs ?? 0,
            attemptCount: err?.attemptCount ?? lastTelemetry?.attemptCount ?? 1,
            itemsFetched: 0,
            storiesSaved: 0,
            retryAfterSeconds: err?.retryAfterSeconds ?? null,
            rateLimitRemaining: err?.rateLimitRemaining ?? null,
            rateLimitReset: err?.rateLimitReset ?? null,
            requestUrl: err?.requestUrl || lastTelemetry?.requestUrl || config.endpoint || '',
            errorMessage: message
          });
        }
      }
    }

    if (!hitRateLimit && errors.length === 0) {
      clearProviderCooldownState(provider);
    }

    const status = errors.length === 0
      ? 'succeeded'
      : (storiesSaved > 0 || failoverStoriesSaved > 0)
        ? 'partial'
        : 'failed';
    const errorMessage = errors.length ? errors.join('; ').slice(0, 2000) : null;
    await finishNewsProviderSync(env, provider, { status, storiesSaved, error: errorMessage });

    return {
      httpStatus: 200,
      body: {
        provider,
        status,
        storiesSaved,
        errors,
        ...(hitRateLimit ? {
          rateLimited: true,
          cooldownUntil,
          failoverProvider,
          failoverCategories,
          failoverStoriesSaved
        } : {})
      }
    };
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

async function updateNewsProvider(provider, updatedBy, env, options = {}) {
  const result = await executeProviderSync(provider, updatedBy, env, options);
  return jsonResponse(result.body, result.httpStatus);
}

/**
 * Staggered topic sync: processes the next batch of (provider, category) pairs
 * from the rotation queue. Designed to run every 10 minutes via cron,
 * spreading the 42 fetches evenly across the hour instead of bursting.
 */
async function runStaggeredSync(env, triggerSource = 'cron', updatedBy = 'staggered-scheduler') {
  const providers = getNewsProviders(env).filter(p => p.configured);
  if (providers.length === 0) {
    return { skipped: true, reason: 'No providers configured', pairsSynced: 0 };
  }

  const batch = getNextSyncBatch(providers, PAIRS_PER_RUN);
  const results = [];
  let totalStoriesSaved = 0;

  for (const { provider, category } of batch) {
    const config = getNewsProviderConfig(provider);
    if (!config) continue;
    // Small pause between fetches to avoid hammering APIs
    if (results.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    try {
      const feed = await getNewsFeed(provider, category, ADMIN_MARKET, {
        credentials: env,
        cache: false,
      });
      const stories = feed.items.slice(0, 10);
      const upsertResult = await upsertNewsStories(env, provider, category, stories);
      const savedCount = upsertResult?.savedCount ?? 0;
      totalStoriesSaved += savedCount;
      await recordNewsProviderFetchLog(env, {
        provider,
        providerLabel: config.label,
        category,
        triggerSource: triggerSource + ':staggered',
        status: 'succeeded',
        httpStatus: 200,
        durationMs: 0,
        attemptCount: 1,
        itemsFetched: feed.items.length,
        storiesSaved: savedCount,
        duplicatesSkipped: upsertResult?.duplicatesSkipped ?? 0,
        errorMessage: null,
      });
      results.push({ provider, category, status: 'succeeded', storiesSaved: savedCount });
    } catch (err) {
      console.error(`Staggered sync failed for ${provider}/${category}:`, err);
      results.push({
        provider,
        category,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    pairsSynced: results.length,
    totalStoriesSaved,
    results,
    triggerSource,
  };
}

async function runHourlyAutoSync(env, triggerSource = 'cron', updatedBy = 'hourly-scheduler', { force = false } = {}) {
  const currentAuto = getAutoSyncState();
  if (!force && !currentAuto.enabled) {
    return {
      skipped: true,
      reason: 'Auto-sync is currently paused by administrator',
      autoSync: currentAuto
    };
  }

  const providers = getNewsProviders(env).filter(p => p.configured);
  const results = [];
  let totalStoriesSaved = 0;
  let rateLimitedCount = 0;
  const excludedFailovers = new Set();

  for (const provider of providers) {
    try {
      const outcome = await executeProviderSync(provider.id, updatedBy, env, {
        triggerSource,
        force: false,
        allowFailover: true,
        excludedFailoverProviders: excludedFailovers
      });
      if (outcome.httpStatus === 200) {
        totalStoriesSaved += (outcome.body.storiesSaved || 0) + (outcome.body.failoverStoriesSaved || 0);
        if (outcome.body.rateLimited || outcome.body.status === 'rate_limited') {
          rateLimitedCount++;
        }
      }
      results.push({
        provider: provider.id,
        httpStatus: outcome.httpStatus,
        ...outcome.body
      });
    } catch (err) {
      console.error(`Auto-sync failed for provider ${provider.id}:`, err);
      results.push({
        provider: provider.id,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const allSucceeded = results.length > 0 && results.every(r => r.status === 'succeeded');
  const anySaved = totalStoriesSaved > 0;
  const overallStatus = allSucceeded ? 'succeeded' : anySaved ? 'partial' : 'failed';
  const summaryText = `Synced ${results.length} providers (${totalStoriesSaved} stories saved${rateLimitedCount ? `, ${rateLimitedCount} rate-limited` : ''})`;

  const updatedAutoSync = setAutoSyncState({
    lastRunAt: new Date().toISOString(),
    lastTrigger: triggerSource,
    lastStatus: overallStatus,
    lastSummary: summaryText,
    updatedBy
  });

  // Automatically trigger 3x/day AI story curation (Morning, Afternoon, Evening) if current slot is due
  let aiCurationResult = null;
  try {
    const curationState = getAiCurationState();
    if (curationState.enabled && curationState.isSlotDue) {
      aiCurationResult = await runAiStoryCuration(env, {
        slot: curationState.currentSlot,
        triggerSource: `auto_${triggerSource}`,
        updatedBy: `ai-scheduler:${updatedBy}`
      });
    }
  } catch (err) {
    console.error('Scheduled AI story curation check failed:', err);
  }

  console.info(JSON.stringify({
    event: 'HOURLY_AUTO_SYNC_COMPLETE',
    triggerSource,
    overallStatus,
    totalStoriesSaved,
    rateLimitedCount,
    providersCount: results.length,
    aiCurationTriggered: Boolean(aiCurationResult && !aiCurationResult.skipped)
  }));

  return {
    skipped: false,
    triggerSource,
    status: overallStatus,
    totalStoriesSaved,
    rateLimitedCount,
    results,
    autoSync: updatedAutoSync,
    aiCuration: aiCurationResult?.aiCuration || getAiCurationState()
  };
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
        'Content-Security-Policy': "default-src 'none'; connect-src 'self'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      }
    });
  }
  if (!identity) return jsonResponse({ error: 'GitHub authentication is required' }, 401);
  if (url.pathname === '/admin/api/identity' && request.method === 'GET') {
    return jsonResponse({ login: identity.login });
  }
  if (url.pathname === '/admin/api/status' && request.method === 'GET') {
    const pendingProvider = url.searchParams.get('provider');
    if (pendingProvider && !getNewsProviders(env).some(provider => provider.id === pendingProvider)) {
      return jsonResponse({ error: 'Unknown news provider' }, 400);
    }
    try {
      return jsonResponse(await getNewsAdminSnapshot(env, getNewsProviders(env), pendingProvider));
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

  if (url.pathname === '/admin/api/image' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Image generation must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await readAdminStoryPayload(request);
      if (payload instanceof Response) return payload;
      if (!env.AI) return jsonResponse({ error: 'Workers AI is not configured for this Worker' }, 503);
      if (!env.SUMMARY_RATE_LIMITER) {
        return jsonResponse({ error: 'Summary rate limiter is not configured for this Worker' }, 503);
      }
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin-image:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Image generation rate limit exceeded' }, 429);
      return jsonResponse(await generateAdminStoryImage(payload, request.url, env));
    } catch (err) {
      console.error('Admin AI image generation failed:', err);
      return jsonResponse({
        error: err instanceof Error ? err.message : 'Could not generate an AI image'
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

  const displayCatsMatch = url.pathname.match(/^\/admin\/api\/stories\/(\d+)\/display-categories$/);
  if (displayCatsMatch && request.method === 'PATCH') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Story category updates must be requested from the admin origin' }, 403);
    }
    try {
      let body = {};
      try { body = await request.json(); } catch { /* empty body clears the override */ }
      const result = await setStoryDisplayCategories(env, displayCatsMatch[1], body.display_categories);
      if (!result.ok) return jsonResponse({ error: result.error || 'Could not update story categories' }, result.error === 'Story was not found' ? 404 : 400);
      return jsonResponse({
        id: Number(displayCatsMatch[1]),
        display_categories: result.displayCategories,
        overrridable_categories: OVERRIDABLE_CATEGORIES,
      });
    } catch (err) {
      console.error('News story display-categories update failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update story categories' }, 502);
    }
  }

  const interestKwMatch = url.pathname.match(/^\/admin\/api\/stories\/(\d+)\/interest-keywords$/);
  if (interestKwMatch && request.method === 'PATCH') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Story keyword updates must be requested from the admin origin' }, 403);
    }
    try {
      let body = {};
      try { body = await request.json(); } catch { /* empty body clears the keywords */ }
      const result = await setStoryInterestKeywords(env, interestKwMatch[1], body.interest_keywords);
      if (!result.ok) return jsonResponse({ error: result.error || 'Could not update story keywords' }, result.error === 'Story was not found' ? 404 : 400);
      return jsonResponse({
        id: Number(interestKwMatch[1]),
        interest_keywords: result.interestKeywords,
        interest_keyword_options: INTEREST_KEYWORDS,
      });
    } catch (err) {
      console.error('News story interest-keywords update failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update story keywords' }, 502);
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
      const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';
      return await updateNewsProvider(updateMatch[1], identity.login, env, {
        force,
        triggerSource: 'admin_manual'
      });
    } catch (err) {
      console.error('News admin provider update failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update news provider' }, 502);
    }
  }

  const resetMatch = url.pathname.match(/^\/admin\/api\/providers\/([a-z0-9-]+)\/reset$/);
  if (resetMatch && request.method === 'POST') {
    try {
      if (!isSameOrigin(request)) {
        return jsonResponse({ error: 'Provider reset must be requested from the admin origin' }, 403);
      }
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Admin update rate limit exceeded' }, 429);
      const result = await resetNewsProviderSync(env, resetMatch[1], identity.login);
      return jsonResponse(result);
    } catch (err) {
      console.error('News admin provider reset failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not reset provider sync state' }, 502);
    }
  }

  if (url.pathname === '/admin/api/providers/sync-all' && request.method === 'POST') {
    try {
      if (!isSameOrigin(request)) {
        return jsonResponse({ error: 'Provider sync must be requested from the admin origin' }, 403);
      }
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Admin update rate limit exceeded' }, 429);
      const summary = await runHourlyAutoSync(env, 'admin_sync_all', identity.login, { force: true });
      return jsonResponse({
        ...summary,
        autoSync: getAutoSyncState()
      });
    } catch (err) {
      console.error('Admin sync-all failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not sync all providers' }, 502);
    }
  }

  if (url.pathname === '/admin/api/auto-sync' && request.method === 'GET') {
    return jsonResponse({ autoSync: getAutoSyncState() });
  }

  if (url.pathname === '/admin/api/auto-sync' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Auto-sync changes must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await request.json().catch(() => ({}));
      if (typeof payload.enabled === 'boolean') {
        const autoSync = setAutoSyncState({
          enabled: payload.enabled,
          updatedBy: identity.login
        });
        return jsonResponse({ autoSync });
      }
      if (payload.action === 'check_stale' || payload.action === 'run_if_stale') {
        const current = getAutoSyncState();
        const aiState = getAiCurationState();
        let triggered = false;
        let summary = null;
        if (current.enabled && current.isStale) {
          summary = await runHourlyAutoSync(env, 'stale_check', `stale-check:${identity.login}`);
          triggered = true;
        } else if (aiState.enabled && aiState.isSlotDue) {
          summary = await runAiStoryCuration(env, {
            slot: aiState.currentSlot,
            triggerSource: 'scheduled_window',
            updatedBy: `window-check:${identity.login}`
          });
          triggered = !summary.skipped;
        }
        return jsonResponse({
          triggered,
          summary,
          autoSync: getAutoSyncState(),
          aiCuration: getAiCurationState()
        });
      }
      return jsonResponse({ autoSync: getAutoSyncState() });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update auto-sync settings' }, 500);
    }
  }

  if (url.pathname === '/admin/api/ai-curation' && request.method === 'GET') {
    return jsonResponse({ aiCuration: getAiCurationState() });
  }

  if (url.pathname === '/admin/api/ai-curation' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'AI curation settings must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await request.json().catch(() => ({}));
      const updated = updateAiCurationConfig(payload, identity.login);
      if (payload.reCurate) {
        const runResult = await runAiStoryCuration(env, {
          slot: payload.slot || updated.currentSlot,
          triggerSource: 'taste_profile_update',
          updatedBy: identity.login,
          force: true
        });
        return jsonResponse({
          updated: true,
          curated: true,
          runResult,
          aiCuration: getAiCurationState()
        });
      }
      return jsonResponse({ updated: true, aiCuration: updated });
    } catch (err) {
      return jsonResponse({
        error: err instanceof Error ? err.message : 'Could not update AI curation settings'
      }, 500);
    }
  }

  if (url.pathname === '/admin/api/ai-curation/run' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'AI curation runs must be requested from the admin origin' }, 403);
    }
    try {
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin-curation:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'AI curation rate limit exceeded; try again shortly' }, 429);
      const payload = await request.json().catch(() => ({}));
      const result = await runAiStoryCuration(env, {
        slot: payload.slot || null,
        triggerSource: payload.triggerSource || 'manual',
        updatedBy: identity.login,
        force: true
      });
      return jsonResponse(result);
    } catch (err) {
      console.error('Admin AI story curation run failed:', err);
      return jsonResponse({
        error: err instanceof Error ? err.message : 'Could not run AI story curation'
      }, 502);
    }
  }

  if (url.pathname === '/admin/api/ai-curation/bulk' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Bulk story decisions must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await request.json().catch(() => ({}));
      const storyIds = Array.isArray(payload.storyIds) ? payload.storyIds : [];
      const action = typeof payload.action === 'string' ? payload.action : 'approve';
      const result = await bulkDecideNewsStories(env, storyIds, action, identity.login);
      return jsonResponse(result);
    } catch (err) {
      console.error('Bulk AI story decision failed:', err);
      return jsonResponse({
        error: err instanceof Error ? err.message : 'Could not complete bulk story decision'
      }, 502);
    }
  }

  if (url.pathname === '/admin/api/logs' && request.method === 'GET') {
    const provider = url.searchParams.get('provider') || 'all';
    const status = url.searchParams.get('status') || 'all';
    const category = url.searchParams.get('category') || 'all';
    const limit = Number(url.searchParams.get('limit') || 100);
    return jsonResponse(getNewsProviderFetchLogs({ provider, status, category, limit }));
  }

  if (url.pathname === '/admin/api/logs/clear' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Log clearing must be requested from the admin origin' }, 403);
    }
    clearNewsProviderFetchLogs();
    return jsonResponse({ cleared: true, ...getNewsProviderFetchLogs() });
  }

  if (url.pathname === '/admin/api/stories/search' && request.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    if (!q.trim()) return jsonResponse({ items: [] });
    try {
      const items = await searchNewsStories(env, q);
      return jsonResponse({ items });
    } catch (err) {
      console.error('Story search failed:', err);
      return jsonResponse({ items: [] });
    }
  }

  // Validate story categories via embedding classifier (prototype).
  // Classifies unapproved stories and flags mismatches for review.
  if (url.pathname === '/admin/api/stories/validate-categories' && request.method === 'POST') {
    if (!env.AI) {
      return jsonResponse({ error: 'Workers AI is not configured for this Worker' }, 503);
    }
    try {
      // Parse optional limit (default: process all unvalidated)
      let body = {};
      try {
        body = await request.json();
      } catch {
        // empty body is fine
      }
      const maxStories = Math.min(Math.max(Number(body.limit) || 15, 1), 20);
      const BATCH = 15;

      let totalValidated = 0;
      let totalStored = 0;
      let firstError = null;
      const allMismatches = [];
      const allResults = [];
      let offset = 0;

      // Interest keyword vectors are loaded from Supabase (embedded once and
      // persisted) and reused for every story — no per-story AI cost.
      // Returns null until all 100 are backfilled; keyword tagging waits.
      const keywordVectors = await getPersistedKeywordEmbeddings(env);

      while (totalValidated < maxStories) {
        // Fetch next batch of unapproved stories missing category validation
        // (and never overwriting a hand-set display override) or missing
        // interest keyword tags.
        const query = new URLSearchParams({
          select: 'id,title,description,category,image_url,provider,article_url,published_at,fetched_at,display_categories,embedding_category,embedding_confidence,interest_keywords',
          approved: 'eq.false',
          removed: 'eq.false',
          or: '(and(embedding_category.is.null,display_categories.is.null),interest_keywords.is.null)',
          order: 'fetched_at.desc',
          limit: String(Math.min(BATCH, maxStories - totalValidated)),
          offset: String(offset),
        });
        const res = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
          headers: supabaseHeaders(env),
        });
        if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
        const stories = await res.json();
        if (!stories.length) break;

        const results = await validateStoryCategories(env, stories, { keywordVectors });

        // Store the embedding predictions. For category mismatches, auto-apply
        // the AI's pick as the display override — Katie reviews them in the
        // validation list. Interest keyword tags are always stored when found.
        for (const r of results) {
          const patch = {};
          if (r.categoryValidated && r.embeddingCategory) {
            patch.embedding_category = r.embeddingCategory;
            patch.embedding_confidence = r.confidence;
            if (r.mismatch) patch.display_categories = [r.embeddingCategory];
          }
          if (r.keywordsClassified) {
            patch.interest_keywords = r.keywordMatches.map((m) => m.id);
          }
          if (Object.keys(patch).length === 0) continue;
          const updateRes = await fetch(
            supabaseUrl(env, STORIES_TABLE, new URLSearchParams({ id: `eq.${r.id}` })),
            {
              method: 'PATCH',
              headers: { ...supabaseHeaders(env), 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            }
          );
          if (updateRes.ok) {
            totalStored++;
            if (r.mismatch && r.categoryValidated) r.displayCategories = [r.embeddingCategory];
            if (r.keywordsClassified) r.interestKeywords = r.keywordMatches.map((m) => m.id);
          } else {
            const errText = await updateRes.text().catch(() => 'unknown');
            console.error(`Failed to store embedding for story ${r.id}: ${updateRes.status} ${errText}`);
            if (!firstError) firstError = `Story ${r.id}: ${updateRes.status} ${errText}`;
          }
        }

        totalValidated += results.length;
        allMismatches.push(...results.filter((r) => r.mismatch));
        allResults.push(...results.map((r) => ({
          id: r.id,
          title: r.title,
          queryCategory: r.queryCategory,
          embeddingCategory: r.embeddingCategory,
          confidence: r.confidence,
          mismatch: r.mismatch,
          imageUrl: r.imageUrl || null,
          provider: r.provider || null,
          articleUrl: r.articleUrl || null,
          description: r.description || null,
          publishedAt: r.publishedAt || null,
          fetchedAt: r.fetchedAt || null,
          displayCategories: r.displayCategories || null,
          interestKeywords: r.interestKeywords || null,
          keywordMatches: (r.keywordMatches || []).map((m) => ({
            id: m.id,
            label: m.label,
            confidence: m.confidence,
          })),
        })));
        offset += stories.length;

        // If we got fewer than requested, we've reached the end
        if (stories.length < BATCH) break;
      }

      return jsonResponse({
        validated: totalValidated,
        stored: totalStored,
        storeError: firstError,
        mismatches: allMismatches.map((m) => ({
          id: m.id,
          title: m.title,
          queryCategory: m.queryCategory,
          embeddingCategory: m.embeddingCategory,
          confidence: m.confidence,
          imageUrl: m.imageUrl || null,
          provider: m.provider || null,
          articleUrl: m.articleUrl || null,
          description: m.description || null,
          publishedAt: m.publishedAt || null,
          fetchedAt: m.fetchedAt || null,
          displayCategories: m.displayCategories || null,
          interestKeywords: m.interestKeywords || null,
          keywordMatches: (m.keywordMatches || []).map((k) => ({
            id: k.id,
            label: k.label,
            confidence: k.confidence,
          })),
        })),
        results: allResults,
      });
    } catch (err) {
      console.error('Category validation failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Validation failed' }, 502);
    }
  }

  if (url.pathname === '/admin/api/ads' && request.method === 'GET') {
    const category = url.searchParams.get('category') || 'all';
    const network = url.searchParams.get('network') || 'all';
    const query = url.searchParams.get('q') || '';
    const embedded = getAds({ category, network, query });
    // Include Awin ads from Supabase so the admin panel manages all inventory.
    let awinAds = [];
    if (env?.SUPABASE_URL && env?.SUPABASE_SECRET_KEY) {
      try {
        awinAds = await getAwinAds(env, { category, query });
        if (network && network !== 'all') {
          awinAds = awinAds.filter(a => a.network.toLowerCase() === network.toLowerCase());
        }
      } catch (err) {
        console.error('Admin Awin ads fetch failed:', err.message);
      }
    }
    return jsonResponse({ ads: [...embedded, ...awinAds] });
  }

  if (url.pathname === '/admin/api/ads' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Ad creation must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await request.json().catch(() => ({}));
      const ad = createAd(payload);
      return jsonResponse({ id: ad.id, created: true, ad });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not create ad' }, 500);
    }
  }

  const adEditMatch = url.pathname.match(/^\/admin\/api\/ads\/([^/]+)$/);
  if (adEditMatch && (request.method === 'PATCH' || request.method === 'PUT')) {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Ad updates must be requested from the admin origin' }, 403);
    }
    try {
      const payload = await request.json().catch(() => ({}));
      const adId = decodeURIComponent(adEditMatch[1]);
      const updated = updateAd(adId, payload);
      if (!updated) return jsonResponse({ error: 'Ad was not found' }, 404);
      return jsonResponse({ id: adId, updated: true, ad: updated });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not update ad' }, 500);
    }
  }

  if (url.pathname === '/admin/api/awin/sync' && request.method === 'POST') {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: 'Awin sync must be requested from the admin origin' }, 403);
    }
    try {
      const limit = await env.SUMMARY_RATE_LIMITER.limit({ key: `admin:${identity.login}` });
      if (!limit.success) return jsonResponse({ error: 'Admin update rate limit exceeded' }, 429);
      const payload = await request.json().catch(() => ({}));
      const result = await syncAwin(env, {
        includeProducts: payload.includeProducts !== false,
        productLocale: payload.productLocale || 'en_US',
        maxPrograms: Math.min(Number(payload.maxPrograms) || 50, 100),
      });
      return jsonResponse(result);
    } catch (err) {
      console.error('Awin sync failed:', err);
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not sync Awin' }, 502);
    }
  }

  if (url.pathname === '/admin/api/awin/status' && request.method === 'GET') {
    try {
      const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/awin_sync_runs`;
      const params = new URLSearchParams({
        select: 'id,started_at,finished_at,status,steps,error',
        order: 'started_at.desc',
        limit: '5',
      });
      const res = await fetch(`${base}?${params}`, {
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        },
      });
      const runs = res.ok ? await res.json() : [];
      const countsRes = await fetch(
        `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/awin_programs?select=advertiser_id&enabled=eq.true`,
        {
          headers: {
            apikey: env.SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
          },
        }
      );
      const programRows = countsRes.ok ? await countsRes.json().catch(() => []) : [];
      const programCount = Array.isArray(programRows) ? programRows.length : 0;
      return jsonResponse({ runs, programCount, configured: Boolean(env.AWIN_API_TOKEN) });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Could not load Awin status' }, 500);
    }
  }

  if (url.pathname === '/admin/api/awin/ads/bulk' && request.method === 'PATCH') {
    try {
      const body = await request.json();
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const category = String(body.category || '').trim();
      const enabled = body.enabled;
      if (!ids.length || (!category && typeof enabled !== 'boolean')) {
        return jsonResponse({ error: 'ids and category or enabled are required' }, 400);
      }
      const headers = {
        'apikey': env.SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      };
      const base = env.SUPABASE_URL.replace(/\/$/, '');
      const patch = {};
      if (category) patch.category = category;
      if (typeof enabled === 'boolean') patch.enabled = enabled;
      let updated = 0;
      // Split into programs (awin-program-<advId>) and products (awin-product-<advId>:<prodId>)
      const programIds = [];
      const productIds = [];
      for (const id of ids) {
        const m = String(id).match(/^awin-(program|product)-(.+)$/);
        if (!m) continue;
        if (m[1] === 'program') programIds.push(m[2]);
        else productIds.push(m[2]);
      }
      if (programIds.length) {
        const res = await fetch(
          `${base}/rest/v1/awin_programs?advertiser_id=in.(${programIds.join(',')})`,
          { method: 'PATCH', headers, body: JSON.stringify(patch) }
        );
        if (!res.ok) throw new Error(`Program update failed (HTTP ${res.status})`);
        updated += programIds.length;
      }
      if (productIds.length) {
        // Products use text IDs like "53739:abc123" — batch in chunks of 50.
        for (let i = 0; i < productIds.length; i += 50) {
          const chunk = productIds.slice(i, i + 50);
          const orFilter = chunk.map(id => `id.eq.${encodeURIComponent(id)}`).join(',');
          const res = await fetch(
            `${base}/rest/v1/awin_products?or=(${orFilter})`,
            { method: 'PATCH', headers, body: JSON.stringify(patch) }
          );
          if (!res.ok) throw new Error(`Product update failed (HTTP ${res.status})`);
          updated += chunk.length;
        }
      }
      return jsonResponse({ ok: true, updated });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Bulk update failed' }, 500);
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
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : '';
  const link = typeof body.link === 'string' ? body.link.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4_000) : '';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 4_000) : '';
  const aiSummary = typeof body.aiSummary === 'string' ? body.aiSummary.trim().slice(0, 4_000) : '';
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 500) : '';
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

function base64ToBytes(base64) {
  const clean = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function detectImageContentType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function createImageResponse({ bytes, contentType }) {
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function rememberGeneratedImage(cacheKey, generated) {
  if (imageMemoryCache.has(cacheKey)) {
    imageMemoryCache.delete(cacheKey);
  } else if (imageMemoryCache.size >= MAX_IMAGE_CACHE_ENTRIES) {
    const oldestKey = imageMemoryCache.keys().next().value;
    if (oldestKey) imageMemoryCache.delete(oldestKey);
  }
  imageMemoryCache.set(cacheKey, generated);
}

async function putImageInEdgeCache(cacheKey, generated) {
  try {
    if (typeof caches !== 'undefined' && caches?.default) {
      await caches.default.put(cacheKey, createImageResponse(generated));
    }
  } catch (err) {
    console.warn('Could not store generated image in edge cache:', err);
  }
}

async function matchImageFromEdgeCache(cacheKey) {
  try {
    if (typeof caches !== 'undefined' && caches?.default) {
      const matched = await caches.default.match(cacheKey);
      if (matched) return matched;
    }
  } catch (err) {
    console.warn('Could not read generated image from edge cache:', err);
  }
  return null;
}

async function buildLittlablesImagePrompt(story, env) {
  const suppliedText = [story.aiSummary, story.description, story.content]
    .map(value => extractPageText(decodeHtml(value || '')))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2_000);

  let articleExcerpt = '';
  if (suppliedText.length < 120 && story.link) {
    try {
      const page = await fetchPublicPage(story.link);
      const scrapedText = extractPageText(page.content);
      if (isReadableArticleText(scrapedText)) {
        articleExcerpt = scrapedText.slice(0, 1_500);
      }
    } catch (err) {
      console.warn(`Could not scrape article while preparing admin AI image ${story.link}:`, err);
    }
  }

  const storyDetails = [
    `Title: ${story.title}`,
    story.category && story.category !== 'all' ? `Category: ${story.category}` : '',
    suppliedText ? `Story details: ${suppliedText}` : '',
    articleExcerpt ? `Article excerpt: ${articleExcerpt}` : ''
  ].filter(Boolean).join('\n');

  let sceneDescription = '';
  try {
    const generated = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content: 'Create a fun image prompt based around the provided story details that fits the theme of Littlables (a joyful, cozy, family-friendly, whimsical storybook news and discovery platform). Describe one charming, colorful visual scene inspired by the story details. Do not include any text, words, letters, logos, or watermarks in the image description. Output only the scene description in 1-2 sentences.'
        },
        {
          role: 'user',
          content: `Create a fun image based around these story details that fit the theme of Littlables:\n\n${storyDetails}`
        }
      ],
      max_tokens: 120,
      temperature: 0.6
    });
    if (typeof generated?.response === 'string') {
      sceneDescription = generated.response.trim().replace(/\s*\n+\s*/g, ' ').slice(0, 320);
    }
  } catch (err) {
    console.warn('Could not refine image prompt with LLM, using story details directly:', err);
  }

  const fallbackDetails = [story.title, suppliedText.slice(0, 180)].filter(Boolean).join(' — ');
  const coreScene = sceneDescription || fallbackDetails;

  return `Create a fun image based around the story details that fit the theme of Littlables: ${coreScene}. Whimsical, warm, colorful family-friendly storybook illustration, cozy and uplifting Littlables aesthetic, charming characters and scenery, soft lighting, no text, no words, no watermarks.`.slice(0, 650);
}

async function runWorkersAiImageModel(prompt, seed, env) {
  let rawResult;
  try {
    rawResult = await env.AI.run(IMAGE_MODEL, {
      prompt,
      num_steps: 4,
      ...(Number.isFinite(seed) ? { seed } : {})
    });
  } catch (primaryErr) {
    console.warn(`Primary image model (${IMAGE_MODEL}) failed, trying fallback:`, primaryErr);
    try {
      rawResult = await env.AI.run(FALLBACK_IMAGE_MODEL, {
        prompt,
        ...(Number.isFinite(seed) ? { seed } : {})
      });
    } catch {
      console.error('Workers AI image generation failed:', primaryErr);
      const details = primaryErr instanceof Error ? `: ${primaryErr.message.slice(0, 250)}` : '';
      throw new Error(`Workers AI could not generate the image${details}`);
    }
  }

  let bytes;
  if (rawResult && typeof rawResult === 'object' && typeof rawResult.image === 'string' && rawResult.image.trim()) {
    bytes = base64ToBytes(rawResult.image);
  } else if (rawResult instanceof Uint8Array) {
    bytes = rawResult;
  } else if (rawResult instanceof ArrayBuffer) {
    bytes = new Uint8Array(rawResult);
  } else if (rawResult && (typeof rawResult.getReader === 'function' || (typeof ReadableStream !== 'undefined' && rawResult instanceof ReadableStream))) {
    const ab = await new Response(rawResult).arrayBuffer();
    bytes = new Uint8Array(ab);
  } else {
    throw new Error('Workers AI returned an empty or unsupported image payload.');
  }

  if (!bytes || bytes.byteLength === 0) {
    throw new Error('Workers AI returned an empty image.');
  }

  return {
    bytes,
    contentType: detectImageContentType(bytes)
  };
}

async function generateAdminStoryImage(story, requestUrl, env) {
  const prompt = await buildLittlablesImagePrompt(story, env);
  const seed = Math.floor(Math.random() * 1_000_000);
  const generated = await runWorkersAiImageModel(prompt, seed, env);

  const imageUrlObj = new URL('/ai-image', requestUrl);
  imageUrlObj.searchParams.set('prompt', prompt);
  imageUrlObj.searchParams.set('seed', String(seed));
  const imageUrl = imageUrlObj.href;

  rememberGeneratedImage(imageUrl, generated);
  await putImageInEdgeCache(imageUrl, generated);

  return {
    image: imageUrl,
    prompt
  };
}

async function serveAiStoryImage(request, env) {
  const url = new URL(request.url);
  const prompt = (url.searchParams.get('prompt') || '').trim();
  if (!prompt || prompt.length > 1_000) {
    return jsonResponse({ error: 'A valid image prompt is required' }, 400);
  }
  const seedParam = Number(url.searchParams.get('seed'));
  const seed = Number.isInteger(seedParam) && seedParam >= 0 ? seedParam : 0;

  const cacheKey = url.href;
  const memCached = imageMemoryCache.get(cacheKey);
  if (memCached) {
    return createImageResponse(memCached);
  }

  const edgeCached = await matchImageFromEdgeCache(cacheKey);
  if (edgeCached) {
    return edgeCached;
  }

  if (!env.AI) {
    return jsonResponse({ error: 'Workers AI is not configured for this Worker' }, 503);
  }
  if (env.SUMMARY_RATE_LIMITER) {
    const limit = await env.SUMMARY_RATE_LIMITER.limit({
      key: `ai-image:${request.headers.get('CF-Connecting-IP') || 'unknown'}`
    });
    if (!limit.success) {
      return jsonResponse({ error: 'AI image request rate limit exceeded' }, 429);
    }
  }

  try {
    const generated = await runWorkersAiImageModel(prompt, seed, env);
    rememberGeneratedImage(cacheKey, generated);
    await putImageInEdgeCache(cacheKey, generated);
    return createImageResponse(generated);
  } catch (err) {
    console.error('Public AI story image generation failed:', err);
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Unable to generate story image'
    }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return serveAdmin(request, env);
    }
    if (request.method === 'GET' && pathname === '/ai-image') {
      return serveAiStoryImage(request, env);
    }
    if (request.method === 'GET' && pathname === '/feed') {
      if (
        (url.searchParams.get('auto_sync') === '1' || env?.AUTO_SYNC_ON_FEED === 'true') &&
        ctx &&
        typeof ctx.waitUntil === 'function'
      ) {
        const autoState = getAutoSyncState();
        if (autoState.enabled && autoState.isStale) {
          ctx.waitUntil(runHourlyAutoSync(env, 'stale_check', 'feed-stale-check'));
        }
      }
      return serveNewsFeed(request, env);
    }
    if (request.method === 'POST' && pathname === '/api/engagement') {
      return handleEngagementEvent(request, env);
    }
    if (request.method === 'GET' && pathname === '/ads') {
      const category = (url.searchParams.get('category') || 'all').trim();
      const query = (url.searchParams.get('q') || url.searchParams.get('topic') || '').trim();
      const network = (url.searchParams.get('network') || 'all').trim();
      const isStandardCategory = NEWS_CATEGORY_SET.has(category.toLowerCase());
      const effectiveCategory = isStandardCategory ? category.toLowerCase() : 'all';
      const effectiveQuery = query || (!isStandardCategory ? category : '');
      const embedded = getAds({ category: effectiveCategory, query: effectiveQuery });
      // Merge Awin ads from Supabase (best effort — never break the endpoint).
      // network=awin returns only Awin ads; otherwise they're appended.
      const wantOnlyAwin = network.toLowerCase() === 'awin';
      let awinAds = [];
      if (env?.SUPABASE_URL && env?.SUPABASE_SECRET_KEY && (wantOnlyAwin
        || (network.toLowerCase() !== 'gumroad' && network.toLowerCase() !== 'amazon'
          && network.toLowerCase() !== 'tiktok'))) {
        try {
          // Admin panel sees hidden ads too (includeDisabled: true).
          awinAds = await getAwinAds(env, { category: effectiveCategory, query: effectiveQuery, includeDisabled: true });
        } catch (err) {
          console.error('Awin ads fetch failed:', err.message);
        }
      }
      return jsonResponse({ ads: wantOnlyAwin ? awinAds : [...embedded, ...awinAds] });
    }
    return jsonResponse({ error: 'Route not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    if (env?.AUTO_SYNC_ENABLED === 'false') {
      console.info('Provider auto-sync skipped via AUTO_SYNC_ENABLED=false');
      return;
    }
    const cronPattern = event?.cron || '0 * * * *';
    // Use staggered sync for frequent crons (every 10 min), hourly burst otherwise.
    // Staggered spreads the 42 provider/topic fetches evenly across the hour.
    const isStaggered = cronPattern.includes('*/10') || cronPattern.includes('*/5');
    const task = isStaggered
      ? runStaggeredSync(env, 'cron', `cron:${cronPattern}`)
      : runHourlyAutoSync(env, 'cron', `cron:${cronPattern}`);
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  }
};

