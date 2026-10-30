import { supabaseUrl, supabaseHeaders, SYNC_RUNS_TABLE } from './news-storage.mjs';

// Live provider sync run tracking for the admin panel run strip.
// Every helper is fail-open: run tracking must never break a sync, so any
// Supabase failure degrades to "no run row" instead of throwing.

// Heartbeats are throttled: at most one PATCH per 30 seconds per run,
// plus one whenever the provider changes, so a long crawl stays visible
// without spending the worker's subrequest budget on progress writes.
export const SYNC_RUN_HEARTBEAT_MIN_MS = 30_000;

export function isSyncRunHeartbeatDue({ lastHeartbeatMs, lastProvider, provider, nowMs = Date.now() }) {
  if (lastProvider !== provider) return true;
  if (lastHeartbeatMs == null) return true;
  return nowMs - lastHeartbeatMs >= SYNC_RUN_HEARTBEAT_MIN_MS;
}

export async function startSyncRun(env, { trigger, provider = null, pairsTotal = null }) {
  try {
    const res = await fetch(supabaseUrl(env, SYNC_RUNS_TABLE), {
      method: 'POST',
      headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
      body: JSON.stringify({
        trigger,
        provider,
        status: 'running',
        pairs_total: pairsTotal,
        pairs_done: 0,
        last_activity_at: new Date().toISOString()
      })
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
  } catch {
    return null;
  }
}

export async function updateSyncRun(env, runId, patch) {
  if (!runId) return false;
  try {
    const res = await fetch(
      supabaseUrl(env, SYNC_RUNS_TABLE, new URLSearchParams({ id: `eq.${runId}` })),
      {
        method: 'PATCH',
        headers: supabaseHeaders(env),
        body: JSON.stringify({
          ...patch,
          last_activity_at: patch.last_activity_at || new Date().toISOString()
        })
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function finishSyncRun(env, runId, { status, pairsDone = null, summary = null }) {
  if (!runId) return false;
  const patch = {
    status,
    summary,
    finished_at: new Date().toISOString(),
    current_provider: null,
    current_category: null
  };
  if (pairsDone !== null) patch.pairs_done = pairsDone;
  return updateSyncRun(env, runId, patch);
}
