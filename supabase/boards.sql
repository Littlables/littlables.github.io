-- User boards: named topic collections on profile pages (/@username/boardslug)
-- v1: each board groups a subset of the owner's pills and shows those topics' news

CREATE TABLE IF NOT EXISTS public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  icon_emoji TEXT,
  theme TEXT,
  background_color TEXT,
  pills JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS icon_emoji TEXT;

-- Slug format: 1-50 chars, lowercase letters, numbers, dashes, underscores
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_slug_format;
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS spaces_slug_format;
ALTER TABLE public.boards ADD CONSTRAINT spaces_slug_format
  CHECK (slug ~ '^[a-z0-9\-_]{1,50}$');

-- Background color format: #rrggbb (nullable = inherit profile theme)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boards_bg_color_format') THEN
    ALTER TABLE public.boards DROP CONSTRAINT boards_bg_color_format;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spaces_bg_color_format') THEN
    ALTER TABLE public.boards ADD CONSTRAINT spaces_bg_color_format
      CHECK (background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Anyone can read boards (they're on public profile pages)
DROP POLICY IF EXISTS "Boards are viewable by everyone" ON public.boards;
CREATE POLICY "Boards are viewable by everyone"
  ON public.boards FOR SELECT
  USING (true);

-- Owners can manage their own boards
DROP POLICY IF EXISTS "Users can insert their own boards" ON public.boards;
CREATE POLICY "Users can insert their own boards"
  ON public.boards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own boards" ON public.boards;
CREATE POLICY "Users can update their own boards"
  ON public.boards FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own boards" ON public.boards;
CREATE POLICY "Users can delete their own boards"
  ON public.boards FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at auto-bump
CREATE OR REPLACE FUNCTION public.handle_board_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_board_updated ON public.boards;
CREATE TRIGGER on_board_updated
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_board_updated();

-- Ensure membership column and helper exist even if boards.sql is run before profiles_expansion.sql
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

-- Enforce membership limit: max spaces (boards) per user (5 free / 25 member)
CREATE OR REPLACE FUNCTION public.enforce_max_spaces_per_user()
RETURNS TRIGGER AS $$
DECLARE
  allowed_spaces INT;
BEGIN
  SELECT max_spaces INTO allowed_spaces FROM public.get_membership_limits(NEW.user_id);
  allowed_spaces := COALESCE(allowed_spaces, 5);
  IF (SELECT COUNT(*) FROM public.boards WHERE user_id = NEW.user_id) > allowed_spaces THEN
    RAISE EXCEPTION 'Maximum of % spaces per user reached', allowed_spaces
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_max_spaces_trigger ON public.boards;
CREATE TRIGGER enforce_max_spaces_trigger
  AFTER INSERT ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_spaces_per_user();

-- Grants (table privileges are separate from RLS policies)
GRANT ALL ON public.boards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT SELECT ON public.boards TO anon;

-- Storage bucket for board logos (2 MB limit, safe image MIME types only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-logos',
  'board-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Board logo storage policies
DROP POLICY IF EXISTS "Board logos are publicly readable" ON storage.objects;
CREATE POLICY "Board logos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'board-logos');

DROP POLICY IF EXISTS "Users can upload their own board logos" ON storage.objects;
CREATE POLICY "Users can upload their own board logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'board-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own board logos" ON storage.objects;
CREATE POLICY "Users can update their own board logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'board-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own board logos" ON storage.objects;
CREATE POLICY "Users can delete their own board logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'board-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
