# AI Workshop dashboard — progress

A running log of what's built, what needs setup, and what's planned. Live at https://a-icommunity.vercel.app

## Latest session — 2026-06-11 (branch `agent/overhaul-2026-06-11`, NOT yet merged)

Overhaul pass: fixes + design consistency/lift + 2 new features + automation. App was already in good shape (clean build, no critical bugs) — this is polish + additions.

- **Design primitives + consistency.** Added shared `.modal-overlay`, `.modal-panel`, `.input`, `.empty-state`, `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-sm` to `index.css`, then applied across the modals (Feedback, Auth sign-in + profile, Photo uploader, Session editor) so overlays/padding/inputs/buttons match. Standardized the lightbox spinner to Lucide `Loader2`. Skeleton radii tidied. **Did NOT** force `.card-interactive` onto News/Members (they're media-led magazine cards with their own hover lift — boxing them would be wrong) or downgrade the richer icon-led empty states.
- **In-dashboard RSVP** (new). `api/_rsvp.js` (Upstash in prod / file store in dev, same pattern as session-meta), `api/rsvp.js` route + dev middleware. Identity (id/name/avatar) is derived **server-side from the verified Supabase session, never the body** (`requireUser` added to `api/_guard.js`). `Rsvp.jsx` adds a "I'm going / Maybe" toggle as the **primary CTA on the Home hero** (Luma demoted to a secondary text link); shows who's going with avatars. Anonymous POST → 401 (verified). GET is public + edge-cached.
- **Public session recap pages** (new). Hash route `#recap/<date>` (added to `App.jsx`'s router alongside the legal routes). `SessionRecap.jsx`: cover, demos, attendees, photo gallery (committed + Blob uploads), **Copy link**, and a **Draft a LinkedIn post** button that streams via the existing `/api/generate-post` (new `src/lib/postdraft.js` SSE helper, `AbortController` cancel-on-leave). Entry point: a **Recap** link on each Sessions tile. _Caveat: hash-route SPA won't rich-unfurl on LinkedIn — static per-session OG prerender is the documented follow-up._
- **News automation.** `scripts/draft-news.mjs` pulls public AI RSS (TechCrunch/Verge/Ars/VentureBeat/HF), Gemini flash (`gemini-flash-latest`) curates 8 items into `data/news-draft.json` (a **review file — never auto-publishes** into `news.json`). `.github/workflows/news.yml` runs it weekly + fetches cover images + opens a review PR. Verified locally: 60 candidates → 8 attributed drafts.
- **Cost audit** → `docs/cost-audit.md`. All free-tier today; #1 exposure is `/api/generate-post` having no cumulative per-user quota (Security rule 5) — now more relevant since auto-recap adds LLM calls. Includes a ~30-line implementation sketch + provider spend-cap backstop. Quota itself NOT built this pass (documented as fast-follow).
- **Fixes:** `PhotoUploader` now uses the shared `TODAY` (noon-UTC) instead of a stray `new Date()`. Reviewed by a verification agent — one routing bug found + fixed (nav tabs were dead while a recap page was open; now route through `goTo`).
- **News refreshed to the past two weeks** (`data/news.json`, window May 28 – Jun 11): 8 current items + rewritten theme statements, generated via the new `draft:news` pipeline and curated by hand, cover images fetched.
- **Session #07 transcript → recap → SoMe post.** `build-data.js` now also parses the note's **"## Tools & products discussed"** into `session.tools` (the AI ideas). `SessionRecap.jsx` shows the About + a "Tools & ideas discussed" section and folds both into the LinkedIn-draft prompt, so the recap's auto-post is genuinely about what was discussed. New CLI `scripts/draft-session-post.mjs <date> [linkedin|instagram]` generates the same post from the terminal (reuses `_postmaker.js`). Session #07's note already lives in the vault; `data.json` rebuilt with its 28 tools.

Outstanding before merge: manual browser smoke (RSVP toggle, recap page, modals); decide whether to commit `data/news-draft.json`; add `GEMINI_API_KEY` as a GitHub Actions secret for the news workflow.

## Session — 2026-06-07 (merged to `main`, deployed)

- **Performance pass — "instant load."** The page was dominated by ~77MB of unoptimized images (raw camera photos up to 5MB each; a 3.4MB hero PNG above the fold on every tab). Added `scripts/optimize-images.mjs` — an idempotent `sharp` pipeline (manifest-guarded, wired into `build`) that downscales + recompresses session/news/member images to display sizes and emits a small WebP hero. **77MB → 13.8MB; hero 3.3MB → 29KB.** Re-runs/Vercel builds skip already-done files. New photos dropped in `public/sessions/<date>/` auto-optimize on next build.
- **Code-split the non-default tabs** (Learn, Forum, News, Tools, Members, Sessions) with `React.lazy` + `Suspense` (each loads only when opened; initial JS 154KB → 122KB gzip). Added a **`TabErrorBoundary`** that auto-reloads once on a stale-chunk failure (the classic post-deploy cached-page 404), so code-splitting can't strand users on a blank tab.
- **Edge-cache API GETs** (`Cache-Control` `s-maxage` + `stale-while-revalidate`) on photos/session-meta/topics/threads/polls/attendees → repeat loads are instant.
- **Dropped the dead, render-blocking Google Fonts `<link>`** (Inter/JetBrains) — the app self-hosts Geist via fontsource; those were never used.
- **Sessions gallery: skeleton-hold + reduced-motion.** Holds the grid behind matching skeleton tiles until both photos + session-meta settle (no more late sessions popping in / shifting layout). Added a `prefers-reduced-motion` guard to the shared `.skeleton` shimmer (app-wide). **Edit button moved to overlay the cover photo's top-right.**
- **Post maker upgrades (Tools):** output now **streams token-by-token** into the preview (SSE for both Gemini + OpenRouter) with a live caret + **Stop** button + `AbortController` cancel-on-leave; the preview is now **platform-accurate** (real Instagram card when IG is selected, LinkedIn card otherwise) with a realistic **"…more" fold** (LI ~210 / IG ~125 chars) and a live char/word counter; the native session `<select>` is replaced by a custom **accessible dropdown** (cover thumbnail + photo-count badge, full keyboard/listbox support).

## Session — 2026-06-05 (merged to `main`)

- **Suggestions → Ideas forum board.** The standalone Suggestions panel is gone; it's now a pinned, score-sorted **Ideas** board inside the Forum (reuses the threads engine, so it has voting + replies). Existing suggestions + votes were migrated into it. The cockpit shows a read-only **top-ideas preview** that links into the Forum.
- **Polls merged into the Forum** as a second pinned card next to Ideas (no longer a top-level tab). Killed the "three places to vote" confusion.
- **Nav cleanup:** 8 tabs → **7**, reordered into clusters — **Home · Forum · Learn · News · Members · Sessions · Tools**. "Cockpit" renamed to **Home**. Old `#polls`/`#cockpit` links redirect.
- **Session editor** (Sessions tab → hover a session → **Edit**): inline rename with a saved animation, **drag-to-reorder photos (first = featured cover, shown larger)**, a "Make featured" shortcut for touch, and **multi-select bulk delete** of photos. Backed by a new `session-meta` store (`{ name, order }` per date) — Obsidian stays the source for the rich session content.
- **Photo management:** move photos between sessions (`PATCH /api/photos`, Blob copy+del), create a new session by date (defaults to the next biweekly date), confirmation grid of just-uploaded photos. Lightbox rebuilt: full-screen dim (portaled), fits any aspect on mobile/desktop, swipe + bottom nav.
- **Security hardening (closes the old known gap).** All mutating routes (`photos`, `session-meta`, `threads`, `topics`, `polls`, `upload-image`, `generate-post`) now verify the caller's **Supabase JWT server-side** and are **rate-limited** (Upstash), via `api/_guard.js` wired through the serverless fns + dev middleware + `server.js`. Client attaches the bearer token (`authedFetch`). Reads stay open. Generic 500s (no `e.message` leak). Verified: signed-in writes land, anonymous/bogus → 401.
- **Compliance trio:** `/privacy`, `/terms`, `/accessibility` (hash routes) + a site **footer**. Real sub-processor list, GDPR rights + Datatilsynet, photo-removal note, Denmark governing law, honest accessibility statement. Contact email + effective date are constants at the top of `LegalPages.jsx`.
- **Auth modal** focus-highlight polish.

## Implemented

### Tabs
- **Home** (was Cockpit) — Next session card (premium warm gradient, countdown, theme headline, venue map link, add-to-calendar), Schedule ahead, Latest discussion preview, **Top ideas preview** (links into the Forum).
- **Forum (Discussions)** — pinned **Ideas** board (suggest + upvote, score-sorted) and **Polls** card (structured votes), plus member **topics** with one-level replies, up/down votes, and image/GIF uploads. Login-gated. Powered by the shared threads engine.
- **Learn** — tutorial **slide decks** (cover → steps → resources), keyboard nav, copyable code. Content in `data/learn.json`.
- **News** — curated AI roundup, "Read more" cards, category filter.
- **Tools** — free utilities: **Post maker** (session → LinkedIn/IG post via Gemini, **streamed** with a platform-accurate live preview + "…more" fold + accessible session picker), **Token & cost estimator**, **Image to link** (ImgBB), **JSON formatter**.
- **Members** — gallery; photoless members get gender-aware DiceBear avatars.
- **Sessions** — committed + uploaded photos, lightbox, and the **session editor** (rename / featured cover / reorder / bulk delete; move + create-by-date in the uploader).

### Auth (Supabase)
- Google + email/password. **Public read, login required to interact.** Profile editing (name, avatar, bio).
- **Server-side enforced:** mutating API routes verify the Supabase JWT + rate-limit (see hardening above). Degrades to typed-name mode if Supabase isn't configured.

### Cross-cutting
- **Coming list** — who accepted the Google Calendar invite, with avatars, stale-while-revalidate.
- **Image/GIF uploads** — ImgBB proxy (`/api/upload-image`), reused by forum + Tools.
- **UI/UX** — mobile hamburger menu, desktop top menu, warm yellow gradient theme, skeleton loaders, focus rings, footer with the compliance trio, stop-slop copy.
- **Branding** — SVG logo + favicon/PWA icons + manifest, AI-generated hero/OG image.

## Setup on Vercel
Configured: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `BLOB_*`, `IMGBB_API_KEY`, `GCAL_*`, `GEMINI_API_KEY`. (The Supabase + Upstash vars are also read at runtime by the new auth guard — already present, so the gate enforces automatically on deploy.)

Outstanding:
- **Supabase → Authentication → URL Configuration** — Site URL + Redirect URLs must include `https://a-icommunity.vercel.app` (and `http://localhost:5280` for dev), or Google sign-in bounces to localhost.
- **Publish the Google OAuth consent screen to Production** — so it works for everyone and the Calendar token doesn't expire after 7 days.

## Planned / ideas
- **Member Projects directory** — a Supabase `profiles` table so member name/avatar/bio + "what I'm building" show to everyone.
- **Per-user LLM token quota** on `/api/generate-post` (rate-limited already; cap total spend per user before public exposure).
- **Demo sign-up + in-dashboard RSVP** on the Next session card.
- **Shareable session recap pages** — public per-session URLs for LinkedIn.
- **Touch/keyboard photo reorder** — the drag-reorder is pointer-only (noted in the accessibility statement); add a touch-friendly alternative.
- **Live AI news**, **Copenhagen events tab**, **more tools**, **member-submitted tutorials**.

## Notes
- Local API stores (`data/*-store.json`) are gitignored; production uses Upstash.
- **Local dev now connects to the live Upstash + Blob stores** when `.env.local` holds those creds — so local dev is NOT a sandbox (writes/deletes hit production). Vercel marks secrets "Sensitive", so `vercel env pull` returns them empty; copy from the Upstash/Vercel consoles by hand.
- Secrets live only in `.env.local` (gitignored). The anon/publishable Supabase key is safe to expose; never commit the `service_role`/`sb_secret_` key.
