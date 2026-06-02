# AI Workshop dashboard — progress

A running log of what's built, what needs setup, and what's planned. Live at https://a-icommunity.vercel.app

## Implemented

### Tabs
- **Cockpit** — Next session card (premium warm gradient, countdown pill, theme headline, venue map link, subtle "Add to calendar"), Schedule ahead (compact, venue links), Latest discussion preview (newest forum topics, deep-links into the Forum), Suggestions board.
- **Learn** — library of tutorial **slide decks** on building with AI. Grid of cards → fullscreen slide viewer (cover → steps → resources), arrow/keyboard nav, progress dots, copyable code blocks. Content in `data/learn.json`; each guide can link a slide deck.
- **Forum (Discussions)** — members start **topics**; each has a thread with **one-level replies, up/down votes, and image/GIF uploads**. Cascade delete, login-gated. Powered by the shared threads engine.
- **News** — curated AI roundup, "Read more" cards, category filter.
- **Polls** — login-gated voting, pick-one or pick-any, live tallies (voter chips capped at 8).
- **Tools** (was "Post") — a hub of free utilities: **Post maker** (session → LinkedIn/IG post via Gemini, live preview), **Token & cost estimator**, **Image to link** (ImgBB), **JSON formatter**.
- **Members** — gallery; photoless members get gender-aware DiceBear avatars.
- **Sessions** — committed + uploaded photos, lightbox.

### Auth (Supabase)
- Google + email/password. **Public read, login required to interact** (post, vote, suggest, comment).
- **Profile editing** — name, avatar (generated / Google photo / URL), bio, stored in user_metadata.
- Degrades gracefully: with no keys, no login UI and the app falls back to typed names.
- Known gap: gating is **client-side only** — the API doesn't yet verify the Supabase JWT (fine for a trusted group; harden before public).

### Cross-cutting
- **Coming list** — reads who accepted the Google Calendar invite, shown with avatars; stale-while-revalidate so it no longer flashes on refresh.
- **Image/GIF uploads** — ImgBB proxy (`/api/upload-image`), reused by the forum and the Tools image utility.
- **UI/UX** — mobile **hamburger menu** (was a bottom bar), desktop top **text menu**, warm yellow gradient theme (`premium-card` / `warm-card`), skeleton loaders, keyboard focus rings, unified page headers, stop-slop copy pass.
- **Branding** — SVG logo + favicon/PWA icons + manifest, AI-generated hero/OG image.

## Setup on Vercel
Most env vars are set. Outstanding:
- **`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`** — NOT yet on Vercel. Without them the Sign-in button is hidden in prod. Add them, then **redeploy** (VITE_ vars are baked in at build time).
- **Supabase → Authentication → URL Configuration** — set Site URL + Redirect URLs to include `https://a-icommunity.vercel.app` (and `http://localhost:5280` for dev), or Google sign-in bounces to localhost.
- **Publish the Google OAuth consent screen to Production** — so it works for everyone (not just test users) and the Calendar token doesn't expire after 7 days.

Already configured: `IMGBB_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN` (Polls/Suggestions/Forum), `GCAL_*` (Coming list), `GEMINI_API_KEY` (Post maker), `BLOB_*` (photo uploads).

## Planned / ideas
- **Member Projects directory** — a Supabase `profiles` table so member name/avatar/bio + "what I'm building" show to everyone (turns Members into a portfolio board).
- **Demo sign-up + in-dashboard RSVP** — sign up to demo / RSVP yes-maybe on the Next session card.
- **Shareable session recap pages** — public per-session URLs (photos + recap + demos) for LinkedIn.
- **Live AI news** — auto-pull from the free Hacker News API + Google News RSS, keep curated editorial on top.
- **Copenhagen events tab** — scrape Luma Copenhagen for local AI/tech events.
- **More tools** — prompt improver (Gemini), regex tester, markdown preview.
- **Member-submitted tutorials** for the Learn tab; **embed Google Slides** inside the slide viewer.
- **Server-side JWT enforcement** before opening the community publicly.

## Notes
- Local API stores (`data/*-store.json`) are gitignored; production uses Upstash.
- Secrets live only in `.env.local` (gitignored). The anon/publishable Supabase key is safe to expose; never commit the `service_role`/`sb_secret_` key.
