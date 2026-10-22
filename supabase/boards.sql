-- User boards: named topic collections on profile pages (/@username/boardslug)
-- v1: each board groups a subset of the owner's pills and shows those topics' news

CREATE TABLE IF NOT EXISTS public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  theme TEXT,
  background_color TEXT,
  pills JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Slug format: 1-50 chars, lowercase letters, numbers, dashes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boards_slug_format') THEN
    ALTER TABLE public.boards ADD CONSTRAINT boards_slug_format
      CHECK (slug ~ '^[a-z0-9-]{1,50}$');
  END IF;
END $$;

-- Background color format: #rrggbb (nullable = inherit profile theme)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boards_bg_color_format') THEN
    ALTER TABLE public.boards ADD CONSTRAINT boards_bg_color_format
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

-- Grants (table privileges are separate from RLS policies)
GRANT ALL ON public.boards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT SELECT ON public.boards TO anon;

-- Storage bucket for board logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('board-logos', 'board-logos', true)
ON CONFLICT (id) DO NOTHING;

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
