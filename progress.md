# AI Sundays dashboard, progress

A running log of what's built, what needs setup, and what's planned. Live at https://a-icommunity.vercel.app

## 2026-09-01, hero rewritten: headline dropped, stats separated, per-thumb hover

**Current state:** done, audit green (11 suites), not pushed. Three fixes from Auri.

1. **"Build with AI. Show what you learned." is gone.** The positioning line under it is now the
   `<h1>` at hero size: "A Copenhagen community that meets every two weeks to build with AI,
   then shows the work." Still exactly one h1 on the page. **The old headline also lived in
   three metadata slots** and was updated in all of them: `index.html` og:description and
   twitter:description (what LinkedIn and Slack show for a shared link, arguably where the
   headline mattered most) and `public/manifest.webmanifest` description.
2. **Photo strip hover no longer zooms all four at once.** The strip had ONE `group` on the whole
   button, so `group-hover:scale` fired on every thumbnail together. Each thumbnail is now its
   own named group (`group/thumb` + `group-hover/thumb:scale-[1.04]`).
3. **The three stats ran together as one line of numbers**, worse because the first is three
   lines tall and the others are two. They now carry a rule between them via
   `[&>*+*]:border-l` with symmetric padding.

### Gotchas
- **Tailwind v4 sets the standalone `scale` property, NOT `transform`.** Reading
  `getComputedStyle(el).transform` on a `scale-[1.04]` element returns `none` and looks like the
  class is broken. Read `.scale`. This cost several probes.
- **The dev server's Tailwind did NOT pick up the new `group-hover/thumb` utility.** The rule was
  absent from the dev CSS while present in `dist`, so the hover looked broken on 5280 and worked
  in the build. **Restart `npm run dev` after adding a novel arbitrary/named-group utility**, or
  verify against the build.
- Hover state ends the moment a probe does anything else, so sampling a transition after a
  `hover` call usually catches the value on its way back. Prove scoping by which elements have
  the property AT ALL (`none` vs a value), not by catching the peak.

### File pointers
- `src/components/Hero.jsx` · `:91` the h1, `:152` the stat row with the divider utilities,
  `:195` the strip, thumbnails carrying `group/thumb`.
- `index.html:19,26` and `public/manifest.webmanifest:4` · the share/PWA copy, which has to be
  changed with the headline or the old one keeps showing up in link previews.

## 2026-09-01, Home loses Latest discussion and Top ideas

**Current state:** done, audit green (11 suites), not pushed. Auri asked whether the two panels
belonged on the landing page. Measured before touching anything, and they did not.

**The numbers that settled it**
- Latest discussion: **312px to say "No discussions yet."**
- Top ideas: **312px** showing **two** ideas, **both posted by Auri**, one of which reads as a
  scratch note ("notipon has free listening as well, try it maybe with podcasts").
- Together **624px of a 2081px page, 30%**. Page is now **1745px**.

An empty forum panel on a landing page argues the community is dead, which is the exact opposite
of what the rest of that page is now doing. Both live one nav click away under Forum, which is
where a member goes looking for them. The 2026-08-31 declutter audit found the same thing
independently (its next-step 1, "collapse LatestDiscussion when empty, 534px") and it had sat
open since.

**Not deleted:** \`src/components/Suggestions.jsx\` and \`src/components/LatestDiscussion.jsx\` are
now **orphaned, imported by nothing**. Kept deliberately because Auri said "not sure", not
"remove". Delete both if the panels are not coming back.

### Next steps
1. **Decide on the two orphaned components** above. They are dead code until then.
2. Auri still needs to read the hero copy at \`Hero.jsx:102\`, and to sign in once for the
   never-tested successful-write path.
3. 4 open \`/#tools\` findings, and **30 commits unpushed**.

### Gotchas
- **This is the third time a Home panel has been measured rather than argued about**, and each
  time the measurement decided it instantly. \`getBoundingClientRect().height\` on a panel versus
  \`document.body.scrollHeight\` turns "I am not sure this belongs" into "312px to say nothing".
- Removing the last render of a component leaves its FILE orphaned but the build still passes,
  because nothing imports it and nothing errors. \`grep -rn '<ComponentName'\` after any removal.

### File pointers
- \`src/App.jsx\` · the Home grid, now NextSession + ScheduleAhead only, with a comment recording
  the measurements. The two imports are gone, replaced by a note about the orphaned files.
- \`src/components/Discussions.jsx\` · where discussions and ideas actually live, on the Forum tab.

## 2026-09-01, landing page audit vs other communities. 8 of 10 applied

**Current state:** **8 of 10 done** across `3cd3f54` (the four cuts), `f799765` (photos) and
the commit carrying this entry (what/who/free/walk-ins). **9 is half-done and 10 is dropped**,
both on Auri's answers, see below. Audit green, 11 suites. Nothing pushed.

**Auri's answers, which decided the last four:** walk-ins are fine with RSVP preferred;
attending is **free**; **name no organisers**; and there is **no follow channel yet**.

Original audit: Benchmarked `/#home` against **AI Tinkerers Copenhagen**
(literally the same thing in the same city, https://copenhagen.aitinkerers.org/), the global
AI Tinkerers page, and general event-landing guidance. **Everything below was verified on
PRODUCTION**, not dev, because the two things that matter most are DEV-gated differently.

**The pattern behind all ten:** the page is built for AURI, as an operations dashboard, and it
is serving as a FRONT DOOR. Items 1-4 are the dashboard leaking out; 5-10 are the front door
missing.

### The ten

**Cut. ALL FOUR DONE in `3cd3f54`,** verified against the built bundle, not the dev server:
1. **Internal ops notes are public.** `ScheduleAhead` renders "Only one date scheduled. **Add
   more in the calendar so the schedule stays useful.**" (an instruction to Auri) and "Gap on
   record: 22 Feb 2026 to 19 Apr 2026. Protocol paused. Sessions in this window went unlogged."
   Neither is DEV-gated; only the Luma hint is. Reads as "this is neglected".
2. **Test data on the landing page.** Top ideas publishes the raw backlog including an entry by
   **"TEst Powerplant"** and an idea at **-1**.
3. **The next session leads with what is NOT decided:** "Format TBD", "Presenter: Open slot".
   The comparable frames identical uncertainty as "+50 AI builders, slide-free demos".
4. **"11 days 23 hr"** is false precision for a fortnightly meetup.
   *How:* 1 and 2 moved behind the existing `showHints` DEV gate and are now
   **dead-code-eliminated from the production bundle** (checked by grepping `dist/`, the only
   reliable test since `vite preview` cannot render this page). 3 became "Open format" and
   "Open, yours if you want it". 4 drops the hour past two days out; inside 48h it still shows.

**Add**
5. **DONE** (`f799765`). Four session covers, newest first, linking to the archive. Committed
   photos only, since Blob uploads arrive async and would pop in after paint. Two thumbs on a
   phone, four from `sm`. Caption is "Photos from our sessions", deliberately countless: the
   strip shows four and only seven of nine sessions have photos, so any number would be wrong.
6 + 7. **DONE.** One paragraph under the hero subhead: "Two hours on a Sunday. Someone shows
   what they built, or we pick topics on the day and work through them together. Engineers,
   designers, founders and students, anyone building with AI. Free to attend, and you never have
   to present." **Auri should sanity-check this copy**, it is the public description of his
   community and I drafted it from session data plus his answers, not from his words.
8. **DONE.** Under the signed-out RSVP button: "An RSVP helps us plan the room, but you are
   welcome to just turn up." Shown only to signed-out visitors, who are the ones deciding.
9. **HALF DONE.** "Free to attend" is in the hero paragraph. **Organisers deliberately NOT
   named**, Auri chose nobody. No member currently has `Organizer` status in the data anyway.
10. **DROPPED for now.** There is no newsletter, LinkedIn, Slack or Luma link to point at. Needs
    a channel to exist first. Revisit when one does; the `luma` field per session already exists
    and is empty.

### Gotchas
- **`vite preview` (5281) CANNOT test what the public sees on Home.** No API means NextSession
  and ScheduleAhead render empty states, so the ops notes vanish and you conclude they are
  fine. They are not: check **prod**. This is the third time the preview server has produced a
  false read today.
- **A scripted content check produced a false positive and needed verifying.** A regex for
  `/free|dkk|kr/` reported the page states its price. It does not: the only "free" on the
  page is inside a member's idea about a podcast app. Always print the MATCH, not just the
  boolean.
- **The blank hero band in the first screenshot was pre-paint again** (fourth time today). The
  band is a bright brand illustration and renders fine. Zoom or read `naturalWidth` before
  reporting a broken image.

### Next steps
1. **Auri must sanity-check the hero copy.** `Hero.jsx:102` is now the public description of his
   community and I drafted it from session data plus four answers, not from his words. It is the
   sentence a stranger judges the community on.
2. **Item 10 is dropped until a channel exists.** No newsletter, LinkedIn, Slack or Luma to
   point at. The per-session `luma` field already exists and is empty, so that is the hook.
3. **Item 9 is half done on purpose.** "Free to attend" ships; organisers are not named because
   Auri said name nobody. No member has `Organizer` status in the data either, so if that ever
   changes, `MembersGallery` already counts them and the landing page could show them.
4. Everything from the earlier entries still stands, including the 4 open `/#tools` findings,
   the signed-in verification pass, and **28 commits still unpushed**.

### File pointers
- `src/components/Hero.jsx` (lines as of `24d886b`) · `:64` the new `recentPhotos` /
  `onOpenPhotos` props, `:102` the what-and-who paragraph, `:195` the photo strip. `App.jsx`
  computes `recentPhotos` (committed covers only, newest first, four of them).
- `src/components/ScheduleAhead.jsx:70` `showHints` is the DEV gate; `:156-160` the gap note,
  which is OUTSIDE it and therefore public. The "Only one date scheduled" line is likewise
  ungated.
- `src/components/NextSession.jsx:23` the `'tbd'` format label; `:142` the one correctly
  DEV-gated hint, the pattern to copy for items 1.
- `src/components/Suggestions.jsx:22` · the `score > 0` filter that keeps downvoted and test
  rows off the landing page.
- `src/components/Rsvp.jsx:172` · the walk-ins line, rendered only when signed out.
- `src/lib/dates.js:106` · the `days > 2` branch that drops the hour from the countdown.
- `src/App.jsx:344` · the Home-only Hero render, where a photo strip would go.

## 2026-09-01, three removals: archive timeline, attendance counts, Sessions sort

**Current state:** done, committed, audit green (11 suites). From Agentation feedback on
`/#sessions` and `/#members`.

**What was removed**
1. **`ArchiveTimeline`** from the sessions page: the render block AND the component, plus the
   now-dead `monthYear` helper, its orphaned comment, and four unused lucide imports
   (`History`, `ChevronDown`, `ChevronUp`, `CircleSlash`).
2. **The "N sessions" attendance badge** from every member card.
3. **The "Sessions" sort option**, which ranked people by attendance and was the only other
   reader of that number.

`gaps` is still accepted by `SessionsGallery` and still passed by `App.jsx`, deliberately,
renamed to `_gaps` with a comment. The recorded gaps still live in `data/schedule.json`, so a
rhythm view can come back later with no plumbing.

**Two suites asserted the removed behaviour and were rewritten to assert its ABSENCE**, which is
the point: `members` now checks no attendance count is published and that the sort offers
exactly `Featured,Name`; `shell` replaced its three timeline assertions (8.8) with a check that
the tab renders its tiles, titles itself, and leaves **no stray Timeline control behind**.

*Verified in the browser:* members shows `[Featured, Name]`, 0 attendance badges, 23 cards;
sessions shows 0 timeline controls, 9 tiles, h1 "Sessions".

### Gotchas
- **A suite that asserts a feature exists becomes a suite that fails when you delete it.** That
  is correct behaviour, not an obstacle: rewrite it to assert the absence, so nobody reinstates
  the thing by accident. Both rewrites here do that explicitly.
- `theme` failed ONCE inside the audit ("default is system", "system + OS light renders light")
  and then passed 3/3 standalone and green on the next full run. **Suspected flake, not
  investigated.** It has fixed `sleep()` calls at `theme-check.mjs:53,69,87,102,110,119,141,152,161`,
  the same shape that made `lightbox` and `shell` flaky earlier today. If it recurs, convert it
  to `waitFor` like those two.
- Removing a component orphans more than the component: check for now-unused helpers, imports
  and props. `grep -c` each symbol before assuming.

### Next steps
1. `member.attended` is still computed in `scripts/build-data.js` and still shipped in
   `src/data.json`, it is just no longer rendered. Left alone on purpose: it is cheap, and
   deleting it would need a data rebuild plus a members-check change for no visible gain.
   Remove it if the field is ever confusing rather than merely unused.
2. If `theme` flakes again, convert its fixed sleeps to `waitFor` (see the gotcha above).
3. Everything from the earlier entries still stands: the 4 open `/#tools` findings, the
   signed-in verification pass, and **21 commits still unpushed**.

### File pointers
- `src/components/SessionsGallery.jsx:15` · `gaps: _gaps`, the deliberately-unused prop, with
  the comment explaining why it is still accepted.
- `src/components/MembersGallery.jsx:53` · `SORTS`, now two entries. The sort logic below it no
  longer branches on `sortBy`, it is a plain name sort for anything that is not Featured.
- `scripts/members-check.mjs` · the two inverted assertions.
  `scripts/shell-check.mjs` · the replaced 8.8 block, and the header comment at the top of the
  file that records what 8.8 used to cover.
- `data/schedule.json` · still holds the recorded gaps, the only record those weeks happened.

## 2026-09-01, RESOLVED: the Supabase project was PAUSED, not gone. Auri reactivated it

**Current state: FIXED, nothing to change.** Auri reactivated the project and it is the SAME
ref, so **no env var, no Vercel setting and no redeploy was needed**. Supabase free-tier pauses
an idle project and, while paused, its subdomain stops resolving entirely, which is
indistinguishable from a deleted project from the outside. Reactivation restored DNS, both
providers (google: true, email: true) and every account.

Verified after reactivation: DNS resolves (Cloudflare IPs), `/auth/v1/settings` returns 200 with
the anon key, the PAGE can reach Supabase again (the exact call that threw `Failed to fetch`
now answers), and an unauthenticated write returns a clean **401 "Please sign in to do that."**
on both local and prod, meaning `verifyToken` can reach the auth server again.

**It takes a couple of minutes.** Immediately after reactivation `/auth/v1/settings` answered
**502** for about 90 seconds (6 polls) before flipping to 200. Do not conclude it failed.

The original diagnosis, kept because the symptom will recur every time the project idles:

`iogwikfvzxfblwuuvtmq.supabase.co` returned **Non-existent domain**. Confirmed
on the local resolver AND on Cloudflare `1.1.1.1`, so it is not local DNS and not a paused
project. The subdomain does not exist. **Nobody can sign in, on prod or locally**, and because
the server cannot reach it either, `verifyToken` fails and EVERY mutating route 401s. Verified:
`POST https://a-icommunity.vercel.app/api/session-meta` returns 401 right now.

**Prod points at the same dead project.** `VITE_` vars are inlined at build time, so grepping
the deployed bundle proves what Vercel's env holds: same ref. The ref exists ONLY in the
untracked `.env.local` and in Vercel env, nowhere in git, so history cannot date the breakage.

**Effect:** the whole site is read-only. No renames, photo uploads, forum posts, polls, RSVPs
or Post maker. Symptom in the browser is a raw `TypeError: Failed to fetch`, because the host
does not resolve, so there is no status code to report.

**Not caused by today's work.** Writes were already being refused. The sign-in gating in
`8233334` / `8c77b8c` turned a confusing late failure into a visible dead end: every write
control now reads "Sign in to ..." and sign-in itself throws.

### Next steps
0. **Auri can now do the signed-in verification pass** that has been blocked all session: rename
   a session, drag a photo, press Alt+arrow on a focused photo, and run the Post maker once.
   Every REFUSAL path is verified; no SUCCESSFUL write has ever been exercised.

**Steps 1 and 2 below are NO LONGER NEEDED** (kept only in case the project is ever really
deleted). Steps 3 and 4 are still open and still worth doing:
1. **Restore or recreate the Supabase project**, then set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` in `.env.local` AND in Vercel, and redeploy (the URL is baked into
   the client bundle at build time, so an env change alone does nothing until a rebuild).
   `docs/auth-setup.md` has the setup and its steps 1-4 are still correct. **Also required in
   the new project:** Authentication > Providers (enable Email; enable Google and paste a Client
   ID + secret, adding Supabase's callback URL to that Google client), and Authentication >
   URL Configuration (Site URL = the prod origin; Redirect URLs must list the prod origin AND
   **both** `http://localhost:5280` and `http://127.0.0.1:5280`, which are different origins,
   and the app redirects to whichever is in the address bar).
   Creating projects and handling keys is Auri's, not mine.
