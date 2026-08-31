# 10 areas × 10 improvements, plan and status

The plan originally lived only on `origin/claude/audit-and-ui-overhaul`, and the triage of it
was done once and never written down. It lives here now so the status survives.

Inspiration drawn from Luma (event cards: cover thumb → title → venue; category tiles with
counts; follow CTA), Meetup (member grids, RSVP prominence), Linear/Vercel (keyboard
affordances, restrained density), Stripe docs (typographic hierarchy), and the 2026
event-landing-page consensus: *relevance → proof → logistics → action*, with **one** primary CTA.

**Status re-triaged 2026-08-31 against the working tree** (branch `feat/dark-mode`).
Area 9 removed the same day, see below.

| | Done | Partial | Open | Moot |
|---|---|---|---|---|
| Total | **50** | **17** | **21** | **12** |

Area 9 (Feedback) was removed on 2026-08-31, which moved its 1 done, 2 partial and
7 open into moot. 90 items are now live. Area 4 was rebuilt the same day: 8 done and
2 partial, both partials blocked on stale data rather than missing code.

Legend: `[x]` done · `[~]` partial · `[ ]` open · `[-]` moot (solved another way, or no longer applies)

---

## 1. Global shell & navigation, 6 done, 3 open, 1 moot
- [x] 1.1 Skip-to-content link, `App.jsx:157`, `.skip-link` in `index.css`
- [x] 1.2 Real footer (identity, links, data freshness), `LegalPages.jsx` `Footer`
- [ ] 1.3 Header shadow only once scrolled, header is a static `border-b`, no scroll listener anywhere
- [-] 1.4 Horizontally scrollable tabs on mobile with edge fade, solved differently: mobile uses a fixed bottom bar + hamburger sheet, so there is no tab strip to scroll
- [x] 1.5 Per-tab document title, `App.jsx:126`
- [x] 1.6 `aria-live` announcement on tab change, `App.jsx:214`
- [x] 1.7 Wordmark links home, carries the brand mark, `App.jsx:166`
- [x] 1.8 `prefers-reduced-motion` honoured globally, `index.css:212`, blanket rule on `*`
- [ ] 1.9 Back/forward between tabs, still `history.replaceState` (`App.jsx:91`), so Back leaves the app
- [ ] 1.10 Print stylesheet, no `@media print` anywhere

## 2. Hero & at-a-glance, 9 done, 1 deliberately skipped
Rebuilt wholesale on 2026-08-30.
- [x] 2.1 One primary CTA, `Hero.jsx:155` `btn-primary`; the duplicate weak link was removed from `NextSession`
- [x] 2.2 Live countdown, `useCountdown`, self-scheduling
- [x] 2.3 "Next session" as a first-class stat
- [x] 2.4 Numerals-first stat blocks, `.num`, tabular figures
- [x] 2.5 One-line description of the community
- [x] 2.6 Date line pairs today with the next session, `fmtToday`
- [x] 2.7 Fluid `clamp()` type scale, `.hero-title`
- [x] 2.8 Dismissible stale-data notice, sessionStorage
- [-] 2.9 "New here?" entry point, skipped on purpose: the About page it would link to does not exist, and inventing a destination is a speculative feature
- [x] 2.10 Tighter hero on mobile, `h-20 sm:h-44`

## 3. Next session card, 5 done, 3 partial, 2 open
- [x] 3.1 Visible field labels, the original bug (icon-only, so values read as bare dashes)
- [x] 3.2 Actionable empty values: "Open slot" and "TBD" instead of a bare dash
- [x] 3.3 Lifecycle status pill, `soon` / `thisWeek` / muted variants
- [~] 3.4 Venue links to a map, works, but `lib/venues.js` only maps `matrikel1`; every other venue silently renders as plain text
- [~] 3.5 Luma link when present, **prompt when not**, the link renders; there is no prompt for the missing case
- [~] 3.6 Rotatable roles rendered, only `roles.host` is shown; the other roles in the data are still unrendered
- [x] 3.7 Clear CTA hierarchy. RSVP is unambiguously primary
- [ ] 3.8 `.ics` download beside the Google Calendar link. Google-only
- [ ] 3.9 Lean Coffee auto-flag when fewer than two demos, the format label exists, the auto-flag logic does not
- [~] 3.10 Countdown consistent with the hero, the card shows `relative()` ("in 6 days"), the hero shows a live `formatCountdown` ("6d 02h"). Different formats, arguably fine, not consistent

