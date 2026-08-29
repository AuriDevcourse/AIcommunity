# AI Workshop dashboard — progress

A running log of what's built, what needs setup, and what's planned. Live at https://a-icommunity.vercel.app

## SESSION HANDOFF — 2026-08-29 (RESUME HERE)

**Current state:** `main` untouched. One PR open, one branch parked. Nothing deployed.

### PR #3 — parser fixes (ready to review)
`claude/parser-and-feedback-fixes` · https://github.com/AuriDevcourse/AIcommunity/pull/3

Three regexes used anchors JavaScript doesn't have, each failing silently:

- **`\Z` is not a JS anchor** — in `build-data.js` it matched a literal "Z", so the Action
  Items block was cut at the first capital Z in the text (a name like "Zoe" ate the rest of
  the list, and the partial line was still captured, so items could be stored truncated
  mid-word). Rebuilding against the real vault recovers one previously-invisible action item
  (22 → 23), loses none.
- **Members-table regex** terminated only on a blank line, so if the table is ever last in the
  hub file, `members` silently becomes `[]` on an exit-0 build. Not triggered today; fixed
  preventively — same shape of bug.
- **`$` under the `/m` flag** in the feedback parser (`server.js` + `vite.config.js`) matches at
  *every* line ending, so **every multi-line feedback entry was truncated to its first line**
  on read-back. Verified end-to-end: a three-line entry now round-trips whole.

All three now use `(?![\s\S])`, a real end-of-input assertion. Diff is 4 files.

Two traps worth remembering, both hit during this work:
- **`vite.config.js` is CRLF** in this repo (Windows desktop). A normal text edit rewrites all
  514 lines. Patch it in binary mode.
- **`npm run build` runs `optimize:images`**, which rewrites ~19 image files and the manifest.
  Use `npm run build:data && npx vite build` when you want a source-only diff.

### Branch parked, NOT merged: `claude/audit-and-ui-overhaul`
A large audit + UI rework built against a **44-commit-stale checkout** before the drift was
noticed. Most of it is superseded by what's on `main` now (code splitting, image optimization,
skeletons, reduced-motion, the news rules, Google-Calendar schedule). Kept only so nothing is
lost — treat it as a scrap heap, not a proposal. Anything worth keeping should be re-derived
against current `main`.

Possibly still worth cherry-picking from it, if you want them:
- Security headers on `server.js` (CSP, nosniff, referrer, frame-ancestors, HSTS) + compression
- `scripts/audit.mjs` — pre-deploy budget/meta/header/data-freshness check
- `scripts/capture.mjs` — CDP screenshots of every tab in both themes (the `--screenshot` CLI
  flag silently ignores `--force-prefers-color-scheme`; this drives DevTools Protocol instead)
- A real 1200×630 `og:image` card, `robots.txt`, `sitemap.xml`

### Fixed along the way
- **Corrupt git ref** `.git/refs/remotes/origin/HEAD 2` (a byte-identical duplicate, the kind
  iCloud/Dropbox leaves behind) was making **every `git fetch` fail**. That is almost certainly
  why this checkout sat 44 commits behind without anyone noticing. Moved to
  `/tmp/git-stray-HEAD-2.bak`. Worth checking the other repos on this machine for the same file.

### Not done
- The poll auth review. On the stale tree, poll ownership was verifiable by typing someone's
  name; `main` has since restructured polls (`Polls.jsx`, `/api/polls`, KV/Upstash) so that
  finding does **not** transfer. Someone should check whether the current implementation
  authenticates writes.

## SESSION HANDOFF — 2026-06-19

**Current state:** Sessions tab + recap polish from Agentation feedback, plus all 8 session
titles set. Everything is **uncommitted on `main`** (local dev only, live site unchanged).
Repo auto-deploys from `main` on push, so branch before committing.

**What was just done:**
- **All 8 sessions titled** via a `**Title:**` field in `content/sessions/*.md` (parsed by
  `build-data.js` into `s.title`): #1 First meetup & format · #2 AI automations with Make.com ·
  #3 AI in game design · #4 International guests · #5 Image-to-3D demos · #6 Ice cream session ·
  #7 How we build with AI · #8 AI tools across business & creativity.
