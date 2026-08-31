// Proves the Content-Security-Policy in vercel.json does not break the built app.
//
//   npm run build && node scripts/csp-check.mjs
//
// Neither `vite dev` nor `vite preview` applies vercel.json, so the policy that
// actually ships is never exercised locally. This serves dist/ with the real
// headers from vercel.json, walks every route, and fails on any violation.
//
// It matters because the policy was Report-Only with no report-uri for months:
// it neither blocked nor reported, so nothing would have surfaced a mistake in it.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.CSP_PORT || 5399);
const CDP = Number(process.env.CDP_PORT || 9499);
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-csp-${process.pid}`;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html missing. Run npm run build first.');
  process.exit(1);
}

// The headers vercel.json applies to every path.
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const siteHeaders = vercel.headers.find((h) => h.source === '/(.*)').headers;
const csp = siteHeaders.find((h) => h.key.startsWith('Content-Security-Policy'));
if (!csp) { console.error('no CSP in vercel.json'); process.exit(1); }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = join(DIST, url);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  for (const h of siteHeaders) res.setHeader(h.key, h.value);
  res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.onmessage = (m) => {
          const msg = JSON.parse(m.data);
          if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        };
        return;
      }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('could not attach to Chrome');
}

const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, (msg) => (msg.error ? rej(new Error(msg.error.message)) : res(msg.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

const ROUTES = ['home', 'discussions', 'learn', 'news', 'members', 'sessions', 'tools', 'privacy', 'terms', 'accessibility'];

let pass = 0;
const fails = [];
const check = (label, cond, detail = '') => {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');

  check('the policy is enforced, not Report-Only', csp.key === 'Content-Security-Policy',
    `header is ${csp.key}`);

  // A Report-Only policy with no report-uri is the state this check exists to
  // prevent: it neither blocks nor reports, so it protects nothing.
  if (csp.key.endsWith('Report-Only')) {
    check('a Report-Only policy names a report-uri', /report-uri|report-to/.test(csp.value),
      'without one it neither blocks nor reports');
  }

  // The listener has to exist BEFORE the document starts loading, or every
  // violation raised during load happens with nothing listening. Attaching it
  // after navigate and then reloading (the obvious approach) wipes the listener
  // with the document, which is how the first version of this check reported a
  // clean pass while api.dicebear.com was deliberately blocked.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push({
        directive: e.effectiveDirective, blocked: e.blockedURI,
      }));
    `,
  });

  const violations = [];
  for (const route of ROUTES) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/#${route}` });
    await sleep(2000);
    const found = await evalJs('JSON.stringify(window.__csp || [])');
    for (const v of JSON.parse(found)) violations.push({ ...v, route });
  }

  const unique = [...new Map(violations.map((v) => [`${v.directive}|${v.blocked}`, v])).values()];
  check(`no CSP violations across ${ROUTES.length} routes`, unique.length === 0,
    unique.map((v) => `${v.directive} blocked ${v.blocked}`).join('; '));

  // The other headers are worth asserting too, since they ship from the same block.
  const want = ['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options',
    'Permissions-Policy', 'Strict-Transport-Security', 'Cross-Origin-Opener-Policy'];
  const have = siteHeaders.map((h) => h.key);
  check('the other security headers are all present', want.every((w) => have.includes(w)),
    want.filter((w) => !have.includes(w)).join(', '));
  check('frame-ancestors is set', /frame-ancestors/.test(csp.value));
  check('object-src is locked down', /object-src 'none'/.test(csp.value));
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  server.close();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'CSP FAIL' : 'CSP PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
