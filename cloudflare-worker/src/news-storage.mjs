import { NEWS_CATEGORIES } from './news-provider-config.mjs';

const STORIES_TABLE = 'news_stories';
const SYNC_TABLE = 'news_provider_sync';

function supabaseHeaders(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function supabaseUrl(env, table, query = '') {
  const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;
  return query ? `${base}?${query}` : base;
}

async function readRows(response, context) {
  if (!response.ok) throw new Error(`${context} failed (HTTP ${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`${context} returned an invalid response`);
  return rows;
}

function normalizeStory(row) {
  return {
    title: row.title,
    link: row.article_url,
    image: row.image_url || '',
    description: row.description || '',
    content: row.content || '',
    aiSummary: row.ai_summary || '',
    pubDate: row.published_at || '',
    fetchedAt: row.fetched_at || '',
    source: row.source_name || '',
    provider: row.provider,
    category: row.category
  };
}

export async function getStoredNewsFeed(env, category) {
  const makeQuery = approved => {
    const params = new URLSearchParams({
      select: 'provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,fetched_at',
      approved: `eq.${approved}`,
      removed: 'eq.false',
      order: 'published_at.desc.nullslast,fetched_at.desc',
      limit: '50'
    });
    if (category && category !== 'all') {
      params.set('category', `eq.${category}`);
    }
    return params;
  };
  const [approvedResponse, unapprovedResponse] = await Promise.all([
    fetch(supabaseUrl(env, STORIES_TABLE, makeQuery(true)), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, makeQuery(false)), {
      headers: supabaseHeaders(env)
    })
  ]);
  const [approvedRows, unapprovedRows] = await Promise.all([
    readRows(approvedResponse, 'Approved news feed lookup'),
    readRows(unapprovedResponse, 'Unapproved news feed lookup')
  ]);
  const seenUrls = new Set();
  const items = [];
  for (const row of [...approvedRows, ...unapprovedRows]) {
    if (seenUrls.has(row.article_url)) continue;
    seenUrls.add(row.article_url);
    items.push({ ...normalizeStory(row), approved: row.approved });
  }
  return { provider: 'supabase', items };
}

const MAX_PROVIDER_FETCH_LOGS = 300;
export const HOURLY_SYNC_INTERVAL_MS = 60 * 60 * 1000;
export const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 3600;

const providerFetchLogsMemory = [];
const providerCooldownMemory = new Map();
const autoSyncStateMemory = {
  enabled: true,
  intervalMs: HOURLY_SYNC_INTERVAL_MS,
  lastRunAt: null,
  lastTrigger: null,
  lastStatus: 'never',
  lastSummary: null,
  updatedBy: 'system',
  updatedAt: null
};
let nextLogId = 1;

export function getProviderCooldownState(providerId) {
  const entry = providerCooldownMemory.get(providerId);
  if (!entry) return null;
  if (entry.cooldownUntil) {
    const expiresAt = Date.parse(entry.cooldownUntil);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      providerCooldownMemory.delete(providerId);
      return null;
    }
  }
  return entry;
}

export function setProviderCooldownState(providerId, {
  cooldownUntil,
  rateLimitResetAt = null,
  retryAfterSeconds = null,
  rateLimitRemaining = null,
  lastError = null,
  failoverProvider = null,
  failoverCategories = []
} = {}) {
  const entry = {
    provider: providerId,
    cooldownUntil: cooldownUntil || new Date(Date.now() + DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS * 1000).toISOString(),
    rateLimitResetAt: rateLimitResetAt || cooldownUntil || null,
    retryAfterSeconds: retryAfterSeconds ?? null,
    rateLimitRemaining: rateLimitRemaining ?? null,
    lastError: lastError || null,
    failoverProvider: failoverProvider || null,
    failoverCategories: Array.isArray(failoverCategories) ? failoverCategories : [],
    recordedAt: new Date().toISOString()
  };
  providerCooldownMemory.set(providerId, entry);
  return entry;
}

export function clearProviderCooldownState(providerId) {
  providerCooldownMemory.delete(providerId);
}

export function getAutoSyncState() {
  const lastRunMs = autoSyncStateMemory.lastRunAt ? Date.parse(autoSyncStateMemory.lastRunAt) : NaN;
  const nextRunMs = Number.isFinite(lastRunMs)
    ? lastRunMs + autoSyncStateMemory.intervalMs
    : Date.now() + autoSyncStateMemory.intervalMs;
  const isStale = autoSyncStateMemory.enabled && (
    !Number.isFinite(lastRunMs) || (Date.now() - lastRunMs) >= autoSyncStateMemory.intervalMs
  );
  return {
    ...autoSyncStateMemory,
    nextRunAt: autoSyncStateMemory.enabled ? new Date(nextRunMs).toISOString() : null,
    isStale
  };
}

export function setAutoSyncState(updates = {}) {
  if (typeof updates.enabled === 'boolean') autoSyncStateMemory.enabled = updates.enabled;
  if (updates.lastRunAt !== undefined) autoSyncStateMemory.lastRunAt = updates.lastRunAt;
  if (updates.lastTrigger !== undefined) autoSyncStateMemory.lastTrigger = updates.lastTrigger;
  if (updates.lastStatus !== undefined) autoSyncStateMemory.lastStatus = updates.lastStatus;
  if (updates.lastSummary !== undefined) autoSyncStateMemory.lastSummary = updates.lastSummary;
  if (updates.updatedBy !== undefined) autoSyncStateMemory.updatedBy = updates.updatedBy;
  autoSyncStateMemory.updatedAt = new Date().toISOString();
  return getAutoSyncState();
}

export async function recordNewsProviderFetchLog(env, entry) {
  const normalized = {
    id: nextLogId++,
    provider: entry.provider || 'unknown',
    providerLabel: entry.providerLabel || entry.provider || 'Unknown',
    category: entry.category || 'all',
    triggerSource: entry.triggerSource || 'manual',
    status: entry.status || 'succeeded',
    httpStatus: entry.httpStatus ?? null,
    durationMs: Number.isFinite(entry.durationMs) ? Math.max(0, Math.round(entry.durationMs)) : 0,
    attemptCount: Number.isFinite(entry.attemptCount) ? Math.max(1, Math.round(entry.attemptCount)) : 1,
    itemsFetched: Number.isFinite(entry.itemsFetched) ? Math.max(0, Math.round(entry.itemsFetched)) : 0,
    storiesSaved: Number.isFinite(entry.storiesSaved) ? Math.max(0, Math.round(entry.storiesSaved)) : 0,
    duplicatesSkipped: Number.isFinite(entry.duplicatesSkipped) ? Math.max(0, Math.round(entry.duplicatesSkipped)) : 0,
    retryAfterSeconds: entry.retryAfterSeconds ?? null,
    rateLimitRemaining: entry.rateLimitRemaining ?? null,
    rateLimitReset: entry.rateLimitReset ?? null,
    requestUrl: entry.requestUrl || '',
    errorMessage: entry.errorMessage || null,
    failoverProvider: entry.failoverProvider || null,
    createdAt: entry.createdAt || new Date().toISOString()
  };

  providerFetchLogsMemory.unshift(normalized);
  if (providerFetchLogsMemory.length > MAX_PROVIDER_FETCH_LOGS) {
    providerFetchLogsMemory.length = MAX_PROVIDER_FETCH_LOGS;
  }

  if (env?.SUPABASE_URL && env?.SUPABASE_SECRET_KEY && env?.ENABLE_SUPABASE_PROVIDER_LOGS === 'true') {
    try {
      await fetch(supabaseUrl(env, 'news_provider_logs'), {
        method: 'POST',
        headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
        body: JSON.stringify([{
          provider: normalized.provider,
          category: normalized.category,
          trigger_source: normalized.triggerSource,
          status: normalized.status,
          http_status: normalized.httpStatus,
          duration_ms: normalized.durationMs,
          attempt_count: normalized.attemptCount,
          items_fetched: normalized.itemsFetched,
          stories_saved: normalized.storiesSaved,
          retry_after_seconds: normalized.retryAfterSeconds,
          rate_limit_remaining: normalized.rateLimitRemaining,
          rate_limit_reset: normalized.rateLimitReset,
          request_url: normalized.requestUrl,
          error_message: normalized.errorMessage,
          failover_provider: normalized.failoverProvider,
          created_at: normalized.createdAt
        }])
      });
    } catch (err) {
      console.warn('Could not persist provider fetch log to Supabase:', err);
    }
  }

  return normalized;
}

export function getNewsProviderFetchLogs({
  provider = 'all',
  status = 'all',
  category = 'all',
  limit = 100
} = {}) {
  const filtered = providerFetchLogsMemory.filter((log) => {
    if (provider && provider !== 'all' && log.provider !== provider) return false;
    if (category && category !== 'all' && log.category !== category) return false;
    if (status && status !== 'all') {
      if (status === 'failover') {
        if (!log.failoverProvider && log.triggerSource !== 'failover') return false;
      } else if (log.status !== status) {
        return false;
      }
    }
    return true;
  });

  const totalRequests = providerFetchLogsMemory.length;
  const rateLimitedCount = providerFetchLogsMemory.filter(l => l.status === 'rate_limited').length;
  const failedCount = providerFetchLogsMemory.filter(l => l.status === 'failed').length;
  const failoverCount = providerFetchLogsMemory.filter(l => Boolean(l.failoverProvider) || l.triggerSource === 'failover').length;
  const totalDuration = providerFetchLogsMemory.reduce((acc, l) => acc + (l.durationMs || 0), 0);
  const averageLatencyMs = totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0;

  return {
    logs: filtered.slice(0, Math.max(1, Math.min(300, Number(limit) || 100))),
    totalMatching: filtered.length,
    summary: {
      totalRequests,
      rateLimitedCount,
      failedCount,
      failoverCount,
      averageLatencyMs
    }
  };
}

export function clearNewsProviderFetchLogs() {
  providerFetchLogsMemory.length = 0;
}

export async function getNewsAdminSnapshot(env, providers, pendingProvider = null) {
  const storyCountQuery = new URLSearchParams({ select: 'id' });
  const recentQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,removed_at,fetched_at,decision_action,decision_by,decision_at,previous_approved,previous_removed',
    decision_at: 'not.is.null',
    order: 'decision_at.desc'
  });
  const pendingQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,fetched_at,decision_action',
    approved: 'eq.false',
    removed: 'eq.false',
    or: '(decision_action.is.null,decision_action.eq.undo)',
    order: 'fetched_at.desc',
    limit: '100'
  });
  if (pendingProvider) pendingQuery.set('provider', `eq.${pendingProvider}`);
  const bannedQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,removed_at,fetched_at,decision_action,decision_by,decision_at,previous_approved,previous_removed',
    removed: 'eq.true',
    order: 'removed_at.desc.nullslast',
    limit: '100'
  });
  const providerCountRequests = providers.map(provider => {
    const query = new URLSearchParams({
      select: 'id',
      provider: `eq.${provider.id}`
    });
    return fetch(supabaseUrl(env, STORIES_TABLE, query), {
      headers: supabaseHeaders(env, { Range: '0-0', Prefer: 'count=exact' })
    });
  });
  const [countResponse, recentResponse, pendingResponse, bannedResponse, syncResponse, ...providerCountResponses] = await Promise.all([
    fetch(supabaseUrl(env, STORIES_TABLE, storyCountQuery), {
      headers: supabaseHeaders(env, { Range: '0-0', Prefer: 'count=exact' })
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, recentQuery), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, pendingQuery), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, bannedQuery), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, SYNC_TABLE, 'select=provider,status,started_at,last_attempt_at,last_success_at,stories_saved,last_error,updated_by'), {
      headers: supabaseHeaders(env)
    }),
    ...providerCountRequests
  ]);
  if (!countResponse.ok) throw new Error(`Story count lookup failed (HTTP ${countResponse.status})`);
  const contentRange = countResponse.headers.get('Content-Range') || '';
  const total = Number(contentRange.match(/\/(\d+|\*)$/)?.[1]);
  if (!Number.isFinite(total)) throw new Error('Story count lookup returned no exact count');
  const recentRows = await readRows(recentResponse, 'Recent story lookup');
  const pendingRows = await readRows(pendingResponse, 'Unapproved story lookup');
  const bannedRows = await readRows(bannedResponse, 'Banned story lookup');
  const syncRows = await readRows(syncResponse, 'Provider status lookup');
  const syncByProvider = new Map(syncRows.map(row => [row.provider, row]));

  // Derive latest hourly run timestamp if not set in memory yet
  if (!autoSyncStateMemory.lastRunAt && syncRows.length) {
    const latestAttempt = syncRows
      .map(r => Date.parse(r.last_attempt_at || r.last_success_at || ''))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    if (Number.isFinite(latestAttempt)) {
      autoSyncStateMemory.lastRunAt = new Date(latestAttempt).toISOString();
    }
  }

  const providerTotals = new Map(providers.map((provider, index) => {
    const response = providerCountResponses[index];
    if (!response.ok) throw new Error(`Story count lookup for ${provider.id} failed (HTTP ${response.status})`);
    const range = response.headers.get('Content-Range') || '';
    const total = Number(range.match(/\/(\d+|\*)$/)?.[1]);
    if (!Number.isFinite(total)) {
      throw new Error(`Story count lookup for ${provider.id} returned no exact count`);
    }
    return [provider.id, total];
  }));
  return {
    totalStories: total,
    recentStories: recentRows.map(row => ({
      ...normalizeStory(row),
      id: row.id,
      approved: row.approved,
      removed: row.removed,
      updatedAt: row.decision_at || row.fetched_at || '',
      decisionAction: row.decision_action,
      decisionBy: row.decision_by,
      decisionAt: row.decision_at,
      previousApproved: row.previous_approved,
      previousRemoved: row.previous_removed
    })),
    bannedStories: bannedRows.map(row => ({
      ...normalizeStory(row),
      id: row.id,
      approved: row.approved,
      removed: row.removed,
      updatedAt: row.removed_at || row.decision_at || row.fetched_at || '',
      decisionAction: row.decision_action,
      decisionBy: row.decision_by,
      decisionAt: row.decision_at,
      previousApproved: row.previous_approved,
      previousRemoved: row.previous_removed
    })),
    pendingStories: pendingRows.map(row => ({
      ...normalizeStory(row),
      id: row.id,
      approved: row.approved,
      updatedAt: row.fetched_at || '',
      decisionAction: row.decision_action || ''
    })),
    providers: providers.map(provider => {
      const syncRow = syncByProvider.get(provider.id) || {
        status: 'never',
        started_at: null,
        last_attempt_at: null,
        last_success_at: null,
        stories_saved: 0,
        last_error: null,
        updated_by: null
      };
      const cooldown = getProviderCooldownState(provider.id);
      return {
        ...provider,
        total_stories_saved: providerTotals.get(provider.id) || 0,
        ...syncRow,
        ...(cooldown ? {
          cooldown_until: cooldown.cooldownUntil,
          rate_limit_reset_at: cooldown.rateLimitResetAt,
          retry_after_seconds: cooldown.retryAfterSeconds,
          rate_limit_remaining: cooldown.rateLimitRemaining,
          failover_provider: cooldown.failoverProvider,
          failover_categories: cooldown.failoverCategories
        } : {})
      };
    }),
    autoSync: getAutoSyncState(),
    providerLogs: getNewsProviderFetchLogs({ limit: 100 }),
    aiCuration: await ensureAndGetAiCurationSnapshot(env, {
      recentRows,
      bannedRows,
      pendingRows
    })
  };
}

export async function approveNewsStory(env, storyId, approvedBy) {
  const query = new URLSearchParams({
    id: `eq.${storyId}`,
    approved: 'eq.false',
    removed: 'eq.false',
    select: 'id'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      approved: true,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      decision_action: 'approve',
      decision_by: approvedBy,
      decision_at: new Date().toISOString(),
      previous_approved: false,
      previous_removed: false
    })
  });
  const rows = await readRows(response, 'Story approval update');
  if (rows.length !== 1) return false;
  syncAiStagedPickDecision(Number(storyId), 'approved', approvedBy);
  return true;
}

export async function updateNewsStory(env, storyId, story) {
  const query = new URLSearchParams({
    id: `eq.${storyId}`,
    select: 'id'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      title: story.title,
      category: story.category,
      article_url: story.link,
      image_url: story.image || null,
      description: story.description || null,
      content: story.content || null,
      ai_summary: story.aiSummary || null,
      published_at: story.pubDate || null,
      source_name: story.source || null
    })
  });
  const rows = await readRows(response, 'Story detail update');
  if (rows.length === 1) {
    syncAiStagedPickDetails(Number(storyId), story);
  }
  return rows.length === 1;
}

export async function createApprovedCustomNewsStory(env, story, approvedBy) {
  const now = new Date().toISOString();
  const query = new URLSearchParams({
    on_conflict: 'provider,category,article_url'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'POST',
    headers: supabaseHeaders(env, {
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify([{
      provider: 'custom',
      category: story.category,
      title: story.title,
      article_url: story.link,
      image_url: story.image || null,
      description: story.description || null,
      content: story.content || null,
      ai_summary: story.aiSummary || null,
      published_at: story.pubDate || null,
      source_name: story.source || null,
      approved: true,
      approved_by: approvedBy,
      approved_at: now,
      removed: false,
      removed_by: null,
      removed_at: null,
      decision_action: 'approve',
      decision_by: approvedBy,
      decision_at: now,
      previous_approved: false,
      previous_removed: false
    }])
  });
  const rows = await readRows(response, 'Custom story publish');
  if (rows.length !== 1 || !Number.isSafeInteger(rows[0].id)) {
    throw new Error('Custom story publish returned an invalid response');
  }
  return rows[0].id;
}

export async function disapproveNewsStory(env, storyId, decidedBy) {
  const lookupQuery = new URLSearchParams({
    id: `eq.${storyId}`,
    removed: 'eq.false',
    select: 'id,approved,removed'
  });
  const lookup = await fetch(supabaseUrl(env, STORIES_TABLE, lookupQuery), {
    headers: supabaseHeaders(env)
  });
  const matchingRows = await readRows(lookup, 'Story disapproval lookup');
  if (matchingRows.length !== 1) return false;
  const previous = matchingRows[0];
  if (previous.removed) return false;
  const query = new URLSearchParams({
    id: `eq.${storyId}`,
    approved: `eq.${previous.approved}`,
    removed: 'eq.false',
    select: 'id'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      approved: false,
      approved_by: null,
      approved_at: null,
      decision_action: 'disapprove',
      decision_by: decidedBy,
      decision_at: new Date().toISOString(),
      previous_approved: previous.approved,
      previous_removed: false
    })
  });
  const rows = await readRows(response, 'Story disapproval update');
  if (rows.length === 1) {
    syncAiStagedPickDecision(Number(storyId), 'disapproved', decidedBy);
  }
  return rows.length === 1;
}

export async function banNewsStory(env, storyId, bannedBy) {
  const query = new URLSearchParams({
    id: `eq.${storyId}`,
    approved: 'eq.false',
    removed: 'eq.false',
    select: 'id'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      removed: true,
      removed_by: bannedBy,
      removed_at: new Date().toISOString(),
      decision_action: 'ban',
      decision_by: bannedBy,
      decision_at: new Date().toISOString(),
      previous_approved: false,
      previous_removed: false
    })
  });
  const rows = await readRows(response, 'Story ban update');
  if (rows.length === 1) {
    syncAiStagedPickDecision(Number(storyId), 'banned', bannedBy);
  }
  return rows.length === 1;
}

export async function undoNewsStoryDecision(env, storyId, undoneBy) {
  const query = new URLSearchParams({
    id: `eq.${storyId}`,
    decision_action: 'in.(approve,disapprove,unapprove,ban)',
    decision_at: 'not.is.null',
    select: 'id,approved,removed,decision_action,decision_at,previous_approved,previous_removed'
  });
  const lookup = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    headers: supabaseHeaders(env)
  });
  const rows = await readRows(lookup, 'Story decision lookup');
  if (rows.length !== 1 || rows[0].previous_approved == null || rows[0].previous_removed == null) {
    return false;
  }
  const decision = rows[0];
  const updateQuery = new URLSearchParams({
    id: `eq.${storyId}`,
    decision_action: `eq.${decision.decision_action}`,
    decision_at: `eq.${decision.decision_at}`,
    approved: `eq.${decision.approved}`,
    removed: `eq.${decision.removed}`,
    select: 'id'
  });
  const response = await fetch(supabaseUrl(env, updateQuery ? STORIES_TABLE : STORIES_TABLE, updateQuery), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      approved: decision.previous_approved,
      removed: decision.previous_removed,
      approved_by: decision.previous_approved ? undoneBy : null,
      approved_at: decision.previous_approved ? new Date().toISOString() : null,
      removed_by: decision.previous_removed ? undoneBy : null,
      removed_at: decision.previous_removed ? new Date().toISOString() : null,
      decision_action: 'undo',
      decision_by: undoneBy,
      decision_at: new Date().toISOString(),
      previous_approved: null,
      previous_removed: null
    })
  });
  const updatedRows = await readRows(response, 'Story decision undo');
  if (updatedRows.length === 1) {
    const nextState = decision.previous_removed
      ? 'banned'
      : decision.previous_approved
        ? 'approved'
        : 'staged';
    syncAiStagedPickDecision(Number(storyId), nextState, undoneBy);
  }
  return updatedRows.length === 1;
}

export async function claimNewsProviderSync(env, provider, updatedBy) {
  const response = await fetch(supabaseUrl(env, 'rpc/claim_news_provider_sync'), {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({ p_provider: provider, p_updated_by: updatedBy })
  });
  if (!response.ok) throw new Error(`Could not claim provider update (HTTP ${response.status})`);
  const result = await response.json();
  if (typeof result !== 'boolean') throw new Error('Provider update lock returned an invalid response');
  return result;
}

export async function upsertNewsStories(env, provider, category, stories) {
  if (!stories.length) return { savedCount: 0, duplicatesSkipped: 0 };
  const seenUrls = new Set();
  const uniqueStories = [];
  let duplicatesSkipped = 0;
  for (const story of stories) {
    if (!story?.link || seenUrls.has(story.link)) {
      duplicatesSkipped++;
      continue;
    }
    seenUrls.add(story.link);
    uniqueStories.push(story);
  }
  if (!uniqueStories.length) return { savedCount: 0, duplicatesSkipped };
  const rows = uniqueStories.map(story => ({
    provider,
    category,
    title: story.title,
    article_url: story.link,
    image_url: story.image || null,
    description: story.description || null,
    content: story.content || null,
    published_at: story.pubDate || null,
    source_name: story.source || null,
    fetched_at: new Date().toISOString()
  }));
  const query = new URLSearchParams({
    on_conflict: 'provider,category,article_url'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'POST',
    headers: supabaseHeaders(env, {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`Saving ${provider}/${category} stories failed (HTTP ${response.status})`);
  return { savedCount: rows.length, duplicatesSkipped };
}

export async function finishNewsProviderSync(env, provider, {
  status,
  storiesSaved,
  error = null
}) {
  const query = new URLSearchParams({ provider: `eq.${provider}` });
  const response = await fetch(supabaseUrl(env, SYNC_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({
      status,
      started_at: null,
      last_success_at: status === 'succeeded' || status === 'partial' ? new Date().toISOString() : undefined,
      stories_saved: storiesSaved,
      last_error: error,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Saving ${provider} update status failed (HTTP ${response.status})`);
}

export function buildKeywordOrFilter(queryText) {
  const raw = String(queryText || '')
    .trim()
    .replace(/[-_+]+/g, ' ')
    .replace(/[,()*%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';

  const baseTerms = [raw, ...raw.split(/\s+/).filter(t => t.length >= 2)];
  const expanded = [];
  for (const term of baseTerms) {
    const lower = term.toLowerCase();
    expanded.push(lower);
    if (lower.endsWith('ies') && lower.length > 4) {
      expanded.push(`${lower.slice(0, -3)}y`);
    } else if (lower.endsWith('y') && lower.length > 3 && !/[aeiou]y$/.test(lower)) {
      expanded.push(`${lower.slice(0, -1)}ies`);
    }
    if (lower.endsWith('es') && lower.length > 4) {
      expanded.push(lower.slice(0, -2));
      expanded.push(lower.slice(0, -1));
    } else if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
      expanded.push(lower.slice(0, -1));
    } else if (lower.length >= 3 && !lower.endsWith('s')) {
      expanded.push(`${lower}s`);
    }
  }

  const uniqueTerms = Array.from(new Set(expanded.filter(Boolean))).slice(0, 6);
  const clauses = [];
  for (const term of uniqueTerms) {
    clauses.push(
      `title.ilike.*${term}*`,
      `description.ilike.*${term}*`,
      `content.ilike.*${term}*`,
      `ai_summary.ilike.*${term}*`,
      `source_name.ilike.*${term}*`,
      `category.ilike.*${term}*`
    );
  }
  return `(${clauses.join(',')})`;
}

export async function getStoredKeywordNewsFeed(env, keyword) {
  const orFilter = buildKeywordOrFilter(keyword);
  if (!orFilter) {
    return { provider: 'supabase', topic: keyword, items: [] };
  }

  const makeQuery = approved => new URLSearchParams({
    select: 'provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,fetched_at',
    approved: `eq.${approved}`,
    removed: 'eq.false',
    or: orFilter,
    order: 'published_at.desc.nullslast,fetched_at.desc',
    limit: '50'
  });

  const [approvedResponse, unapprovedResponse] = await Promise.all([
    fetch(supabaseUrl(env, STORIES_TABLE, makeQuery(true)), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, makeQuery(false)), {
      headers: supabaseHeaders(env)
    })
  ]);
  const [approvedRows, unapprovedRows] = await Promise.all([
    readRows(approvedResponse, 'Approved keyword news feed lookup'),
    readRows(unapprovedResponse, 'Unapproved keyword news feed lookup')
  ]);
  const seenUrls = new Set();
  const items = [];
  for (const row of [...approvedRows, ...unapprovedRows]) {
    if (seenUrls.has(row.article_url)) continue;
    seenUrls.add(row.article_url);
    items.push({ ...normalizeStory(row), approved: row.approved });
  }
  return { provider: 'supabase', topic: keyword, items };
}

export async function searchNewsStories(env, queryText, limit = 100) {
  const orFilter = buildKeywordOrFilter(queryText);
  if (!orFilter) return [];

  const params = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,fetched_at,approved_at,removed_at,decision_action,decision_by,decision_at,previous_approved,previous_removed',
    or: orFilter,
    order: 'published_at.desc.nullslast,fetched_at.desc',
    limit: String(limit)
  });
  try {
    const response = await fetch(supabaseUrl(env, STORIES_TABLE, params), {
      headers: supabaseHeaders(env)
    });
    if (!response.ok) return [];
    const rows = await response.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(row => ({
      ...normalizeStory(row),
      id: row.id,
      approved: row.approved,
      removed: row.removed,
      updatedAt: row.decision_at || row.approved_at || row.removed_at || row.fetched_at || row.published_at || '',
      decisionAction: row.decision_action || (row.removed ? 'ban' : row.approved ? 'approve' : ''),
      decisionBy: row.decision_by || '',
      previousApproved: row.previous_approved,
      previousRemoved: row.previous_removed
    }));
  } catch (err) {
    console.error('searchNewsStories failed:', err);
    return [];
  }
}

