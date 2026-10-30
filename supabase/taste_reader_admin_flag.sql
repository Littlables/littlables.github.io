-- Taste Reader step 1b: flag the littlables profile as admin.
--
-- The gated Taste Reader site page checks profiles.is_admin for the
-- signed-in user. Live check 2026-10-30 showed the littlables profile
-- (username 'littlables') with is_admin = false, even though it is
-- meant to be the admin account, so the gated page would deny it.
--
-- This update flags it. It is idempotent (only rows still false are
-- touched, and a missing profile touches zero rows, with no error).
-- It runs as the deploy database user, not as an authenticated browser
-- user, so the protect_profile_membership trigger (which blocks
-- authenticated users from granting themselves is_admin) does not
-- block it. It intentionally changes is_admin only: membership stays
-- as it is, unless Katie separately wants the 'admin' tier too.
-- This file sorts after profiles_expansion.sql, so the is_admin
-- column exists on a fresh database before this update runs.

update public.profiles
set is_admin = true
where username = 'littlables'
  and is_admin is distinct from true;
