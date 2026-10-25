# Littlables Supabase email templates

Source copies of the auth emails, kept in the repo so they can be reviewed
and versioned. Supabase does not read these files — they must be pasted
into the dashboard (below). Keep the dashboard copies in sync when these
change.

## Files

- `magic-link.html` — returning sign-ins (the `signInWithOtp` email for an
  existing account). Subject: **Your Littlables sign-in link**
- `confirm-signup.html` — brand-new sign-ups (same flow, first time).
  Subject: **Welcome to Littlables — confirm your email**

Both keep the link front and center as a button and show the 6-digit
`{{ .Token }}` code underneath for the dialog's code-entry step, so new
and returning users get the same experience.

## Install (Supabase dashboard, Katie's step)

Supabase Dashboard → Authentication → Templates → pick the template →
paste the file's body into the message editor and set the subject above.
Variables used: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`.

## Redirects

The sign-in link returns to the site the user started from: the app passes
`emailRedirectTo: window.location.origin` with `signInWithOtp` (see
`src/contexts/AuthContext.tsx`). The redirect allow-list must include the
origins used (`https://littlables.com`, `https://*.littlables.com` covers
dev). Without the override, links fall back to the project's Site URL.

## Known email limitation

A working copy-to-clipboard button is not possible inside an email:
clients strip JavaScript. The code is therefore set large, centered, and
letter-spaced in a dashed box so it is easy to select (long-press on
mobile) and copy by hand.

## Branding

Dark cozy card matching the site's dark theme (bg `#0b0f19`, card
`#1e293b`, indigo `#6366f1` → purple `#a855f7` button, muted `#94a3b8`
footer). Footer links: littlables.com, /about, hello@littlables.com
(the disclaimer contact). No webfonts are loaded — email clients fall
back to the font stack.
