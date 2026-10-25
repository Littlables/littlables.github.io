# littlables Supabase email templates

Source copies of the auth emails, kept in the repo so they can be reviewed
and versioned. Supabase does not read these files — they must be pasted
into the dashboard (below). Keep the dashboard copies in sync when these
change.

## Files

- `magic-link.html` — returning sign-ins (the `signInWithOtp` email for an
  existing account). Subject: **Your littlables sign-in link**
- `confirm-signup.html` — brand-new sign-ups (same flow, first time).
  Subject: **Welcome to littlables — confirm your email**

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
`#1e293b`, rainbow gradient button (`#ef4444` → `#f59e0b` →
`#10b981` → `#3b82f6` → `#8b5cf6`, sky `#38bdf8` fallback for clients
without gradient support, white text), muted `#94a3b8` footer,
pink `#fb7185` footer links (no underline; a `.footer-link:visited`
rule pins the same pink so visited links don't shift color).
Header is the site logo: favicon mark + Fredoka wordmark.
Footer links: littlables.com, /about, hello@littlables.com
(the disclaimer contact). Fredoka + Quicksand load from Google Fonts
(same files as the site); clients that block webfonts (Gmail, Outlook)
fall back to the site's own font stacks.
