// Batched, fail-open AI usage counting for the admin dashboard's live counts.
//
// Each AI call site records its invocations in memory (counter.add) and the
// request or run flushes once at the end (counter.flush). A flush is a single
// PostgREST RPC call carrying every accumulated (model, use) total, so logging
// costs at most one extra subrequest per invocation no matter how many AI
// calls ran — the batched validation and multi-category curation runs stay
// comfortably under Cloudflare's 50-subrequest limit.
//
// Semantics: "calls" counts successful AI invocations; "errors" counts
// invocations that failed (threw, or returned nothing usable after retries).
// Total invocations for a row = calls + errors.
//
// A flush never throws: if Supabase is unreachable, the function is missing
// (pre-migration), or the RPC fails,
// the counts are dropped with a warning and the feature that was measured
// keeps working. Counts are cleared when a flush starts (at-most-once),
// so a retried flush never double-counts.
//
// The helper builds its own RPC URL and headers from env instead of importing
// news-storage's Supabase helpers: news-storage itself uses this module, so
// importing it back would create a module cycle.

const RPC_PATH = '/rest/v1/rpc/increment_ai_usage';

// Short model keys, matching the dashboard's AI_USAGE_MODELS map.
export const AI_USAGE_MODEL_LLAMA = 'llama';
export const AI_USAGE_MODEL_FLUX = 'flux';
export const AI_USAGE_MODEL_SDXL = 'sdxl';
export const AI_USAGE_MODEL_BGE = 'bge';

export function createAiUsageCounter() {
  const counts = new Map();

  return {
    add(model, use, calls = 1, errors = 0) {
      if (!model || !use) return;
      const callCount = Math.max(0, Math.floor(calls));
      const errorCount = Math.max(0, Math.floor(errors));
      if (callCount <= 0 && errorCount <= 0) return;
      const key = model + '\0' + use;
      const current = counts.get(key) || { model, use, calls: 0, errors: 0 };
      current.calls += callCount;
      current.errors += errorCount;
      counts.set(key, current);
    },

    snapshot() {
      return [...counts.values()].map((row) => ({ ...row }));
    },

    get size() {
      return counts.size;
    },

    async flush(env) {
      if (counts.size === 0) return false;
      const rows = [...counts.values()].map((row) => ({
        model: row.model,
        usage_key: row.use,
        calls: row.calls,
        errors: row.errors
      }));
      counts.clear();
      if (!env?.SUPABASE_URL || !env?.SUPABASE_SECRET_KEY) return false;
      try {
        const day = new Date().toISOString().slice(0, 10);
        const res = await fetch(
          `${String(env.SUPABASE_URL).replace(/\/$/, '')}${RPC_PATH}`,
          {
            method: 'POST',
            headers: {
              apikey: env.SUPABASE_SECRET_KEY,
              Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_day: day, p_rows: rows })
          }
        );
        if (!res.ok) console.warn('AI usage flush failed:', res.status);
        return res.ok;
      } catch (err) {
        console.warn('AI usage flush failed:', err?.message || err);
        return false;
      }
    }
  };
}
