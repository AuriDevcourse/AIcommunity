# 10 areas × 10 improvements

Inspiration drawn from Luma (event cards: cover thumb → title → venue; category tiles with
counts; follow CTA), Meetup (member grids, RSVP prominence), Linear/Vercel (keyboard
affordances, restrained density), Stripe docs (typographic hierarchy), and the 2026
event-landing-page consensus: *relevance → proof → logistics → action*, with **one** primary CTA.

## 1. Global shell & navigation
1. Skip-to-content link
2. Real footer (identity, links, data freshness)
3. Header shadow only once scrolled
4. Horizontally scrollable tabs on mobile with edge fade
5. Per-tab document title
6. `aria-live` announcement on tab change
7. Wordmark links home, carries the favicon mark
8. `prefers-reduced-motion` honoured globally
9. Back/forward navigation between tabs (pushState, not replaceState)
10. Print stylesheet

## 2. Hero & at-a-glance
1. One primary CTA in the hero (add next session to calendar)
2. Live countdown to the next session
3. "Next session" as a first-class stat
4. Numerals-first stat blocks
5. One-line description of what this community is
6. Date line pairs today with the next session
7. Fluid `clamp()` type scale
8. Dismissible stale-data notice
9. "New here?" entry point
10. Tighter hero on mobile

## 3. Next session card
1. **Visible field labels** (they were icon-only, so every value read as a bare dash)
2. Actionable empty values instead of "—"
3. Lifecycle status pill (T-7 → T+3)
4. Venue links to a map when set
5. Luma link when present, prompt when not
6. Rotatable roles rendered (data existed, was never shown)
7. Clear CTA hierarchy
8. `.ics` download beside the Google Calendar link
9. Lean Coffee auto-flag when fewer than two demos
10. Countdown consistent with the hero

## 4. Schedule ahead
1. Group by month instead of one flat wall
2. Show the next few, expand for the rest
3. Stronger "next" treatment
4. Presenter shown when known
5. Venue-status colour coding
6. Per-row add-to-calendar
7. Maintainer-only hints hidden behind a dev flag
8. Render the `gaps` data
9. Low-runway state with a real next step
10. Denser single column on mobile

## 5. Community polls
1. Skeleton loading instead of a spinner line
2. Optimistic vote with rollback
3. Explicit "your vote" state
4. Sort by votes / by order toggle
5. Options behave as a radio group (arrow keys)
6. `aria-live` result announcements
7. Labelled, validated name field
8. Inline validation in the create modal
9. Surface the server's duplicate-option response
10. Per-poll share link

## 6. News
1. Luma-style card hierarchy
2. Text search across titles and summaries
3. Explicit newest-first ordering
4. Collapsible "why it matters" to cut card height
5. Source count and reading time
6. Sticky filter bar
7. Blur-up image placeholders
8. External-link affordance
9. Arrow-key navigation across filter chips
10. "Last updated" line

## 7. Members
1. Role badges (Organizer vs Active)
2. Member search
3. Sort control
4. Deterministic colour for initials avatars
5. Clearer LinkedIn affordance
6. Sessions-attended count from real history
7. Grid tuned per breakpoint
8. Accessible names on every card
9. Empty state
10. Visible note on how to be removed

## 8. Sessions archive & lightbox
1. List every session, not only those with photos
2. Show demos, attendees and summary
3. Preload the next lightbox image
4. Swipe navigation on touch
5. Position counter and keyboard hints
6. Thumbnail strip
7. Descriptive alt text
8. Timeline with the recorded gaps
9. Hover treatment respects reduced motion
10. Deep-link to a single session

## 9. Feedback
1. Character counter against the real server cap
2. Success state that says what happens next
3. Per-category helper text
4. Offline detection
5. Draft persistence
6. Distinct message for rate limiting
7. Discoverable shortcut
8. Privacy statement in the dialog
9. Client-side validation before submit
10. `aria-live` status

## 10. Platform
1. Security headers (CSP, nosniff, referrer, frame-ancestors, HSTS)
2. Response compression
3. Real `og:image` with absolute URLs from an env var
4. `robots.txt` + `sitemap.xml`
5. Route-level code splitting
6. Long-cache hashed assets, never the HTML
7. Network-failure states in the UI
8. Request logging and a readiness probe
9. JSON 404/405 for unknown API routes
10. A repeatable audit script