/* ============================================================================
 * AI DAILY STORY CURATION & STAGING QUEUE (3x/Day: Morning, Afternoon, Evening)
 * ============================================================================ */

export const AI_CURATION_SLOTS = Object.freeze(['morning', 'afternoon', 'evening']);
export const AI_PICKS_PER_CATEGORY = 5;
const AI_CURATION_MODEL = '@cf/meta/llama-3.1-8b-instruct';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'are', 'was',
  'were', 'will', 'would', 'could', 'should', 'about', 'into', 'over', 'after',
  'before', 'under', 'between', 'through', 'during', 'what', 'when', 'where',
  'which', 'while', 'their', 'there', 'these', 'those', 'they', 'them', 'then',
  'than', 'some', 'such', 'more', 'most', 'other', 'only', 'also', 'just',
  'like', 'make', 'made', 'many', 'much', 'very', 'your', 'our', 'new', 'news',
  'says', 'said', 'report', 'reports', 'year', 'years', 'first', 'time', 'today',
  'week', 'month', 'world', 'how', 'why', 'who', 'its', 'his', 'her', 'has', 'had'
]);

const aiTasteProfileMemory = {
  customInstructions: 'Prioritize joyful, insightful, family-friendly, and high-signal stories across childcare, wildlife conservation, creative arts, breakthrough AI and technology, constructive global currents, and uplifting human-interest news. Avoid clickbait, partisan outrage, repetitive stock tickers, celebrity gossip, or grim crime blotters.',
  preferredKeywords: 'breakthrough, discovery, family, conservation, kindness, innovation, creativity, community, science, wildlife, education, rescue, art',
  mutedKeywords: 'gossip, scandal, lottery, crash, partisan, clickbait, rumor, tragedy, lawsuit',
  updatedAt: null,
  updatedBy: 'system'
};