## 4. Schedule ahead, 10 done (2 inert on live data)
Rebuilt 2026-08-31. `ScheduleAhead.jsx` went from 47 lines reading five fields to a
grouped, foldable list. The graft in `App.jsx` was generalised: it carried only
`topics` from the static schedule onto the live Google Calendar rows, and now carries
`presenter`, `venueStatus`, `roles`, `notes`, `number` and `luma` too, live values
winning where both have something.

- [x] 4.1 Group by month, `SEPTEMBER 2026` / `OCTOBER 2026` headers
- [x] 4.2 Show the next few, expand for the rest, 4 rows then "N more dates", with "Show fewer" back
- [x] 4.3 Stronger "next" treatment, tinted row, `next` pill, semibold date
- [x] 4.4 Presenter shown when known, pill turns green with a name, muted "open" without
- [~] 4.5 Venue-status colour coding, BUILT and verified, but inert: see the data note below
- [x] 4.6 Per-row add-to-calendar, calendar icon on every row via `googleCalendarUrl`
- [~] 4.7 Maintainer hints behind a dev flag, BUILT behind `import.meta.env.DEV` (never ships), same inert problem
- [x] 4.8 Render the `gaps` data, "Gap on record: 22 Feb 2026 to 19 Apr 2026. Protocol paused..."
- [x] 4.9 Low-runway state, warns at two dates or fewer with a real next step
- [x] 4.10 Denser single column on mobile, `py-2 sm:py-2.5`, the next-row inset is `sm:` only

**Not on the plan, but the actual decluttering win:** the venue was printed in full on
every row (`@ Matrikel1, Højbro Pl. 10, 1200 København, Denmark`, six times). It now
shows once in the panel header, and a row only names a venue when it differs.

### Why 4.5 and 4.7 render nothing right now
`venueStatus`, `roles` and `notes` exist ONLY in `data/schedule.json`. The live rows come
from Google Calendar, which carries date, theme, venue and startsAt and nothing else. The
graft matches by date, and **the two sources do not overlap**: the static file still lists
2026-05-03 to 2026-07-12 while the calendar returns 2026-09-06 to 2026-12-13. So both
features are dead until `data/schedule.json` is updated to the current dates.

Verified by temporarily injecting a static entry for 2026-09-06 with
`venueStatus: "tentative"`, a host role and a note: the warn pill, the `#9` number, the
green presenter pill and the DEV hint all rendered. `data/schedule.json` was restored and
is byte-identical to HEAD.

**This is a data task, not a code one.** Refresh the dates in `data/schedule.json` and
both light up with no further work.

## 5. Community polls, 2 done, 2 partial, 6 open
- [x] 5.1 Skeleton loading instead of a spinner line
- [ ] 5.2 Optimistic vote with rollback
- [x] 5.3 Explicit "your vote" state, `myVote()` + "Your vote is in"
- [ ] 5.4 Sort by votes / by order toggle
- [ ] 5.5 Options behave as a radio group (arrow keys)
- [ ] 5.6 `aria-live` result announcements
- [~] 5.7 Labelled, validated name field, placeholder only, no `<label>`; moot in auth mode where the field is hidden
- [~] 5.8 Inline validation in the create modal, the server error is surfaced, nothing validates before submit
- [ ] 5.9 Surface the server's duplicate-option response, the server does not detect duplicates either
- [ ] 5.10 Per-poll share link

## 6. News, 3 done, 4 partial, 3 open
- [x] 6.1 Luma-style card hierarchy, cover → title → meta
- [ ] 6.2 Text search across titles and summaries
- [x] 6.3 Explicit newest-first ordering, **fixed 2026-08-31**; the file is genuinely unsorted
- [x] 6.4 Collapsible "why it matters", `aria-expanded`, chevron
- [~] 6.5 Source count and reading time, a `Clock` and `sources[0]` are used; no count, no computed reading time
- [ ] 6.6 Sticky filter bar
- [~] 6.7 Blur-up image placeholders, `loading="lazy"` only
- [~] 6.8 External-link affordance, `target="_blank"` with no visible icon
- [ ] 6.9 Arrow-key navigation across filter chips
- [~] 6.10 "Last updated" line, `windowLabel` covers the window, not a last-updated timestamp

