-- Search query logging: what users search for (anonymous, COPPA-safe).
-- No user_id, no IP, no session. Just the query + result count + country.

CREATE TABLE IF NOT EXISTS public.search_queries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INT NOT NULL DEFAULT 0,
  country_code CHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_queries_normalized ON public.search_queries (normalized_query, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON public.search_queries (created_at DESC);

ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

-- Only the worker (service_role) writes and reads. No anon access.
DROP POLICY IF EXISTS "Service role manages search queries" ON public.search_queries;
CREATE POLICY "Service role manages search queries"
  ON public.search_queries FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, DELETE ON public.search_queries TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.search_queries_id_seq TO service_role;

-- Top queries (last 30 days) with avg result counts, by country and region
CREATE OR REPLACE VIEW public.search_query_stats AS
SELECT
  normalized_query AS query,
  MAX(query) AS sample_query,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(*) AS searches,
  ROUND(AVG(result_count)) AS avg_results,
  MAX(created_at) AS last_searched
FROM public.search_queries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY normalized_query, country_code
ORDER BY searches DESC;

GRANT SELECT ON public.search_query_stats TO service_role;

-- Content gaps: frequent queries with zero (or near-zero) results, by country and region
CREATE OR REPLACE VIEW public.search_zero_result_queries AS
SELECT
  normalized_query AS query,
  MAX(query) AS sample_query,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(*) AS searches,
  ROUND(AVG(result_count)) AS avg_results,
  MAX(created_at) AS last_searched
FROM public.search_queries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY normalized_query, country_code
HAVING AVG(result_count) < 1
ORDER BY searches DESC;

GRANT SELECT ON public.search_zero_result_queries TO service_role;