const aiCurationStateMemory = {
  enabled: true,
  picksPerCategory: AI_PICKS_PER_CATEGORY,
  lastRunAt: null,
  lastSlot: null,
  lastBatchId: null,
  lastTrigger: null,
  lastStatus: 'never',
  lastSummary: null,
  completedSlotsByDate: {},
  updatedAt: null,
  updatedBy: 'system'
};

// Map of storyId -> staged pick entry
const aiStagedPicksMemory = new Map();
const dismissedOrDecidedStoryIds = new Set();
let learnedSignalsCache = {
  approvedCount: 0,
  rejectedCount: 0,
  topApprovedSources: [],
  topApprovedCategories: [],
  topApprovedTerms: [],
  avoidedSources: [],
  avoidedTerms: [],
  recentApprovedSample: [],
  recentRejectedSample: []
};

export function getDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentCurationSlot(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

export function getSlotLabel(slot) {
  if (slot === 'morning') return 'Morning Edition (08:00)';
  if (slot === 'afternoon') return 'Afternoon Edition (13:00)';
  if (slot === 'evening') return 'Evening Edition (18:00)';
  return 'Latest Edition';
}

export function getNextCurationWindow(now = new Date()) {
  const scheduleHours = [
    { slot: 'morning', hour: 8 },
    { slot: 'afternoon', hour: 13 },
    { slot: 'evening', hour: 18 }
  ];
  for (const item of scheduleHours) {
    const candidate = new Date(now);
    candidate.setHours(item.hour, 0, 0, 0);
    if (candidate.getTime() > now.getTime()) {
      return { slot: item.slot, nextRunAt: candidate.toISOString() };
    }
  }
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);
  return { slot: 'morning', nextRunAt: tomorrowMorning.toISOString() };
}