## 7. Members, 5 done, 5 open
- [ ] 7.1 Role badges (Organizer vs Active)
- [ ] 7.2 Member search
- [ ] 7.3 Sort control, the order is a random **shuffle on every mount**, which is the opposite of a control
- [x] 7.4 Deterministic colour for initials avatars. DiceBear seeded by name
- [x] 7.5 Clearer LinkedIn affordance, brand bug + `aria-label`
- [ ] 7.6 Sessions-attended count from real history
- [x] 7.7 Grid tuned per breakpoint, 2 / 3 / 4 / 5
- [x] 7.8 Accessible names on every card, `aria-label` on the link, `alt=""` on the decorative photo
- [x] 7.9 Empty state, "No members yet."
- [ ] 7.10 Visible note on how to be removed

## 8. Sessions archive & lightbox, 7 done, 1 partial, 2 open
- [x] 8.1 List every session, not only those with photos, `SessionTile` handles `hasPhotos === false`
- [x] 8.2 Show demos, attendees and summary, on the recap page
- [x] 8.3 Preload the next lightbox image, **added 2026-08-31**
- [x] 8.4 Swipe navigation on touch, **added 2026-08-31**, plus `touch-action: pan-y` so an edge swipe is not the browser's back gesture
- [~] 8.5 Position counter and keyboard hints, the counter is there, the keyboard hints are only a code comment
- [ ] 8.6 Thumbnail strip
- [x] 8.7 Descriptive alt text, **added 2026-08-31**, was `alt=""`
- [ ] 8.8 Timeline with the recorded gaps
- [x] 8.9 Hover treatment respects reduced motion, covered by the blanket rule at `index.css:212`
- [x] 8.10 Deep-link to a single session, `#recap/<date>`

## 9. Feedback, REMOVED 2026-08-31, all 10 moot
The feature is gone. It never worked in production: there was no `api/feedback.js`,
so on Vercel the POST fell through to the SPA and returned HTML, and the handler
appended to `data/feedback.md`, a file, on a read-only filesystem. Polishing the
modal would have been decorating a dead endpoint.

Deleted: `FeedbackButton.jsx`, the Vite dev middleware, both `server.js` routes,
`VITE_FEEDBACK_ENABLED`, and `data/feedback.md` (its only entry was a smoke test).
If feedback comes back it needs a real serverless route on Upstash first, the same
store polls and threads already use.

- [-] 9.1 to 9.10, all moot with the feature removed.

## 10. Platform, 4 done, 4 partial, 2 open
- [~] 10.1 Security headers (CSP, nosniff, referrer, frame-ancestors, HSTS), every header ships **except** that the CSP is `Content-Security-Policy-Report-Only` with no `report-uri`, so it neither blocks nor reports and its `frame-ancestors` is inert. Highest-value open item here.
- [~] 10.2 Response compression. Vercel compresses at the edge (production), `server.js` does not. Only matters if the parked self-host runtime is ever used.
- [x] 10.3 Real `og:image` with absolute URLs, and regenerated from the AI Sundays wordmark on 2026-08-31
- [ ] 10.4 `robots.txt` + `sitemap.xml`, neither exists
- [x] 10.5 Route-level code splitting, `React.lazy` on every non-default tab
- [x] 10.6 Long-cache hashed assets, never the HTML, `/assets/*` immutable, `/api/*` no-store
- [~] 10.7 Network-failure states in the UI, `TabErrorBoundary` catches stale-chunk failures; there is no general offline/fetch-failure state
- [~] 10.8 Request logging and a readiness probe, `/healthz` exists; no structured logging, no requestId
- [x] 10.9 JSON 404/405 for unknown API routes, **fixed 2026-08-31**; previously returned 200 + the SPA shell
- [ ] 10.10 A repeatable audit script, `scripts/audit.mjs` exists only on `origin/claude/audit-and-ui-overhaul`

---

## Not in this plan at all

The plan is a UI-and-platform document, so it has no entry for the most serious defect found
so far: **every mutating API route took the caller's identity from the request body**, which let
any signed-in member vote as anyone, post under anyone's name, and delete anyone's topic or
comment. Fixed 2026-08-31 (`api/_identity.js`, 21 assertions in `npm run identity:check`).

Treat the 100 items as a backlog, not as a definition of done.
