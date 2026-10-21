-- Story engagement tracking for recommendation engine feedback loop
-- Records anonymous views and clicks to learn what readers actually engage with

CREATE TABLE IF NOT EXISTS public.story_engagement (
  id BIGSERIAL PRIMARY KEY,
  story_url_hash TEXT NOT NULL,
  story_url TEXT NOT NULL,
  story_title TEXT,
  category TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast aggregation by story
CREATE INDEX IF NOT EXISTS idx_engagement_url_hash ON public.story_engagement(story_url_hash);
CREATE INDEX IF NOT EXISTS idx_engagement_created ON public.story_engagement(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_category ON public.story_engagement(category);

-- Enable RLS
ALTER TABLE public.story_engagement ENABLE ROW LEVEL SECURITY;

-- Anyone can insert engagement events (anonymous tracking)
CREATE POLICY IF NOT EXISTS "Anyone can record engagement"
  ON public.story_engagement FOR INSERT
  WITH CHECK (true);

-- Only service_role can read (aggregated via worker)
CREATE POLICY IF NOT EXISTS "Service role can read engagement"
  ON public.story_engagement FOR SELECT
  USING (false);

-- Grants
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