function parseCommaList(str) {
  return String(str || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 2);
}

function extractMeaningfulTerms(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^-+|-+$/g, ''))
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

export function computeLearnedTasteSignals(recentRows = [], bannedRows = []) {
  const approvedRows = [];
  const rejectedRows = [];

  for (const row of recentRows) {
    const isApproved = row.approved === true || row.decision_action === 'approve' || row.decisionAction === 'approve';
    const isRejected = row.removed === true ||
      row.decision_action === 'disapprove' || row.decisionAction === 'disapprove' ||
      row.decision_action === 'ban' || row.decisionAction === 'ban';
    if (isApproved && !row.removed) {
      approvedRows.push(row);
    } else if (isRejected) {
      rejectedRows.push(row);
    }
    if (row.id != null && (isApproved || isRejected)) {
      dismissedOrDecidedStoryIds.add(Number(row.id));
    }
  }

  for (const row of bannedRows) {
    if (row.id != null) dismissedOrDecidedStoryIds.add(Number(row.id));
    if (!rejectedRows.some(r => r.id === row.id)) {
      rejectedRows.push(row);
    }
  }

  const approvedSourceCounts = new Map();
  const approvedCatCounts = new Map();
  const approvedTermCounts = new Map();
  const rejectedSourceCounts = new Map();
  const rejectedTermCounts = new Map();

  for (const row of approvedRows) {
    const src = String(row.source_name || row.source || '').trim();
    if (src) approvedSourceCounts.set(src, (approvedSourceCounts.get(src) || 0) + 1);
    const cat = String(row.category || 'all').trim();
    approvedCatCounts.set(cat, (approvedCatCounts.get(cat) || 0) + 1);
    for (const term of extractMeaningfulTerms(`${row.title || ''} ${row.description || ''}`)) {
      approvedTermCounts.set(term, (approvedTermCounts.get(term) || 0) + 1);
    }
  }

  for (const row of rejectedRows) {
    const src = String(row.source_name || row.source || '').trim();
    if (src) rejectedSourceCounts.set(src, (rejectedSourceCounts.get(src) || 0) + 1);
    for (const term of extractMeaningfulTerms(row.title || '')) {
      if ((approvedTermCounts.get(term) || 0) === 0) {
        rejectedTermCounts.set(term, (rejectedTermCounts.get(term) || 0) + 1);
      }
    }
  }

  const topEntries = (map, limit = 8) => Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

  learnedSignalsCache = {
    approvedCount: approvedRows.length,
    rejectedCount: rejectedRows.length,
    topApprovedSources: topEntries(approvedSourceCounts, 6),
    topApprovedCategories: topEntries(approvedCatCounts, 7),
    topApprovedTerms: topEntries(approvedTermCounts, 10),
    avoidedSources: topEntries(rejectedSourceCounts, 5),
    avoidedTerms: topEntries(rejectedTermCounts, 8),
    recentApprovedSample: approvedRows.slice(0, 12).map(r => ({
      id: r.id,
      title: r.title,
      category: r.category || 'all',
      source: r.source_name || r.source || ''
    })),
    recentRejectedSample: rejectedRows.slice(0, 10).map(r => ({
      id: r.id,
      title: r.title,
      category: r.category || 'all',
      source: r.source_name || r.source || ''
    }))
  };

  return learnedSignalsCache;
}

