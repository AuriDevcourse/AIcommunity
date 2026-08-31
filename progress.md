# AI Sundays dashboard, progress

A running log of what's built, what needs setup, and what's planned. Live at https://a-icommunity.vercel.app

## FIXED 2026-08-31, `9b1c9ab`, the email exposure and the wrong-event bug

**Current state:** shipped to `main` and deployed. Three leaks closed. `main` at `153d73b`.

### What was wrong
Two faults, fixed in one commit because fixing either alone regressed the other.

1. **`findEvent` matched the wrong event.** It had a second fallback accepting ANY event in
   the window with attendees. The 2026-09-06 session has none, so `/api/attendees` returned
   the guest list of `"Placeholder: Atostogos | Neda"`, a personal holiday event in the same
   calendar. Two of its tentative guests, `Eltjuga` and `Arnas127`, were rendering by name
   on the live next-session card. Neither is a member.
2. **The endpoint published every invitee's address.** Public and unauthenticated, ten per
   request, four of whom had declined the invite.
3. **The bundle published four more.** `data/members-profile.json` stored addresses for four
   members, and because `src/lib/attendees.js` imported that file, Vite compiled all four
   into the client JS served to every visitor. `resolveGuest` tried an exact-email match
   first, which was the only reason they were stored.

### What shipped
Title match only in `findEvent`; no match returns `found: false` and the Coming row does not
render. `email` removed from the `/api/attendees` response. Addresses removed from
`members-profile.json` and the email branch removed from `resolveGuest`.

Verified: zero addresses in the repo file, zero in `dist/assets/*.js` beyond the deliberate
GDPR contact at `src/components/LegalPages.jsx:5`, and no `email` key in the API response.
All four suites pass.

### Two caveats that are NOT bugs
- **Matching is slightly weaker.** The email branch is gone and three name-based fallbacks
  remain. It covered only 4 of 20 members, and `name` still carries the email local part
  when the calendar has no display name, so token matching resolves those cases.
- **The Coming list will look empty** until people are actually invited to the session event
  in Google Calendar. Correct behaviour, but a visible change from before.

### Still open on this topic
- The four addresses remain in git history and on GitHub in commits before `9b1c9ab`.
  Removing them going forward does not un-publish them. Auri's call whether to rewrite
  history; the usual advice is to accept it.
- **Auri's judgement, not a technical step:** people who declined an unrelated invite had
  their address served from the site. Consider whether to tell anyone.
- `api/attendees.js` still has no gate on GET. That is now fine, since the response carries
  no personal data, but worth remembering if fields are ever added back.

## Favicon replaced, `153d73b`
Auri supplied a 620x620 rounded-tile mark with the rising-sun dome, in both colourways,
replacing the one derived by hand from the wordmark. Colours corrected on the way in: both
files were exported with the pre-lock `#1e4c34` / `#fbb90c`. Both ship, with the inverted
mark served to dark browser chrome via `media="(prefers-color-scheme: dark)"`.
`gen-icons.mjs` is down to one source for all five sizes, and `apple-touch-icon` is
flattened onto the tile green because iOS shows transparent corners as dark notches.

**This retires the gradient icons** (`brand/icon.svg`, `icon-badge.svg`, `icon-16.svg`,
`icon-mono.svg` are now unreferenced), which contradicts palette.md's "the icon carries
gradient" rule. That line in the brand doc should be updated to match.

### Numbered next steps
1. **Mono-font cleanup.** `.num` (Geist Mono) is used 46 times, and many are phrases rather
   than figures: `relative(s.date)` renders "in 3 wk" in monospace, and so do
   `memberCount`, `slideCount`, `topicCount`, `{index+1} / {total}`. Rule should be tabular
   figures and live-updating values only; roughly 30 of the 46 revert to sans.
2. **1.9, the Back button.** Tab navigation uses `history.replaceState` (`src/App.jsx`), so
   Back leaves the app instead of returning to the previous tab. A bug, not polish.
3. **Area 5, Polls** (2/10), the weakest area and needs no decisions.
4. **Area 7, Members** stays BLOCKED: full names for `Mari`, `Yogi` and `Frederik` are in no
   source in the repo. Do not guess names into a public repo.
5. `data/schedule.json` dates still lag the calendar, which keeps Area 4's 4.5 and 4.7 inert.
6. The CSP is still `Report-Only` with no `report-uri`.

## Area 7 (Members) pre-work findings, 2026-08-31

**Current state:** nothing built for Area 7 yet. `main` clean at `ad747db`. This is
investigation only, recorded so it is not re-derived: reading the data turned up three
problems that would make a naive implementation display wrong information.

**Where the ten stand.** Done: 7.4 deterministic DiceBear avatars, 7.5 LinkedIn
affordance, 7.7 responsive 2/3/4/5 grid, 7.8 accessible names, 7.9 empty state.
Open: 7.1 role badges, 7.2 search, 7.3 sort control, 7.6 sessions-attended, 7.10
removal note.

### The three data problems, measured
1. **Two fake members.** `Unknown #1` and `Unknown #2` carry `status: "Number only"`, a
   parsing artifact where the vault member table recorded a headcount without names.
   Render 7.1 as-is and two cards get a badge reading "Number only". They also inflate
   the count: the tab claims "20 people" and draws 20 cards, but two are not people.
2. **Three members never render.** `Andrei Prusu`, `Pavel Kucera` and `Ernestas Sažinas`
   have full entries with photos in `data/members-profile.json` but **no row in the member
   table**, so they are absent from `members[]` in `src/data.json`.
3. **Attendance names do not line up.** Sessions record first names (`Auri`, `Ignas`,
   `Sany`); members are full names. A naive token match resolves **10 of 15** distinct
   attendee names. The five misses split two ways: `Auri` is Auri's own nickname and needs
   an alias, while `Mari`, `Yogi` and `Frederik` look like guests who were never members.
   A count that silently drops the organiser's own attendance is worse than no count.

### What the data does support
- **7.1 is pure render work.** `members[].status` already holds exactly `Organizer` /
  `Active` (1 and 16 respectively, plus the 2 bogus rows).
- **7.6 is computable.** 6 of 8 sessions have a populated `attendees[]`.
- `PostMaker.jsx` already has a `sameName` helper handling nicknames and prefixes, so the
  fuzzy matcher for 7.6 exists to reuse rather than write.
- 7.3 replaces a **random shuffle on every mount** (`MembersGallery.jsx:56`), which is the
  opposite of a sort control.

### Numbered next steps
1. Fix the data layer first, in `scripts/build-data.js` and `data/members-profile.json`:
   drop the `Unknown #N` rows from the member list (keep them in a headcount if the number
   matters), add the three missing member rows, add an alias field so `Auri` resolves to
   `Aurimas Baciauskas`. 7.1 and 7.6 become honest only after this.
2. Then the UI items: 7.2 search, 7.3 a real sort control, 7.10 removal note.
3. **Open question for Auri:** should guests who attended but are not members appear in
   the directory at all? Yes moves this toward the member/projects directory he asked
   about earlier; no means the attendance count just ignores them.

### WhatsApp as a member-data source: investigated, rejected
Asked whether the roster could be pulled from the WhatsApp group automatically. Three
routes, none usable:
- **Official Meta WhatsApp Business Cloud API** does not expose group participant lists or
  group history for an existing community group, and needs a dedicated number plus Business
  verification. It cannot read the group's roster at all.
- **whatsapp-web.js / Baileys** can, by driving WhatsApp Web or reimplementing the
  protocol, and are a direct ToS violation with a real risk of the number being banned.
  This is the case rule 19 exists for. Do not.
- **Manual chat export** is legitimate but manual, and yields names only.

It is also the wrong SHAPE even if it worked: WhatsApp names are the nicknames (`Auri`,
`Mari`, `Yogi`) that already cause the 10-of-15 matching failure above, with no photo, no
LinkedIn, no email. And a roster is phone numbers, so rules 6 and 18 apply.

**Use the already-planned Supabase `profiles` table instead.** Google sign-in is live and
`user_metadata` already carries `full_name`, `avatar_url` and a `description` that
`src/lib/auth.jsx:19` reads, so names and photos self-update from a source the member
maintains. It gives a canonical user id per member, which fixes the nickname matching at
the root, and carries the "what I'm building" field the projects showcase needs.
Non-signed-in members keep `data/members-profile.json` as the fallback.

**Unverified:** Auri's `orgsConsole` project reportedly aggregates Google + WhatsApp for
LYS/LTBB. If WhatsApp ingestion is already solved there, check how before re-deciding.

### File pointers
`src/components/MembersGallery.jsx` (the tab), `src/lib/members-profile.js` (the merge),
`data/members-profile.json` (photos, LinkedIn, displayName, gender), `scripts/build-data.js`
(parses the vault member table into `members[]`), `src/components/PostMaker.jsx` (`sameName`).

