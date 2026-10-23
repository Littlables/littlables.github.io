-- Add country breakdowns to all analytics stats views.
-- board_analytics gets a country_code column (story_engagement and
-- search_queries already have one).

ALTER TABLE public.board_analytics
  ADD COLUMN IF NOT EXISTS country_code CHAR(2);

-- Reference: country -> region mapping (matches the 20 country keywords).
-- Used to roll up per-country stats into regions.
CREATE TABLE IF NOT EXISTS public.country_regions (
  country_code CHAR(2) PRIMARY KEY,
  region TEXT NOT NULL
);

INSERT INTO public.country_regions (country_code, region) VALUES
  ('US', 'north-america'), ('CA', 'north-america'), ('MX', 'north-america'),
  ('GB', 'europe'), ('IE', 'europe'), ('FR', 'europe'), ('DE', 'europe'),
  ('IT', 'europe'), ('ES', 'europe'), ('NL', 'europe'), ('SE', 'europe'),
  ('BR', 'south-america'),
  ('AU', 'oceania'), ('NZ', 'oceania'),
  ('CN', 'asia'), ('JP', 'asia'), ('IN', 'asia'), ('KR', 'asia'),
  ('ZA', 'africa'), ('EG', 'africa')
ON CONFLICT (country_code) DO UPDATE SET region = EXCLUDED.region;

GRANT SELECT ON public.country_regions TO service_role;

-- Helper: map a country code to its region, defaulting to 'global'.
CREATE OR REPLACE FUNCTION public.country_to_region(cc CHAR(2))
RETURNS TEXT LANGUAGE sql IMMUTABLE AS
$$ SELECT COALESCE((SELECT region FROM public.country_regions WHERE country_code = UPPER(cc)), 'global') $$;

GRANT EXECUTE ON FUNCTION public.country_to_region(CHAR(2)) TO service_role;

-- Keyword CTR by country and region
DROP VIEW IF EXISTS public.keyword_engagement_stats;
CREATE VIEW public.keyword_engagement_stats AS
SELECT
  kw AS keyword,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(*) FILTER (WHERE event_type = 'view') AS views,
  COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'view') > 0
    THEN COUNT(*) FILTER (WHERE event_type = 'click')::float / COUNT(*) FILTER (WHERE event_type = 'view')
    ELSE 0
  END AS ctr
FROM public.story_engagement, LATERAL unnest(keywords) AS kw
WHERE created_at > NOW() - INTERVAL '30 days'
  AND kw IS NOT NULL
GROUP BY kw, country_code;

GRANT SELECT ON public.keyword_engagement_stats TO service_role;

-- Acquisition by country and region
DROP VIEW IF EXISTS public.acquisition_stats;
CREATE VIEW public.acquisition_stats AS
SELECT
  COALESCE(NULLIF(referrer_domain, ''), '(direct)') AS referrer_domain,
  COALESCE(NULLIF(utm_source, ''), '(none)') AS utm_source,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(*) FILTER (WHERE event_type = 'view') AS views,
  COUNT(*) FILTER (WHERE event_type = 'click') AS clicks
FROM public.story_engagement
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3;

GRANT SELECT ON public.acquisition_stats TO service_role;

-- Dwell time by country and region
DROP VIEW IF EXISTS public.story_dwell_stats;
CREATE VIEW public.story_dwell_stats AS
SELECT
  story_url_hash,
  MAX(story_title) AS story_title,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(*) AS dwell_events,
  ROUND(AVG(dwell_seconds)) AS avg_dwell_seconds,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dwell_seconds)) AS median_dwell_seconds
FROM public.story_engagement
WHERE event_type = 'dwell'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY story_url_hash, country_code;

GRANT SELECT ON public.story_dwell_stats TO service_role;

-- Board topics by country and region
DROP VIEW IF EXISTS public.board_topic_stats;
CREATE VIEW public.board_topic_stats AS
SELECT
  kw AS keyword,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(*) AS boards_built
FROM public.board_analytics, LATERAL unnest(keyword_ids) AS kw
WHERE created_at > NOW() - INTERVAL '30 days'
  AND kw IS NOT NULL
GROUP BY kw, country_code
ORDER BY boards_built DESC;

GRANT SELECT ON public.board_topic_stats TO service_role;