export function syncAiStagedPickDecision(storyId, nextStatus, decidedBy = 'admin') {
  const numId = Number(storyId);
  if (!Number.isFinite(numId)) return;
  if (nextStatus === 'approved' || nextStatus === 'disapproved' || nextStatus === 'banned') {
    dismissedOrDecidedStoryIds.add(numId);
  } else if (nextStatus === 'staged') {
    dismissedOrDecidedStoryIds.delete(numId);
  }
  const existing = aiStagedPicksMemory.get(numId);
  if (!existing) return;
  existing.status = nextStatus;
  existing.approved = nextStatus === 'approved';
  existing.removed = nextStatus === 'banned';
  existing.decisionAction = nextStatus === 'approved'
    ? 'approve'
    : nextStatus === 'disapproved'
      ? 'disapprove'
      : nextStatus === 'banned'
        ? 'ban'
        : 'undo';
  existing.decisionBy = decidedBy;
  existing.decisionAt = new Date().toISOString();
  existing.updatedAt = existing.decisionAt;
}

export function syncAiStagedPickDetails(storyId, updatedFields = {}) {
  const numId = Number(storyId);
  const existing = aiStagedPicksMemory.get(numId);
  if (!existing) return;
  if (updatedFields.title !== undefined) existing.title = updatedFields.title;
  if (updatedFields.category !== undefined) existing.category = updatedFields.category;
  if (updatedFields.link !== undefined) existing.link = updatedFields.link;
  if (updatedFields.image !== undefined) existing.image = updatedFields.image;
  if (updatedFields.description !== undefined) existing.description = updatedFields.description;
  if (updatedFields.content !== undefined) existing.content = updatedFields.content;
  if (updatedFields.aiSummary !== undefined) existing.aiSummary = updatedFields.aiSummary;
  if (updatedFields.pubDate !== undefined) existing.pubDate = updatedFields.pubDate;
  if (updatedFields.source !== undefined) existing.source = updatedFields.source;
  existing.updatedAt = new Date().toISOString();
}

