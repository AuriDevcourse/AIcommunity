# Post Maker — setup

The **Post** tab turns session notes into a social post (LinkedIn or Instagram) in the AI Workshop community voice. Pick a past session to pre-fill from its demos/attendees/summary, or paste your own notes, choose the format, and generate. Copy + regenerate built in.

## How it works
- The community voice + knowledge (what the AI Workshop is, formats, house style, "never mention TechBBQ") plus three real posts as labeled few-shot examples are baked into `api/_postmaker.js` as the system prompt. No external knowledge base files.
- LLM provider: **Google Gemini** when `GEMINI_API_KEY` is set (preferred), otherwise **OpenRouter** (`OPENROUTER_API_KEY`). Pick whichever key you have.
- House style is enforced in the prompt and in `postProcess()` (strips em dashes, markdown bold, double spaces).
- `api/generate-post.js` is the Vercel function; mirrored in `vite.config.js` (dev) and `server.js` (self-host). UI: `src/components/PostMaker.jsx`, tab wired in `App.jsx`.

## One-time setup
Add ONE provider key to the dashboard env (Vercel → Settings → Environment Variables, and `.env.local` for dev):
```
# Option A — Google Gemini (Google AI Studio key)
GEMINI_API_KEY=...
# Option B — OpenRouter
OPENROUTER_API_KEY=sk-or-...
```
Optional model overrides:
```
GEMINI_MODEL=gemini-2.5-flash          # default
POST_MODEL=anthropic/claude-sonnet-4.6 # OpenRouter default
```
Redeploy after adding env on Vercel. Until a key is set, the Post tab shows "not connected yet".

## Notes
- Gemini default is `gemini-2.5-flash`. Thinking is disabled (`thinkingConfig.thinkingBudget: 0`) so hidden reasoning tokens don't eat the post; if you ever see truncated output, raise `maxOutputTokens` in `callGemini`.
- If a model slug stops working, set `GEMINI_MODEL` / `POST_MODEL` — no code change needed.
- The voice never references TechBBQ and is tuned from real post performance. Edit `VOICE` / `EXAMPLES` / `FORMAT_RULES` in `api/_postmaker.js` to adjust.
- The same voice also exists as a standalone option in the toneofv "Post Maker" tool; this dashboard version is the integrated one that pre-fills from session data and shows a LinkedIn preview.