## SHIPPED, 2026-08-31, ten commits on `main`, pushed

**Current state:** `main` == `origin/main` at `93baf8d`. Working tree clean apart from
`probe.html` / `probe.jsx`, which are Hero timer instrumentation from an earlier session,
deliberately not committed and not gitignored either. `feat/dark-mode` was fast-forwarded
into `main` and carries nothing extra.

Everything in parts 1 to 4 below is now on `main` and deployed. **Where those entries say
"uncommitted on feat/dark-mode", read it as history, not as the current state.**

| commit | subject |
|---|---|
| `643ce11` | fix(security): take caller identity from the verified session, never the body |
| `e898ce2` | feat(theme): dark mode and the AI Sundays palette, with gradients scoped |
| `7c1f57f` | feat(brand): rebrand to AI Sundays |
| `0ac6781` | feat(hero): rebuild the hero, and stop the masthead repeating on every tab |
| `03e6e31` | fix(ui): make the photo lightbox usable on a phone, and sort news |
| `3a6fe6c` | chore(copy): remove em-dashes and tighten the UI copy |
| `8878d6f` | refactor: remove the feedback feature |
| `b28e147` | feat(schedule): rebuild Schedule ahead |
| `e85386f` | chore(tooling): make the screenshot harness wait for fetch |
| `93baf8d` | docs: record the plan status in the repo, and the session handoff |

**Verified from the committed tree before pushing**, not from the working copy:
`npx vite build` clean, `npm run smoke` PASS, `npm run theme:check` PASS (34 assertions),
`npm run identity:check` 21/21, `npm run lightbox:check` 13/13.

**Known imperfection in the split.** `index.css`, `App.jsx`, `server.js` and
`vite.config.js` each carry more than one concern, and a single file cannot be split
across commits without interactive staging. They landed with their dominant change and
each commit message names what rode along. The security fix is the one that matters for
review and it is clean in `643ce11` on its own.

**Check on the live site once Vercel finishes:** the wordmark and favicon in both themes,
and that polls and the forum still read and write, because vote keys moved from the
normalised display name to the Supabase user id. Pre-fix votes are deduped on the voter's
next vote rather than migrated in bulk.

### Numbered next steps
1. **Refresh the dates in `data/schedule.json`** to match the live Google Calendar. That
   alone activates 4.5 (venue-status pill) and 4.7 (maintainer hints), which are built and
   verified but inert because the static file lists 2026-05-03 to 2026-07-12 while the
   calendar returns 2026-09-06 to 2026-12-13. Data task, no code.
2. **Area 7 Members** (5/10), the most visible remaining: search, role badges, a real sort
   control in place of the random shuffle on every mount, sessions-attended counts. Also
   the surface a Projects showcase would hang off.
3. **Area 5 Polls** (2/10), the weakest: optimistic vote with rollback, sort toggle,
   arrow-key radio group, aria-live results, duplicate-option detection, share links.
4. **The CSP is still `Content-Security-Policy-Report-Only` with no `report-uri`**
   (`vercel.json:18`), so it neither blocks nor reports and its `frame-ancestors` is inert.
   Left alone deliberately: flipping it ships straight to prod and wants sign-off.
   Groundwork done, `index.html` has no inline scripts and every other header is correct.
5. `.warm-card` still carries a gradient on 8 surfaces, which is gradient-as-default and
   breaks the "scoped, not global" rule in palette.md.
6. `public/brand/hero.png` (3.4MB) is orphaned, and `scripts/optimize-images.mjs` still
   reprocesses it on every build.

### File pointers
`docs/improvement-plan.md` is the live status board for all 100 items (50 done, 17 partial,
21 open, 12 moot across 90 live). `api/_identity.js` is the identity contract every
mutating route now goes through. `src/index.css` holds the palette in the three-state
pattern. `src/components/ScheduleAhead.jsx` and the graft at `src/App.jsx` are the Area 4
work. Brand source of truth is `Desktop/SideProjects/ai-sundays/brand/palette.md`.

## SESSION HANDOFF, 2026-08-31 (part 4), gradients, declutter, feedback removed, Area 4

Everything below shipped to `main` on 2026-08-31.

### Gradients scoped to what palette.md actually allows
The brand rule is "the icon carries gradient, the wordmark stays flat", with gradient
limited to the icon, hero moments and large decorative shapes. The UI broke it in three
places.
- **The page glow was dead code, not just off-brand.** `body::before` painted three
  ANIMATED radial gradients in raw `hsl()` literals from the white-page era, in BOTH
  themes, on a 14s loop. Yellow on cream is 1.57, so at 14% opacity it was invisible and
  cost a repaint every frame. Now a single STATIC Halo, dark mode only, brand yellow,
  which is the scope palette.md gives it. `@keyframes glimmer` had one consumer and went.
- **Chips flattened** (`.pill-top`, `.ideas-chip`). A 20px chip is not a hero moment; a
  135deg two-stop fill at that size reads as a dirty smudge.
- **The Next session wash now traces the Sun.** It ran yellow to PALER yellow, which is a
  fade, not the brand gradient. The mid stop is an amber tint now, so it follows the real
  `#F8B800` to `#F08A00` path at 135deg. Tints, not the saturated stops: ink measures
  15.43 and muted 4.85 on the strongest stop.
- **`.warm-card` still carries a gradient on 8 surfaces** (Learn, Tools, recap, Latest
  discussion, Suggestions). That is gradient-as-default and still breaks the rule. OPEN.

### Declutter
- **The masthead was rendering on EVERY tab.** Tools, Learn, News, Members, Photos and
  Forum each opened with the h1, the description and the art band, and THEN their own
  header: two stacked headings and ~410px of chrome before the first card on a ~1070px
  page. All six have their own header and the nav carries the wordmark, so it is home-only
  now. Tools' first card moved from 530px to 200px.
- Ten strings cut. The pattern was explaining the obvious: "Small utilities for the
  community. No sign-up, no cost." became "Free, no sign-up."
- **435 em-dashes removed across 55 files**, prose only. FIVE are deliberately kept
  because they are structural and removing them breaks parsing: `build-data.js:133` (the
  `### Name / Topic` demo split), `build-data.js:166` (the tools bullets),
  `_gcal.js:124` (title-prefix character class), and `_postmaker.js:113,115`
  (postProcess strips them out of generated posts).
  Not rewritten: `content/sessions/*.md`, which mirrors the Obsidian vault AND uses the
  em-dash as the delimiter the parser splits on, plus the local stores holding
  member-written posts. Verified afterwards: `src/data.json` contains ZERO em-dashes, so
  nothing leaks into the UI.
- **The post-maker prompt gained sentence-shape rules** (no "not X but Y", no throat
  clearing, no inanimate subjects, no adverbs, vary length, two beats three). Em-dashes
  were already guarded there twice, in OUTPUT RULES and in postProcess. Also found
  `#AIWorkshop` still hardcoded in the hashtags the model emits, a rename miss.

### Feedback feature REMOVED
It never worked in production. There was no `api/feedback.js`, so on Vercel the POST fell
through to the SPA and returned HTML; and the handler appended to `data/feedback.md`, a
file, on a read-only filesystem. Deleted the component, the Vite middleware, both
`server.js` routes, `VITE_FEEDBACK_ENABLED`, the README section and the log file (its only
entry was a smoke test). `vite.config.js` no longer touches the filesystem at all, so its
whole `node:fs` import went; `server.js` came down to `existsSync` + `mkdirSync`.
The "Feedback" heading in the accessibility statement stays: that is the contact address
for reporting barriers, unrelated to the button.
If it comes back it needs a real serverless route on Upstash first.

### Area 4 rebuilt, all 10 items
`ScheduleAhead.jsx` went from 47 lines reading five fields to a grouped, foldable list:
month headers, 4 rows then "N more dates", a tinted next row with a `next` pill, per-row
add-to-calendar, the low-runway warning, and the recorded gap rendered.
**The best change is not on the plan:** the venue was printed in full on all six rows
(`@ Matrikel1, Hojbro Pl. 10, 1200 Kobenhavn, Denmark`). It shows once in the header now,
and a row only names a venue when it differs.

**The graft in `App.jsx` was generalised** from `topics` only to also carry `presenter`,
`venueStatus`, `roles`, `notes`, `number` and `luma`, live values winning where both have
something.

**4.5 and 4.7 are inert, and it is a DATA problem, not code.** `venueStatus`, `roles` and
`notes` exist only in `data/schedule.json`; live rows come from Google Calendar. The graft
matches by date and the two sources do not overlap: the static file lists 2026-05-03 to
2026-07-12, the calendar returns 2026-09-06 to 2026-12-13. Both were verified by
temporarily injecting a static entry for 2026-09-06 (warn pill, `#9`, green presenter pill
and DEV hint all rendered), then `data/schedule.json` was restored byte-identical to HEAD.
**Refresh the dates in `data/schedule.json` and both light up with no code change.**

