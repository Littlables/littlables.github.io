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

-- Membership tier ('free' by default; paid tiers unlock higher space & playroom limits)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_membership_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_membership_check;
  END IF;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_membership_check
    CHECK (membership IN ('free', 'member', 'plus', 'premium', 'admin'));
END $$;

-- Prevent regular authenticated users from setting or changing their own membership or is_admin columns
-- via INSERT or UPDATE from the browser; only service_role / postgres can grant elevated privileges.
CREATE OR REPLACE FUNCTION public.protect_profile_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.membership := 'free';
      NEW.is_admin := false;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.membership IS DISTINCT FROM OLD.membership THEN
        NEW.membership := OLD.membership;
      END IF;
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_membership_trigger ON public.profiles;
CREATE TRIGGER protect_profile_membership_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_membership();

-- Centralized membership limits lookup used by boards & playrooms triggers
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

-- Storage bucket for avatar uploads (2 MB limit, safe image MIME types only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatar storage policies
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

