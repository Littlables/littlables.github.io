-- Ad engagement tracking: impressions and clicks per ad (anonymous, COPPA-safe).
-- Powers ad CTR analytics for the $10k/month revenue goal.

CREATE TABLE IF NOT EXISTS public.ad_engagement (
  id BIGSERIAL PRIMARY KEY,
  ad_id TEXT NOT NULL,
  ad_title TEXT,
  network TEXT,
  category TEXT,
  -- Story context: which story the ad was shown next to (for keyword-ad matching later)
  story_url_hash TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
  session_id TEXT,
  country_code CHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_engagement_ad_id ON public.ad_engagement(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_engagement_created ON public.ad_engagement(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_engagement_network ON public.ad_engagement(network);

ALTER TABLE public.ad_engagement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record ad engagement" ON public.ad_engagement;
CREATE POLICY "Anyone can record ad engagement"
  ON public.ad_engagement FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read ad engagement" ON public.ad_engagement;
CREATE POLICY "Service role can read ad engagement"
  ON public.ad_engagement FOR SELECT
  USING (false);

GRANT INSERT ON public.ad_engagement TO anon;
GRANT INSERT ON public.ad_engagement TO authenticated;
GRANT ALL ON public.ad_engagement TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ad_engagement_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.ad_engagement_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ad_engagement_id_seq TO service_role;

-- Per-ad CTR (last 30 days), by country and region
CREATE OR REPLACE VIEW public.ad_engagement_stats AS
SELECT
  ad_id,
  MAX(ad_title) AS ad_title,
  MAX(network) AS network,
  MAX(category) AS category,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(*) FILTER (WHERE event_type = 'view') AS impressions,
  COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'view') > 0
    THEN COUNT(*) FILTER (WHERE event_type = 'click')::float / COUNT(*) FILTER (WHERE event_type = 'view')
    ELSE 0
  END AS ctr
FROM public.ad_engagement
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY ad_id, country_code;

GRANT SELECT ON public.ad_engagement_stats TO service_role;

-- Per-network rollup (last 30 days), by country and region
CREATE OR REPLACE VIEW public.ad_network_stats AS
SELECT
  COALESCE(NULLIF(network, ''), '(unknown)') AS network,
  country_code,
  public.country_to_region(country_code) AS region,
  COUNT(DISTINCT ad_id) AS ads,
  COUNT(*) FILTER (WHERE event_type = 'view') AS impressions,
  COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'view') > 0
    THEN COUNT(*) FILTER (WHERE event_type = 'click')::float / COUNT(*) FILTER (WHERE event_type = 'view')
    ELSE 0
  END AS ctr
FROM public.ad_engagement
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY impressions DESC;

GRANT SELECT ON public.ad_network_stats TO service_role;
