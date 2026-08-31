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
| Total | **75** | **9** | **4** | **12** |

Area 9 (Feedback) was removed on 2026-08-31, which moved its 1 done, 2 partial and
7 open into moot. 90 items are now live. Area 4 was rebuilt the same day: 8 done and
2 partial, both partials blocked on stale data rather than missing code.

Legend: `[x]` done · `[~]` partial · `[ ]` open · `[-]` moot (solved another way, or no longer applies)

---

## 1. Global shell & navigation, 7 done, 2 open, 1 moot
- [x] 1.1 Skip-to-content link, `App.jsx:157`, `.skip-link` in `index.css`
- [x] 1.2 Real footer (identity, links, data freshness), `LegalPages.jsx` `Footer`
- [ ] 1.3 Header shadow only once scrolled, header is a static `border-b`, no scroll listener anywhere
- [-] 1.4 Horizontally scrollable tabs on mobile with edge fade, solved differently: mobile uses a fixed bottom bar + hamburger sheet, so there is no tab strip to scroll
- [x] 1.5 Per-tab document title, `App.jsx:126`
- [x] 1.6 `aria-live` announcement on tab change, `App.jsx:214`
- [x] 1.7 Wordmark links home, carries the brand mark, `App.jsx:166`
- [x] 1.8 `prefers-reduced-motion` honoured globally, `index.css:212`, blanket rule on `*`
- [x] 1.9 Back/forward between tabs, `382ca84`: only the first sync replaces, later changes push. `npm run history:check`, 11 assertions
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

## 5. Community polls, 10 done
Rebuilt 2026-08-31 (`6ecaf2d`). `npm run polls:check` covers it, 14 assertions in a real
browser.
- [x] 5.1 Skeleton loading instead of a spinner line
- [x] 5.2 Optimistic vote with rollback, `applyVoteLocally` mirrors the server's
      `withResults`; the previous poll is restored on failure and the selection kept as a draft
- [x] 5.3 Explicit "your vote" state
- [x] 5.4 Sort by votes / by order, sorted on a copy so server state is not reordered
- [x] 5.5 Options behave as a radio group, `role=radiogroup` + `aria-checked` + roving
      tabindex + arrows that move AND select, Home/End; multi-select uses group/checkbox
- [x] 5.6 `aria-live` polite region announcing the saved vote and the new total
- [x] 5.7 Labelled name field, and the question and option inputs too
- [x] 5.8 Inline validation in the create modal, naming the missing requirement
- [x] 5.9 Duplicate options rejected server-side, case- and space-insensitively
- [x] 5.10 Per-poll share link via a new `#poll/<id>` route, mirroring `#recap/<date>`

## 6. News, 10 done
Rebuilt 2026-08-31 (`ca08f3c`). `npm run news:check`, 15 assertions.
- [x] 6.1 Luma-style card hierarchy
- [x] 6.2 Text search over title, subtitle, summary, both why-fields and source names
- [x] 6.3 Explicit newest-first ordering
- [x] 6.4 Collapsible "why it matters"
- [x] 6.5 Source count and reading time, from the prose only at 200wpm
- [x] 6.6 Sticky filter bar, with the search beside it
- [~] 6.7 Image placeholders: a skeleton holds the box and the photo fades over it.
      NOT a true LQIP blur-up, which needs a per-image base64 thumbnail emitted at build
      time; a new generated artifact for a difference invisible at this card size
- [x] 6.8 External-link affordance, a visible arrow on every off-site link
- [x] 6.9 Arrow-key navigation across the filter chips, with one tab stop
- [x] 6.10 "Last reviewed" line, from a real `curatedAt` in data/news.json

## 7. Members, 10 done
Rebuilt 2026-08-31 (`50fa800`). `npm run members:check`, 13 assertions.
**`content/members.md` is now the source of truth** (Name | Status | Aliases), replacing the
table that lived only in Auri's Obsidian vault. `scripts/build-data.js` reads it and keeps
the vault table as a fallback for an older checkout.
- [x] 7.1 Role badges, only `Organizer` renders; nineteen "Active" badges would be noise
- [x] 7.2 Member search, over display name and aliases
- [x] 7.3 Sort control: Featured / Name / Sessions. The old random shuffle survives as ONE
      option instead of being the only behaviour
- [x] 7.4 Deterministic colour for initials avatars, DiceBear seeded by name
- [x] 7.5 Clearer LinkedIn affordance
- [x] 7.6 Sessions-attended from real history, 31 of 34 attendance entries resolve
- [x] 7.7 Grid tuned per breakpoint
- [x] 7.8 Accessible names on every card
- [x] 7.9 Empty state, plus a distinct "nobody matches" state for a search
- [x] 7.10 Visible note on how to be removed

Fixed by the move, none of which were on the plan: `Unknown #1` and `Unknown #2` were
headcount placeholders rendering as blank cards and inflating the count; Andrei Prusu,
Pavel Kucera and Ernestas Sazinas had photos but no member row and never appeared at all.

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

## 10. Platform, 8 done, 2 partial
Rebuilt 2026-08-31 (`e6f544c`). `npm run csp:check` (5) and `npm run audit` are new.
- [x] 10.1 Security headers and CSP. **Enforced now**, was `Report-Only` with no
      `report-uri`, so it neither blocked nor reported. `i.ibb.co` had to be added to
      `img-src` first or every Forum image upload would have been blocked
- [~] 10.2 Response compression. Vercel compresses at the edge, so production is covered;
      `server.js` does not, and it is a parked runtime. Not worth a dependency
- [x] 10.3 Real `og:image` with absolute URLs
- [x] 10.4 `robots.txt` and `sitemap.xml`. One URL in the sitemap on purpose: every view is
      a hash route and a fragment is not a separate URL to a crawler
- [x] 10.5 Route-level code splitting
- [x] 10.6 Long-cache hashed assets, never the HTML
- [x] 10.7 Network-failure states. One offline notice below the header, plus the existing
      TabErrorBoundary for stale-chunk failures
- [~] 10.8 Request logging and a readiness probe. `/healthz` exists; no structured logging
      or requestId, and both would only affect the parked `server.js`
- [x] 10.9 JSON 404/405 for unknown API routes
- [x] 10.10 A repeatable audit script. `npm run audit` runs all nine suites, starts what
      each needs, and reports SKIP separately from PASS so a suite that could not run never
      reads as green

---

## Not in this plan at all

The plan is a UI-and-platform document, so it has no entry for the most serious defect found
so far: **every mutating API route took the caller's identity from the request body**, which let
any signed-in member vote as anyone, post under anyone's name, and delete anyone's topic or
comment. Fixed 2026-08-31 (`api/_identity.js`, 21 assertions in `npm run identity:check`).

Treat the 100 items as a backlog, not as a definition of done.
