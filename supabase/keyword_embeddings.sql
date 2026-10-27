-- Persisted Workers AI embedding vectors for interest keyword descriptions.
-- Computed once (in safe chunks) and reused by every validation run, so the
-- 100 keyword descriptions don't cost AI calls on cold starts.
-- Rows are written by the worker's service-role key; never read by the frontend.
CREATE TABLE IF NOT EXISTS keyword_embeddings (
  keyword_id TEXT PRIMARY KEY,
  embedding JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tables created via psql don't get Supabase's default privileges; the
-- worker's service role needs explicit grants (RLS bypass alone isn't enough).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keyword_embeddings TO service_role;
