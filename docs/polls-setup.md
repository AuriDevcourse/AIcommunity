# Polls, how it works & production setup

## What it does
- A **Polls** tab on the dashboard. Anyone can create a poll, and everyone votes.
- **Name-gated:** you type your name once, then vote. One vote per name per poll, re-voting *replaces* your previous answer, it never double-counts. Name matching is case-insensitive (`Auri` == `auri`).
- **Pick one** (radio) or **Pick any** (multi-select) per poll.
- Live tallies with a bar per option, vote counts, and the list of who voted. Refreshes every 5s.
- Close/reopen and delete buttons per poll (no login, it's a trusted ~15-person group).

## Architecture
- Frontend: `src/components/Polls.jsx` → calls `/api/polls`.
- Logic: `api/_polls-core.js` (shared, single source of truth). The `_` prefix means Vercel does **not** expose it as its own endpoint, it's just imported.
- Endpoint: `api/polls.js` (Vercel serverless function).
- Local dev + Hetzner reuse the same logic via `vite.config.js` middleware and `server.js`.

## Storage
The store auto-selects based on env:
- **`KV_REST_API_URL` is set** → Upstash Redis (production on Vercel).
- **not set** → local JSON file `data/polls-store.json` (dev + self-host).

Votes live in a Redis hash keyed by voter name, so simultaneous voters during a live session never overwrite each other.

## One-time production setup on Vercel
The live site (a-icommunity.vercel.app) is a static build, so polls need a serverless KV store. Free tier is plenty.

1. Vercel dashboard → your project → **Storage** → **Create** → **Upstash (Redis)** (Marketplace). Accept the free plan.
2. **Connect** it to the project. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into the project env (all environments).
3. **Redeploy** (or push any commit) so the function picks up the env vars.
4. Seed the starter poll once, against production, from your machine:
   ```bash
   KV_REST_API_URL="<value from Vercel>" KV_REST_API_TOKEN="<value>" npm run seed:polls
   ```
   …or just create it from the Polls tab UI. Either works.

That's it. Until step 2 is done, the Polls tab loads but voting shows a "backend not configured" message.

## Local development
Already works with no setup, `npm run dev`, open the Polls tab. The seed poll is in `data/polls-store.json` (run `npm run seed:polls` to recreate it).