### Plan status
`docs/improvement-plan.md` now lives in the repo with per-item status, which is the whole
point: the previous triage was done once and never written down. **50 done, 17 partial,
21 open, 12 moot** across 90 live items (Area 9's ten are moot now).

### Tooling fixed along the way
- **`scripts/capture.mjs` never waited for fetch**, only for images, so screenshots caught
  the empty state. It nearly made me report a phantom regression in the calendar matcher.
  It now polls until the resource count stops growing.
- **Vite was bound to `[::1]` only**, so `http://localhost` worked and `http://127.0.0.1`
  was refused, while `smoke`, `theme-check` and `capture` all default to `127.0.0.1`. That
  cost two false alarms today. `vite.config.js` now sets `host: '127.0.0.1'`.
- New suites: `npm run identity:check` (21 assertions) and `npm run lightbox:check` (13).
  With `smoke` and `theme:check` (34) that is four.

### Next steps
1. **Refresh `data/schedule.json` dates** to match the live calendar, which activates 4.5
   and 4.7 for free.
2. **Area 7 Members** (5/10) is the most visible remaining: search, role badges, a real
   sort control instead of the random shuffle on every mount, sessions-attended counts.
   It is also the surface a Projects showcase would hang off.
3. **Area 5 Polls** (2/10) is the weakest: optimistic vote with rollback, sort toggle,
   arrow-key radio group, aria-live results, duplicate-option detection, share links.
4. **The CSP is still `Report-Only` with no `report-uri`**, so it neither blocks nor
   reports. Left alone deliberately; flipping it ships straight to prod.
5. `.warm-card` gradient on 8 surfaces.
6. `public/brand/hero.png` (3.4MB) is orphaned and `optimize-images.mjs` still reprocesses
   it on every build.

### Gotchas
- `probe.html` and `probe.jsx` in the root are Hero timer instrumentation from an earlier
  session. Deliberately NOT committed, and not gitignored either.
- `vite.config.js` and `index.html` are CRLF in git; everything else is LF. A scripted
  whole-file rewrite turns a 32-line change into 540. Check `git diff --stat` after any.
- Running the CDP-driven suites back to back can fail on Chrome contention. Run them
  sequentially.

## SESSION HANDOFF, 2026-08-31 (part 3), brand palette + real art

**Current state:** `feat/dark-mode`, uncommitted, now carrying FIVE pieces of work
(dark mode, hero rebuild, identity/security batch, rebrand, this palette pass).

### Palette
Source of truth is `SideProjects/ai-sundays/brand/palette.md`, locked 2026-08-31 with
measured WCAG ratios. **The values I used earlier today were wrong**: I read them off the
wordmark SVG (`#1e4c34` / `#fbb90c`), but the locked values are `#124A30` green,
`#F8B800` yellow, `#F8F0E4` cream. Every other brand asset already used the locked ones,
so the wordmark was the odd one out, `public/brand/logo{,-dark}.svg` were rewritten to match.

`src/index.css` now maps the semantic tokens onto that palette in all three theme states.
Contrast was measured, not eyeballed, and my checker reproduces palette.md's numbers exactly.

- **New `--page` token.** `--background` had to keep meaning SURFACE: it is what
  `btn-primary` uses for its text and what the focus ring punches through, and it is used
  47 times in JSX. So the body ground moved to `--page` (cream / deep green) and
  `--background` became the card surface (white / `#103A26`). Cards read as paper on paper.
- **New `--primary` / `--primary-fg`.** `.btn-primary` was `foreground`-on-`background`
  (black/white). It is now brand green with cream text in light (9.07) and brand yellow
  with deep-green text in dark (8.32).
- Measured picks: light `--muted` `#6B6355` (5.25 on cream), `--ok` `#1B6B45` (5.74),
  `--warn` `#9A5B00` (4.80), `--err` `#B3261E` (5.78). Dark: `--muted` `#9DB3A5` (6.62),
  `--ok` `#5FD39B` (7.92), `--warn` `#F5B93F` (8.35), `--err` `#FF8A80` (6.46).
- **`--warn` is NOT the brand amber.** `#F08A00` is 2.23 on cream and fails as text;
  palette.md is explicit that amber is a gradient end-stop only. Darkened to `#9A5B00`.
- **Yellow is never text on cream** (1.57). It survives as chips, edges and washes where
  the foreground is ink or brand green.
- The brand palette lives on bare `:root`; only the semantic mapping changes per theme, so
  no colour has its only definition inside a conditional block.

### Art
- **Hero band is now two real images**, `public/brand/hero-{light,dark}.webp` (2400x420).
  The old CSS `filter: invert(1) hue-rotate(180deg)` dark-mode fake is DELETED, run on the
  brand art it turns the green horizon magenta. Swapped by the same three-state class rule
  as the wordmark.
- **Favicon comes from the brand's own icons now**, not the one I derived by hand.
  `gen-icons.mjs` renders 16/32 from `brand/icon-16.svg` (rays dropped, shapes thickened for
  tab size) and 180/192/512 from `icon-badge.svg`. `icon.svg` (transparent, gradient) and
  `icon-mono.svg` are also shipped for reuse.
- `public/brand/pattern.webp` (1200px, 44KB) is available and wired to nothing. The source
  PNG was 3.4MB, so it was compressed on the way in. **Not verified as seamlessly tileable**
  Check before using it as a CSS repeat.
- theme-color / manifest background moved to cream and deep green.

### Evidence
Build clean · `identity:check` 21/21 · `lightbox:check` 13/13 · `smoke` PASS ·
`theme:check` PASS, now 34 assertions. Home reviewed in light and dark with real data from
the dev server (preview has no API layer, so the session card is empty there).

**`theme-check.mjs` had the old grounds hardcoded** in seven places (`rgb(255,255,255)`,
`rgb(18,18,18)`, `#121212`). They are now four named constants at the top. While doing that
I found the light theme-color meta was never asserted at all, only the dark one, so a wrong
light value would have shipped silently. Added.

### Follow-ups
1. **`public/brand/hero.png` (3.4MB) and `hero.webp` are now orphaned**, nothing in `src/`
   references them, but `scripts/optimize-images.mjs` still reprocesses the 3.4MB PNG on
   every build. Delete both and drop the hero block from that script. Left in place pending
   your go-ahead since they are tracked.
2. The pattern is unused. Natural homes would be empty states or a Photos-tab header.
3. `lib/venues.js` still maps only `matrikel1`; every other venue renders as plain text.

## SESSION HANDOFF, 2026-08-31 (part 2), rebrand to AI Sundays

**Current state:** still `feat/dark-mode`, still uncommitted. That branch now carries FOUR
things: dark mode, the hero rebuild, the identity/correctness batch, and this rebrand.

### The logo
Source files are `Desktop/SideProjects/ai-sundays/logo/SVG/Ai SUndays {Ori,Inv}.svg`.
Blob lettering with a rising-sun dot, two colours: green `#1e4c34`, amber `#fbb90c`.
`Ori` = green blob + amber letters. `Inv` = amber blob + green letters. Both are solid
blobs, so either sits on any ground. Lockup aspect is 2.879:1 (viewBox 1769.76 x 614.7).

- Copied to `public/brand/logo.svg` (Ori) and `public/brand/logo-dark.svg` (Inv).
- **Header shows the lockup and the text wordmark is gone**, the lockup already contains
  the name. Ori in light, Inv in dark. Swapped in CSS (`.brand-lockup--light/--dark` in
  `index.css`), NOT by choosing a `src` in JS, so the right mark paints on the first frame.
  Mirrors the three-state theme pattern exactly. Sized 32px tall (92px wide); 26px was
  legible but cramped. Both files load on every page (~27KB raw) since a display:none
  `<img>` is still fetched, acceptable, cached, not worth a background-image rewrite.
- **`public/favicon.svg` is new**: the rising-sun dome lifted out of the lockup, amber on
  a green rounded square. Its bbox in the lockup is `x=838.75 y=0 w=258.75 h=173`, fitted
  to 36px wide in a 64 box (`scale 0.13913`). Checked at 16px, the dome still reads.
- `npm run gen:icons` regenerates every raster size from that one SVG.
- **`scripts/gen-icons.mjs` now builds the OG image from the wordmark**, not from a crop of
  the old hero. It uses the STANDARD lockup on cream `#f7f3e8`, deliberately: the rising
  sun sits OUTSIDE the blob and takes the letter colour, so the inverted mark's green sun
  vanishes on a green ground and the logo loses its one distinguishing element. Verified.

### The rename, and what was deliberately NOT renamed
Renamed across header, all document titles, `index.html` (title, description, og:title,
twitter:title), `manifest.webmanifest` (name, short_name, theme_color -> `#1e4c34`),
`LegalPages.jsx` (operator + body + footer), `src/lib/calendar.js` (the event a member adds
to their own calendar), `PostMaker.jsx` + `api/_postmaker.js` (the LLM voice prompt and the
OpenRouter `X-Title`), `scripts/draft-session-post.mjs`, and the feedback-log header.

**Left alone on purpose, changing any of these breaks live data or a real path:**
- `aiworkshop:polls` / `:votes:` / `:thread:` / `:thrvotes:` / `:topics` / `:rsvp` /
  `:sessionnames` are **Upstash keys**. Renaming them orphans every poll, comment, vote
  and RSVP in production.
- `aiw.theme`, `aiw.staleScheduleDismissed`, `aiworkshop_voter_name`, `aiworkshop_rsvp_*`,
  `aiworkshop_attendees_*` are localStorage/cookie keys. Renaming resets every user.
- `scripts/build-data.js` points at the real vault folder
  `Documents\Obsidian Vault\AI Workshop`. Rename that folder first if you want it moved.

### Calendar matching now accepts both names
`api/_gcal.js` matched the single substring `'AI Workshop'` against real Google Calendar
event titles, so renaming the events would have silently emptied the schedule. It now takes
a comma-separated list, defaulting to `'AI Sundays,AI Workshop'`, and the theme-stripping
regex handles either prefix. `GCAL_EVENT_MATCH` still overrides. Verified against six title
shapes including an explicit override narrowing back to one name.

### Evidence
Build clean · `identity:check` 21/21 · `lightbox:check` 13/13 · `smoke` PASS (titles now
read `AI Sundays · <tab>`) · `theme:check` PASS. Header reviewed in light, dark and at
390px; favicon reviewed at 16px and 128px; og.png reviewed at full size.

### Follow-ups
1. **`public/brand/hero.png` / `hero.webp` are still the old abstract line-art** and no
   longer match the brand. The hero band on every tab shows it. Needs new art, or drop it.
2. The Vercel URL stays `a-icommunity.vercel.app`; nothing in the app depends on the name.
3. Supabase OAuth consent screen still says the old name if it was set there, check
   before the next sign-in flow demo.
4. `manifest.theme_color` is now brand green while the runtime `theme-color` meta is still
   white/near-black per theme. Intentional (green is the install/splash colour) but worth
   a look on an installed Android PWA.

## SESSION HANDOFF, 2026-08-31, improvement batch 1: identity + correctness (RESUME HERE)

**Current state:** still on `feat/dark-mode`, still uncommitted. That branch now carries
THREE things: dark mode, the hero rebuild, and this batch. Splitting it into separate
commits before merge matters more than it did yesterday.

### The improvement plan's status is gone
`docs/improvement-plan.md` still exists only on `origin/claude/audit-and-ui-overhaul`
(extracted and read this session). The per-item triage from 2026-08-30 was NEVER SAVED
only the summary counts (22 done / 28 partial / 45 open / 5 moot) survived in this file.
Re-triaging is a prerequisite for working the plan systematically. The five items the
previous handoff named by file and line were all re-verified as real this session.

### Built: the identity fix (bigger than the handoff described)
The handoff called out "poll votes are keyed on `body.name`". The same root cause was in
SIX places: every mutating handler called `guardMutation`, which verifies the Supabase JWT
and then DISCARDS the user, so each handler read identity from the request body.

| File | Action | What a signed-in member could do |
|---|---|---|
| `_topics.js` | delete | Delete anyone's topic, cascade-purging its whole thread + votes |
| `_threads.js` | delete | Delete anyone's comment and all its replies |
| `_threads.js` | vote | Vote as anyone, or overwrite their vote |
| `_threads.js` | post | Post under anyone's name |
| `_polls-core.js` | vote | Vote as anyone, or overwrite their vote |
| `_polls-core.js` | create | Attribute a poll to anyone |

The two deletes are broken access control on a destructive path, and `_threads.js` powers
the Ideas board and the Forum, so one signed-in member could wipe the discussions.

- **New `api/_identity.js`**, one source of truth. `nameOf` / `avatarOf` / `voterKey`
  (the Supabase user id) / `ownsRecord` / `identityFor`.
- **Vote keys moved from the normalised name to the user id.** A name can be changed in
  the profile editor and two members can share one, which is exactly why keying on it let
  anyone overwrite anyone.
- **Legacy vote rows are deduped, not double-counted.** Votes cast before the fix are
  keyed on the name; when that same person votes again the old row is deleted. Needed a
  new `delVote` on both poll stores (Upstash `HDEL` + the file store); `_threads.js`
  already had one.
- **`ownsRecord` falls back to the name for pre-fix records** that have no `userId`, but
  compares against the name on the VERIFIED session, never the body. That keeps old
  comments deletable by their author without reopening the hole.
- **Typed-name mode still works.** With no Supabase configured `requireUser` returns
  `configured: false`, `user` stays null, and `identityFor` falls back to the body name.
  There is no session to trust and nothing to protect in that mode.
- **All nine call sites** updated so the three runtimes agree: `api/{polls,threads,topics}.js`,
  the Vite dev middleware (new `whoFor` helper next to `gate`), and `server.js` (same helper).
- **No client changes were needed.** `useMemberName` already returns the session name in
  auth mode with `setName` as a no-op, so what the client sends already matches what the
  server derives.

### Also built
- **The recap lightbox is operable on a phone** (`SessionRecap.jsx`). This was NOT a
  half-applied fix: it is the app's ONLY lightbox and the gallery routes every photo click
  into it, so mobile users could never see past photo 1 of any session. Added a bottom
  prev/counter/next bar (`sm:hidden`, since the side arrows are `hidden sm:flex`), swipe,
  next-image preload, and real alt text (`Session photo N of M`) in place of `alt=""`.
  Two bugs found by the test and fixed:
  - `touch-action: pan-y` + `overscroll-behavior: contain` on the overlay. Without it a
    right-swipe near the left edge is the platform's back gesture, so paging back
    navigated off the recap route entirely (confirmed: the hash was cleared).
  - The gesture's trailing compatibility click hit the overlay's click-to-dismiss and
    closed the viewer mid-swipe. Suppressed with a 400ms TIMESTAMP, not a flag, a flag
    left standing also ate the next real tap, so dismissing after a swipe took two taps.
- **News is explicitly newest-first** (`News.jsx`). `data/news.json` is genuinely unsorted
  (the drafting pipeline writes source order), so an arbitrary item led the roundup.
  Sorted on a copy; `news` is an imported module object and must not be mutated.
- **`index.html` title** was `AI Workshop · Cockpit`, a tab renamed to Home months ago.
- **Unknown `/api/*` now returns 404 JSON** in `server.js` (plan item 10.9). The SPA
  fallback answered `/api/anything` with 200 and an HTML shell. Verified live.

### Evidence
`npx vite build` clean. New `npm run identity:check` (21 assertions) and
`npm run lightbox:check` (13 assertions) both PASS, plus `npm run smoke` PASS and
`npm run theme:check` PASS. The identity check was run against the PRE-FIX handlers to
confirm it actually catches the bug: it failed 9 assertions there, including
`totalVoters 1` where two different people had voted (Bob's vote erased Alice's), and a
separate probe showed Bob deleting Alice's topic with a 200.

### Next steps
1. **Split and commit `feat/dark-mode`.** Three logical commits: dark mode, hero, this batch.
2. **The CSP is still dead and was deliberately NOT touched.** `vercel.json:18` is
   `Content-Security-Policy-Report-Only` with no `report-uri`, so it neither blocks nor
   reports and its `frame-ancestors` is inert. Flipping it to enforcing needs sign-off
   because it ships straight to prod. Groundwork done: `index.html` has no inline scripts
   (`/theme-init.js` is a real file), every other header is already correct, and the
   external origins in the current policy look complete. Verify the ImgBB and Gemini calls
   are all server-side before flipping.
3. **Re-triage the 100-item plan** against current main; the old triage is unrecoverable.
4. Cheap wins still open: `pushState` for tab back/forward (`App.jsx:90`), `venueStatus`
   and `gaps` (read by nothing), `sortByProfileCompleteness` (imported by nothing).

### Gotchas
- **`vite.config.js` and `index.html` are CRLF in git; every other file here is LF.**
  Rewriting them whole with an LF-writing script turned a 32-line change into 540 and a
  5-line change into 59. Restored. Check `git diff --stat` for absurd counts after any
  scripted edit.
- **`scripts/smoke.mjs` and `theme-check.mjs` default to `127.0.0.1:5281`** and expect
  `vite preview`, not the dev server on 5280. Pointed at the wrong target they fail
  loudly and misleadingly (all 7 routes `mounted=false`); `theme:check` also reports 2
  false failures against dev. `scripts/capture.mjs` has the same 127.0.0.1-vs-localhost
  trap. Vite binds `localhost`, which resolves to `::1` here.
- `#sessions` in the smoke test is mildly flaky on preview (`mounted=undefined`, a timeout
  on the heaviest page). Passed on reruns.
- `probe.html` and `probe.jsx` in the repo root are untracked leftovers from an earlier
  session, not part of this work.

## SESSION HANDOFF, 2026-08-30 (part 2), hero rebuild (RESUME HERE)

**Current state:** on the same branch `feat/dark-mode`. Dark mode passed its
re-audit (GO). The hero rebuild (plan Area 2) is built and green, not committed.

### Where the improvement plan actually stands
`docs/improvement-plan.md` ("10 areas x 100 improvements") lives ONLY on
`origin/claude/audit-and-ui-overhaul`, not on main. That branch is now 54 behind
and 2 ahead, 5051 insertions over 79 files, and rewrites components main no
longer has (`TopicPoll.jsx`, `Hero.jsx`, `Footer.jsx`, `OpenActions.jsx`,
`DemoBacklog.jsx`). Treat it as unmergeable; the DOCUMENT is the only thing
worth rescuing.

Four agents triaged all 100 items against current main:
**22 done, 28 partial, 45 open, 5 moot.** The plan is wrong in both directions:
it claims 10.1 security headers that were never enforced, and has no idea about
deep links, code splitting, skeletons or reduced-motion that shipped later.

### Built this round: Area 2, the hero
`src/components/Hero.jsx` (new). The masthead renders on every tab; the
at-a-glance band only on home.
- **2.1 CTA**, "Add to calendar" as a real `btn-primary`. The duplicate weak
  text link was REMOVED from `NextSession.jsx`; two copies of one action on one
  screen blurred the hierarchy. RSVP is now unambiguously the card's primary.
- **2.2 countdown**, `useCountdown` self-schedules with recursive setTimeout:
  every second inside the last hour, every minute before, no timer at all past
  a week out or once the session is over. Keyed on a timestamp, not a Date, or
  the effect re-runs every render.
- **2.3 / 2.4 stats**, numerals-first: value large in `.num` tabular figures,
  label under it. Next session / sessions held / members.
- **2.5** one-line description under the h1.
- **2.6** "Today is Sun 30 Aug" line.
- **2.7** `.hero-title` uses `clamp(1.75rem, 1.1rem + 3.2vw, 3rem)`.
- **2.8** dismissible stale-schedule notice, dismissal in sessionStorage.
- **2.10** hero art down to `h-20` on mobile from `h-28`.
- **2.9 "New here?" SKIPPED ON PURPOSE.** The About Us page it would link to
  does not exist. Inventing a destination would be a speculative feature.

### Supporting changes
- `src/lib/dates.js`, `sessionStart()` resolves the real start instant, using
  a session's `startsAt` when present and otherwise pinning 12:30 to
  Europe/Copenhagen. The offset comes from `Intl`, so CET/CEST is automatic
  (verified: Sept resolves to 10:30Z, Dec to 11:30Z, both 12:30 local).
  Also `formatCountdown()` and `fmtToday()`.
- `src/lib/calendar.js` (new), `googleCalendarUrl()` lifted out of
  `NextSession.jsx` so the hero can use it without a second copy.
- `src/lib/schedule.js`, `useSchedule` now returns `status`:
  `loading | live | unconfigured | stale`. An UNCONFIGURED calendar is not a
  stale one; only `stale` shows the warning, so local dev does not cry wolf.
- `api/_gcal.js`, `toSession` now passes `startsAt` through, so the countdown
  can use the real event time instead of always assuming 12:30.

### Evidence
`npx vite build` clean, `npm run smoke` PASS (7 routes + 390px), and
`npm run theme:check` PASS (33 assertions) after the hero landed. Screenshots
reviewed in light, dark and at 390px, with a temporary future session injected
to see the populated state, then reverted (`data/schedule.json` is byte-clean
against HEAD, verified with `git status`).

### Next steps
1. **Review and merge `feat/dark-mode`.** It now carries dark mode AND the hero.
   Consider splitting into two commits.
2. **The security batch, not yet built.** Highest value in the whole triage:
   - **Poll votes are keyed on `body.name`** (`api/_polls-core.js:169`,
     `createdBy` at `:159`). `guardMutation` verifies the JWT then discards the
     user, so any signed-in member can vote as anyone or overwrite their vote.
     `requireUser()` already exists in `api/_guard.js:76-81` for exactly this.
   - **The CSP is dead**: `vercel.json:18` is `Content-Security-Policy-Report-Only`
     with no `report-uri`, so it neither blocks nor reports, and its
     `frame-ancestors` is inert.
   - **`/api/anything` returns 200 HTML** (`server.js:156` SPA fallback).
   - **The photo lightbox has no mobile navigation**: arrows are `hidden sm:flex`
     (`SessionRecap.jsx:224,227`) and there are no touch handlers.
   - **News is not newest-first**: `News.jsx:50` renders raw file order and
     `data/news.json` is genuinely unsorted.
3. Cheap wins, data already plumbed and dropped: `pushState` for tab
   back/forward (`App.jsx:90`), `venueStatus` and `gaps` (read by nothing in
   `src/`), `sortByProfileCompleteness` (imported by nothing).

### Gotchas
- **Production is Vercel only.** `.github/workflows/deploy.yml` has its push
  trigger commented out, so `server.js` is a parked runtime. `vercel.json`
  headers are what ship.
- **`vite preview` has no API layer**, so `/api/schedule` 404s to the SPA and
  the stale notice always shows there. On Vercel `api/schedule.js` returns
  `{configured:false}` when GCAL_* is unset, so it will not fire spuriously.
- **`git checkout --` plus `autocrlf: true` makes `diff <(git show ...)` show
  every line changed.** That is LF-vs-CRLF, not a real difference. Trust
  `git status`.
- The hero renders on EVERY tab; only the at-a-glance band is home-gated.

## SESSION HANDOFF, 2026-08-30

**Current state:** dark mode built and verified on branch `feat/dark-mode`.
**Nothing committed, nothing pushed**, live site unchanged. Branch is off `main`
(which auto-deploys, so it stays untouched).

### What was just done
The app was light-only: zero occurrences of `dark`, `dark:` or
`prefers-color-scheme` anywhere in `src/`. Two things made it look like dark mode
existed and did not: `index.html` carried a near-black `theme-color` meta, which
only tints the mobile address bar, and `capture.mjs` forced both colour schemes
over CDP against CSS that never responded, so both sets of screenshots came out
identical.

- **`src/index.css`**, the light `:root` palette gained `--surface-mix`,
  `--overlay`, a `--gold-*` set, and three shadow tokens. Every one of those is
  redefined in two dark selectors: `@media (prefers-color-scheme: dark)
  { :root:not([data-theme="light"]) }` for anyone who has not chosen, and
  `:root[data-theme="dark"]` so the toggle wins in both directions. No colour has
  its only definition inside a conditional block.
- **`src/lib/theme.js`** (new), `useTheme()` with three states. `system` removes
  both the attribute and the storage key, so the CSS media query decides and a
  device that later changes its OS preference follows along. Also drives the
  `theme-color` meta, follows OS changes live while on `system`, and syncs across
  tabs via the `storage` event.
- **`src/components/ThemeToggle.jsx`** (new), `role="radiogroup"` with three
  `role="radio"` icon buttons (Lucide Sun / Moon / Monitor). `compact` variant in
  the desktop header, labelled variant in the mobile hamburger sheet.
- **`public/theme-init.js`** + `index.html`, applies the saved theme before
  first paint.
- **Pinned surfaces that must not follow the theme:** `.chip-on-media` (the
  `bg-white/90` chips over photos in News / SessionsGallery / SessionRecap, with
  `text-foreground` they would have gone white-on-white), the PostMaker LinkedIn
  and Instagram preview panels, and the photo lightbox.
- **`.hero-art`**, the hero is inverted by CSS filter in dark mode. One asset,
  not two.
- **Tooling:** `smoke.mjs` + `capture.mjs` are platform-aware now; `capture.mjs`
  gained seven dark shots; new `scripts/theme-check.mjs` / `npm run theme:check`.

### Audit round (completion-auditor: BLOCK, then fixed)

The auditor reproduced the build and both test scripts, script-diffed token
parity (21 tokens, all redefined in both dark selectors, none dark-only), and
ran its own CDP contrast sweep over every visible element on all 7 routes in
dark: **zero low-contrast text**. It found two real defects, both in the toggle
rather than the palette, and both are now fixed:

1. **The two toggle instances did not stay in sync.** `useTheme()` gave each
   caller its own `useState`, and `ThemeToggle` is mounted twice (header +
   mobile sheet). Clicking Dark in the sheet left the header radio still
   reporting `aria-checked="true"` on System until a reload. The state now
   lives in a module-level store read through `useSyncExternalStore`, so there
   is one value and both instances see it.
2. **`role="radiogroup"` was declared without the keyboard contract.** All
   three radios had `tabIndex 0` and the arrow keys did nothing, so a screen
   reader announced "1 of 3" and Tab walked through all three. Now a roving
   `tabIndex` with Arrow / Home / End, moving selection and focus together.

Also from that pass: three `rgba()` shadows that `--modal-shadow` was made for
were still hardcoded (`App.jsx`, `AuthControls.jsx`, `PostMaker.jsx`) and are
now tokenised, with a new `--popover-shadow` for the two dropdowns; the compact
toggle buttons gained `.tap-target`; the CSP comment in `theme-init.js` was
wrong (`server.js` sets no CSP at all, and the `vercel.json` one is
`Report-Only`) and now says so; README gained the two script rows and a Theme
control section.

`scripts/theme-check.mjs` grew from 21 to 33 assertions, covering exactly the
two blockers: it now opens the mobile menu at 390px and asserts both
radiogroups agree, and drives real key events for Arrow / Home / End.

**One pre-existing issue the sweep surfaced, not caused by this branch and not
fixed here:** `SessionsGallery.jsx:205` renders `--muted` on `bg-accent` at
4.35:1 in LIGHT mode, just under AA. `git diff` confirms the light `--muted` is
untouched by this work.

### Evidence
- `npx vite build` clean.
- `npm run smoke` PASS, all 7 routes, no console errors, plus the 390px pass.
- `npm run theme:check` PASS, 33 assertions. Dark contrast 16.00:1 foreground,
  6.99:1 muted.
- Screenshots reviewed in both themes across home, news and tools.

### Next steps
1. **Review the diff and merge.** Branch off `main`, nothing auto-deployed yet.
2. **Fold the two checks into one pre-push habit:** `npm run smoke` then
   `npm run theme:check`, both against `vite preview` on 5281.
3. Everything still open from the 2026-08-29 handoff below is still open, the
   photo-deletion policy call and the poll auth review in particular.

### Gotchas worth not undoing
- **`theme-init.js` is a separate file on purpose.** The CSP in `vercel.json` is
  `script-src 'self'`; an inline script would need a sha256 hash maintained in
  both `vercel.json` and `server.js` every time a byte of it changes. It must
  stay in sync with `src/lib/theme.js`: same key `aiw.theme`, same attribute.
- **The page glimmer is dimmed with a `filter`, not `opacity`.** `@keyframes
  glimmer` animates opacity, and an animation beats a plain declaration, so an
  `opacity:` override there does nothing.
- **`:root` must keep `color-scheme`.** It is what makes scrollbars and native
  form controls follow the theme.
- **Every file in this repo is CRLF.** Patch in binary mode or you rewrite the
  whole file (same trap `vite.config.js` already had).
- **`scripts/theme-check.mjs` proves no-flash by blocking the app bundle** so
  React never runs. If `data-theme` is still set, only the render-blocking script
  in `<head>` can have set it. Do not "simplify" that into a timing check
  `Page.navigate` to the same URL and hash is a no-op and creates no document,
  which is what made the first two attempts at this silently pass nothing.
- `npm run smoke` needs `vite preview` on **5281**; `npm run dev` is 5280.

### Files
`src/index.css`, `src/lib/theme.js`, `src/components/ThemeToggle.jsx`,
`public/theme-init.js`, `index.html`, `src/App.jsx`,
`src/components/{News,SessionsGallery,SessionRecap,PostMaker}.jsx`,
`scripts/{theme-check,smoke,capture}.mjs`, `package.json`.

## SESSION HANDOFF, 2026-08-29

**Current state:** three commits pushed to `main` and deployed. One security
finding left deliberately undecided (below). One branch parked.

### Pushed to main
1. `17a1255`, parser fixes (see below)
2. `92c7324`, security headers, skip link, per-tab titles, `npm run smoke`
3. `de01fb2`, a11y + CLS fixes on the session card, news, members, photos
4. `14db26d`, news window moved to 15–29 Aug, logo links home, touch behaviour
5. `a4f9c7f`, finger-sized tap targets + a mobile pass in the smoke test

### New tooling worth knowing about
- **`npm run smoke`**, loads all 7 routes in headless Chrome, fails on any
  console error or uncaught exception, then re-runs at 390px with touch and
  coarse-pointer emulation to check horizontal overflow and tap-target sizes.
  Added because `vite build` passed cleanly on a temporal-dead-zone
  ReferenceError that would have thrown on first render.
- **`node scripts/capture.mjs <dir>`**, screenshots every route in both colour
  schemes over the DevTools Protocol. The plain `--screenshot` CLI flag ignores
  `--force-prefers-color-scheme` and cannot do full pages. It scrolls first,
  because `captureBeyondViewport` does not trigger `loading="lazy"` images and
  the tail of every long page was otherwise screenshotting blank.
- **`node scripts/gen-news-placeholders.mjs`**, several news sources serve one
  og:image across every article, so five cards showed the same picture and one
  none. Generates a distinct typographic card per story instead.

### Mobile decisions worth not undoing
- Pinch-zoom is deliberately still enabled. `touch-action: manipulation` kills
  double-tap zoom (the accidental one), and 16px form controls under 640px stop
  iOS zooming on focus. Disabling pinch-zoom outright fails WCAG 1.4.4 and iOS
  has ignored `user-scalable=no` since iOS 10 anyway.
- Tailwind v4 already wraps its own `hover:` utilities in `@media (hover:hover)`.
  Three hand-written `:hover` rules in index.css were not, so they latched on tap;
  those are now guarded with `:active` press states for touch.

### Needs YOUR decision, not a patch: photo deletion is not ownership-checked
`DELETE /api/photos?url=...` and `PATCH` (move) are gated by `guardMutation`, so
the caller must be signed in and is rate-limited, but **nothing checks that the
caller uploaded the photo**. Any signed-in member can delete or move any other
member's session photo.

The uploader IS recoverable: `api/_photos.js:31` parses it out of the blob
pathname (`<slug(name)>__<filename>`).

Not fixed here because it is a policy call, not a bug. Locking deletion to the
uploader would stop you curating other people's uploads. The options:
- uploader-only, with a `PHOTO_MODERATORS` env allowlist for you
- leave it open (fine if the room is trusted) and just document it
- soft-delete instead of hard-delete, so anything removed is recoverable

Everything else in `api/` checks out: every mutating route calls
`guardMutation`, and `_guard.js` verifies the Supabase JWT server-side rather
than trusting anything in the body.

### Also worth knowing
- **62 `"<name> 2.jsx"` duplicates** are sitting untracked in `src/components/`,
  byte-identical to their originals, imported by nothing. Same syncing artifact
  that produced the corrupt git ref. `.gitignore` now blocks them from ever
  being committed; deleting the local copies is safe.
- **Local dev looks emptier than production.** Schedule comes from Google
  Calendar and the forum/ideas from Upstash, so without those env vars Home
  renders "No upcoming session scheduled" and empty forum cards. Don't judge
  layout changes from a local screenshot.

### PR #3, parser fixes (ready to review)
`claude/parser-and-feedback-fixes` · https://github.com/AuriDevcourse/AIcommunity/pull/3

Three regexes used anchors JavaScript doesn't have, each failing silently:

- **`\Z` is not a JS anchor**, in `build-data.js` it matched a literal "Z", so the Action
  Items block was cut at the first capital Z in the text (a name like "Zoe" ate the rest of
  the list, and the partial line was still captured, so items could be stored truncated
  mid-word). Rebuilding against the real vault recovers one previously-invisible action item
  (22 → 23), loses none.
- **Members-table regex** terminated only on a blank line, so if the table is ever last in the
  hub file, `members` silently becomes `[]` on an exit-0 build. Not triggered today; fixed
  preventively, same shape of bug.
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
lost, treat it as a scrap heap, not a proposal. Anything worth keeping should be re-derived
against current `main`.

Possibly still worth cherry-picking from it, if you want them:
- Security headers on `server.js` (CSP, nosniff, referrer, frame-ancestors, HSTS) + compression
- `scripts/audit.mjs`, pre-deploy budget/meta/header/data-freshness check
- `scripts/capture.mjs`. CDP screenshots of every tab in both themes (the `--screenshot` CLI
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

## SESSION HANDOFF, 2026-06-19

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
  `postmaker.session` handoff. Tools opens 'post', PostMaker preselects + clears it; no inline
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
   to the real ~12-15, fix names, add website links (`- **[Name](https://url)**, note`).
2. **Commit + deploy this batch:** branch (e.g. `feat/sessions-recap-polish`) off `main`, commit,
   push (= deploy). Lots of good polish sitting local.
3. **About Us page** (was the pre-pivot feature): rename Members tab → About Us (origin/where/when
   + members grid, smaller photos). Interview started. WAITING ON AURI for: origin story, venue,
   rhythm, who-it's-for, how-to-join, and the public-framing question (portfolio-accelerator vs
   softer "builders learning by building").
4. **"What's new" changelog**, header button + `data/updates.json`, badge on major updates only.
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
  auth-gated), or just rely on the new ignore-the-default logic.
