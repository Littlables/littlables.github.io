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

-- Slug format: 1-50 chars, lowercase letters, numbers, dashes, underscores.
-- "spaces" is reserved (/@name/spaces/<space> is the direct space route).
ALTER TABLE public.playrooms DROP CONSTRAINT IF EXISTS playrooms_slug_format;
ALTER TABLE public.playrooms ADD CONSTRAINT playrooms_slug_format
  CHECK (slug ~ '^[a-z0-9\-_]{1,50}$' AND slug <> 'spaces');

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
  space_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playroom_id, space_id)
);

-- Migrate legacy board_id column to space_id if present on existing databases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'playroom_spaces' AND column_name = 'board_id'
  ) THEN
    ALTER TABLE public.playroom_spaces RENAME COLUMN board_id TO space_id;
  END IF;
END $$;

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

-- Ensure membership column and helper exist even if playrooms.sql is run before profiles_expansion.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership TEXT NOT NULL DEFAULT 'free';

CREATE OR REPLACE FUNCTION public.get_membership_limits(target_user_id UUID)
RETURNS TABLE(max_spaces INT, max_playrooms INT, max_spaces_per_playroom INT) AS $$
DECLARE
  user_membership TEXT;
BEGIN
  SELECT COALESCE(membership, 'free') INTO user_membership
  FROM public.profiles
  WHERE id = target_user_id;

  IF user_membership IN ('member', 'plus', 'premium', 'admin') THEN
    RETURN QUERY SELECT 25, 10, 15;
  ELSE
    RETURN QUERY SELECT 5, 1, 5;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enforce membership limit: max playrooms per user (1 free / 10 member)
CREATE OR REPLACE FUNCTION public.enforce_max_playrooms_per_user()
RETURNS TRIGGER AS $$
DECLARE
  allowed_playrooms INT;
BEGIN
  SELECT max_playrooms INTO allowed_playrooms FROM public.get_membership_limits(NEW.user_id);
  allowed_playrooms := COALESCE(allowed_playrooms, 1);
  IF (SELECT COUNT(*) FROM public.playrooms WHERE user_id = NEW.user_id) > allowed_playrooms THEN
    RAISE EXCEPTION 'Maximum of % playrooms per user reached', allowed_playrooms
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_max_playrooms_trigger ON public.playrooms;
CREATE TRIGGER enforce_max_playrooms_trigger
  AFTER INSERT ON public.playrooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_playrooms_per_user();

-- Enforce membership limit: max spaces per playroom (5 free / 15 member)
CREATE OR REPLACE FUNCTION public.enforce_max_spaces_per_playroom()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
  allowed_per_playroom INT;
BEGIN
  SELECT user_id INTO owner_id FROM public.playrooms WHERE id = NEW.playroom_id;
  SELECT max_spaces_per_playroom INTO allowed_per_playroom FROM public.get_membership_limits(owner_id);
  allowed_per_playroom := COALESCE(allowed_per_playroom, 5);
  IF (SELECT COUNT(*) FROM public.playroom_spaces WHERE playroom_id = NEW.playroom_id) > allowed_per_playroom THEN
    RAISE EXCEPTION 'A playroom can hold at most % spaces', allowed_per_playroom
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_max_playroom_spaces_trigger ON public.playroom_spaces;
CREATE TRIGGER enforce_max_playroom_spaces_trigger
  AFTER INSERT ON public.playroom_spaces
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_spaces_per_playroom();

-- Grants (table privileges are separate from RLS policies)
GRANT ALL ON public.playrooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playrooms TO authenticated;
GRANT SELECT ON public.playrooms TO anon;

GRANT ALL ON public.playroom_spaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playroom_spaces TO authenticated;
GRANT SELECT ON public.playroom_spaces TO anon;

-- Auto-create default "My playroom" when a new profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile_playroom()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.playrooms (user_id, name, slug, position)
  VALUES (NEW.id, 'My playroom', 'my-playroom', 0)
  ON CONFLICT (user_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_playroom ON public.profiles;
CREATE TRIGGER on_profile_created_playroom
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_playroom();

-- Backfill: one "My playroom" per profile, with their existing spaces attached
INSERT INTO public.playrooms (user_id, name, slug, position)
SELECT id, 'My playroom', 'my-playroom', 0
FROM public.profiles
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO public.playroom_spaces (playroom_id, space_id, position)
SELECT p.id, b.id, b.position
FROM public.playrooms p
JOIN public.boards b ON b.user_id = p.user_id
WHERE p.slug = 'my-playroom'
ON CONFLICT (playroom_id, space_id) DO NOTHING;