2. **Or run without auth, deliberately and briefly:** unset the two Supabase vars and set
   `ALLOW_ANONYMOUS_WRITES=true`. That makes every write world-writable. Only with eyes open.
3. **Offered, not yet done:** the sign-in UI surfaces the raw `TypeError: Failed to fetch`. It
   should say sign-in is unavailable instead of leaking a browser internal.
4. **Offered, not yet done:** `docs/auth-setup.md` ends with a "Known limitation (v1)" section
   claiming gating is client-side only and the API trusts a `name` from the body. **That is no
   longer true** and reads as a live security hole to anyone who finds it: `guardMutation` and
   `requireUser` verify the JWT, and `identityFor` derives identity from the verified session.
   Rewrite or delete that section.

### Gotchas
- **A paused Supabase project looks EXACTLY like a deleted one from outside.** The subdomain
  stops resolving, so a public resolver says "Non-existent domain" and `fetch` throws
  `Failed to fetch`. Before concluding a project is gone, check the Supabase dashboard for a
  paused state. Free-tier projects pause when idle, so **this will happen again** to a community
  site with quiet weeks.
- After reactivation the auth endpoint answered **502 for ~90 seconds** before 200. Poll, do not
  conclude failure.
- Reactivation kept the same ref, both providers and all accounts, so nothing below about
  recreating the project applied. The next bullet only matters for a genuine delete.
- **If a project is ever really deleted, every existing account dies with it.** Anyone who had signed in must sign up
  again, and any `user.id` recorded against forum posts, polls, RSVPs or session edits will not
  match the new accounts. Ownership checks key on `user.id` (`api/_identity.js` `ownsRecord`).
- **A dead host throws, it does not return a status.** `fetch()` rejects with
  `TypeError: Failed to fetch`, so every `catch` that assumes an HTTP error sees nothing useful
  and every `if (!res.ok)` never runs. This is the one failure mode `src/lib/api.js`
  `writeJson` handles by returning a sentence instead of throwing.
- **If you just delete the Supabase env vars, writes now fail CLOSED with 503**, not open. That
  is `e8d78c4` (audit item 3) working as designed. Set `ALLOW_ANONYMOUS_WRITES=true` if open is
  actually what you want.
- Check a suspect host on a PUBLIC resolver (`nslookup host 1.1.1.1`) before blaming the app.
  A local-only failure and a deleted project look identical from inside the browser.

### File pointers
- `.env.local` (untracked) and Vercel env · the only two places the project ref lives.
- `src/lib/supabase.js:8` `authEnabled` is `Boolean(url && anon)`, so it is TRUE whenever the
  keys are merely PRESENT, whether or not the project answers. A paused or deleted project
  therefore leaves the app convinced auth is configured, gating every write off with no way in.
- `api/_guard.js` · `verifyToken` returns null when the fetch throws, which is why every route
  answers 401 rather than 503.
- `docs/auth-setup.md` · the project setup steps.

## 2026-09-01, /#tools audit. 10 findings, 6 closed, 4 left

**Current state:** the page is down to **Post maker + Image to link**, and the sign-in story is
fixed. `npm run audit` green, 11 suites. Nothing pushed.

**Closed, 6 of 10**
- **4, 9, 10 and most of 7** by Auri's cut (`b221172`): the token estimator, image compressor
  and JSON formatter are DELETED, components and all. The subtitle went with them, because both
  survivors call auth-gated routes, so "Free, no sign-up" was not merely misleading, it was
  false. Now "Free to use, sign in to run them", under "Tools for the community".
- **5, 6 and the rest of 7** by `8c77b8c`: the action is gated before the work, both error nodes
  announce, and the dropzone is a real button.

**Still open, 4 of 10**
- **1, 2, 3** the spend set, all in the paid path. Do these together.
- **8** no deep links.

Everything in the list below was measured signed OUT against the **dev** server (5280) in Chrome
via the extension, cross-checked against the source, BEFORE any of it was changed.

### The ten as originally found

**Spend and secrets (one commit, all in the paid path)**
1. **No input cap before a paid LLM call.** `api/_postmaker.js:253` is
   `String(body?.notes || '').trim()` with no `.slice()`. `max_tokens: 700` caps the OUTPUT
   only, so one request can carry megabytes into a paid model; the sole ceiling is Vercel's body
   limit. SECURITY.md r4 and r5.
2. **Provider error text forwarded to the browser.** `_postmaker.js:263` returns
   `{ ok:false, error: e.message }` straight from OpenRouter/Gemini; `_imgbb.js:30` does the
   same with ImgBB's message. r20 wants a safe sentence + correlation id, detail to logs.
3. **No spend quota.** Only control on the paid route is `limit: 10` per 60s, so ~600 calls an
   hour per signed-in user. No `quota`/`daily`/`budget` anywhere in `api/`. r5.

**The sign-in story, the same disease the sessions page had**
4. **"Free, no sign-up" is false** (`Tools.jsx:48`). Post maker and Image to link both call
   auth-gated routes and 401 signed out. Three of five ARE free; the copy should say which.
5. **Nothing is gated up front.** Post maker opened fully signed out: pick a session, pick
   LinkedIn or Instagram, press Generate, and only then get refused.
   **DONE.** `canGenerate` / `canUpload` mirror `guardMutation` (`authEnabled ? (!authLoading &&
   Boolean(user)) : true`). The tools still OPEN signed out, deliberately, because the subtitle
   promises "free to use, sign in to run them" and someone should be able to see what a tool
   does before making an account. Only the ACTION is gated: the button reads **"Sign in to
   generate"** / the dropzone reads **"Sign in to upload an image"**, and both call
   `openAuth()`.
6. **DONE.** Both error nodes carry `role="alert"` now. Originally: **the refusal was silent to
   assistive tech.** `PostMaker.jsx:630` is
   `{status === 'error' && <div className="text-sm text-err">{error}</div>}`: a plain div, no
   `role="alert"`, and `main [aria-live]` returns nothing on that page.

**Accessibility**
7. **DONE for the survivor.** The Image-to-link dropzone was a `<div onClick>`: not focusable,
   not keyboard operable, and the only labelling lived on a hidden file input. It is a real
   `<button>` now, carrying the accessible name, and the file input is `tabIndex={-1}`
   `aria-hidden` since it is an implementation detail. Retired for the deleted tools.
   Originally: **four of five form controls have no accessible label**, relying on `placeholder` alone: the
   Image-to-link and Image-compressor file inputs, the Token-estimator and JSON-formatter
   textareas. Only the estimator's price input is labelled. WCAG 3.3.2 / 4.1.2.

**Navigation**
8. **No deep links.** Entering a tool never changes the URL, it stays `#tools`. So no shareable
   link to a tool, a reload drops back to the list, and browser Back leaves the SITE. Verified
   by accident: Back landed on `chrome://newtab`.

**Product calls, not defects**
9. ~~RETIRED, the estimator is deleted.~~ **The estimator priced input only.** Real calls pay for output too, usually 3-5x the input
   rate, so the headline figure can be an order of magnitude low. Wants output tokens + output
   rate, and model presets so nobody looks a rate up.
10. ~~RETIRED, the compressor is deleted so there is no overlap left.~~
    **The two image tools did not explain their difference.** Both compress; the real distinction
    is file back vs URL back and neither card says so. The compressor card's second line,
    "Auto-applied on every upload too", describes a site-wide behaviour, not the tool.

### Gotchas
- **Checked and NOT a finding:** the Post maker streams with a real `AbortController` and a Stop
  button (`PostMaker.jsx:361-408, 616`), so DESIGN.md r4 is satisfied. Both image tools validate
  `file.type` client-side and `_imgbb.js` caps the payload at 4.4MB base64. The tools list page
  has a clean heading order and zero targets under 24x24. Do not re-report these.