- `npm run build:data` must run after editing any `content/sessions/*.md` (dev does it on start).

**Files:** `content/sessions/*.md` (notes w/ `**Title:**`), `scripts/build-data.js` (parser),
`src/components/SessionsGallery.jsx`, `src/components/SessionRecap.jsx`, `src/components/Tools.jsx`,
`src/components/PostMaker.jsx`, `src/App.jsx`.

## SESSION HANDOFF, 2026-06-16

**Current state:** Session **#08 (2026-06-14)** transcribed, cleaned, and published to the
Obsidian vault + built into `src/data.json`. It shows on the **local** dev server only.
**NOT committed, NOT pushed**, live site unchanged. Changes sit **uncommitted on `main`**.

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
1. **Decide git:** move the uncommitted changes onto a branch (e.g. `feat/session-08`), repo
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

## Latest session, 2026-06-14 (merged to `main`, deployed · commit `ca77400`)

**Current state:** Built a "Topics for the day" system + a presentation deck for running the meetup, plus image compression and Forum tweaks. All merged to `main` and pushed (auto-deploys to Vercel). Build clean.

**What was just done:**
- **Topics for the day.** New left column in the **Forum** tab (topics left, forum right). Topics are per-session in `data/schedule.json` under each upcoming entry's `topics[]`, grafted onto the live Google Calendar session **by date** in `App.jsx` (gcal only carries date/theme/venue). A topic can have `points[]`, a `flow[]` pipeline (icon + label + detail), a `files[]` breakdown (name/does/rules/risk, where each rule is `{rule, without}`), an `image`, and a `note`. Icons are named as strings, mapped in `src/lib/topicIcons.js`.
- **Present deck** at hash route `#present` (opens in a **new tab** via the "Present" button, for a projector while the dashboard stays on the laptop). `TopicsPresentation.jsx`: cover → one slide per topic → drill-down file slides showing each file's **rule / without-it** in two columns. Keyboard + dot nav, mirrors the Learn viewer. Route wired in `App.jsx` (early-return, guarded against the hash-rewrite effect like `#recap`).
- Today's (2026-06-14) topics cover: how our sessions run (a **proposal** to discuss), recording + transcription pipeline, social posts connected, the **CLAUDE.md story** (WORKFLOW/SECURITY/DESIGN + why + per-file rules), project updates & feedback, recap.
- **Recording notice** on the Next Session card (`NextSession.jsx`), "say your name ~10s, sessions are recorded."
- **Forum:** Ideas + Polls now **expanded by default** (no accordion). Ideas shows 3 with "See more" (+10), Polls shows 3 with "Show all" (`SessionThread.jsx` `initialLimit`, `Polls.jsx` `initialLimit`). Topics column scrolls on desktop.
- **Sessions tab renamed to Photos** (`App.jsx` TABS).
- **Image compression.** Shared `src/lib/compressImage.js` (1600px JPEG ~0.82, GIFs untouched). Auto-applied on **forum image** uploads (`SessionThread`) and **Image-to-link** tool. New **Image compressor** tool (`ImageCompressor.jsx`, drop → before/after size → download). `PhotoUploader` already compressed (left as-is).
- **News tab note** about a planned auto-refresh cron (`News.jsx`).

