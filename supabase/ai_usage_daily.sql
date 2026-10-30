-- AI usage daily counters: powers the live call counts (Today / Last 7 days)
-- in the admin panel's "AI usage" section (GET /admin/api/ai-usage).
--
-- One row per day per model per use — never one row per call — so the table
-- stays tiny forever (at most ~15 rows a day) and needs no retention job.
-- Counts come from a single batched RPC per worker invocation (see
-- cloudflare-worker/src/ai-usage-log.mjs); the RPC upserts atomically, so
-- concurrent invocations never lose or double-count a call.
--
-- Columns: usage_date (UTC day), model (short key: llama, flux, sdxl, bge),
-- usage_key (dashboard row id: curation, summaries, scene, image, ai-tags,
-- validation, tagging, warmup, ad-auto-tag, ad-match, playroom-fallback),
-- calls (successful AI invocations), errors (failed invocations).
-- No prompts, story ids, user ids, or IPs are ever stored here.
--
-- Grants matter: tables created via psql get no automatic privileges (and
-- since 2026-10-30 Supabase grants nothing automatically to new public
-- tables), so without the explicit GRANTs below the worker would get
-- "permission denied" on both the RPC and the endpoint read. RLS is enabled
-- and nothing is granted to anon/authenticated, so this table is worker-only
-- by design (same pattern as ai_summaries); service_role bypasses RLS.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  usage_date date NOT NULL,
  model text NOT NULL,
  usage_key text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_date, model, usage_key)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_daily TO service_role;

CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_day date, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_usage_daily (usage_date, model, usage_key, calls, errors)
  SELECT p_day, r.model, r.usage_key,
         COALESCE(r.calls, 0), COALESCE(r.errors, 0)
  FROM jsonb_to_recordset(p_rows) AS r(model text, usage_key text, calls int, errors int)
  ON CONFLICT (usage_date, model, usage_key)
  DO UPDATE SET calls = ai_usage_daily.calls + EXCLUDED.calls,
                 errors = ai_usage_daily.errors + EXCLUDED.errors;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_usage(date, jsonb) TO service_role;
