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
    providerLogs: getNewsProviderFetchLogs({ limit: 100 })
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
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, updateQuery), {
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
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,fetched_at',
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
      removed: row.removed
    }));
  } catch (err) {
    console.error('searchNewsStories failed:', err);
    return [];
  }
}

