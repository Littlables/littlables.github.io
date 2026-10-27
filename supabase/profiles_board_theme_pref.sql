-- User preference: always use the viewer's own theme when viewing others' boards.
-- Off (false) by default: boards show in the board/owner theme unless set to 'none'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS use_viewer_theme_for_boards BOOLEAN NOT NULL DEFAULT false;
