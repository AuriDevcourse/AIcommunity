# "Coming" list. Google Calendar attendees setup

Shows who accepted the session's Google Calendar invite, on the **Next session** card. Reads the event's guest list and lists everyone whose RSVP is **Yes** (plus a "maybe" count for tentative).

## Why it needs OAuth (not just an API key)
Attendee RSVP status is private to the event. A public API key can't see it. So the dashboard reads the guest list **as the organiser** (`baciauskas.aurimas@gmail.com`) using a stored OAuth refresh token. Scope is read-only (`calendar.events.readonly`).

The "Coming" section simply doesn't render until this is configured, nothing breaks before then.

## How the event is matched
For the next session date (from `data/schedule.json`), the endpoint looks at that day on your calendar and picks the event whose **title contains "AI Workshop"** (override with `GCAL_EVENT_MATCH`). So: name the session event something like **"AI Workshop, local LLMs"** and invite people as guests. People click **Yes** in the invite → they show up under Coming.

## One-time setup

### 1. Google Cloud (5 min)
1. console.cloud.google.com → pick/create a project → **APIs & Services → Enable APIs → enable "Google Calendar API"**.
2. **Credentials → Create credentials → OAuth client ID → type: Web application**.
3. Under **Authorised redirect URIs** add: `http://localhost:5283/oauth2callback`
4. Copy the **Client ID** and **Client secret**.
5. OAuth consent screen: **User type = External**, add `baciauskas.aurimas@gmail.com` under **Test users**.
6. **Important, publish to Production.** While the app's publishing status is "Testing", Google expires refresh tokens after **7 days** (the Coming list would die weekly). After confirming auth works, click **Publish app** → "In production". `calendar.events.readonly` is a sensitive scope, so you'll see an "unverified app" warning on the consent screen, for personal use just click **Advanced → Go to (app)**. No verification submission needed.

### 2. Mint the refresh token (on your machine)
Create `.env.local` in the repo root (already gitignored):
```
GCAL_CLIENT_ID=<client id>
GCAL_CLIENT_SECRET=<client secret>
```
Then:
```
npm run google:auth
```
A browser opens, sign in as `baciauskas.aurimas@gmail.com` and approve. The terminal prints:
```
GCAL_REFRESH_TOKEN=1//0g...
```
Add that line to `.env.local` too. Now `npm run dev` shows the real Coming list.

### 3. Production (Vercel)
Add these to the Vercel project env (all environments), then redeploy:
- `GCAL_CLIENT_ID`
- `GCAL_CLIENT_SECRET`
- `GCAL_REFRESH_TOKEN`
- *(optional)* `GCAL_CALENDAR_ID`, defaults to `primary`
- *(optional)* `GCAL_EVENT_MATCH`, defaults to `AI Workshop`

## Architecture
- `api/_gcal.js`, refresh-token → access-token, `events.list` for the date, filter `responseStatus === 'accepted'`. Shared logic.
- `api/attendees.js`. Vercel serverless function → `GET /api/attendees?date=YYYY-MM-DD`.
- `vite.config.js` middleware + `server.js` mirror it for dev / self-host.
- `src/components/Attendees.jsx`, renders on the Next session card, maps guest names to member photos in `public/members` where they match.

## Notes
- Refresh tokens **expire after 7 days if the OAuth app is in "Testing"** publishing status, publish to Production (step 6) to make it long-lived. Otherwise it only dies if you revoke it at myaccount.google.com/permissions. If Coming ever stops loading, re-run `npm run google:auth`.
- Recurring event? `singleEvents=true` is used, so each date's instance and its guest list resolve correctly.