**Next steps:**
1. **Decide the news cron cadence** (1 vs 2 weeks) and wire the actual job, the note in the News tab promises it. The scaffolding exists: `scripts/draft-news.mjs` + `.github/workflows/news.yml` (needs `GEMINI_API_KEY` GitHub Actions secret).
2. To set topics for the next session: edit the matching date's `topics[]` in `data/schedule.json`, then `npm run build:data` (dev runs it on start).
3. Optional: add real `image` paths to topics (drop file in `public/`, set `"image": "/..."`), placeholders show until then.
4. Still pending from before: per-user LLM token quota on `/api/generate-post`; publish Google OAuth consent screen to Production.

**Gotchas:**
- `data/schedule.json` is the source; `src/data.json` is generated by `build:data` (tracked, committed). Editing schedule.json alone won't update the app until build:data runs.
- `#present` opened in a new tab loads the whole SPA at that hash; the static schedule fallback means it works immediately even before the gcal fetch.
- `npm run build` re-optimizes images in `public/` (sharp), those binary changes are build artifacts; don't commit them (reverted this session).

**Key files:** `src/components/TopicsForTheDay.jsx`, `TopicsPresentation.jsx`, `TopicFiles.jsx`, `src/lib/topicIcons.js`, `src/lib/compressImage.js`, `src/components/ImageCompressor.jsx`, `data/schedule.json` (topics), `src/App.jsx` (Forum two-col + `#present` route + Photos rename).

