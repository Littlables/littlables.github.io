-- Daily provider error stats for rate-limit monitoring.
-- Aggregates news_provider_logs by provider and day.

CREATE OR REPLACE VIEW public.provider_daily_errors AS
SELECT
  provider,
  DATE(created_at) AS error_date,
  COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limit_hits,
  COUNT(*) FILTER (WHERE status = 'failed') AS failures,
  COUNT(*) FILTER (WHERE status = 'succeeded') AS successes,
  COUNT(*) AS total_attempts,
  MAX(created_at) AS last_attempt_at
FROM public.news_provider_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY provider, DATE(created_at)
ORDER BY error_date DESC, provider;

GRANT SELECT ON public.provider_daily_errors TO service_role;
