# AI Workshop · Cockpit

Personal dashboard for running the **AI Workshop** Copenhagen meetup — a single place to see what's happening, plan ahead, and capture signals.

Built with Vite + React + Tailwind. Reads markdown session notes + JSON planning files; renders a cockpit view, a news feed, and accepts feedback via a small Vite middleware that appends to `data/feedback.md`.

## Run

```bash
npm install
npm run dev          # http://localhost:5280
```

The `dev` script runs the parser first, then Vite. Re-run `npm run dev` after editing planning JSON or session notes.

## Scripts

| Command              | What it does |
|---|---|
| `npm run dev`        | Build data + start Vite on :5280 |
| `npm run build`      | Build data + production build |
| `npm run build:data` | Parse markdown + JSON → `src/data.json` |
| `npm run fetch:news` | Re-fetch Open Graph images for news items into `public/news-images/` |
| `npm run preview`    | Serve the production build |

## Data sources

The dashboard reads from three places:

1. **Markdown session notes** at `~/Documents/AuriGrownup/AI Workshop/Sessions/*.md` — parsed for attendees, demos, action items.
2. **Planning JSON** in `data/`:
   - `schedule.json` — upcoming sessions (theme, format, venue, presenter, roles)
   - `backlog.json` — demo backlog
   - `news.json` — AI news roundup with sources + image paths
   - `feedback.md` — appended to by the in-app feedback button
3. **Generated** `src/data.json` — output of `scripts/build-data.js` (gitignored).

Note: the markdown notes path is hardcoded to a local user directory — this dashboard is not portable as-is. Adapt `scripts/build-data.js` if forking.

## Sections

**Cockpit tab**
- Next session — date, format, theme, venue, lifecycle (T-7 → T+3), rotatable roles, Lean Coffee auto-flag
- Demo backlog
- Schedule ahead (6 upcoming sessions)
- Content pipeline (Granola integration is phase-2)
- Org health (computed metrics vs framework targets)
- Members (with last-seen / last-demo from session history)
- Open action items (extracted from all session notes)
- Past sessions timeline (with gap markers)

**News tab**
- Roundup window with theme statements per category
- Filter chips: All / Global / EU+Policy
- Magazine-style cards with hero images, summaries, source links

**Feedback button** (floating, bottom-right)
- Categories: General / Session / Idea / Demo signup / Venue / WhatsApp signal
- Submits to `/api/feedback` (Vite middleware) → appends to `data/feedback.md`
- Shows last 5 entries

## Operations framework

The dashboard is shaped by `Community Operations Framework.md` (lives in the markdown vault, not in this repo) — defining the per-session lifecycle, rotatable roles, and quarterly health metrics that the dashboard tracks.
