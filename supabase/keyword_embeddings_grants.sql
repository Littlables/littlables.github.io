-- Grant the worker's service role access to the keyword_embeddings table.
-- Tables created via psql don't get Supabase's default privileges, so without
-- this the worker gets "permission denied" (HTTP 403) on lookup/upsert.
-- (Same root cause as the 2026-10-21 profiles table fix: RLS bypass alone
-- doesn't grant table privileges — check GRANTs too.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keyword_embeddings TO service_role;
