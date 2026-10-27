-- Ad keyword tags for keyword-based ad matching.
-- Ads themselves stay in static JSON (fast CDN serving); only the tags live here.
-- Frontend fetches tags via GET /ads/tags and merges by ad_id client-side.

CREATE TABLE IF NOT EXISTS public.ad_keyword_tags (
  ad_id TEXT PRIMARY KEY,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role needs full access (worker uses service key)
GRANT ALL ON public.ad_keyword_tags TO service_role;

-- Allow public read via the worker API (worker uses service key, so this is belt-and-braces)
-- No RLS enabled = open via service key only; anon key has no grants.
