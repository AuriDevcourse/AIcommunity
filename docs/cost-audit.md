# Cost & automation audit

_Last reviewed: 2026-06-11_

The dashboard runs entirely on **free tiers** today. Nothing here is urgent at the
current scale (a small Copenhagen meetup), but two items become important the
moment the app is shared more widely or AI drafting gets used a lot.

## Service inventory

| Service | What it does | Tier | Cost risk |
|---|---|---|---|
| **Vercel** (hosting + serverless) | hosts the SPA + `/api/*` functions | Hobby (free) | Low. Edge-DDoS protection built in. Function invocations cut by `s-maxage` caching on GET routes. |
| **Gemini flash** (`gemini-flash-latest`) | Post Maker, auto recap draft, news draft | Free text tier | **Medium** — see exposure #1. Free quota is per-project, not per-key; don't burst. |
| **OpenRouter** (fallback for Post Maker) | only used if `GEMINI_API_KEY` is unset | Pay-as-you-go | Medium — paid per token if it ever becomes the active provider. |
| **Upstash Redis** | rate-limit counters + RSVP/polls/threads/session-meta stores | Free tier (10k cmd/day) | Low. |
| **Vercel Blob** | session photo storage | Free tier | Low; images are downscaled client-side before upload. |
| **ImgBB** | forum/tool image uploads | Free | Low. |
| **Supabase** | auth (Google + email) | Free tier | Low. |

## Exposure #1 — `/api/generate-post` has no cumulative per-user quota (highest priority)

The route is already **auth-gated + rate-limited** (`guardMutation`, 10/min). That
caps *frequency* but not *total spend*: a signed-in user making many valid,
spaced-out requests stays under the rate limit while still drawing tokens on every
call. This is Security rule 5 (per-user usage quota), and it matters more now that
**two** features call this endpoint — the Post Maker **and** the new auto recap
draft.

**Recommended fix (fast follow, ~30 lines).** Track per-user generations in Redis
keyed by month and refuse over a cap. Sketch:

```js
// in api/_guard.js (or a small api/_quota.js)
export async function withinQuota(userId, { bucket = 'gen', max = 50 } = {}) {
  if (!KV_URL || !userId) return true;          // no store / anon → don't block here
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const key = `quota:${bucket}:${userId}:${month}`;
  const n = await kv(['INCR', key]);
  if (n === 1) await kv(['EXPIRE', key, 60 * 60 * 24 * 35]); // ~1 month TTL
  return n <= max;
}
```

Wire it into `api/generate-post.js` (and the dev middleware) after `requireUser`:
over quota → return `429`/`402` with a "resets next month" message. Optionally read
the provider's `usage` field and count tokens instead of generations for a true
spend cap. The streaming path can count one generation up-front (before the SSE
starts) so a mid-stream abort still counts as one use.

**Backstop:** set a hard spend cap in the Gemini/OpenRouter console so a bug or
abuse can never run up an unbounded bill.

## Exposure #2 — public exposure of the app

Today browsing is open and only writes are gated, which is correct. Before
promoting the app widely:
- Confirm every mutating route calls `guardMutation` (currently: photos,
  session-meta, threads, topics, polls, upload-image, generate-post, **rsvp**). ✔
- Keep the Gemini key server-side only (it is — never `VITE_`-prefixed). ✔
- Add the per-user quota above before the Post Maker / recap draft are promoted.

## What's already efficient

- **Images**: `scripts/optimize-images.mjs` runs in `build` (77MB → 13.8MB; hero
  3.3MB → 29KB). New photos auto-optimize on the next build.
- **Edge caching**: GET routes (`photos`, `session-meta`, `attendees`, `rsvp`,
  topics/threads) set `s-maxage` + `stale-while-revalidate`, so repeat loads hit
  the cache, not the function — fewer invocations and faster loads.
- **Code-splitting**: non-default tabs load on demand.

## Automation now in place

- **News drafting** (`npm run draft:news` + `.github/workflows/news.yml`): weekly
  cron pulls public AI RSS, Gemini flash curates a draft into `data/news-draft.json`,
  cover images are fetched, and a PR is opened for review. Curation stays human;
  only the gathering is automated. Near-zero cost (free Gemini tier).
- **Auto recap draft**: the recap page drafts a LinkedIn post from a session's
  notes/photos via the existing Post Maker endpoint — no new LLM plumbing.

## Suggested next automations (not built)

- **Scheduled a11y/perf check**: a GitHub Action running Lighthouse CI or
  `@axe-core/cli` against the preview URL on each PR, to keep WCAG 2.2 AA from
  regressing (pairs with the accessibility statement).
- **React Doctor** in CI (`npx react-doctor@latest`) to catch the class of bugs AI
  agents introduce into React.
- **Stale-photo / orphan-Blob cleanup**: a periodic job that deletes Blob objects
  no session references, to keep the free Blob tier comfortable long-term.
```
