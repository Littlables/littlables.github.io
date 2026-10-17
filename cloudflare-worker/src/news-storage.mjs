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
    source: row.source_name || '',
    provider: row.provider,
    category: row.category
  };
}

export async function getStoredNewsFeed(env, category) {
  const makeQuery = approved => new URLSearchParams({
    select: 'provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved',
    category: `eq.${category}`,
    approved: `eq.${approved}`,
    removed: 'eq.false',
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

export async function getNewsAdminSnapshot(env, providers) {
  const storyCountQuery = new URLSearchParams({ select: 'id' });
  const recentQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,removed_at,fetched_at,decision_action,decision_by,decision_at,previous_approved,previous_removed',
    decision_at: 'not.is.null',
    order: 'decision_at.desc',
    limit: '10'
  });
  const pendingQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,fetched_at,decision_action',
    approved: 'eq.false',
    removed: 'eq.false',
    or: '(decision_action.is.null,decision_action.eq.undo)',
    order: 'fetched_at.desc',
    limit: '100'
  });
  const bannedQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,removed,removed_at,fetched_at,decision_action,decision_by,decision_at,previous_approved,previous_removed',
    removed: 'eq.true',
    order: 'removed_at.desc.nullslast',
    limit: '100'
  });
  const [countResponse, recentResponse, pendingResponse, bannedResponse, syncResponse] = await Promise.all([
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
    })
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
    providers: providers.map(provider => ({
      ...provider,
      ...(syncByProvider.get(provider.id) || {
        status: 'never',
        started_at: null,
        last_attempt_at: null,
        last_success_at: null,
        stories_saved: 0,
        last_error: null,
        updated_by: null
      })
    }))
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
  if (!stories.length) return;
  const rows = stories.map(story => ({
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