- **Name-priority fix (the #7/#6 "no name" bug).** The session-meta KV store had stale
  overrides pinning #6→"Session #6" and #7→"Session #7" (the old default, saved before titles).
  A manual rename always beat the title. Couldn't clear via API (POST needs sign-in), so changed
  the logic in BOTH SessionsGallery + SessionRecap: an override only wins if it DIFFERS from
  "Session #N"; a junk override equal to the generic default is ignored so the title shows.
- **Attendees parser bug fixed (`build-data.js get`):** empty `**Attendees:**` line swallowed the
  next line via `\s*` → changed to `[^\S\n]*`. Was polluting #5/#6 attendees with an internal
  note. Converted those two internal `>` notes to `<!-- HTML comments -->`. Also removed the wrong
  "Guest" from #8 (now the real 5: Auri, Andrei, Sany, Eividas, Ignas).
- **SessionsGallery.jsx:** title wraps to 2 lines (`line-clamp-2`); cover click ALWAYS opens the
  recap (removed the old grid lightbox + dead imports); photoless tiles read "View recap".
- **SessionRecap.jsx:** cover = FIXED featured photo (`committed.photos[0]`), `loading="eager"
  fetchpriority="high"` so it shows instantly + caches (Auri disliked the randomizer's reload).
  Recap title now matches the tile (same name chain). Hero actions: **Copy link** + **Create a
  social media post** (the latter deep-links to the Post maker via a `sessionStorage`
  `postmaker.session` handoff — Tools opens 'post', PostMaker preselects + clears it; no inline
  drafting anymore). Location hides "TBD". Topic + demo cards got leading icons. Photos grid:
  shows first 6 + a "See more (N)" button; clicking a photo opens an in-page `PhotoLightbox`
  (Esc/arrows/click-outside), not a new tab. `ToolChips`: tools with a `[Name](url)` link render
  as links (ExternalLink icon), others show an Info dot + click-to-reveal note.
- **App.jsx:** recap opens at the TOP instantly (`scrollTo behavior:'instant'` + effect on
  `recapDate`), fixing the mid-page smooth-scroll jump (`html{scroll-behavior:smooth}`).
- **Tools.jsx / PostMaker.jsx:** read the `postmaker.session` handoff to open + preselect.

**Next steps (in order):**
1. **Tools curation (#08).** Auto-extracted list is noisy (~40 entries). WAITING ON AURI to ID 5
   garbled names: **Mikolos, Pyrmus, CrowdSomething, Tensor Honey, "Mythos models"**. Then trim
   to the real ~12-15, fix names, add website links (`- **[Name](https://url)** — note`).
2. **Commit + deploy this batch:** branch (e.g. `feat/sessions-recap-polish`) off `main`, commit,
   push (= deploy). Lots of good polish sitting local.
3. **About Us page** (was the pre-pivot feature): rename Members tab → About Us (origin/where/when
   + members grid, smaller photos). Interview started — WAITING ON AURI for: origin story, venue,
   rhythm, who-it's-for, how-to-join, and the public-framing question (portfolio-accelerator vs
   softer "builders learning by building").
4. **"What's new" changelog** — header button + `data/updates.json`, badge on major updates only.
5. **Merge Photos into one Sessions tab** (tab consolidation, 7 tabs → fewer).
6. **News cron secret:** add `GEMINI_API_KEY` to GitHub Actions secrets or the weekly news draft
   (`.github/workflows/news.yml`) fails silently.
7. **#8 location** still blank (TBD hidden in UI but unknown).
8. **Bigger, not started:** Member Projects directory (highest-leverage for the portfolio purpose);
   server-side JWT enforcement on `api/*` before any public/wider launch (HIGH security gap).

**Gotchas:**
- Auto-deploys from `main` on push → branch first.
- Session NAMES: live reads the session-meta KV (Upstash); titles here are baked into
  `src/data.json` (the committed snapshot is what Vercel ships). KV override only wins now if it's
  a REAL custom name (≠ "Session #N"). To truly clear a KV name you must be signed in (POST is
  auth-gated) — or just rely on the new ignore-the-default logic.
- `npm run build:data` must run after editing any `content/sessions/*.md` (dev does it on start).

**Files:** `content/sessions/*.md` (notes w/ `**Title:**`), `scripts/build-data.js` (parser),
`src/components/SessionsGallery.jsx`, `src/components/SessionRecap.jsx`, `src/components/Tools.jsx`,
`src/components/PostMaker.jsx`, `src/App.jsx`.

## SESSION HANDOFF — 2026-06-16

**Current state:** Session **#08 (2026-06-14)** transcribed, cleaned, and published to the
Obsidian vault + built into `src/data.json`. It shows on the **local** dev server only.
**NOT committed, NOT pushed** — live site unchanged. Changes sit **uncommitted on `main`**.

**What was just done:**
- Built the cross-repo recording → transcript → dashboard pipeline (see `docs/recording-pipeline.md`).
- In the **transcribe** repo (`C:/Users/User/Desktop/SideProjects/transcribe`): added
  `archive_transcript.py` (full transcript, profanity masked EN+LT → private vault
  `AI Workshop/Transcripts/`), `name_from_intros.py` (name speakers from their self-intros,
  PRIMARY over voiceprints), a hallucination guard in `cleanup_local.py`, EMPTIED the stale
  hardcoded speaker map in `apply_corrections.py` (it leaked #07's "Frederik" onto #08), and
  added glossary fixes (ChatGPT, eToro, CLAUDE.md). All wired into `run.py`.
- Processed #08 from `Ai comm 2.m4a` (1h44m, 415 turns). Hand-fixed names + product names.
  Published `Sessions/#08 SESSION 2026-06-14.md` + `Transcripts/#08 TRANSCRIPT 2026-06-14.md`.

**Next steps (in order):**
1. **Decide git:** move the uncommitted changes onto a branch (e.g. `feat/session-08`) — repo
   AUTO-DEPLOYS from `main` on push, so don't commit straight to `main`. Then commit + (when
   ready) merge/push to deploy #08 to the live site.
2. Fill **Location** for #08 (currently `TBD` in `Sessions/#08 SESSION 2026-06-14.md`), re-run
   `npm run build:data`.
3. Replace the **Mikolos** image-generator placeholder with its real name (Auri to recall),
   add to glossary, rebuild.

**Uncommitted right now:** `M src/data.json`, `?? docs/recording-pipeline.md`. Last commit
`8665946`, `main` level with `origin/main`.

**Gotchas:**
- This repo auto-deploys from `main` on push → branch first.
- #08's small speakers stayed "Guest" (diarization over-split; couldn't pin Justas/Iret to
  voice labels). For future sessions do a clean **intro round** (each person says "Hi, I'm X"
  one at a time) so `name_from_intros.py` maps them automatically.
- Dev server was running on `http://localhost:5280`. Ollama must be up for the pipeline.

**Files:** `docs/recording-pipeline.md` (the full flow), `scripts/build-data.js` (reads vault
`Sessions/` → `src/data.json`), and the transcribe repo's `run.py` + its `progress.md`.

## Latest session — 2026-06-14 (merged to `main`, deployed · commit `ca77400`)

**Current state:** Built a "Topics for the day" system + a presentation deck for running the meetup, plus image compression and Forum tweaks. All merged to `main` and pushed (auto-deploys to Vercel). Build clean.

**What was just done:**
- **Topics for the day.** New left column in the **Forum** tab (topics left, forum right). Topics are per-session in `data/schedule.json` under each upcoming entry's `topics[]`, grafted onto the live Google Calendar session **by date** in `App.jsx` (gcal only carries date/theme/venue). A topic can have `points[]`, a `flow[]` pipeline (icon + label + detail), a `files[]` breakdown (name/does/rules/risk, where each rule is `{rule, without}`), an `image`, and a `note`. Icons are named as strings, mapped in `src/lib/topicIcons.js`.
- **Present deck** at hash route `#present` (opens in a **new tab** via the "Present" button — for a projector while the dashboard stays on the laptop). `TopicsPresentation.jsx`: cover → one slide per topic → drill-down file slides showing each file's **rule / without-it** in two columns. Keyboard + dot nav, mirrors the Learn viewer. Route wired in `App.jsx` (early-return, guarded against the hash-rewrite effect like `#recap`).
- Today's (2026-06-14) topics cover: how our sessions run (a **proposal** to discuss), recording + transcription pipeline, social posts connected, the **CLAUDE.md story** (WORKFLOW/SECURITY/DESIGN + why + per-file rules), project updates & feedback, recap.
- **Recording notice** on the Next Session card (`NextSession.jsx`) — "say your name ~10s, sessions are recorded."
- **Forum:** Ideas + Polls now **expanded by default** (no accordion) — Ideas shows 3 with "See more" (+10), Polls shows 3 with "Show all" (`SessionThread.jsx` `initialLimit`, `Polls.jsx` `initialLimit`). Topics column scrolls on desktop.
- **Sessions tab renamed to Photos** (`App.jsx` TABS).
- **Image compression.** Shared `src/lib/compressImage.js` (1600px JPEG ~0.82, GIFs untouched). Auto-applied on **forum image** uploads (`SessionThread`) and **Image-to-link** tool. New **Image compressor** tool (`ImageCompressor.jsx`, drop → before/after size → download). `PhotoUploader` already compressed (left as-is).
- **News tab note** about a planned auto-refresh cron (`News.jsx`).

**Next steps:**
1. **Decide the news cron cadence** (1 vs 2 weeks) and wire the actual job — the note in the News tab promises it. The scaffolding exists: `scripts/draft-news.mjs` + `.github/workflows/news.yml` (needs `GEMINI_API_KEY` GitHub Actions secret).
2. To set topics for the next session: edit the matching date's `topics[]` in `data/schedule.json`, then `npm run build:data` (dev runs it on start).
3. Optional: add real `image` paths to topics (drop file in `public/`, set `"image": "/..."`) — placeholders show until then.
4. Still pending from before: per-user LLM token quota on `/api/generate-post`; publish Google OAuth consent screen to Production.

**Gotchas:**
- `data/schedule.json` is the source; `src/data.json` is generated by `build:data` (tracked, committed). Editing schedule.json alone won't update the app until build:data runs.
- `#present` opened in a new tab loads the whole SPA at that hash; the static schedule fallback means it works immediately even before the gcal fetch.
- `npm run build` re-optimizes images in `public/` (sharp) — those binary changes are build artifacts; don't commit them (reverted this session).

**Key files:** `src/components/TopicsForTheDay.jsx`, `TopicsPresentation.jsx`, `TopicFiles.jsx`, `src/lib/topicIcons.js`, `src/lib/compressImage.js`, `src/components/ImageCompressor.jsx`, `data/schedule.json` (topics), `src/App.jsx` (Forum two-col + `#present` route + Photos rename).

## Session — 2026-06-11 (branch `agent/overhaul-2026-06-11`; this work reached `main` via `feat/calendar-schedule`)

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
