// One-time helper to mint a Google Calendar refresh token for the session
// organiser account. Run once on your machine:
//
//   1) In Google Cloud Console, create an OAuth 2.0 Client ID (type: Web app).
//      Add  http://localhost:5283/oauth2callback  as an authorised redirect URI.
//      Enable the Google Calendar API for the project. Add your personal Gmail
//      as a Test user on the OAuth consent screen (if the app is in Testing).
//   2) Put the client id/secret in .env.local:
//        GCAL_CLIENT_ID=...
//        GCAL_CLIENT_SECRET=...
//   3) Run:  npm run google:auth, sign in as baciauskas.aurimas@gmail.com.
//   4) Copy the printed GCAL_REFRESH_TOKEN into .env.local AND your Vercel env.
//
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 5283;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

// minimal .env.local loader (so client id/secret don't need to be exported)
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const CLIENT_ID = process.env.GCAL_CLIENT_ID;
const CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GCAL_CLIENT_ID / GCAL_CLIENT_SECRET. Add them to .env.local first (see header of this file).');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });

const server = createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) { res.writeHead(404); res.end(); return; }
  const code = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('code');
  if (!code) { res.writeHead(400); res.end('No code'); return; }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT, grant_type: 'authorization_code',
      }),
    });
    const j = await r.json();
    if (!j.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('No refresh_token returned. Revoke the app at myaccount.google.com/permissions and run again (needs prompt=consent).');
      console.error('\nNo refresh_token in response:', j);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Success. Refresh token printed in your terminal, you can close this tab.');
      console.log('\n=== Add this to .env.local and your Vercel project env ===\n');
      console.log(`GCAL_REFRESH_TOKEN=${j.refresh_token}\n`);
    }
  } catch (e) {
    res.writeHead(500); res.end('Error: ' + e.message);
    console.error(e);
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 500);
  }
});

server.listen(PORT, () => {
  console.log('\nOpen this URL and sign in as the session organiser (baciauskas.aurimas@gmail.com):\n');
  console.log(authUrl + '\n');
  // Windows: the URL must be double-quoted or cmd.exe treats its '&' separators as
  // command chaining and drops every param after the first (response_type missing).
  // The '""' is start's required (empty) window-title arg.
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '""', `"${authUrl}"`], { detached: true, stdio: 'ignore' });
  }
});
