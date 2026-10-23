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

CREATE INDEX IF NOT EXISTS idx_stories_region ON public.news_stories (region);
CREATE INDEX IF NOT EXISTS idx_stories_country ON public.news_stories (country_code);

-- Backfill: derive from existing interest_keywords where present.
-- Maps country keyword ids to ISO codes, then to regions via country_regions.
UPDATE public.news_stories s
SET
  country_code = m.iso,
  region = COALESCE((SELECT r.region FROM public.country_regions r WHERE r.country_code = m.iso), 'global')
FROM (
  VALUES
    ('country-us', 'US'), ('country-uk', 'GB'), ('country-canada', 'CA'),
    ('country-australia', 'AU'), ('country-nz', 'NZ'), ('country-ireland', 'IE'),
    ('country-france', 'FR'), ('country-germany', 'DE'), ('country-italy', 'IT'),
    ('country-spain', 'ES'), ('country-netherlands', 'NL'), ('country-sweden', 'SE'),
    ('country-china', 'CN'), ('country-japan', 'JP'), ('country-india', 'IN'),
    ('country-korea', 'KR'), ('country-mexico', 'MX'), ('country-brazil', 'BR'),
    ('country-south-africa', 'ZA'), ('country-egypt', 'EG')
) AS m(kw, iso)
WHERE s.country_code IS NULL
  AND s.interest_keywords IS NOT NULL
  AND m.kw = ANY(s.interest_keywords);

-- Anything still NULL gets 'global'
UPDATE public.news_stories
SET region = 'global'
WHERE region IS NULL;
