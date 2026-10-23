-- Playrooms: shareable collections of spaces (boards).
-- Phase 1: data model only. A playroom acts as another homepage: a combined,
-- customizable feed of its spaces' stories. Free tier: 1 playroom per user,
-- 5 total spaces per user, max 5 spaces per playroom. Many-to-many: a space
-- can belong to multiple playrooms.

CREATE TABLE IF NOT EXISTS public.playrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  theme TEXT,
  background_color TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Slug format: 1-50 chars, lowercase letters, numbers, dashes.
-- "spaces" is reserved (/@name/spaces/<space> is the direct space route).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'playrooms_slug_format') THEN
    ALTER TABLE public.playrooms ADD CONSTRAINT playrooms_slug_format
      CHECK (slug ~ '^[a-z0-9-]{1,50}$' AND slug <> 'spaces');
  END IF;
END $$;

-- Background color format: #rrggbb (nullable = inherit)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'playrooms_bg_color_format') THEN
    ALTER TABLE public.playrooms ADD CONSTRAINT playrooms_bg_color_format
      CHECK (background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

-- Join: spaces within a playroom (ordered). Many-to-many.
CREATE TABLE IF NOT EXISTS public.playroom_spaces (
  playroom_id UUID NOT NULL REFERENCES public.playrooms(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playroom_id, board_id)
);

-- Enable RLS
ALTER TABLE public.playrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playroom_spaces ENABLE ROW LEVEL SECURITY;

-- Anyone can read playrooms (they're shareable pages)
DROP POLICY IF EXISTS "Playrooms are viewable by everyone" ON public.playrooms;
CREATE POLICY "Playrooms are viewable by everyone"
  ON public.playrooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Playroom spaces are viewable by everyone" ON public.playroom_spaces;
CREATE POLICY "Playroom spaces are viewable by everyone"
  ON public.playroom_spaces FOR SELECT
  USING (true);

-- Owners manage their own playrooms
DROP POLICY IF EXISTS "Users can insert their own playrooms" ON public.playrooms;
CREATE POLICY "Users can insert their own playrooms"
  ON public.playrooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own playrooms" ON public.playrooms;
CREATE POLICY "Users can update their own playrooms"
  ON public.playrooms FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own playrooms" ON public.playrooms;
CREATE POLICY "Users can delete their own playrooms"
  ON public.playrooms FOR DELETE
  USING (auth.uid() = user_id);

-- Owners manage their own playroom memberships
DROP POLICY IF EXISTS "Users can insert their own playroom spaces" ON public.playroom_spaces;
CREATE POLICY "Users can insert their own playroom spaces"
  ON public.playroom_spaces FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.playrooms p WHERE p.id = playroom_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own playroom spaces" ON public.playroom_spaces;
CREATE POLICY "Users can update their own playroom spaces"
  ON public.playroom_spaces FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.playrooms p WHERE p.id = playroom_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own playroom spaces" ON public.playroom_spaces;
CREATE POLICY "Users can delete their own playroom spaces"
  ON public.playroom_spaces FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.playrooms p WHERE p.id = playroom_id AND p.user_id = auth.uid()));

-- Updated_at auto-bump
CREATE OR REPLACE FUNCTION public.handle_playroom_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_playroom_updated ON public.playrooms;
CREATE TRIGGER on_playroom_updated
  BEFORE UPDATE ON public.playrooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_playroom_updated();

-- Grants (table privileges are separate from RLS policies)
GRANT ALL ON public.playrooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playrooms TO authenticated;
GRANT SELECT ON public.playrooms TO anon;

GRANT ALL ON public.playroom_spaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playroom_spaces TO authenticated;
GRANT SELECT ON public.playroom_spaces TO anon;

-- Backfill: one "My playroom" per profile, with their existing spaces attached
INSERT INTO public.playrooms (user_id, name, slug, position)
SELECT id, 'My playroom', 'my-playroom', 0
FROM public.profiles
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.playroom_spaces (playroom_id, board_id, position)
SELECT p.id, b.id, b.position
FROM public.playrooms p
JOIN public.boards b ON b.user_id = p.user_id
WHERE p.slug = 'my-playroom'
ON CONFLICT (playroom_id, board_id) DO NOTHING;