- **Also checked and NOT a finding:** the `postmaker.session` sessionStorage handoff from the
  recap looks like it would strand you inside Post maker forever, but `PostMaker.jsx:371`
  removes the key on mount. One-shot, works as intended.

### File pointers
- `src/components/Tools.jsx` (line numbers as of `b221172`) · `:14` the `TOOLS` array, now two
  entries, with a comment recording what was removed and why. `:21` the `active` state: a
  sub-tool renders IN PLACE OF the list and never touches the URL, which is the whole of finding
  8. `:46/:50` the heading and subtitle, both rewritten because each remaining tool needs auth.
- `api/_postmaker.js` · `:251` `handleGeneratePost`, `:263` the leaked message, `:151/196`
  `max_tokens`. `api/generate-post.js` · guarded, `limit: 10`.
- `api/_imgbb.js:8` `handleImageUpload`, size cap at `:15`, leaked message at `:30`.
- The auth gates (line numbers as of `8c77b8c`): `PostMaker.jsx:361` `canGenerate`,
  `ImageToLink.jsx:22` `canUpload`. Both are the same expression as `SessionsGallery.jsx`
  `canEdit`; **three copies now, worth extracting to a `useCanWrite()` hook** the next time a
  fourth appears.
- `src/lib/api.js` `writeJson` from the sessions pass is still NOT used here: PostMaker reads an
  SSE stream so it cannot use it as-is, and ImageToLink parses its own JSON. Worth revisiting if
  item 2 changes those error shapes.

## 2026-09-01, session #9 published: Session after Summer Break

**Current state:** session 2026-08-30 has a title, 3 topics and 4 photos. Audit green
(11 suites). **Not pushed.**

**A bug shipped into that first commit and is now fixed.** Auri saw the entire `<!-- INCOMPLETE
... -->` block rendered as visible text on the recap page. Adding a Topics section ABOVE the
comment folded the whole comment into the last topic's body, because every section parser in
build-data just takes the text between two headings and nothing stripped comments. `build-data`
now strips `<!-- ... -->` before any parsing, and **fails the build** if a comment reaches the
output anyway. Verified by removing the strip: the build refuses with
"an HTML comment leaked into the output".

**What was done**
- 4 photos from Auri's phone into `public/sessions/2026-08-30/` as `01-04.jpg`, ordered so the
  sharp wide room shot is `01` and therefore the cover. `npm run optimize:images` took them
  from 4.9MB to 0.8MB in place.
- `content/sessions/#09 SESSION 2026-08-30.md` gained a Title field and a Topics section:
  agentic workflows, Telegram for daily updates, a Slack bot for tags and tasks.
- `npm run build:data` picked all of it up: title, 4 photos, 3 topics.

### Gotchas
- **A markdown comment is not safe scratch space in a file a parser reads.** It is invisible in
  Obsidian, which is exactly why it feels safe, and it was published on a live page. Anything a
  section parser can see between two headings can reach the site.
- **`build:data` refuses photos that are not git-tracked** and prints the exact `git add` lines
  to run. It is not an error, it is the guard against `src/data.json` referencing files that
  never got committed. Run `git add public/sessions/<date>/` then rebuild.
- The Title field parser is not line-anchored, so it used to match a field name written inside a
  comment, and a session once ended up titled with a sentence from its own instructions. Now
  moot, comments are stripped first, but the parser is still not line-anchored.
- Location for #9 is still `TBD` on purpose. The note's comment says it was probably Matrikel1
  but was left unassumed, and an invented value becomes the permanent public record.
- The topics were written from ONLY what Auri said. The note file warns against inventing
  content; three short entries beat three padded ones.

### Next steps
1. Location for #9 if Auri remembers it, plus an About This Session paragraph, Demos and Tools,
   all of which the note supports and all of which are currently absent.
2. **New finding, not yet logged as its own item:** on the recap page the topic names are NOT
   headings (`main h2, main h3` returns empty), so the same problem the 2026-09-01 heading pass
   fixed elsewhere still exists there.

### File pointers
- `content/sessions/#09 SESSION 2026-08-30.md` · the note. Its own HTML comment documents every
  section the format supports and what is deliberately missing.
- `scripts/build-data.js` · `parseSessionFile` strips `<!-- ... -->` on the FIRST line that
  reads the file, before any parser sees it. Near `writeFileSync`, the output is checked for
  `<!--` and the build exits 1 if one got through. Also `listSessionPhotosForDate` and the
  git-tracked guard that refuses uncommitted photos.
- `scripts/optimize-images.mjs` · in-place, idempotent, manifest-driven. Safe to re-run; it
  skips files whose size already matches `scripts/.image-opt-manifest.json`.

## 2026-09-01, /#sessions audit. All 10 applied

**Current state:** **all 10 done.** Seven commits, `a072830` through the one carrying this
entry. **NOTHING PUSHED YET.** `npm run audit` green (11 suites) after every one. `a072830` item 2, `8233334` item 1, `e8d78c4` item 3, `8e001d8` pointers, items
4-6 committed alongside this entry. **Nothing pushed yet.** `npm run audit` is **11 suites**
and green.
Everything below was found before any of it changed, measured signed OUT against the **dev**
server (5280) at 1280 wide, in Chrome via the extension, cross-checked against the source. Auri asked
for ten improvements across UX, security and convenience, prompted by "you can edit pictures
even though you are not logged in".

**The headline, and it is not what it looks like:** server-side auth is CORRECT.
`POST /api/session-meta` with no token returns **401 on both dev and prod** (verified with an
empty body, which cannot mutate anything). The archive is not writable by strangers. Everything
below is the UI around that gate.

### The ten, all applied

**Auth pass (do together)**
1. **Every write control is shown to signed-out visitors.** The per-card Edit button appears on
   hover and opens the FULL Edit Session modal: editable name, save, drag-to-reorder, Select
   all, star-to-feature, delete. "Add photos" is not disabled either (`disabled:false`, no
   `aria-disabled`). Nothing on screen says you are signed out. Gate the affordance, do not
   only reject at the API.
   **DONE.** `canEdit` in SessionsGallery mirrors `guardMutation` exactly:
   `authEnabled ? (!authLoading && Boolean(user)) : true`. Without Supabase the server allows
   the write, so the UI must too; while auth resolves it stays false, or every visitor gets a
   flash of Edit buttons that then vanish. The per-card Edit button is **absent, not disabled**
   (`onEdit` is null, the button does not render), because the server refuses that write anyway.
   "Add photos" stays visible but becomes **"Sign in to add photos"** and calls `openAuth()`:
   contributing photos is the point of the page, so a visitor should still see the invitation.
   *Verified signed out:* 0 Edit buttons, the label reads "Sign in to add photos", clicking it
   opens the real auth modal. *Verified the render path is intact* by forcing `canEdit = true`
   on the dev server: 9 Edit buttons, label back to "Add photos", editor opens. Probe reverted.
2. **Writes are optimistic and swallow the rejection. This is the real bug and it hits
   signed-IN users too.** `saveMeta` (SessionsGallery.jsx:48) applies the rename to local state
   BEFORE the request, then `catch { /* optimistic state already applied */ }`. But
   `authedFetch` (lib/supabase.js:36) just returns `fetch(...)`, and fetch does NOT throw on
   401, so that catch is **dead code** and nothing checks `res.ok`. Any failed save looks like a
   success and reverts on reload. `deletePhotos:98` has the same shape. Fix: check `res.ok`,
   roll back, surface the error.
   **DONE, uncommitted.** New `src/lib/api.js` exports `writeJson()`, which inspects the
   response instead of ignoring it: a non-OK status, or a 200 carrying `{ok:false}`, both come
   back as `{ok:false, status, error}` with the server's own sentence. `saveMeta` snapshots
   **just that date** before the optimistic update and restores it on refusal (per-date, so a
   rollback cannot clobber an unrelated edit that landed in between). `deletePhotos` returns the
   first refusal; `loadUploads()` was already the rollback. `saveName` / `moveTo` /
   `deleteSelected` await the result, and `flashSaved()` fires only on a real success. A
   `role="alert"` banner in the modal carries the message.
   *Verified signed out:* renaming to "HACKED BY ANON" now shows "Please sign in to do that.",
   the Saved flash stays at opacity 0, and the field reverts. Before, the rename appeared to
   stick and flashed Saved.
   *Not verified:* the signed-IN success path, no way to log in as Auri. The branch is
   `if (r && r.ok === false) error else flashSaved()`, so an undefined return still flashes
   success, which is the safe default. **Auri should click one rename while signed in.**
3. **`guardMutation` fails OPEN** (api/_guard.js:84). `if (authConfigured())` wraps the whole
   auth check, so a missing `VITE_SUPABASE_URL`/anon key makes every mutating route accept
   anonymous writes. Latent today (both envs configured), one missing env var from live.
   SECURITY.md says fail CLOSED if env unset.
   **DONE.** Typed-name mode is a real supported deployment, so it must be CHOSEN, not inherited
   from a missing env var. `guardMutation` and `requireUser` now refuse with **503** when auth
   is unconfigured, unless `ALLOW_ANONYMOUS_WRITES` is exactly the string `"true"` (a strict
   compare, so `1` or `yes` do not count). Documented in `.env.local.example`. With Supabase
   configured nothing changes: an anonymous write is still 401 on dev and prod, re-verified.
   New `scripts/guard-check.mjs` (`npm run guard:check`, wired into the audit as suite 11)
   covers all four env shapes. **Confirmed the test has teeth** by reverting the fix: it fails
   with "got null (allowed!)" on exactly the two cases that matter.

**Modal pass (shared fix)**
4. Edit Session and PhotoUploader are `div.modal-overlay` with **no `role="dialog"`, no
   `aria-modal`, no accessible name**; the page has zero `[role=dialog]`. AuthControls, Learn,
   PostMaker and SessionRecap all do it right, so this is inconsistency, not ignorance.
5. **Escape does not close** Edit Session or PhotoUploader. Verified in-browser. The same four
   components above all bind Escape.