export function getAiCurationState() {
  const now = new Date();
  const dateKey = getDateKey(now);
  const currentSlot = getCurrentCurationSlot(now);
  const completedSlotsToday = aiCurationStateMemory.completedSlotsByDate[dateKey] || [];
  const isSlotDue = aiCurationStateMemory.enabled && !completedSlotsToday.includes(currentSlot);
  const nextWindow = getNextCurationWindow(now);

  const allPicks = Array.from(aiStagedPicksMemory.values())
    .sort((a, b) => {
      if (a.curatedAt !== b.curatedAt) return (b.curatedAt || '').localeCompare(a.curatedAt || '');
      if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
      return (a.rank || 99) - (b.rank || 99);
    });

  const activeStagedPicks = allPicks.filter(pick => pick.status === 'staged' && !pick.approved && !pick.removed);

  const categoryCounts = {};
  for (const cat of NEWS_CATEGORIES) {
    categoryCounts[cat] = activeStagedPicks.filter(p => p.category === cat).length;
  }

  return {
    enabled: aiCurationStateMemory.enabled,
    picksPerCategory: AI_PICKS_PER_CATEGORY,
    currentSlot,
    currentSlotLabel: getSlotLabel(currentSlot),
    isSlotDue,
    lastRunAt: aiCurationStateMemory.lastRunAt,
    lastSlot: aiCurationStateMemory.lastSlot,
    lastBatchId: aiCurationStateMemory.lastBatchId,
    lastTrigger: aiCurationStateMemory.lastTrigger,
    lastStatus: aiCurationStateMemory.lastStatus,
    lastSummary: aiCurationStateMemory.lastSummary,
    nextSlot: nextWindow.slot,
    nextRunAt: aiCurationStateMemory.enabled ? nextWindow.nextRunAt : null,
    completedSlotsToday,
    tasteProfile: { ...aiTasteProfileMemory },
    learnedSignals: learnedSignalsCache,
    stagedPicks: activeStagedPicks,
    recentCuratedPicks: allPicks.slice(0, 105),
    categoryCounts
  };
}

export function updateAiCurationConfig(updates = {}, updatedBy = 'admin') {
  if (typeof updates.enabled === 'boolean') {
    aiCurationStateMemory.enabled = updates.enabled;
  }
  if (typeof updates.customInstructions === 'string') {
    aiTasteProfileMemory.customInstructions = updates.customInstructions.trim().slice(0, 2000);
  }
  if (typeof updates.preferredKeywords === 'string') {
    aiTasteProfileMemory.preferredKeywords = updates.preferredKeywords.trim().slice(0, 1000);
  }
  if (typeof updates.mutedKeywords === 'string') {
    aiTasteProfileMemory.mutedKeywords = updates.mutedKeywords.trim().slice(0, 1000);
  }
  const nowIso = new Date().toISOString();
  aiTasteProfileMemory.updatedAt = nowIso;
  aiTasteProfileMemory.updatedBy = updatedBy;
  aiCurationStateMemory.updatedAt = nowIso;
  aiCurationStateMemory.updatedBy = updatedBy;
  return getAiCurationState();
}

function scoreCandidateStory(story, signals, tasteProfile) {
  let score = 62;
  const reasons = [];
  const textBlob = `${story.title || ''} ${story.description || ''} ${story.content || ''}`.toLowerCase();
  const titleLower = String(story.title || '').toLowerCase();
  const sourceName = String(story.source || story.source_name || '').trim();

  // 1. Check editable taste profile preferred & muted keywords
  const preferredList = parseCommaList(tasteProfile.preferredKeywords);
  const mutedList = parseCommaList(tasteProfile.mutedKeywords);
  const matchedPreferred = preferredList.filter(kw => textBlob.includes(kw));
  const matchedMuted = mutedList.filter(kw => textBlob.includes(kw));

  if (matchedPreferred.length > 0) {
    score += Math.min(18, matchedPreferred.length * 6);
    reasons.push(`matches taste themes (${matchedPreferred.slice(0, 2).map(k => `'${k}'`).join(', ')})`);
  }
  if (matchedMuted.length > 0) {
    score -= Math.min(35, matchedMuted.length * 15);
  }

  // 2. Check learned historical source affinity
  const approvedSourceHit = signals.topApprovedSources.find(
    s => s.name.toLowerCase() === sourceName.toLowerCase()
  );
  const avoidedSourceHit = signals.avoidedSources.find(
    s => s.name.toLowerCase() === sourceName.toLowerCase()
  );
  if (approvedSourceHit) {
    score += Math.min(14, 5 + approvedSourceHit.count * 2);
    reasons.push(`trusted source (${sourceName}) from past approvals`);
  }
  if (avoidedSourceHit && !approvedSourceHit) {
    score -= Math.min(16, 4 + avoidedSourceHit.count * 3);
  }

  // 3. Check learned historical terms from previously approved stories
  const matchedLearnedTerms = signals.topApprovedTerms
    .filter(t => titleLower.includes(t.name))
    .map(t => t.name);
  if (matchedLearnedTerms.length > 0) {
    score += Math.min(12, matchedLearnedTerms.length * 5);
    reasons.push(`aligns with approved topics (${matchedLearnedTerms.slice(0, 2).join(', ')})`);
  }

  const matchedAvoidedTerms = signals.avoidedTerms
    .filter(t => titleLower.includes(t.name))
    .map(t => t.name);
  if (matchedAvoidedTerms.length > 0) {
    score -= Math.min(18, matchedAvoidedTerms.length * 6);
  }

  // 4. Content quality & completeness signals
  const descLen = String(story.description || '').trim().length;
  if (story.image || story.image_url) {
    score += 5;
  }
  if (descLen >= 90) {
    score += 6;
    if (reasons.length < 2) reasons.push('strong article context & summary depth');
  } else if (descLen < 25) {
    score -= 6;
  }

  // 5. Recency boost
  const pubMs = Date.parse(story.pubDate || story.published_at || story.fetchedAt || story.fetched_at || '');
  if (Number.isFinite(pubMs)) {
    const ageHours = Math.max(0, (Date.now() - pubMs) / (1000 * 3600));
    if (ageHours <= 12) {
      score += 6;
      if (reasons.length < 2) reasons.push('freshly published');
    } else if (ageHours <= 36) {
      score += 3;
    }
  }

  const clampedScore = Math.max(15, Math.min(99, Math.round(score)));
  const categoryLabelMap = {
    all: 'Top Currents',
    childcare: 'Childcare & Family',
    animals: 'Animals & Nature',
    arts: 'Creative Arts',
    tech: 'Future Tech & AI',
    world: 'Global Currents',
    uplifting: 'Uplifting News'
  };
  const catLabel = categoryLabelMap[story.category] || story.category || 'Top Currents';
  const defaultReason = `High-signal ${catLabel} pick from ${sourceName || story.provider || 'curated feed'} fitting your editorial profile.`;
  const reasonText = reasons.length > 0
    ? `AI Pick (${clampedScore}% match): ${reasons.slice(0, 2).join(' · ')}.`
    : `AI Pick (${clampedScore}% match): ${defaultReason}`;

  return {
    score: clampedScore,
    reason: reasonText.charAt(0).toUpperCase() + reasonText.slice(1)
  };
}

