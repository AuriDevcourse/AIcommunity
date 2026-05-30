# Auth setup (Supabase)

Login/register for the dashboard. Methods: **Google + email/password**. Scope:
**public read, login required to interact** (browse News/Sessions/Members freely;
sign in to post, vote, suggest, or join session discussion).

The app degrades gracefully: with no Supabase env vars set, `authEnabled` is false,
no auth UI appears, and the old typed-name flow stays in place. Add the keys to
switch the whole app to real accounts.

## 1. Create the Supabase project

1. Go to https://supabase.com, create a project (free tier is fine).
2. Project Settings, API: copy the **Project URL** and the **anon public** key.

## 2. Add the keys

Local dev, in `.env.local` at the repo root:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

Production: add the same two vars in Vercel, Project Settings, Environment Variables,
then redeploy. (The anon key is safe to expose in the browser. Never put the
`service_role` key in client env.)

## 3. Enable providers

In the Supabase dashboard, Authentication, Providers:

- **Email**: enable. "Confirm email" is on by default (Supabase sends a
  confirmation link before first sign-in). Turn it off if you want instant signup.
- **Google**: enable, then paste a Google OAuth **Client ID + secret** from Google
  Cloud Console (APIs & Services, Credentials, OAuth client). In that Google client,
  add Supabase's callback URL (shown in the Supabase Google provider panel) to
  **Authorized redirect URIs**.

## 4. Allow the redirect origins

Authentication, URL Configuration:

- **Site URL**: your production origin.
- **Redirect URLs**: add both `http://localhost:5280` (dev) and the production
  origin. The app uses `window.location.origin` for redirects, so each environment
  must be whitelisted or the OAuth callback fails.

## 5. Restart / redeploy

Restart `npm run dev` (env is read at startup) or redeploy on Vercel. The header
gains a Sign in button, and the interactive features require login.

## Known limitation (v1)

Gating is currently **client-side only**. The API functions
(`api/_polls-core.js`, `api/_suggestions.js`, `api/_threads.js`) accept a
client-supplied `name` and do not verify a Supabase JWT, so the endpoints can be
called directly with any name. This is acceptable for a small trusted community
(risk is spam/impersonation, there is no private data), but it is a UX convention,
not a security boundary.

To harden before going fully public:
1. Send the session access token as `Authorization: Bearer <token>` from each
   composer (`supabase.auth.getSession()`).
2. In each API handler, verify the token against Supabase (`/auth/v1/user` or the
   project JWKS) and derive the identity server-side instead of trusting the body.
3. Key identity and ownership on `user.id` (not display name) so two members with
   the same name don't collide.
