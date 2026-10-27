-- Grant the worker's service role read access to the article_reactions table.
-- The reaction-ranking feed lookup (2026-10-25) failed with HTTP 403
-- "permission denied for table article_reactions" because this table never
-- got a service_role grant (it was created outside the repo migrations).
-- RLS bypass alone doesn't grant table privileges — check GRANTs too.
-- The worker only reads reaction totals; increments go through RPCs, so
-- SELECT is all it needs.
GRANT SELECT ON public.article_reactions TO service_role;