async function selectCategoryPicksWithAi(env, category, candidates, signals, tasteProfile) {
  // First pre-score all candidates deterministically
  const scoredCandidates = candidates.map(story => {
    const { score, reason } = scoreCandidateStory(story, signals, tasteProfile);
    return {
      story,
      heuristicScore: score,
      heuristicReason: reason
    };
  }).sort((a, b) => b.heuristicScore - a.heuristicScore);

  const topPool = scoredCandidates.slice(0, 15);
  if (topPool.length === 0) return [];

  // Attempt Workers AI LLM ranking if env.AI is bound
  if (env?.AI && topPool.length > 1) {
    try {
      const approvedExamples = signals.recentApprovedSample
        .slice(0, 6)
        .map(s => `- [${s.category}] "${s.title}" (${s.source})`)
        .join('\n') || 'None recorded yet';
      const rejectedExamples = signals.recentRejectedSample
        .slice(0, 5)
        .map(s => `- [${s.category}] "${s.title}"`)
        .join('\n') || 'None recorded yet';
      const candidateLines = topPool.map((item, idx) => (
        `${idx + 1}. ID=${item.story.id} | Title: "${item.story.title}" | Source: ${item.story.source || item.story.provider} | Summary: ${(item.story.description || '').slice(0, 140)}`
      )).join('\n');

      const response = await env.AI.run(AI_CURATION_MODEL, {
        messages: [
          {
            role: 'system',
            content: 'You are the editorial AI curator for Littlables. Pick up to 5 news stories from the candidate list that the editor will most enjoy and approve based on their Taste Profile and Past Approval History. Respond ONLY with a valid JSON array of objects: [{"id": <number>, "score": <75-99>, "reason": "<concise 1-sentence reason why editor will enjoy this story>"}].'
          },
          {
            role: 'user',
            content: `Category: ${category}\nEditor Taste Profile: ${tasteProfile.customInstructions}\nPreferred Keywords: ${tasteProfile.preferredKeywords}\nMuted Keywords: ${tasteProfile.mutedKeywords}\n\nRecently Approved Stories:\n${approvedExamples}\n\nRecently Rejected Stories:\n${rejectedExamples}\n\nCandidate Stories:\n${candidateLines}\n\nSelect up to ${AI_PICKS_PER_CATEGORY} best stories as a JSON array.`
          }
        ],
        max_tokens: 450,
        temperature: 0.25
      });

      const rawText = typeof response?.response === 'string' ? response.response.trim() : '';
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          const picked = [];
          const usedIds = new Set();
          for (const entry of parsed) {
            const candidateId = Number(entry?.id);
            const found = topPool.find(c => Number(c.story.id) === candidateId);
            if (found && !usedIds.has(candidateId)) {
              usedIds.add(candidateId);
              picked.push({
                story: found.story,
                score: Number.isFinite(Number(entry.score))
                  ? Math.max(60, Math.min(99, Math.round(Number(entry.score))))
                  : found.heuristicScore,
                reason: typeof entry.reason === 'string' && entry.reason.trim().length > 8
                  ? entry.reason.trim().slice(0, 220)
                  : found.heuristicReason
              });
            }
            if (picked.length >= AI_PICKS_PER_CATEGORY) break;
          }
          // Fill remaining slots up to AI_PICKS_PER_CATEGORY using heuristic top scorers
          for (const fallbackItem of topPool) {
            if (picked.length >= AI_PICKS_PER_CATEGORY) break;
            const cid = Number(fallbackItem.story.id);
            if (!usedIds.has(cid)) {
              usedIds.add(cid);
              picked.push({
                story: fallbackItem.story,
                score: fallbackItem.heuristicScore,
                reason: fallbackItem.heuristicReason
              });
            }
          }
          return picked;
        }
      }
    } catch (err) {
      console.warn(`AI LLM curation fallback used for category ${category}:`, err);
    }
  }

  return topPool.slice(0, AI_PICKS_PER_CATEGORY).map(item => ({
    story: item.story,
    score: item.heuristicScore,
    reason: item.heuristicReason
  }));
}

async function fetchUnapprovedCandidatesByCategory(env) {
  const byCategory = new Map(NEWS_CATEGORIES.map(cat => [cat, []]));
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SECRET_KEY) {
    return byCategory;
  }

  const requests = NEWS_CATEGORIES.map(category => {
    const query = new URLSearchParams({
      select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,fetched_at,decision_action',
      approved: 'eq.false',
      removed: 'eq.false',
      category: `eq.${category}`,
      or: '(decision_action.is.null,decision_action.eq.undo)',
      order: 'published_at.desc.nullslast,fetched_at.desc',
      limit: '30'
    });
    return fetch(supabaseUrl(env, STORIES_TABLE, query), {
      headers: supabaseHeaders(env)
    }).then(res => res.ok ? res.json() : []).catch(() => []);
  });

  const results = await Promise.all(requests);
  NEWS_CATEGORIES.forEach((category, idx) => {
    const rows = Array.isArray(results[idx]) ? results[idx] : [];
    const normalized = rows
      .filter(row => row && row.id != null && !dismissedOrDecidedStoryIds.has(Number(row.id)))
      .map(row => ({
        ...normalizeStory(row),
        id: Number(row.id),
        approved: Boolean(row.approved),
        removed: Boolean(row.removed),
        updatedAt: row.fetched_at || row.published_at || ''
      }));
    byCategory.set(category, normalized);
  });

  return byCategory;
}