6. **No focus management.** After opening, `document.activeElement` is still the trigger behind
   the overlay, the background keeps 85 focusable elements, no trap, no restore on close.

   **4, 5 and 6 DONE as one fix.** New `src/lib/useDialog.js` does all three: Escape (capture
   phase, so the dialog sees it first), focus moved in on open, Tab trapped and wrapping both
   directions, focus restored to the trigger on close. Applied to the Edit Session panel and
   PhotoUploader, which also gained `role="dialog" aria-modal="true" aria-labelledby` and a
   real `<h2>` title (was a div).
   **The one trap in the hook:** `onClose` is almost always an inline arrow, so a new identity
   every render. It is held in a ref and the effect runs ONCE on mount; making the effect depend
   on `onClose` re-runs setup on every parent render and yanks focus back to the first control
   while you are typing.
   *Verified on both dialogs:* role/aria-modal correct, accessible name resolves ("Edit
   session", "Add photos"), focus lands inside, Tab wraps at both ends, Escape closes, focus
   returns to the trigger.

**Keyboard and target size**
7. Photo reorder / set-cover is HTML5 drag-and-drop only, **no keyboard path at all**.
   WCAG 2.1.1.
   **DONE.** Each photo tile is now `tabIndex={0}` with an aria-label saying its position and
   the keys. Bare left/right arrows move focus between tiles (clamped at both ends, they do not
   wrap); **Alt** with left/right moves the photo; **Alt+Home** makes it the cover. An sr-only
   `aria-live` region announces the new position, and only on a real success.
   *Verified:* focus walks 0 to 1 to 2 and back, clamps at both ends; a refused move shows the
   error and makes NO announcement. A SUCCESSFUL move still needs a signed-in click, same gap
   as item 2.
8. "Open recap" measures **53x16 CSS px**, under the 24x24 minimum of WCAG 2.2 section 2.5.8.
   **DONE.** `-my-1 py-1 min-h-6` grows the hit area to 53x24 without opening a gap in the row:
   the padding is cancelled by the negative margin. The select circle went 20x20 to 24x24 too.
   *Verified:* **0 controls under 24x24 on the page, was 20.**
9. The in-modal select circle and star are `sm:opacity-0 sm:group-hover/photo:opacity-100` with
   **no `focus-visible:` variant**, so keyboard users land on invisible controls.
   **DONE.** Both carry `focus-visible:opacity-100` now, copying the card Edit button.
   *Verified in the DOM on both.*

**UX**
10. **Mobile gets the worst of both.** Photos were `grayscale` with colour only on
    `group-hover`, and touch has no hover, so on a phone the whole archive was permanently black
    and white.
    **DONE, Auri picked option 2: colour everywhere.** The filter classes are gone; the tile
    still lifts on hover (`group-hover:-translate-y-1` on the wrapper) so hover feedback
    survives without the desaturation. It suits the cream ground far better.
    *Deliberately NOT changed:* Edit staying `opacity-100` below `sm`. On touch there is no
    hover, so a control that only appears on hover would be unreachable. Item 1 already removed
    it for signed-out visitors, which was the actual complaint.

### Next steps
1. **Push.** Seven commits sit local: `a072830`, `8233334`, `e8d78c4`, `8e001d8`, `c47ec2c`,
   `5298edd`, `ad5971a`. `main` auto-deploys to prod, so this ships the auth fixes.
2. **One signed-in pass, the gap I could not close.** Every REFUSAL path is verified; no
   SUCCESSFUL write was ever exercised, because there is no way to log in as Auri from here.
   Worth one minute: rename a session, drag a photo, and press Alt with an arrow on a focused
   photo. If `saveMeta` returns something unexpected the branch is
   `if (r && r.ok === false) error else flashSaved()`, so a wrong shape shows a false success.
3. **Four components still bind Escape by hand with no focus trap:** AuthControls, Learn,
   PostMaker, SessionRecap. Move them onto `src/lib/useDialog.js`. Mechanical, and it deletes
   code.
4. **Other components still call `authedFetch` raw** and swallow failures the way SessionsGallery
   did before item 2. `grep -rn authedFetch src/` to find them; route each through
   `writeJson`. PhotoUploader's delete and move paths are the ones users touch most.
5. The 2026-08-31 declutter audit is still entirely unstarted, including its own next-step 6
   which wants several `h-section` eyebrows deleted.

### Gotchas
- **`requestAnimationFrame` never fires in a hidden tab.** The first keyboard-reorder build used
  rAF to move focus after the re-render and it silently did nothing under the browser extension,
  which drives a background tab. Focus after a state change belongs in a `useEffect` keyed on
  the new data, never in rAF. Same family as the `:focus-visible` and programmatic-`.click()`
  artifacts below: **three separate times a browser probe reported a bug that was really the
  probe.** Check `document.hidden` and how you dispatched the event before believing a failure.
- A programmatic `.click()` does NOT move focus, so a focus-restore test opened with `.click()`
  will always report failure. Use `el.focus()` then `el.click()`.
- **Two suites were flaky and it was not my code.** Adding an 11th suite raised the load enough
  to expose fixed-sleep races: `lightbox` lost about 1 run in 3 on "no photo thumbnails found"
  (SessionRecap:160 hides thumbnails behind `!loaded`, which waits on two fetches, while the
  suite slept a flat 2600ms), and `shell` failed on "no timeline toggle" the same way. Both now
  poll with a `waitFor(expr, {timeout})` helper instead of sleeping. Verified 5 clean lightbox
  runs, 3 clean shell runs, 2 clean full audits. **If you add a suite and something unrelated
  starts failing, look for `await sleep(` before you look at your own change.**
- **Do not trust a programmatic `.focus()` to test focus styles.** Chrome does not set
  `:focus-visible` for scripted focus, so an element with `focus-visible:opacity-100` reads as
  `opacity: 0` and looks like a bug. It cost one wrong finding here; check the class list before
  reporting a focus defect.
- Probe writes with a body that CANNOT mutate (`{}` with no date). A 401 vs a 400 then tells you
  whether auth or validation answered first, without touching prod data.
- The first screenshot after navigate can be pre-paint: covers looked like blank beige tiles
  while `naturalWidth` was already 1200. Wait, or read `complete`/`naturalWidth` instead.

### File pointers
- `src/components/SessionsGallery.jsx` · the whole page. Line numbers as of `e8d78c4`:
  `:20` `canEdit` (the gate, mirrors guardMutation), `:59` saveMeta, `:122` deletePhotos,
  `:382` the card Edit button (the correct `focus-visible:` pattern to copy for item 9),
  `:543-556` the edit modal grid and the drag handlers (item 7).
- `api/_guard.js` · `:21` `anonWritesAllowed`, `:90` `requireUser`, `:101` `guardMutation`.
  `api/session-meta.js` · a guarded route to copy. `.env.local.example` · what
  `ALLOW_ANONYMOUS_WRITES` means and why it should stay unset.
- `scripts/guard-check.mjs` · `npm run guard:check`, suite 11. Add a case here for any new
  auth branch. `scripts/audit.mjs:28` · the suite list.
- The `waitFor(expr, {timeout})` helper now lives in BOTH `scripts/lightbox-check.mjs` and
  `scripts/shell-check.mjs` (duplicated, not shared, because each suite is standalone). Use it
  instead of `await sleep()` for anything that renders behind a fetch.
- `src/lib/supabase.js:36` `authedFetch`, the reason every `catch` around a write was dead code.
- `src/lib/api.js` · `writeJson`, the fix. **Any new write goes through it**, never through
  `authedFetch` directly. Other components still call `authedFetch` raw and have the same
  swallowed-failure shape: `grep -rn authedFetch src/` to find them.
- `src/lib/useDialog.js` · Escape + focus move + focus trap + focus restore, one hook. **Every
  new modal uses it.** AuthControls, Learn, PostMaker and SessionRecap still bind Escape by hand
  and have no trap; moving them onto the hook is the obvious follow-up, not yet done.

## 2026-09-01, heading structure app-wide, three /#assets fixes, photos API made loud

**Current state:** **Shipped and live.** `npm run audit` PASS, all 10 suites. `npx vite build`
clean. Committed as `6e53940` and pushed straight to `main` (`ad6deab..6e53940`, 21 files) on
Auri's explicit go-ahead, so WORKFLOW.md r1 was waived for this one push, not in general.
Vercel auto-deployed: prod bundle went `index-E3eB-_MW.js` to `index-TP5RpiSL.js`. The heading
probe was re-run against https://a-icommunity.vercel.app and all 8 tabs report exactly one h1
with the same computed sizes as local. `probe.html` and `probe.jsx` are still untracked and were
deliberately kept out of the commit (`git add -u`).

Three commits followed on the same day, all pushed to `main` and all live:
`3f96827` recorded the deploy here, `11f46ae` recorded the preview/photos gotcha, and
`3ba0550` fixed it in code (prod bundle `index-TP5RpiSL.js` to `index-CiT62q-H.js`, verified on
prod: 21 and 5 photos, no warning). The leftover preview server on 5281 was killed; `npm run
audit` starts a new one every run.

**What was just done**

1. **Removed the Sunrise icon, badge card** (`/brand/icon-badge.svg`) from `MARKS` in
   BrandAssets.jsx. `MARKS` is now 3, which fills the `lg:grid-cols-3` row exactly. The svg stays
   in `/public/brand/`, only the listing is gone, and it is recorded in the "deliberately NOT
   offered" comment at the top of the file. `scripts/shell-check.mjs` hardcoded
   `assets.links === 14`; it is now 13 with the arithmetic written next to it.
2. **"Four rules" now reads `{RULES.length} rules`.** The heading counted by hand.
3. **Icons on the four asset sections** that had none: Wordmark `Signature`, Marks and icons
   `Shapes`, Raster and social `Image`, Imagery `Wallpaper`. All four verified present in the
   installed lucide-react before use.
4. **Heading structure, the real fix.** Hero holds the only `<h1>` and renders on Home ONLY
   (App.jsx:338 explains why the masthead was dropped from the other tabs), so every other tab
   had no h1, and Members / Sessions / News had **no heading of any level**: their visible title
   was `<div className="mt-2 text-3xl font-semibold tracking-tight">`. Fixed:
   - page titles to `<h1>`: MembersGallery, News, SessionsGallery (were divs); Discussions,
     Learn, Tools, PostMaker, TokenEstimator, ImageCompressor, ImageToLink, JsonFormatter
     (were h2 with nothing above them).
   - card titles to `<h2>`: Learn, Tools and News cards were `<h3>`, which skipped a level once
     the page title became h1.
   - Home cards to `<h2>`: NextSession (both branches), ScheduleAhead (both branches),
     LatestDiscussion, Suggestions.
   - BrandAssets `Section` to `<h2>`; SessionThread to `{bare ? 'h3' : 'h2'}`; Rsvp "Coming"
     to `<h3>`.

5. **The photos API now fails loudly** (`3ba0550`). Auri reported 2026-05-31 and 2026-06-14
   "suddenly" having no pictures. Nothing had broken: those two are the only sessions whose
   photos live entirely in Vercel Blob, and he was on the preview server, where `/api/photos`
   answers **200 with index.html**. `r.json()` threw and **five** components each swallowed it
   into an empty object. New `src/lib/photos.js` is the single reader: it checks the
   content-type, separates `no-api` / `http` / `bad-json`, and throws a typed
   `PhotosUnavailable` whose message names the cause. SessionsGallery renders a warn notice
   instead of a short gallery. PhotoUploader now treats a failed probe as not-configured, so the
   uploader is disabled where uploading cannot work rather than accepting files that go nowhere.

**Evidence:** `scratchpad/heading-outline.mjs` (throwaway CDP probe, same harness shape as
shell-check) walks all 8 tabs and dumps every heading with its computed font-size and margin.
After: **every tab has exactly one h1, no level skips**, and every size/margin is identical to
before, because Tailwind v4 preflight resets heading font-size, weight and margin.

### Ranked next steps
1. **The #discussions outline is still inverted:** `H2 What we'll talk about` renders BEFORE
   `H1 Community forum`, because App.jsx:376-383 puts TopicsForTheDay in the first grid column.
   Left alone on purpose. The fixes all cost something: reordering the DOM puts the forum above
   the topics on mobile, and CSS `order` splits visual from DOM order, which trades one a11y
   problem for WCAG 1.3.2. **Needs an Auri call on the mobile order.**
2. Eyebrows above a real heading were left as `<div>` deliberately, they are decoration, not
   structure. The 2026-08-31 audit wants several of them **deleted** (next step 6 there), which
   is still open and would remove the question entirely.
3. Labels left as `<div className="h-section">` on purpose, they title nothing:
   Learn:148/168 ("Step 3 of 6", "Keep going"), ThemeToggle:83 ("Theme", a menu group, wants
   `aria-labelledby` not a heading), PhotoUploader:258, Polls:502 ("New poll"), PostMaker:643
   ("Preview"), SessionsGallery:220/438/472, TopicsPresentation:71/84/116.

### Gotchas
- **A heading count in a test will break when the page changes.** shell-check asserted 14
  downloads. Any assertion of the form `x.length === N` over page content is a landmine.
- Agentation annotation paths have no nth-child, so `.mt-10 > .mt-3 > .card` **cannot** tell you
  which instance of a mapped component was clicked. Ask, do not guess.
- Tailwind v4 preflight is what makes div→h1/h2 free. If preflight is ever disabled, every one
  of these swaps becomes a visible size change.
- `npm run audit` starts its own dev server on 5280 and fails to bind if one is already running
  from `npm run dev`; it still passes because it reuses the live one, but the log line
  "dev up at" then refers to the server you started. **It also leaves a preview server on 5281
  behind**, which is the trap in the next bullet.
- **On preview, exactly the 2026-05-31 and 2026-06-14 sessions lose every photo, and it looks
  like data loss.** They are the only two whose photos live entirely in Vercel Blob as runtime
  uploads; every other session has committed files in `public/sessions/<date>/`. `vite preview`
  serves `dist/` with no functions, so `/api/photos` returns **200 with index.html**,
  `r.json()` throws, and `SessionsGallery.jsx:24` catches it and falls back to `setUploads({})`
  with no signal. Diagnosed 2026-09-01 from exactly this symptom. The tell that it is the API
  and not the data: 2026-05-03 drops from 12 photos to 11, because it has 11 committed plus one
  Blob upload. Verified prod is fine (both covers load at naturalWidth 1200, counts 21 and 5).
  **Use 5280.** **Fixed the same day:** `src/lib/photos.js` is now the single reader for the
  endpoint. It checks the content-type, throws a typed `PhotosUnavailable` instead of a bare
  SyntaxError, and SessionsGallery renders a warn notice naming the cause rather than showing a
  silently short gallery. All five callers go through it.

### File pointers
- `src/App.jsx:338` · why the masthead is Home-only, the reason the other tabs had no h1.
  `:357-389` · the tab render tree, and the Discussions two-column grid from step 1.
- `src/components/BrandAssets.jsx` · `/#assets`. `Section` (now h2), `LOCKUPS`/`MARKS`→`AssetCard`,
  `RASTER`/`IMAGERY`→`AssetRow`, `PALETTE`→`Swatch`, `RULES`.
- `src/index.css:332` · `.h-section`, class-only styling. `:624` · the `h1,h2,h3,.h-section`
  rule is inside the print block and affects none of this.
- `src/lib/photos.js` · the ONLY place that should read `/api/photos`. Five components call it.
  If you add a sixth reader, use `fetchPhotos` (you want to show the failure) or
  `fetchPhotosByDate` (you do not), never a bare `fetch`.
- `src/components/SessionsGallery.jsx` · merges committed photos with Blob uploads by date, and
  renders the `uploadsError` notice. `api/_photos.js` · the Blob side.
- `scripts/audit.mjs` · runs all 10 suites and picks the right target per suite.
- `scratchpad/heading-outline.mjs`, `scratchpad/photos-probe.mjs` · the two probes. Not
  committed, recreate them if headings or the gallery change.

## 2026-08-31, declutter audit. Findings only, NOTHING applied

**Current state:** `main` at `ed30ca8`, clean. No code changed by this audit. Measured against
the **dev** server with live Google Calendar, Upstash and Blob data, at 1280x900 and 390x844.

Full report, published as an Artifact:
https://claude.ai/code/artifact/b660706e-d476-4a33-8ec1-3d0fd2e4a74f
(the earlier before/after of the plan items is
https://claude.ai/code/artifact/18bb6053-8687-4827-9d75-484e71a30223)

### Measure against dev, never preview
`vite preview` serves `dist/` with **no serverless functions**, so `/api/*` 404s and Home renders
every panel as an empty state: "None", "No upcoming session scheduled", "No dates on the
calendar yet". Any judgement about density made on port 5281 is a judgement about the empty
state. The audit suites are right to use preview; a human looking at the page is not.

### The two findings that matter
1. **41% of desktop Home is an empty panel plus a duplicate panel**, 730px of 1763px.
   `LatestDiscussion` costs **534px** to say "No discussions yet", because the two-column row
   stretches it to match Top ideas, so an empty state is the tallest block on the page.
   `ScheduleAhead` costs another **196px** (245px mobile) to restate the session spelled out
   directly above it, under a warning that only one date is scheduled. It earns its place at two
   or more future dates and not before.
2. **The next session is stated three times, in three disagreeing formats:** `12 days 17 hr`
   (hero), `in 13 days` (card pill), `Sun 13 Sept` (schedule row). Counted from
   `main.innerText`: the date 3x, "in 13 days" 2x, the venue address 2x, "Copenhagen" 2x,
   "12:30" 2x, and the Top ideas author 4x. Identical at both widths, so it is the content, not
   a responsive artifact.

### Constants masquerading as information
- **`1 min` on all twelve news cards.** `readingMinutes` runs at 200wpm over cards that are all
  well under 200 words, so it can only ever print 1 min. Verified across all 12 items.
- **`6 slides` on all four Learn decks.**
- **`2 sources` printed beside the two source names.**
- **The `#N` badge on news covers is `item.n`, an id, not a rank.** Cards render newest first, so
  it reads #3, #6, #7, #1, #2 down the page. Worse than no number.

### Biggest single redundancy, needs an Auri decision
**Six of twelve news covers have the title and subtitle burned into the image**, and the same
title and subtitle are set as text directly beneath (the `*-card.png` files). Keep the text (it
is selectable, searchable and legible on a phone) and let covers be pictures, or regenerate the
covers without type. Not a code fix, a generation decision.

### Ranked next steps, none started
1. Collapse `LatestDiscussion` when empty, or let the two-column row become one. **534px.**
2. Render `ScheduleAhead` only when it holds a date the Next session card does not. **196px**,
   and it takes the duplicated venue address with it.
3. Strip the news meta row to sources and date: drop `1 min`, the source tally, the `#N` badge.
4. The burned-in headline decision above.
5. One sign-in prompt per tab. The Forum renders **three** `SignInGate`s plus the header button.
6. Line deletions: the eyebrows that restate the nav (ARCHIVE/Sessions, COMMUNITY/Members,
   LEARN/Build with AI, DISCUSSIONS/Community forum), `9 sessions.` under the Photos title (the
   timeline row says it with the span), `12 stories · 2 themes`, the `Format TBD` pill (the Lean
   Coffee note already says the format is open), the Top ideas author column, and ideas at a
   negative score on the landing page.
7. Restyle the generated avatars. Seven bright DiceBear faces outshout sixteen real portraits.

### Do NOT cut these, they only look redundant
"Sessions are recorded" (the one notice with a legal job, make it quieter but keep it before the
session), the hero countdown (the only statement of the date that answers "is it soon"), the news
GLOBAL/EUROPE theme summaries (the only editorial judgement on the page), `1 session` under a
member name (what the Sessions sort runs on), and the date + photo-count pills on session tiles.

### File pointers
`src/components/LatestDiscussion.jsx`, `src/components/ScheduleAhead.jsx`,
`src/components/NextSession.jsx`, `src/components/Hero.jsx`, `src/components/News.jsx`
(`readingMinutes` at the top, the meta row around line 279), `src/components/Suggestions.jsx`
(Top ideas), `src/components/Learn.jsx`, `src/components/MembersGallery.jsx` (the DiceBear
avatar), `src/App.jsx:373` (the Home two-column row).

## 2026-08-31, Download assets footer page

**Current state:** SHIPPED. `main` at `e58981f`, pushed, and Vercel deployed it on the push
(the Hobby push-deploy block did not bite this time, no `npx vercel --prod` needed). `npm run
audit` green on all 10 suites (shell is now 23 assertions). Live at `#assets`, linked first in
the footer. Verified on production: the bundle carries `is-scrolled`, "Download assets" and the
new member names, and `/brand/icon-badge.svg` returns 200.

Auri asked for a footer page where the logos, icons and colours can be downloaded.
`src/components/BrandAssets.jsx`, lazy-loaded, 14 files plus the locked palette.

### What it lists
Everything is served from `/public`, so a download is a plain same-origin `<a download>`:
no endpoint, nothing to rate-limit, nothing to authenticate.

- **Wordmark**, standard and inverted (`brand/logo.svg`, `brand/logo-dark.svg`).
- **Marks**, the app tile (`favicon.svg`), the inverted tile, and two sunrise icon variants
  (full colour, badge).
- **Raster and social**, `brand/og.png` plus the four PWA and favicon PNGs.
- **Imagery**, `hero-light.webp`, `hero-dark.webp`, `pattern.webp`.
- **Colours**, the eight locked values read off the `:root` block in `index.css`, each swatch
  copying its own hex on click, each carrying its measured contrast. The three that are not
  text colours (yellow 1.57, amber 2.23, lime) say so in `--warn`.
- **Type**, Geist and Geist Mono, with a note to install from npm rather than lifting the
  woff2 files out of this repo.
- **Four rules**, including the one this project has now relearned twice: in the inverted
  lockup the sun sits outside the blob, so it must contrast with the PAGE, not the blob.

Three files exist in the repo and are deliberately NOT offered: `brand/icon-mono.svg` (drawn
in `currentColor`, so an `<img>` preview renders it flat black and reads as broken, Auri cut it
on sight), `brand/hero.png` (3.4MB original) and `brand/hero.webp` (superseded by the two
themed bands). Every path on the page was verified to return 200.

### Routing
`FOOTER_KEYS` is new in `LegalPages.jsx` (`[...LEGAL_KEYS, 'assets']`). The assets page routes
like a legal page and renders as its own component, because `LegalPage` stamps an
"Effective <date>" line and a contact block on everything it renders: right for a policy,
wrong for a download page. `App.jsx` branches on `isAssets` before `isLegal`, and the document
title and the `aria-live` region both name it.

### Two things worth keeping
1. A `<button>` used as a grid item does NOT stretch to the row height the way a div does. The
   swatches with less text centred themselves and the colour bands stopped lining up across the
   row. `h-full flex flex-col` on the button fixes it.
2. Every swatch band carries a `border-b`. Without it, cream on a white card in light mode (and
   deep green on a dark card) has no edge at all and reads as empty space.

### Coverage
`shell-check` grew from 15 to 23 assertions: the footer link routes to `#assets`, the page
titles itself, all 14 downloads exist and are same-origin with sane filenames, every download
control has an accessible name, no preview image is broken, eight copyable swatches render, and
Back returns Home. `assets` was also added to the `smoke` route crawl, since fourteen `<img>`
previews are fourteen chances at a console error nobody would notice by eye.

### What went out, five commits
`aec4d9e` members · `81545da` the four plan items plus 8.5 · `d74e378` this page ·
`6e061a0` the shell suite and the audit stale-build fix · `e58981f` the plan re-triage and the
news-image optimization. Branch `feat/plan-remaining` was fast-forwarded into `main` and deleted.

**Auri cut `brand/icon-mono.svg` from the page on sight**, and he was right: it is drawn in
`currentColor`, so an `<img>` preview renders it flat black and reads as broken. The file stays
in the repo with a comment in `BrandAssets.jsx` saying it is deliberately not offered, so nobody
re-adds it thinking it was an oversight. The badge variant stayed.

### Numbered next steps
1. **`data/schedule.json` dates.** Still the only thing blocking plan items 4.5 and 4.7, which
   are built and verified and rendering nothing. Data task, zero code.
2. **Seven members still have no photo or LinkedIn:** Cristina Bodnari, Inigo Casillas, Kernius
   Savickas, Kristina Juozapaviciute, Tady Kapic, Valentin, Vasare Liutkeviciute. They render a
   generated avatar, which works; this is only a list if photos are being collected anyway.
3. **`probe.html` and `probe.jsx`** are still untracked in the working tree, from before these
   sessions. Delete or commit them.
4. If a zip of every asset is ever wanted, that is a build step in `scripts/`, not a runtime
   route. It does not exist and the page does not claim it does.

### File pointers
`src/components/BrandAssets.jsx`, `src/components/LegalPages.jsx` (`FOOTER_KEYS`, the footer
links), `src/App.jsx` (`isAssets`), `scripts/shell-check.mjs`, `scripts/smoke.mjs:17`,
`public/brand/`.

## 2026-08-31, the last four open plan items closed

**Current state:** SHIPPED in `main` at `e58981f`. `npm run audit` green on **all 10 suites**
(a tenth was added). `docs/improvement-plan.md` now reads **83 done, 5 partial, 0 open, 12
moot**.

The four items were 1.3, 1.10, 8.6 and 8.8, plus partial 8.5.

- **1.3 header shadow on scroll.** `src/App.jsx` holds a `scrolled` flag from a passive,
  rAF-throttled listener and the header takes `.is-scrolled`; `.app-header` in
  `src/index.css` carries the shadow. Two details worth keeping: the listener reads once on
  mount, because a reload can restore a scrolled position before any event fires, and the
  shadow is mixed from `--foreground` rather than neutral black, which on the cream ground
  reads as grime.
- **1.10 print stylesheet.** `@media print` at the end of `src/index.css`. Drops the header,
  anything tagged `data-print="hide"` (mobile menu, Add photos, per-tile Edit, the recap's
  copy-link and post buttons) and the dark halo; flattens to white on black; resets
  `position` globally, since a sticky header reprints on every page; stops cards and
  sessions splitting across pages; prints the URL after off-site links.
- **8.5 keyboard hints.** Pointer-only (`hidden sm:inline-flex`): a phone has no keys and
  the hint would be a lie. It is two chevron glyphs, which a screen reader renders as "to
  move Esc to close" and never names a key, so the visual hint is `aria-hidden` and an
  `sr-only` line spells the keys out.
- **8.6 lightbox thumbnail strip.** In `SessionRecap.jsx`. The active thumb is ringed and
  scrolls itself into view (`block: 'nearest'`, or the whole overlay is dragged around).
- **8.8 archive timeline.** `ArchiveTimeline` in `SessionsGallery.jsx`, fed by a new `gaps`
  prop from `App.jsx` (`data.schedule.gaps`). Sessions and gaps interleave on one rail by
  date, oldest first, each gap a dashed segment. Collapsed by default so the photo grid
  stays above the fold.
- **8.3** was widened to preload both neighbours, not just the next photo, now that the
  strip pages backwards as often as forwards.

### Two traps hit while building the strip
1. The overlay sets `touch-action: pan-y` so a horizontal swipe pages the photo. That also
   made the strip unscrollable on touch. It takes `pan-x` back and stops its own touch
   events from reaching the swipe handler, or dragging the strip would flip the photo.
2. Twelve focusable thumbnails would flood the tab order. It is a roving tabindex, one tab
   stop, and the arrow keys were already bound.

### `npm run audit` was grading a stale build. Fixed
`scripts/audit.mjs` built `dist/` **only when `dist/index.html` was missing**, so every
later run graded whatever was last built. That is how the earlier members change reported
"21 cards, data says 23": a stale dist, reading exactly like a filtering bug. It now always
rebuilds. The build costs seconds; a false green costs an hour.

### New suite, and the lightbox suite grew
- `scripts/shell-check.mjs` (`npm run shell:check`), 15 assertions: the header shadow
  appearing and disappearing, the print rules under `Emulation.setEmulatedMedia` (nothing
  sticky, white ground, header gone), and the timeline (collapsed by default, the span and
  gap-count summary, ten rows, the gap window, oldest-first, a row opening its recap).
  Registered in `audit.mjs` between history and lightbox.
- `scripts/lightbox-check.mjs` gained 8 assertions for the strip and the hint, now 21.
- Harness note: reading `aria-expanded` in the same tick as the `click()` reported a
  component bug that did not exist. React had not re-rendered. Assert after a sleep.

### Numbered next steps
1. Commit. Two clean commits: the three new members (previous entry) and these plan items.
2. Refresh `data/schedule.json` to the current dates. Partials **4.5** and **4.7** are built
   and verified and render nothing because the static file lists 2026-05-03 to 2026-07-12
   while Google Calendar returns 2026-09-06 to 2026-12-13. Data task, zero code.
3. The other three partials stay partial on purpose, reasons written at the bottom of
   `docs/improvement-plan.md`: **6.7** LQIP (a new build artifact for an invisible
   difference), **10.2** and **10.8** (both only touch the parked `server.js`).
4. Untracked `probe.html` and `probe.jsx` still sit in the tree, from before these sessions.

### File pointers
`src/App.jsx` (scroll flag, `gaps` prop), `src/index.css` (`.app-header`, `@media print`,
both at the end), `src/components/SessionRecap.jsx` (`PhotoLightbox`),
`src/components/SessionsGallery.jsx` (`ArchiveTimeline`), `scripts/shell-check.mjs`,
`scripts/lightbox-check.mjs`, `scripts/audit.mjs:26` (the suite registry),
`docs/improvement-plan.md`.

## 2026-08-31, three new members: Roman Novosad, Marlu Adamczyk, Prachi Abhyankar

**Current state:** SHIPPED in `main` at `e58981f`. The site reads **23 members** (was 21), 16
of them with photos. `members-check` passes 13/13. Aiza Watzlawek's photo and LinkedIn landed
in the same commit, later the same day; her `gender` hint is gone, since nothing reads it once
a real photo exists.

Auri supplied a LinkedIn URL and a `.jfif` photo for each of the three.

- `content/members.md`, added `Marlu Adamczyk | Active | Marlu` and
  `Prachi Abhyankar | Active | Prachi`, and promoted the first-name-only `Roman` row to
  **Roman Novosad**. The "add a surname when known" line about Roman is gone from Known gaps.
- `data/members-profile.json`, three entries with `linkedin` + `photo`, placed above
  `Maria Krupa` so they take the default `order` of 50.
- `public/members/{roman,marlu,prachi}.jpg`, the Desktop `.jfif` files. All three were
  already 400x400 JPEG, identical to every existing member photo, so a rename was enough.
  `npm run optimize:images` then took them to 15KB / 9KB / 17KB.

Roman still counts 1 session attended with **no alias**: `attendanceCounts` in
`scripts/build-data.js` keys on the tokens of the canonical name, so `Roman` in the #09
notes resolves to `Roman Novosad` on its own. Marlu and Prachi read 0, correct, neither
appears in any session note yet.

### Gotcha: `npm run members:check` alone tests a STALE build
It defaults to `http://127.0.0.1:5281`, a `vite preview` of `dist/`, and does NOT rebuild.
A preview left running from an earlier session reported `21 cards, data says 23`, which
reads exactly like a real filtering bug and is not one. Either run `npm run audit`, which
rebuilds `dist/` first, or pass the dev URL: `node scripts/members-check.mjs http://127.0.0.1:5280`.
The same trap applies to every `*-check` suite marked `needs: 'preview'` in `scripts/audit.mjs`.

### Noise in the diff, not from this task
`npm run optimize:images` also compressed **22 `public/news-images` files** that had been
committed unoptimized, saving 1.3MB. Idempotent, and a Vercel build would have done it
anyway, but they show up as modified alongside the member changes.

### Numbered next steps
1. Commit this. The member change and the news-image recompression are separable if you
   want two commits.
2. Refresh `data/schedule.json`, it still lists 2026-05-03 to 2026-07-12 while Google
   Calendar returns 2026-09-06 to 2026-12-13. The two sources never overlap, so plan items
   **4.5** (venue-status colours) and **4.7** (dev maintainer hints) are built, verified and
   rendering nothing. Data task, zero code.
3. The four open plan items are unchanged: **8.6** lightbox thumbnail strip, **8.8** gaps
   timeline, **1.3** header shadow on scroll, **1.10** print stylesheet.
4. Untracked `probe.html` and `probe.jsx` predate this session and are still sitting in the
   working tree. Delete or commit them.

### File pointers
`content/members.md`, `data/members-profile.json`, `public/members/`,
`scripts/build-data.js:213` (`attendanceCounts`), `src/lib/members-profile.js`,
`src/components/MembersGallery.jsx`, `scripts/audit.mjs:30` (which suite needs which server).

## SHIPPED 2026-08-31, `41a87dc`, the dark-mode logo sun

**Current state:** `main` at `41a87dc`, clean and pushed. `npm run audit` green on all
nine suites.

Auri reported the dark header as "too dark, the logo with green sun is invisible". The
header ground was fine. The sun was the whole problem.

### The rule this breaks
In the inverted lockup the sun sits **outside** the blob, so it has to contrast with the
**page**, not with the blob. It was drawn in `cls-2` (green `#124A30`) on the `#103A26`
header: two shades of the same green, so the corner rendered as a bare wordmark with a
missing dot. One character changed in `public/brand/logo-dark.svg`, the sun path
`M1000.13,160.6...` moved from `cls-2` to `cls-1` (amber `#F8B800`).

**This is the second time.** The identical flaw was found and fixed on the OG image
earlier the same day and not carried across to the header. Any future edit to one lockup
should be checked against the other: `public/brand/logo.svg` (sun already `cls-1`, correct
on cream) and `public/brand/logo-dark.svg`.

`npm run gen:icons` regenerates `brand/og.png` from the light lockup, so the OG image is
untouched by this and stayed out of the diff.

### Numbered next steps
Unchanged from the section below. In short: the archive gap (item 1 there) is the only one
that needs Auri; **8.6** lightbox thumbnail strip, **8.8** gaps timeline, **1.3** header
shadow on scroll and **1.10** print stylesheet are the four open plan items.

### File pointers
`public/brand/logo-dark.svg`, `public/brand/logo.svg`, `scripts/gen-icons.mjs`,
`src/App.jsx:249` (the sticky header).

## SHIPPED 2026-08-31, session #09 recorded

**Current state:** `main` at `d5cb4ca`. `npm run audit` green on all nine suites.
The site now reads **9 sessions held, 21 members** (was 8 and 20).

### #09 is deliberately INCOMPLETE
`content/sessions/#09 SESSION 2026-08-30.md` records **only the attendee list**: Auri,
Ignas, Sany, Andrei, Aiza, Roman. That is all that was reported. Title, topics, demos,
tools and the summary are absent on purpose, not forgotten: an invented demo becomes the
permanent record of a real session and the recap page publishes it.

The note carries a comment listing every section, what each renders and the exact format
the parser wants, so completing it is mechanical. Attendance counts already moved: Auri and
Ignas to 7, Sany 6, Aiza 3, Andrei 2, Roman 1.

**Roman is new** and is listed under his first name only, like Valentin and Dovile. Add a
surname to `content/members.md` when known.

### Trap: the Title parser is NOT line-anchored
`get('Title')` in `scripts/build-data.js` searches the whole file for
`**Title:**` anywhere, including inside an HTML comment. The first draft of #09 mentioned
the field name in its own instructions and the session came out **titled with a sentence
from those instructions**. The other section parsers (`## About This Session`, `## Topics`,
`## Demos`, `## Tools`, `## Action Items`) are all `^`-anchored, so mentioning those
indented inside a comment is safe.

Also: leave the Title field OUT rather than setting it to "TBD". The value renders AS the
session name; with the field absent the UI falls back to "Session #9".

### Pattern worth watching: hardcoded counts in the browser suites
`members-check` asserted `=== 20` members and went red the moment Roman was added. That is
the third instance today, after the organiser-badge count and the news reading-time regex.
**A browser check should read its expectation from `src/data.json`, not a literal.** Both
member assertions do now.

### Numbered next steps
1. **The archive gap is only partly closed.** #08 was 2026-06-14 and #09 is 2026-08-30, so
   at a biweekly cadence roughly four sessions between them are still unrecorded. Each
   needs a note like #09. Only Auri knows whether they happened or the cadence lapsed; if
   it lapsed, that is a `gaps` entry in `data/schedule.json` instead, which Schedule ahead
   already renders.
2. **8.6** thumbnail strip in the lightbox.
3. **8.8** timeline showing the recorded gaps in the archive view.
4. **1.3** header shadow only once scrolled; there is still no scroll listener anywhere.
5. **1.10** print stylesheet.
6. Standing, not on the plan: `.warm-card` carries a gradient on 8 surfaces against
   palette.md's "scoped, not global" rule, and `public/brand/hero.png` (3.4MB) is orphaned
   but still reprocessed on every build.

### Waiting on Auri
1. Fill in #09's title, topics, demos and summary, or say there is nothing to add.
2. Whether sessions happened between 2026-06-14 and 2026-08-30.
3. Only one session is in the dedicated calendar (2026-09-13).
4. `Mari`, `Yogi`, `Frederik`: members or guests? Roman's surname.

### File pointers
`content/sessions/#09 SESSION 2026-08-30.md`, `content/members.md`,
`scripts/build-data.js` (`parseSessionFile`, `attendanceCounts`),
`scripts/members-check.mjs`.

## SHIPPED 2026-08-31, Area 3 Next session complete

**Current state:** `main` at `641f53a`. `npm run audit` green on all nine suites. Plan
**78 done, 6 partial, 4 open, 12 moot**. Every area is now complete or near it.

While updating the tally I corrected two headers that overstated: Area 4 said "10 done"
with 4.5 and 4.7 marked partial in its own item list, and Area 6 said "10 done" with 6.7
partial. They read 8+2 and 9+1 now. If you count the `- [x]` marks with a script you get 91,
not 100: Area 9's ten moot items are collapsed onto a single line.

### The venue map link was DEAD on production, not just sparse
Recorded because the plan described this as "only matrikel1 is mapped", which is not what
was wrong. `venueMapUrl` did an EXACT match on the lowercased name. `data/schedule.json`
says `"Matrikel1"` and Google Calendar returns
`"Matrikel1, Højbro Pl. 10, 1200 København, Denmark"`, so the live value matched nothing and
the venue rendered as plain text on the site while looking perfectly correct in the static
data anyone would test against.

Curated pins are substring-matched now, and any unrecognised value falls back to a Maps
search, so **a new venue no longer needs a code change**. `TBD`, `In-person`,
`In-person + Online` are recognised as statuses rather than places and get no link, because
sending someone to Maps for "TBD" is worse than plain text.

### Two controls disagreed about the same date
`relative()` returned "in 2 wk" at 12 days out while the hero counted "12 days 21 hr" beside
it. Days now run to a fortnight before switching to weeks. Note the two still differ by one:
`daysBetween` counts calendar days (13 sleeps) and the countdown counts elapsed hours
(12d19h). That is defensible, and far better than 2 vs 12.

### 3.9 could not be done literally, and was adapted
The item asks for a Lean Coffee flag "when fewer than two demos". **Nothing records demo
signups for a future session**: `data/backlog.json` is empty and an upcoming entry carries
at most one `presenter`. There is no count to compare against. The flag fires on an
undecided format with nobody presenting, which is the condition the planning note in
schedule.json describes anyway. A literal count needs a signup mechanism that does not exist.

### The .ics, and why it is written the way it is
`src/lib/ics.js` builds the file as a `data:` URL, so no endpoint and no round trip. Times
are UTC with a `Z` rather than a floating local time, which would shift the session by an
hour for anyone outside Copenhagen; a correct `VTIMEZONE` block is a lot of hand-rolled
lines for one recurring event. Values are escaped because a raw comma, semicolon or newline
in a session note would otherwise truncate the file at that point.

### Numbered next steps, four items left
1. **8.6** thumbnail strip in the lightbox.
2. **8.8** timeline showing the recorded gaps (the data is rendered in Schedule ahead
   already, so this is the archive view of the same thing).
3. **1.3** header shadow only once scrolled. There is no scroll listener anywhere yet.
4. **1.10** print stylesheet.

Then the standing items that are not on the plan: `.warm-card` still carries a gradient on
8 surfaces against palette.md's "scoped, not global" rule, and `public/brand/hero.png`
(3.4MB) is orphaned but still reprocessed on every build.

### Waiting on Auri
1. **The 2026-08-30 session has no note**, so the site still says "8 sessions held" when it
   is nearer 13. This is the most visible remaining problem and no code fixes it: past
   sessions come from `content/sessions/*.md`, written by hand.
2. Only one session is in the dedicated calendar (2026-09-13).
3. `Mari`, `Yogi`, `Frederik`: members or guests?

### File pointers
`src/lib/venues.js`, `src/lib/ics.js`, `src/lib/dates.js` (`relative`),
`src/components/NextSession.jsx`, `docs/improvement-plan.md`.

## SHIPPED 2026-08-31, Area 10 Platform, and the CSP is now ENFORCED

**Current state:** `main` at `e6f544c`. Plan **75 done, 9 partial, 4 open, 12 moot**.
Areas 1, 2, 4, 5, 6, 7, 8 and 10 are effectively complete; 9 is deleted.

**`npm run audit` is the one command now.** It runs all nine suites, starts what each
needs, and points each at the right target. It reports SKIP separately from PASS and exits
2, because a suite that could not run must never read as green.

### READ THIS FIRST if the live site breaks
**The Content-Security-Policy is enforced as of `e6f544c`.** It was
`Content-Security-Policy-Report-Only` with no `report-uri` for months, which means it
neither blocked anything nor reported anything. If something stops loading on production
and it worked yesterday, suspect the CSP before anything else, and check the browser
console for a violation naming the blocked origin.

**Adding any new external origin now requires editing `img-src` / `connect-src` in
`vercel.json`.** The trap found while flipping it: `img-src` did not list `i.ibb.co`, where
every image uploaded through the ImgBB proxy is served from, so enforcing it as written
would have blanked every Forum image. Found by grepping `data/threads-store.json` for
hosts, not by reading the policy, which looks complete.

**`npm run csp:check` is the only way to test it.** Neither `vite dev` nor `vite preview`
applies `vercel.json`, so the shipping headers are never exercised by the normal servers.
The check serves `dist/` with the real headers and walks ten routes.

### A check that passed while proving nothing
The first version of `csp-check` attached the `securitypolicyviolation` listener AFTER
navigating and then reloaded, which wipes the listener along with the document. It reported
a clean pass while `api.dicebear.com` was deliberately removed from the policy. Now
installed with `Page.addScriptToEvaluateOnNewDocument`, and re-verified by removing
dicebear again: it names all eight blocked avatars.

Worth generalising: **a browser check that has never been seen to fail is not evidence.**
The same mistake produced a passing `polls:check` against an empty page earlier today.

### Also in
- `robots.txt` and `sitemap.xml`. The sitemap holds ONE url deliberately: every view is a
  hash route and a fragment is not a separate URL to a crawler. If the app ever moves to
  real paths, generate the file from the route table.
- A single offline notice below the header. Each tab's fetch had its own failure copy, so
  losing the network produced a scatter of unrelated messages that never named the cause.
- Auri's Organizer status removed at his request, so no card carries a badge. The Status
  column stays in `content/members.md`. `members-check` now derives the expected badge
  count from `src/data.json` rather than asserting one.

### Deliberately NOT claimed
10.2 response compression and 10.8 structured logging both only affect `server.js`, which
is a parked runtime: `.github/workflows/deploy.yml` has its push trigger commented out and
Vercel is production, compressing at the edge. Marking them done would be false.

### Numbered next steps
1. **Area 3 Next session** (5/10), the largest remaining: `.ics` download beside the Google
   Calendar link, Lean Coffee auto-flag when fewer than two demos, `lib/venues.js` maps
   only `matrikel1` so every other venue renders as plain text, a prompt when no Luma link
   is set, and the roles in the data that are still unrendered.
2. **Area 8's last two**: a thumbnail strip in the lightbox, and a timeline showing the
   recorded gaps.
3. **Area 1's last two**: header shadow only once scrolled, and a print stylesheet.
4. `.warm-card` still carries a gradient on 8 surfaces, against palette.md's "scoped, not
   global" rule.
5. `public/brand/hero.png` (3.4MB) is orphaned and still reprocessed on every build.

### Waiting on Auri
1. **Only one session is in the dedicated calendar** (2026-09-13).
2. **The 2026-08-30 session has no note**, so the site still says "8 sessions held" when it
   is nearer 13. Past sessions come from `content/sessions/*.md`, written by hand.
3. `Mari`, `Yogi`, `Frederik`: members or guests? One row each in `content/members.md`.

### File pointers
`vercel.json` (the policy), `scripts/csp-check.mjs`, `scripts/audit.mjs`,
`public/robots.txt`, `public/sitemap.xml`, `src/App.jsx` (`OfflineNotice`),
`docs/improvement-plan.md`.

## SHIPPED 2026-08-31, Area 6 News complete

**Current state:** `main` at `ca08f3c`. **Eight** suites, all green: `smoke`,
`theme:check` (34), `identity:check` (21), `lightbox:check` (13), `history:check` (11),
`polls:check` (14), `members:check` (13), `news:check` (15). Plan **71 done, 11 partial,
6 open, 12 moot**. Areas 1, 2, 4, 5, 6, 7 and 8 are effectively complete; 9 is deleted.

### gen-news-placeholders.mjs was macOS-only and failed SILENTLY
The worst thing found this round. It wrote its temp HTML to a hardcoded `/tmp` and passed
Chrome the string `file://` + a Windows path, which is not a resolvable URL. Chrome rendered
its own ERR_FILE_NOT_FOUND page to PNG and **exited 0**, so the script reported a tick for
every card. The 12 "generated" cards were all 11.5KB error pages.

Fixed with `os.tmpdir()`, `pathToFileURL()` and a per-platform Chrome default. Real cards
are 121 to 126KB, so the size alone tells you whether a run worked.

**`--force` regenerates ALL twelve and overwrites the six real source photos** (CNBC,
Anthropic, University of Copenhagen, Danish AI Safety Conference, EU-Startups, Under30CEO)
with typographic cards. It happened twice today. Run it WITHOUT `--force` unless you mean
that; the restore is a manual merge against `git show HEAD:data/news.json`.

### Freshness is real data now, not derived
`data/news.json` has `curatedAt: "2026-08-29"`, the date of the commit that actually moved
the window (`14db26d`). Deriving it from git reports unrelated commits: the most recent
change to that file was an em-dash cleanup. The newest story date is also not the same
thing as when the list was reviewed. `draft-news.mjs` now emits `curatedAt` so promoting a
draft carries it forward.

### Gotcha: JSX drops whitespace between elements
`{n} min <span>·</span> {m} sources` rendered as `1 min·2 sources`. Needs explicit `{' '}`.
`news:check` caught it. The same check also showed that a backslash inside a template
literal is an escape, so a regex written as `/\d+/` inside `evalJs(\`...\`)` arrives as
`/d+/` and silently matches nothing. Prefer plain string assertions in those checks.

### Numbered next steps
1. **Area 10 Platform** (4/10): robots.txt and sitemap.xml, a repeatable audit script,
   network-failure states. **The CSP is still `Report-Only` with no `report-uri`** so it
   neither blocks nor reports; flipping it ships straight to prod and wants sign-off.
2. **Area 3 Next session** (5/10): `.ics` download, Lean Coffee auto-flag, `lib/venues.js`
   maps only `matrikel1` so every other venue renders as plain text, Luma prompt, the
   unrendered roles.
3. **Area 8's last two**: thumbnail strip in the lightbox, timeline with the recorded gaps.
4. Area 1's last two: header shadow on scroll, print stylesheet.
5. `.warm-card` still carries a gradient on 8 surfaces, against palette.md's "scoped, not
   global" rule.
6. `public/brand/hero.png` (3.4MB) is orphaned and still reprocessed every build.
7. The `ca08f3c` commit message lost the phrase `file://<windows path>` to a shell backtick;
   the full explanation is in this entry instead. Not worth force-pushing over.

### Waiting on Auri
1. **Only one session is in the dedicated calendar** (2026-09-13).
2. **Yesterday's session (2026-08-30) has no note**, so the site still says "8 sessions
   held" when it is nearer 13. Past sessions come from `content/sessions/*.md`.
3. `Mari`, `Yogi`, `Frederik`: members or guests? One row each in `content/members.md`.

### File pointers
`src/components/News.jsx`, `data/news.json` (`curatedAt`), `scripts/news-check.mjs`,
`scripts/gen-news-placeholders.mjs` (the portability fix), `scripts/draft-news.mjs`.

## SHIPPED 2026-08-31, Area 7 Members complete

**Current state:** `main` at `50fa800`. **Seven** suites, all green: `smoke`,
`theme:check` (34), `identity:check` (21), `lightbox:check` (13), `history:check` (11),
`polls:check` (14) and `members:check` (13). Plan **64 done, 15 partial, 9 open, 12 moot**.
Areas 1, 2, 4, 5, 7 and 8 are effectively complete; 9 is deleted.

### content/members.md is the source of truth now
**To add or remove a member, edit that file.** Columns are Name | Status | Aliases, then
`npm run build:data` (which `npm run dev` runs anyway). It replaces the `| Name | Status |`
table in Auri's Obsidian vault, which only existed on one laptop, so nobody else could add
a person and Vercel builds fell back to a committed snapshot. `scripts/build-data.js`
prefers the file and keeps `parseHub()` as a fallback for an older checkout.

- **Name must match the key in `data/members-profile.json`** or that person gets a
  generated avatar instead of their photo.
- **Aliases exist for attendance matching.** Session notes record first names, so a member
  whose notes name differs from their row reads zero sessions without one. `Auri` is why
  the organiser's own count is 6 and not 0.
- **No email column, deliberately.** The repo is public and nothing rendered needs one.

### Three data faults the move fixed, none of them on the plan
1. `Unknown #1` and `Unknown #2` were headcount placeholders from the vault table. They
   rendered as two blank cards AND counted toward "20 people".
2. Andrei Prusu, Pavel Kucera and Ernestas Sazinas had full profiles with photos but no
   member row, so they never appeared at all.
3. The roster is now 20 real people; the tab previously claimed 20 while drawing 18 plus
   two blanks.

### Still an open gap
`Mari`, `Yogi` and `Frederik` appear in session attendance and match nobody. 31 of 34
entries resolve; those three are treated as guests and counted nowhere. **Only Auri knows
whether they are members recorded under another name.** Recorded under "Known gaps" in
`content/members.md`; adding each is one row. Do not guess a full name into a public repo.

### Numbered next steps
1. **Area 6 News** (3/10): text search, sticky filter bar, blur-up placeholders, source
   count and reading time, arrow-key filter chips, a real last-updated line.
2. **Area 10 Platform** (4/10): robots.txt and sitemap.xml, a repeatable audit script,
   network-failure states. **The CSP is still `Report-Only` with no `report-uri`**, so it
   neither blocks nor reports; flipping it ships straight to prod and wants sign-off.
3. **Area 3 Next session** (5/10): `.ics` download, Lean Coffee auto-flag, `lib/venues.js`
   maps only `matrikel1` so every other venue renders as plain text, Luma prompt, the
   unrendered roles.
4. Area 1's last two: header shadow on scroll, print stylesheet.
5. `.warm-card` still carries a gradient on 8 surfaces, against palette.md's "scoped, not
   global" rule.
6. `public/brand/hero.png` (3.4MB) is orphaned and still reprocessed every build.

### Waiting on Auri
1. **Only one session is in the dedicated calendar** (2026-09-13), so the schedule shows a
   single date and the low-runway warning fires. `GCAL_CALENDAR_ID` is set in `.env.local`
   AND Vercel, and prod is confirmed reading it.
2. **Yesterday's session (2026-08-30) has no note.** The archive stops at `#08` on
   2026-06-14, so the site says "8 sessions held" when it is nearer 13. Past sessions come
   from `content/sessions/*.md`, written by hand; no calendar change fixes this.
3. The three unmatched attendance names above.

### File pointers
`content/members.md` (the roster), `scripts/build-data.js` (`parseMembersFile`,
`attendanceCounts`), `src/components/MembersGallery.jsx`, `data/members-profile.json`
(photos, LinkedIn, displayName, gender), `scripts/members-check.mjs`,
`docs/improvement-plan.md`.

## SHIPPED 2026-08-31, Area 5 Polls complete

**Current state:** `main` at `6ecaf2d`, pushed and deployed. **Six** suites, all green:
`smoke`, `theme:check` (34), `identity:check` (21), `lightbox:check` (13),
`history:check` (11) and the new `polls:check` (14). Plan now **59 done, 15 partial,
14 open, 12 moot**; Areas 2, 4, 5 and 8 are effectively finished and 9 is deleted.

All ten Area 5 items are in `6ecaf2d`: optimistic vote with rollback, sort toggle, a real
radio group (roving tabindex, arrows that move AND select, Home/End), a polite live region,
labelled fields, inline create-modal validation, server-side duplicate-option rejection,
and a per-poll share link on a new `#poll/<id>` route.

### Two traps worth not relearning
1. **A hash change does not remount a component.** The share-link highlight depended on
   `[polls]` alone, so going from `#discussions` to `#poll/<id>` fired nothing and a visitor
   already on the Forum saw no highlight at all. It listens to `hashchange` too now. Any
   future hash route inside a mounted tab has the same trap.
2. **`vite preview` has no API layer**, so `/api/polls` 404s, the list renders empty, and a
   browser check happily passes against a blank page. `polls:check` therefore targets the
   DEV server (5280), unlike `smoke`, `history:check` and `theme:check` which want preview
   (5281). It also waits for a poll card rather than sleeping, because the Forum is a lazy
   chunk plus an Upstash round trip and a flat 3s was sometimes short.

Also: `load()` refetches every 5s, so anything keyed off the hash needs a "handled" ref or
it repeats forever. Without one the shared poll flashed again every five seconds.

### Numbered next steps
1. **Area 7 Members** (5/10) is the most visible remaining, but stays BLOCKED on full names
   for `Mari`, `Yogi`, `Frederik`. Do not guess names into a public repo. The rest of it
   (search, role badges, a real sort control instead of the random shuffle on mount, the
   `Unknown #1/#2` removal, the three invisible members) can proceed without them.
2. **Area 6 News** (3/10): search, sticky filters, blur-up, source count and reading time,
   arrow-key chips, last-updated.
3. **Area 10 Platform** (4/10), and the **CSP is still `Report-Only` with no `report-uri`**,
   so it neither blocks nor reports. Flipping it ships straight to prod.
4. **Area 3 Next session** (5/10): `.ics` download, Lean Coffee auto-flag, `lib/venues.js`
   maps only `matrikel1`, Luma prompt, the unrendered roles.
5. Area 1's last two: header shadow on scroll, print stylesheet.
6. `.warm-card` still carries a gradient on 8 surfaces, against palette.md's "scoped, not
   global" rule.

### Waiting on Auri
1. **The remaining sessions are not in the dedicated calendar.** It holds one event,
   2026-09-13, so the schedule shows a single date and the low-runway warning fires.
   `GCAL_CALENDAR_ID` IS now set in both `.env.local` and Vercel, and prod is confirmed
   reading it.
2. **Yesterday's session (2026-08-30) has no note**, so the archive stops at `#08` on
   2026-06-14 and the site claims "8 sessions held" when it is nearer 13.

### File pointers
`src/components/Polls.jsx`, `api/_polls-core.js` (duplicate detection in the create action),
`src/App.jsx` (`readTabFromHash` routes `#poll/`), `scripts/polls-check.mjs`,
`docs/improvement-plan.md` (per-item status).

## SHIPPED 2026-08-31, mono-font rule and the Back button

**Current state:** `main` at `382ca84`, pushed and deployed. Five test suites now, all
green: `smoke`, `theme:check` (34), `identity:check` (21), `lightbox:check` (13) and the new
`history:check` (11).

### The mono rule, which is a CONVENTION to follow, not just a past change
Two faces ship: Geist and Geist Mono. `.num` applies the mono one, and it had spread to 46
places, many of them prose. `relative()` rendered "in 2 wk" in monospace, and so did
"3 slides", "12 stories", "5 voters", `timeAgo()` output, dates, `#8` id badges, count
pills and avatar initials. Auri read it as the app having a stray font, which is fair.

**Use `.num` only for:** code, filenames, JSON, values that tick while you watch them, and
digits that line up in a column. 26 usages reverted to sans in `ac7cb8f`; **20 keep it**:
the hero countdown and stat numerals (the numerals-first row from item 2.4), the JSON tool's
input and output, code blocks, the slide and lightbox counters, live upload status, the
character counter, vote scores in fixed-width chips, poll counts that align across options,
and filenames in `TopicFiles` / `TopicsPresentation`.

Gotcha: `tabular-nums` contains the substring `num`. Match `num` as a whole class token or
you will strip it.

### Back and Forward, item 1.9, the most reachable bug in the app
Every tab change wrote the hash with `history.replaceState`, so **no history entry was ever
created** and Back walked straight out of the site. On a seven-tab app that is worse than
most of the polish items on the plan.

Only the FIRST hash sync replaces now (writing `#home` on load should not add an entry the
user never asked for); every later change pushes. A change that came FROM the browser has
already updated the hash by the time the effect runs, so `current === tab` and nothing is
written. **That guard is what stops a pushState loop, do not remove it.** `popstate` is now
listened to alongside `hashchange`, because `pushState` does not fire `hashchange`.

`npm run history:check` drives real `Page.navigateToHistoryEntry` calls rather than
synthetic `popstate` events, so it fails if the entries are not genuinely there. Verified
against the old code: 4 failures including "two tab clicks added two history entries:
2 -> 2" and Back landing outside the app with no active tab.

### Numbered next steps
1. **Area 5, Polls** (2/10), the weakest area and needs no decisions: optimistic vote with
   rollback, sort toggle, arrow-key radio group, `aria-live` results, duplicate-option
   detection (needs a small server change), per-poll share links.
2. **Area 7, Members** stays BLOCKED on full names for `Mari`, `Yogi`, `Frederik`. Do not
   guess names into a public repo.
3. Area 6 News (3/10), Area 3 Next session (5/10), Area 1's remaining two (header shadow on
   scroll, print stylesheet).
4. The CSP is still `Report-Only` with no `report-uri`, so it neither blocks nor reports.
5. `.warm-card` still carries a gradient on 8 surfaces, against palette.md's "scoped, not
   global" rule.
6. `public/brand/hero.png` (3.4MB) is orphaned and still reprocessed every build.

### Waiting on Auri, cannot be done from here
1. **`GCAL_CALENDAR_ID` in Vercel**, or production keeps reading his `primary` calendar.
   Value is in `.env.local`.
2. **The remaining sessions are not in the dedicated calendar** (it holds one event,
   2026-09-13), so the schedule shows a single date.
3. **Yesterday's session (2026-08-30) has no note**, so the archive stops at `#08` on
   2026-06-14 and the site claims "8 sessions held" when it is nearer 13.

### File pointers
`src/index.css` (`.num` at the bottom of the components layer), `src/App.jsx` (the hash
effect and the popstate listener), `scripts/history-check.mjs`,
`docs/improvement-plan.md` (per-item status for all 100).

## IN PROGRESS 2026-08-31, migrating to a dedicated Google Calendar

**Current state:** switched and working in LOCAL DEV. `GCAL_CALENDAR_ID` is set in
`.env.local` to the dedicated "AI Workshops" calendar
(`7f91f0da...4753@group.calendar.google.com`, safe to record: the calendar is public by
Auri's own choice and he shared the subscribe link). **NOT set in Vercel yet, so production
still reads `primary`.**

The dedicated calendar currently holds **one** future event, 2026-09-13. The dates the old
`primary` calendar showed (09-20, 10-04, 10-18, 11-01, 11-15 and more) have NOT been moved
across. So the schedule went from 8 entries to 1, and the low-runway warning built in Area
4 is firing correctly: "Only one date scheduled."

Note the next-session date CHANGED: `primary` said 2026-09-06, the dedicated calendar says
2026-09-13. Worth confirming which is real, since that is what members see.

**If the schedule looks empty, this is why.** Events are leaving `primary` as they are
moved, and the app still reads `primary`. 2026-09-06 was returned at 12:30 and gone by
15:20. Once the migration finishes, `primary` returns nothing until the env var is set.

### What Auri still has to do (config, not code)
1. **Set `GCAL_CALENDAR_ID` in Vercel** project env to the value now in `.env.local`.
   Until then production reads `primary` and will empty out as events are moved.
2. **Move or recreate the remaining sessions** in the dedicated calendar. It has one.
3. **Get shareable link** on that calendar is the subscribe link for members. It is already
   public with "See event details".
4. The calendar is named "AI Workshops", not "AI Sundays". Cosmetic, but subscribers see it.

### Also observed after switching
- No guests are invited to the 2026-09-13 event, so `/api/attendees` returns
  `found: false` and the Coming list is empty. Correct: `findEvent` only returns an event
  that HAS attendees. Given Google Calendar cannot do link RSVP, the dashboard button is
  the path anyway.
- The event produces an empty `theme`, which means it is titled bare ("AI Workshops"). Put
  the topic in the event title and the app strips the prefix and shows the rest as the
  session theme.
- `.env.local.example` was a stub containing only stale comments about the removed feedback
  button. Rewritten to document all 20 env vars the app actually reads, each with what
  breaks without it. Verified complete and value-free.

### What shipped for it
`titleMatcher` is now calendar-aware. The title filter exists only because the default is
`primary`, where sessions must be picked out of someone's whole life. On a dedicated
calendar that filter is a liability: an event titled "Session #09" matches no needle and the
schedule silently empties, the wrong-event bug in reverse. So any `GCAL_CALENDAR_ID` other
than `primary` treats every event as a session. `GCAL_EVENT_MATCH` still overrides.
No re-auth needed: the stored refresh token is Auri's own with account-wide
`calendar.events.readonly`.

### Google Calendar cannot do link-based RSVP
Worth recording so it is not re-investigated. Making a calendar public lets people SEE
events; only individually added guest emails produce an RSVP status. There is no self-serve
join link. The dashboard's own RSVP button (Upstash, Google sign-in) already IS link-based
RSVP and is the primary path; Luma is the option for people who will not sign in. Do not
try to route RSVPs through Google Calendar.

### The archive is the bigger gap, and no calendar choice fixes it
Most recent recorded session is `#08` on 2026-06-14, **78 days ago**. Up to 5 sessions are
missing including one Auri says happened 2026-08-30. The site therefore claims "8 sessions
held" when it is nearer 13. Upcoming dates come from Google Calendar; PAST sessions come
from `content/sessions/*.md`, written by hand. Needs Auri to say what happened, or a `gaps`
entry if the cadence genuinely lapsed.

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
