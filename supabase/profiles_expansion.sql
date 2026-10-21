-- Profiles table expansion: full user customization
-- Run after the base profiles.sql migration

-- Unique username for profile URLs (e.g. littlables.com/@username)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Bio / description
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Social media links as JSONB: { twitter, instagram, tiktok, youtube, website }
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Avatar: 'initial' (letter), 'character' (built-in), 'upload' (custom)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_type TEXT DEFAULT 'initial';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_character TEXT;

-- Theme preference (synced from local theme setting)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT;

-- Custom background color (hex, overrides theme background)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_color TEXT;

-- Pills configuration: ordered JSONB array
-- [{ id: 'childcare', type: 'category' }, { id: 'custom-1', label: 'My Topic', type: 'custom', keywords: '...' }]
-- Absent pills = hidden. Order = display order.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pills JSONB;

-- Username format constraint: 3-30 chars, lowercase letters, numbers, underscores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
      CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');
  END IF;
END $$;

-- Background color format: #rrggbb
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bg_color_format'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_bg_color_format
      CHECK (background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

-- Avatar type constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_type_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_type_check
      CHECK (avatar_type IN ('initial', 'character', 'upload'));
  END IF;
END $$;

-- Storage bucket for avatar uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar storage policies
CREATE POLICY IF NOT EXISTS "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY IF NOT EXISTS "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