export async function runAiStoryCuration(env, {
  slot = null,
  triggerSource = 'manual',
  updatedBy = 'ai-curator',
  force = false,
  preloadedRecentRows = null,
  preloadedBannedRows = null,
  preloadedPendingRows = null
} = {}) {
  const now = new Date();
  const dateKey = getDateKey(now);
  const targetSlot = AI_CURATION_SLOTS.includes(slot) ? slot : getCurrentCurationSlot(now);
  const completedToday = aiCurationStateMemory.completedSlotsByDate[dateKey] || [];

  if (!force && !aiCurationStateMemory.enabled) {
    return {
      skipped: true,
      reason: 'AI daily story curation is currently paused',
      aiCuration: getAiCurationState()
    };
  }

  if (!force && triggerSource !== 'manual' && completedToday.includes(targetSlot)) {
    return {
      skipped: true,
      reason: `${getSlotLabel(targetSlot)} has already been curated today (${dateKey})`,
      aiCuration: getAiCurationState()
    };
  }

  // Refresh learned signals if rows are available or fetch them from Supabase
  let recentRows = preloadedRecentRows;
  let bannedRows = preloadedBannedRows;
  if ((!recentRows || !bannedRows) && env?.SUPABASE_URL && env?.SUPABASE_SECRET_KEY) {
    try {
      const [recRes, banRes] = await Promise.all([
        fetch(supabaseUrl(env, STORIES_TABLE, new URLSearchParams({
          select: 'id,provider,category,title,description,source_name,approved,removed,decision_action,decision_at',
          decision_at: 'not.is.null',
          order: 'decision_at.desc',
          limit: '60'
        })), { headers: supabaseHeaders(env) }),
        fetch(supabaseUrl(env, STORIES_TABLE, new URLSearchParams({
          select: 'id,provider,category,title,description,source_name,approved,removed,decision_action,removed_at',
          removed: 'eq.true',
          order: 'removed_at.desc.nullslast',
          limit: '40'
        })), { headers: supabaseHeaders(env) })
      ]);
      if (recRes.ok) recentRows = await recRes.json();
      if (banRes.ok) bannedRows = await banRes.json();
    } catch (err) {
      console.warn('Could not refresh history for AI curation:', err);
    }
  }
  if (Array.isArray(recentRows) || Array.isArray(bannedRows)) {
    computeLearnedTasteSignals(recentRows || [], bannedRows || []);
  }

  // Fetch per-category unapproved candidates
  let candidatesByCategory = await fetchUnapprovedCandidatesByCategory(env);

  // Also merge any preloadedPendingRows so categories always have maximum coverage
  if (Array.isArray(preloadedPendingRows) && preloadedPendingRows.length > 0) {
    for (const row of preloadedPendingRows) {
      if (!row || row.id == null || dismissedOrDecidedStoryIds.has(Number(row.id))) continue;
      const cat = NEWS_CATEGORIES.includes(row.category) ? row.category : 'all';
      const list = candidatesByCategory.get(cat) || [];
      if (!list.some(item => Number(item.id) === Number(row.id))) {
        list.push({
          ...normalizeStory(row),
          id: Number(row.id),
          approved: Boolean(row.approved),
          removed: Boolean(row.removed),
          updatedAt: row.fetched_at || row.updatedAt || ''
        });
        candidatesByCategory.set(cat, list);
      }
    }
  }

  // Replace previous 'staged' picks for this same slot or refresh staging queue cleanly
  for (const [existingId, pick] of aiStagedPicksMemory.entries()) {
    if (pick.status === 'staged' && (force || pick.slot === targetSlot)) {
      aiStagedPicksMemory.delete(existingId);
    }
  }

  const batchId = `${dateKey}-${targetSlot}`;
  const curatedAt = now.toISOString();
  const usedStoryIdsInRun = new Set();
  const stagedByCategory = {};
  let totalStagedInRun = 0;

  for (const category of NEWS_CATEGORIES) {
    const rawCandidates = (candidatesByCategory.get(category) || []).filter(
      c => !usedStoryIdsInRun.has(Number(c.id)) && !dismissedOrDecidedStoryIds.has(Number(c.id))
    );
    const pickedForCategory = await selectCategoryPicksWithAi(
      env,
      category,
      rawCandidates,
      learnedSignalsCache,
      aiTasteProfileMemory
    );

    stagedByCategory[category] = pickedForCategory.length;
    pickedForCategory.forEach((item, index) => {
      const storyId = Number(item.story.id);
      usedStoryIdsInRun.add(storyId);
      totalStagedInRun++;
      aiStagedPicksMemory.set(storyId, {
        ...item.story,
        id: storyId,
        storyId,
        category,
        slot: targetSlot,
        slotLabel: getSlotLabel(targetSlot),
        dateKey,
        batchId,
        rank: index + 1,
        score: item.score,
        reason: item.reason,
        curatedAt,
        curatedBy: updatedBy,
        triggerSource,
        status: 'staged'
      });
    });
  }

  const updatedSlots = Array.from(new Set([...completedToday, targetSlot]));
  aiCurationStateMemory.completedSlotsByDate[dateKey] = updatedSlots;
  aiCurationStateMemory.lastRunAt = curatedAt;
  aiCurationStateMemory.lastSlot = targetSlot;
  aiCurationStateMemory.lastBatchId = batchId;
  aiCurationStateMemory.lastTrigger = triggerSource;
  aiCurationStateMemory.lastStatus = totalStagedInRun > 0 ? 'succeeded' : 'empty';
  aiCurationStateMemory.lastSummary = `Staged ${totalStagedInRun} AI-picked stories across ${NEWS_CATEGORIES.length} categories for ${getSlotLabel(targetSlot)}`;
  aiCurationStateMemory.updatedAt = curatedAt;
  aiCurationStateMemory.updatedBy = updatedBy;

  return {
    skipped: false,
    slot: targetSlot,
    slotLabel: getSlotLabel(targetSlot),
    batchId,
    totalStagedInRun,
    stagedByCategory,
    aiCuration: getAiCurationState()
  };
}

export async function ensureAndGetAiCurationSnapshot(env, {
  recentRows = [],
  bannedRows = [],
  pendingRows = []
} = {}) {
  computeLearnedTasteSignals(recentRows, bannedRows);

  // Sync any existing staged picks against latest DB rows
  const approvedIdSet = new Set(
    recentRows.filter(r => r.approved && !r.removed).map(r => Number(r.id))
  );
  const disapprovedIdSet = new Set(
    recentRows.filter(r => !r.approved && !r.removed && r.decision_action === 'disapprove').map(r => Number(r.id))
  );
  const bannedIdSet = new Set(
    bannedRows.map(r => Number(r.id))
  );

  for (const [storyId, pick] of aiStagedPicksMemory.entries()) {
    if (bannedIdSet.has(storyId)) {
      pick.status = 'banned';
      pick.removed = true;
      pick.approved = false;
    } else if (approvedIdSet.has(storyId)) {
      pick.status = 'approved';
      pick.approved = true;
      pick.removed = false;
    } else if (disapprovedIdSet.has(storyId)) {
      pick.status = 'disapproved';
      pick.approved = false;
    }
  }

  // If auto-curation is enabled and either no run has happened yet or current slot is due, run curation
  const currentState = getAiCurationState();
  if (
    aiCurationStateMemory.enabled &&
    (aiCurationStateMemory.lastRunAt === null || currentState.isSlotDue) &&
    pendingRows.length > 0
  ) {
    try {
      await runAiStoryCuration(env, {
        slot: currentState.currentSlot,
        triggerSource: aiCurationStateMemory.lastRunAt === null ? 'initial_seed' : 'scheduled_window',
        updatedBy: 'ai-scheduler',
        preloadedRecentRows: recentRows,
        preloadedBannedRows: bannedRows,
        preloadedPendingRows: pendingRows
      });
    } catch (err) {
      console.warn('Automatic AI story curation on snapshot load failed:', err);
    }
  }

  return getAiCurationState();
}

export async function bulkDecideNewsStories(env, storyIds = [], action = 'approve', decidedBy = 'admin') {
  if (!['approve', 'disapprove', 'ban'].includes(action)) {
    throw new Error('Invalid bulk decision action');
  }
  const cleanIds = Array.from(new Set(
    (Array.isArray(storyIds) ? storyIds : [])
      .map(id => Number(id))
      .filter(id => Number.isSafeInteger(id) && id > 0)
  )).slice(0, 100);

  if (cleanIds.length === 0) {
    return { action, requestedCount: 0, succeededIds: [], failedIds: [] };
  }

  const succeededIds = [];
  const failedIds = [];

  await Promise.all(cleanIds.map(async (storyId) => {
    try {
      let ok = false;
      if (action === 'approve') {
        ok = await approveNewsStory(env, storyId, decidedBy);
      } else if (action === 'disapprove') {
        ok = await disapproveNewsStory(env, storyId, decidedBy);
      } else if (action === 'ban') {
        ok = await banNewsStory(env, storyId, decidedBy);
      }
      if (ok) {
        succeededIds.push(storyId);
      } else {
        // Still update local staged state if already decided
        syncAiStagedPickDecision(
          storyId,
          action === 'approve' ? 'approved' : action === 'ban' ? 'banned' : 'disapproved',
          decidedBy
        );
        failedIds.push(storyId);
      }
    } catch (err) {
      console.error(`Bulk ${action} failed for story ${storyId}:`, err);
      failedIds.push(storyId);
    }
  }));

  return {
    action,
    requestedCount: cleanIds.length,
    succeededCount: succeededIds.length,
    succeededIds,
    failedIds,
    aiCuration: getAiCurationState()
  };
}


