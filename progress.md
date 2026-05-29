# AI Workshop dashboard — progress

A running log of what's built, what needs setup, and what's planned. Live at https://a-icommunity.vercel.app

## Implemented
- **Cockpit** — next session, schedule ahead, suggestions, tools tested, hero banner.
- **Next session + Coming list** — reads who accepted the Google Calendar invite and shows them with avatars. (Live.)
- **Post Maker** — turn session notes into a LinkedIn/Instagram post in the community voice, with a live LinkedIn preview. Uses Gemini. (Live.)
- **Polls** — name-gated voting, pick-one or pick-any, live tallies. (Needs the Upstash store, see below.)
- **Suggestions board** — anyone suggests what to build next, everyone upvotes/downvotes (one vote per name, toggle to undo), sorted by score. Replaced the static "Soon implementing" card. (Needs the Upstash store.)
  - Made the name requirement explicit (you must enter a name to vote or suggest). 2026-05-29.
- **Photo uploads** — add session photos from the site (drag-and-drop, progress %, downscaled), merged into the gallery. (Live, Vercel Blob.)
- **Sessions gallery** — committed + uploaded photos, lightbox.
- **News, Members** tabs.
- **Branding** — SVG logo + favicon/PWA icon set + manifest, AI-generated hero/OG image.

## Setup still pending (free)
- **Upstash Redis** — one store unlocks BOTH Polls and Suggestions. Create free at upstash.com, add UPSTASH_REDIS_REST_URL + TOKEN to Vercel env, redeploy.
- **Publish the Google OAuth app to Production** — so the Coming-list token doesn't expire after 7 days.

## Planned / ideas
- Session recaps auto-drafted from notes (feeds Post Maker).
- Member Projects directory (each member's current build + links + status).
- Open action items surfaced on the cockpit.
- Merge runtime photo uploads into the Post Maker LinkedIn preview.

## Notes
- Community suggestions from the board that we commit to building get moved into "Planned" above.