## Session, 2026-06-11 (branch `agent/overhaul-2026-06-11`; this work reached `main` via `feat/calendar-schedule`)

Overhaul pass: fixes + design consistency/lift + 2 new features + automation. App was already in good shape (clean build, no critical bugs), this is polish + additions.

- **Design primitives + consistency.** Added shared `.modal-overlay`, `.modal-panel`, `.input`, `.empty-state`, `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-sm` to `index.css`, then applied across the modals (Feedback, Auth sign-in + profile, Photo uploader, Session editor) so overlays/padding/inputs/buttons match. Standardized the lightbox spinner to Lucide `Loader2`. Skeleton radii tidied. **Did NOT** force `.card-interactive` onto News/Members (they're media-led magazine cards with their own hover lift, boxing them would be wrong) or downgrade the richer icon-led empty states.
- **In-dashboard RSVP** (new). `api/_rsvp.js` (Upstash in prod / file store in dev, same pattern as session-meta), `api/rsvp.js` route + dev middleware. Identity (id/name/avatar) is derived **server-side from the verified Supabase session, never the body** (`requireUser` added to `api/_guard.js`). `Rsvp.jsx` adds a "I'm going / Maybe" toggle as the **primary CTA on the Home hero** (Luma demoted to a secondary text link); shows who's going with avatars. Anonymous POST → 401 (verified). GET is public + edge-cached.
- **Public session recap pages** (new). Hash route `#recap/<date>` (added to `App.jsx`'s router alongside the legal routes). `SessionRecap.jsx`: cover, demos, attendees, photo gallery (committed + Blob uploads), **Copy link**, and a **Draft a LinkedIn post** button that streams via the existing `/api/generate-post` (new `src/lib/postdraft.js` SSE helper, `AbortController` cancel-on-leave). Entry point: a **Recap** link on each Sessions tile. _Caveat: hash-route SPA won't rich-unfurl on LinkedIn, static per-session OG prerender is the documented follow-up._
- **News automation.** `scripts/draft-news.mjs` pulls public AI RSS (TechCrunch/Verge/Ars/VentureBeat/HF), Gemini flash (`gemini-flash-latest`) curates 8 items into `data/news-draft.json` (a **review file, never auto-publishes** into `news.json`). `.github/workflows/news.yml` runs it weekly + fetches cover images + opens a review PR. Verified locally: 60 candidates → 8 attributed drafts.
- **Cost audit** → `docs/cost-audit.md`. All free-tier today; #1 exposure is `/api/generate-post` having no cumulative per-user quota (Security rule 5), now more relevant since auto-recap adds LLM calls. Includes a ~30-line implementation sketch + provider spend-cap backstop. Quota itself NOT built this pass (documented as fast-follow).
- **Fixes:** `PhotoUploader` now uses the shared `TODAY` (noon-UTC) instead of a stray `new Date()`. Reviewed by a verification agent, one routing bug found + fixed (nav tabs were dead while a recap page was open; now route through `goTo`).
- **News refreshed to the past two weeks** (`data/news.json`, window May 28 – Jun 11): 8 current items + rewritten theme statements, generated via the new `draft:news` pipeline and curated by hand, cover images fetched.
- **Session #07 transcript → recap → SoMe post.** `build-data.js` now also parses the note's **"## Tools & products discussed"** into `session.tools` (the AI ideas). `SessionRecap.jsx` shows the About + a "Tools & ideas discussed" section and folds both into the LinkedIn-draft prompt, so the recap's auto-post is genuinely about what was discussed. New CLI `scripts/draft-session-post.mjs <date> [linkedin|instagram]` generates the same post from the terminal (reuses `_postmaker.js`). Session #07's note already lives in the vault; `data.json` rebuilt with its 28 tools.

Outstanding before merge: manual browser smoke (RSVP toggle, recap page, modals); decide whether to commit `data/news-draft.json`; add `GEMINI_API_KEY` as a GitHub Actions secret for the news workflow.

## Session, 2026-06-07 (merged to `main`, deployed)

- **Performance pass, "instant load."** The page was dominated by ~77MB of unoptimized images (raw camera photos up to 5MB each; a 3.4MB hero PNG above the fold on every tab). Added `scripts/optimize-images.mjs`, an idempotent `sharp` pipeline (manifest-guarded, wired into `build`) that downscales + recompresses session/news/member images to display sizes and emits a small WebP hero. **77MB → 13.8MB; hero 3.3MB → 29KB.** Re-runs/Vercel builds skip already-done files. New photos dropped in `public/sessions/<date>/` auto-optimize on next build.
- **Code-split the non-default tabs** (Learn, Forum, News, Tools, Members, Sessions) with `React.lazy` + `Suspense` (each loads only when opened; initial JS 154KB → 122KB gzip). Added a **`TabErrorBoundary`** that auto-reloads once on a stale-chunk failure (the classic post-deploy cached-page 404), so code-splitting can't strand users on a blank tab.
- **Edge-cache API GETs** (`Cache-Control` `s-maxage` + `stale-while-revalidate`) on photos/session-meta/topics/threads/polls/attendees → repeat loads are instant.
- **Dropped the dead, render-blocking Google Fonts `<link>`** (Inter/JetBrains), the app self-hosts Geist via fontsource; those were never used.
- **Sessions gallery: skeleton-hold + reduced-motion.** Holds the grid behind matching skeleton tiles until both photos + session-meta settle (no more late sessions popping in / shifting layout). Added a `prefers-reduced-motion` guard to the shared `.skeleton` shimmer (app-wide). **Edit button moved to overlay the cover photo's top-right.**
- **Post maker upgrades (Tools):** output now **streams token-by-token** into the preview (SSE for both Gemini + OpenRouter) with a live caret + **Stop** button + `AbortController` cancel-on-leave; the preview is now **platform-accurate** (real Instagram card when IG is selected, LinkedIn card otherwise) with a realistic **"…more" fold** (LI ~210 / IG ~125 chars) and a live char/word counter; the native session `<select>` is replaced by a custom **accessible dropdown** (cover thumbnail + photo-count badge, full keyboard/listbox support).

## Session, 2026-06-05 (merged to `main`)

- **Suggestions → Ideas forum board.** The standalone Suggestions panel is gone; it's now a pinned, score-sorted **Ideas** board inside the Forum (reuses the threads engine, so it has voting + replies). Existing suggestions + votes were migrated into it. The cockpit shows a read-only **top-ideas preview** that links into the Forum.
- **Polls merged into the Forum** as a second pinned card next to Ideas (no longer a top-level tab). Killed the "three places to vote" confusion.
- **Nav cleanup:** 8 tabs → **7**, reordered into clusters, **Home · Forum · Learn · News · Members · Sessions · Tools**. "Cockpit" renamed to **Home**. Old `#polls`/`#cockpit` links redirect.
- **Session editor** (Sessions tab → hover a session → **Edit**): inline rename with a saved animation, **drag-to-reorder photos (first = featured cover, shown larger)**, a "Make featured" shortcut for touch, and **multi-select bulk delete** of photos. Backed by a new `session-meta` store (`{ name, order }` per date). Obsidian stays the source for the rich session content.
- **Photo management:** move photos between sessions (`PATCH /api/photos`, Blob copy+del), create a new session by date (defaults to the next biweekly date), confirmation grid of just-uploaded photos. Lightbox rebuilt: full-screen dim (portaled), fits any aspect on mobile/desktop, swipe + bottom nav.
- **Security hardening (closes the old known gap).** All mutating routes (`photos`, `session-meta`, `threads`, `topics`, `polls`, `upload-image`, `generate-post`) now verify the caller's **Supabase JWT server-side** and are **rate-limited** (Upstash), via `api/_guard.js` wired through the serverless fns + dev middleware + `server.js`. Client attaches the bearer token (`authedFetch`). Reads stay open. Generic 500s (no `e.message` leak). Verified: signed-in writes land, anonymous/bogus → 401.
- **Compliance trio:** `/privacy`, `/terms`, `/accessibility` (hash routes) + a site **footer**. Real sub-processor list, GDPR rights + Datatilsynet, photo-removal note, Denmark governing law, honest accessibility statement. Contact email + effective date are constants at the top of `LegalPages.jsx`.
- **Auth modal** focus-highlight polish.

## Implemented

### Tabs
- **Home** (was Cockpit). Next session card (premium warm gradient, countdown, theme headline, venue map link, add-to-calendar), Schedule ahead, Latest discussion preview, **Top ideas preview** (links into the Forum).
- **Forum (Discussions)**, pinned **Ideas** board (suggest + upvote, score-sorted) and **Polls** card (structured votes), plus member **topics** with one-level replies, up/down votes, and image/GIF uploads. Login-gated. Powered by the shared threads engine.
- **Learn**, tutorial **slide decks** (cover → steps → resources), keyboard nav, copyable code. Content in `data/learn.json`.
- **News**, curated AI roundup, "Read more" cards, category filter.
- **Tools**, free utilities: **Post maker** (session → LinkedIn/IG post via Gemini, **streamed** with a platform-accurate live preview + "…more" fold + accessible session picker), **Token & cost estimator**, **Image to link** (ImgBB), **JSON formatter**.
- **Members**, gallery; photoless members get gender-aware DiceBear avatars.
- **Sessions**, committed + uploaded photos, lightbox, and the **session editor** (rename / featured cover / reorder / bulk delete; move + create-by-date in the uploader).

### Auth (Supabase)
- Google + email/password. **Public read, login required to interact.** Profile editing (name, avatar, bio).
- **Server-side enforced:** mutating API routes verify the Supabase JWT + rate-limit (see hardening above). Degrades to typed-name mode if Supabase isn't configured.

### Cross-cutting
- **Coming list**, who accepted the Google Calendar invite, with avatars, stale-while-revalidate.
- **Image/GIF uploads**. ImgBB proxy (`/api/upload-image`), reused by forum + Tools.
- **UI/UX**, mobile hamburger menu, desktop top menu, warm yellow gradient theme, skeleton loaders, focus rings, footer with the compliance trio, stop-slop copy.
- **Branding**. SVG logo + favicon/PWA icons + manifest, AI-generated hero/OG image.

## Setup on Vercel
Configured: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `BLOB_*`, `IMGBB_API_KEY`, `GCAL_*`, `GEMINI_API_KEY`. (The Supabase + Upstash vars are also read at runtime by the new auth guard, already present, so the gate enforces automatically on deploy.)

Outstanding:
- **Supabase → Authentication → URL Configuration**. Site URL + Redirect URLs must include `https://a-icommunity.vercel.app` (and `http://localhost:5280` for dev), or Google sign-in bounces to localhost.
- **Publish the Google OAuth consent screen to Production**, so it works for everyone and the Calendar token doesn't expire after 7 days.

## Planned / ideas
- **Member Projects directory**, a Supabase `profiles` table so member name/avatar/bio + "what I'm building" show to everyone.
- **Per-user LLM token quota** on `/api/generate-post` (rate-limited already; cap total spend per user before public exposure).
- **Demo sign-up + in-dashboard RSVP** on the Next session card.
- **Shareable session recap pages**, public per-session URLs for LinkedIn.
- **Touch/keyboard photo reorder**, the drag-reorder is pointer-only (noted in the accessibility statement); add a touch-friendly alternative.
- **Live AI news**, **Copenhagen events tab**, **more tools**, **member-submitted tutorials**.

## Notes
- Local API stores (`data/*-store.json`) are gitignored; production uses Upstash.
- **Local dev now connects to the live Upstash + Blob stores** when `.env.local` holds those creds, so local dev is NOT a sandbox (writes/deletes hit production). Vercel marks secrets "Sensitive", so `vercel env pull` returns them empty; copy from the Upstash/Vercel consoles by hand.
- Secrets live only in `.env.local` (gitignored). The anon/publishable Supabase key is safe to expose; never commit the `service_role`/`sb_secret_` key.
