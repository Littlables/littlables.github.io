-- Story region/country classification.
-- Stores where each story is from: country_code (ISO) + region (broad).
-- 'global' region = no clear country (world news, science, etc.).
-- Forced re-run 2026-10-23: ensure columns exist.

-- Dependency: country_regions table (also in analytics_country.sql; duplicated for ordering safety).
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

ALTER TABLE public.news_stories ADD COLUMN IF NOT EXISTS country_code CHAR(2);
ALTER TABLE public.news_stories ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
ALTER TABLE public.news_stories ADD COLUMN IF NOT EXISTS provider_country CHAR(2);

CREATE INDEX IF NOT EXISTS idx_stories_region ON public.news_stories (region);
CREATE INDEX IF NOT EXISTS idx_stories_country ON public.news_stories (country_code);

-- Backfill removed: validation derives region from keywords on-the-fly.
-- Existing stories will get region/country populated on next validation run.
