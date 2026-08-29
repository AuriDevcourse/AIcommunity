# AI Workshop · Cockpit

Personal dashboard for running the **AI Workshop** Copenhagen meetup — a single place to see what's happening, plan ahead, and capture signals.

Built with Vite + React + Tailwind. Reads markdown session notes + JSON planning files; renders a cockpit view, a news feed, a member gallery, a session photo archive, community polls, and a feedback capture box.

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5280
```

The `dev` script runs the parser first, then Vite. Re-run `npm run dev` after editing planning JSON or session notes.

The dev server binds `127.0.0.1` on purpose — the `/api` middleware has no authentication beyond per-browser tokens, so it should not be on the LAN by default. To test from a phone: `npm run dev -- --host`.

## Scripts

| Command              | What it does |
|---|---|
| `npm run dev`        | Build data + start Vite on 127.0.0.1:5280 |
| `npm run build`      | Build data + production build |
| `npm run build:data` | Parse markdown + JSON → `src/data.json` |
| `npm run fetch:news` | Re-fetch Open Graph images for news items into `public/news-images/` |
| `npm run check:assets` | List unreferenced / oversized images in `public/` |
| `npm run preview`    | Serve the production build (static only — no `/api`) |
| `npm start`          | Run `server.js`: serves `dist/` **and** the `/api` routes |

## Deploying — read this first

The interactive features (**polls**, **feedback**) need a Node process with a writable disk, because state lives in `data/poll.json` and `data/feedback.md`.

- **`npm start` (a VPS, a container)** — everything works.
- **Static hosting (the current `vercel.json`, GitHub Pages, `npm run preview`)** — there is no `/api`. The dashboard, news, members and sessions all render fine; the poll card shows a "needs the Node server" note and the feedback button hides itself. This is by design, not a bug. Making polls work on Vercel would mean replacing the JSON files with a hosted database.

Environment variables are documented in `.env.local.example`.

**Set `DATA_DIR` to a path outside the checkout in production** (the systemd unit and `deploy.sh` both default to `/var/lib/aiworkshop`). `deploy.sh` runs `git reset --hard`, so any state left inside the repo is destroyed on every deploy — which is why `data/poll.json` is gitignored rather than committed.

## Data sources

The dashboard reads from three places:

1. **Markdown session notes** at `~/Documents/AuriGrownup/AI Workshop/Sessions/*.md` — parsed for attendees, demos, action items.
2. **Planning JSON** in `data/`:
   - `schedule.json` — `cadence` (slot + timezone), `upcoming` sessions, and `gaps`
   - `backlog.json` — demo backlog
   - `news.json` — AI news roundup with sources + image paths
   - `feedback.md` — appended to by the in-app feedback button (gitignored)
   - `poll.json` — poll state, written by the API
3. **Generated** `src/data.json` — output of `scripts/build-data.js`. **Committed on purpose**, so a machine without the Obsidian vault can still build.

The notes path is a default for the authoring machines only. Anywhere else, set `AI_WORKSHOP_NOTES_DIR`, or accept the committed `src/data.json` snapshot — the build warns loudly when it falls back, and the app shows a banner once the snapshot is over 45 days old.

`build:data` also validates the schedule and warns when it has expired, is about to run out, or has a `gaps` entry that contradicts a logged session.

## Sections

**Cockpit tab**
- Next session — date, format, theme, venue, time slot and "add to calendar" (both derived from `schedule.cadence`)
- Community polls — create, vote, suggest options
- Schedule ahead, with a warning when fewer than 3 dates remain
- Demo backlog (from `data/backlog.json`)
- Open action items, grouped by hub / session, pulled out of the markdown notes

**News tab** — roundup window and theme statements derived from the items themselves, filter chips built from the data (so a chip can never be empty), and a staleness banner once the newest story is over 3 weeks old.

**Members tab** — photo/initials gallery, LinkedIn links.

**Sessions tab** — photo archive with a keyboard-navigable lightbox. Drop files into `public/sessions/<YYYY-MM-DD>/`.

**Feedback button** (floating, bottom-right, requires `VITE_FEEDBACK_ENABLED=true` and a backend) — appends to `data/feedback.md`.

## Polls: how identity works

There are no accounts. On first vote the server mints a random token, the browser stores it in `localStorage`, and it travels in an `X-Voter-Token` header.

- The token — never the typed name — decides whose vote is whose and who may delete a poll. A name is a display label only.
- One vote per browser profile. Clearing site data, or a different browser, is a new identity.
- Polls created before tokens existed cannot be deleted through the API by anyone. Edit `data/poll.json`, or set `ADMIN_TOKEN`.

## Operations framework

The dashboard is shaped by `Community Operations Framework.md` (lives in the markdown vault, not in this repo) — defining the per-session lifecycle, rotatable roles, and quarterly health metrics.
