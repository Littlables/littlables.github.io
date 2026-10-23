-- Story engagement tracking for recommendation engine feedback loop
-- Records anonymous views and clicks to learn what readers actually engage with

CREATE TABLE IF NOT EXISTS public.story_engagement (
  id BIGSERIAL PRIMARY KEY,
  story_url_hash TEXT NOT NULL,
  story_url TEXT NOT NULL,
  story_title TEXT,
  category TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'dwell')),
  session_id TEXT,
  -- Dwell time in seconds (only for event_type='dwell'; capped at 600s)
  dwell_seconds INT,
  -- Story's interest keywords at event time (for keyword CTR analytics)
  keywords TEXT[],
  -- Acquisition: where the session came from (domain only, never full URL)
  referrer_domain TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  -- Coarse geolocation (country only, from Cloudflare)
  country_code CHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast aggregation by story
CREATE INDEX IF NOT EXISTS idx_engagement_url_hash ON public.story_engagement(story_url_hash);
CREATE INDEX IF NOT EXISTS idx_engagement_created ON public.story_engagement(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_category ON public.story_engagement(category);

-- Enable RLS
ALTER TABLE public.story_engagement ENABLE ROW LEVEL SECURITY;

-- Anyone can insert engagement events (anonymous tracking).
-- NOTE: Postgres policies do not support IF NOT EXISTS — drop first.
DROP POLICY IF EXISTS "Anyone can record engagement" ON public.story_engagement;
CREATE POLICY "Anyone can record engagement"
  ON public.story_engagement FOR INSERT
  WITH CHECK (true);

-- Only service_role can read (aggregated via worker).
DROP POLICY IF EXISTS "Service role can read engagement" ON public.story_engagement;
CREATE POLICY "Service role can read engagement"
  ON public.story_engagement FOR SELECT
  USING (false);

-- Grants: worker uses service_role (bypasses RLS but still needs grants).
GRANT INSERT ON public.story_engagement TO anon;
GRANT INSERT ON public.story_engagement TO authenticated;
GRANT ALL ON public.story_engagement TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.story_engagement_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.story_engagement_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.story_engagement_id_seq TO service_role;

-- Aggregated view for the scorer (last 30 days)
CREATE OR REPLACE VIEW public.story_engagement_stats AS
SELECT
  story_url_hash,
  story_url,
  MAX(story_title) AS story_title,
  MAX(category) AS category,
  COUNT(*) FILTER (WHERE event_type = 'view') AS views,
  COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'view') > 0
    THEN COUNT(*) FILTER (WHERE event_type = 'click')::float / COUNT(*) FILTER (WHERE event_type = 'view')
    ELSE 0
  END AS ctr
FROM public.story_engagement
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY story_url_hash, story_url;

GRANT SELECT ON public.story_engagement_stats TO service_role;

-- Keyword-level CTR: which topics get viewed/clicked (last 30 days).
-- Powers "dinosaurs get 3x the click rate of weather" insights.
CREATE OR REPLACE VIEW public.keyword_engagement_stats AS
SELECT
  kw AS keyword,
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
GROUP BY kw;

GRANT SELECT ON public.keyword_engagement_stats TO service_role;

-- Acquisition: where engaged sessions come from (last 30 days).
CREATE OR REPLACE VIEW public.acquisition_stats AS
SELECT
  COALESCE(NULLIF(referrer_domain, ''), '(direct)') AS referrer_domain,
  COALESCE(NULLIF(utm_source, ''), '(none)') AS utm_source,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(*) FILTER (WHERE event_type = 'view') AS views,
  COUNT(*) FILTER (WHERE event_type = 'click') AS clicks
FROM public.story_engagement
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2;

GRANT SELECT ON public.acquisition_stats TO service_role;

-- ── Board creation analytics ──
-- Logs which pills users build boards from. Anonymous: no user_id, no board name.
-- (Board names can contain PII like a child's name; pills are the signal.)

CREATE TABLE IF NOT EXISTS public.board_analytics (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  keyword_ids TEXT[],
  category_ids TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_analytics_created ON public.board_analytics(created_at);

ALTER TABLE public.board_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log board creation" ON public.board_analytics;
CREATE POLICY "Anyone can log board creation"
  ON public.board_analytics FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read board analytics" ON public.board_analytics;
CREATE POLICY "Service role can read board analytics"
  ON public.board_analytics FOR SELECT
  USING (false);

GRANT INSERT ON public.board_analytics TO anon;
GRANT INSERT ON public.board_analytics TO authenticated;
GRANT ALL ON public.board_analytics TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.board_analytics_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.board_analytics_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.board_analytics_id_seq TO service_role;

-- Most-built board topics (last 30 days)
CREATE OR REPLACE VIEW public.board_topic_stats AS
SELECT
  kw AS keyword,
  COUNT(*) AS boards_built
FROM public.board_analytics, LATERAL unnest(keyword_ids) AS kw
WHERE created_at > NOW() - INTERVAL '30 days'
  AND kw IS NOT NULL
GROUP BY kw
ORDER BY boards_built DESC;

GRANT SELECT ON public.board_topic_stats TO service_role;

-- Average dwell time per story (last 30 days)
CREATE OR REPLACE VIEW public.story_dwell_stats AS
SELECT
  story_url_hash,
  MAX(story_title) AS story_title,
  COUNT(*) AS dwell_events,
  ROUND(AVG(dwell_seconds)) AS avg_dwell_seconds,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dwell_seconds)) AS median_dwell_seconds
FROM public.story_engagement
WHERE event_type = 'dwell'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY story_url_hash;

GRANT SELECT ON public.story_dwell_stats TO service_role;
