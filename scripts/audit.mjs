// One command that runs every check and prints a single verdict.
//
//   npm run audit
//
// Each suite already exists on its own; the value here is that they need
// different things to be running and it is easy to run one against the wrong
// target and get a green that means nothing. This starts what each needs, points
// each at it, and refuses to report a pass it did not earn.
//
// The two targets, and why they differ:
//   preview (5281)  serves dist/, no API layer. Right for anything reading data
//                   baked in at build time.
//   dev     (5280)  the Vite server with the API middleware. Required for polls,
//                   which 404 on preview and would render an empty list that
//                   every assertion then passes against.

import { spawn, spawnSync } from 'node:child_process';

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = 'http://127.0.0.1:5281';
const DEV = 'http://127.0.0.1:5280';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUITES = [
  { name: 'identity', script: 'identity-check.mjs', needs: null },
  { name: 'guard', script: 'guard-check.mjs', needs: null },
  { name: 'csp', script: 'csp-check.mjs', needs: 'dist' },
  { name: 'smoke', script: 'smoke.mjs', needs: 'preview' },
  { name: 'theme', script: 'theme-check.mjs', needs: 'preview' },
  { name: 'history', script: 'history-check.mjs', needs: 'preview' },
  { name: 'shell', script: 'shell-check.mjs', needs: 'preview' },
  { name: 'lightbox', script: 'lightbox-check.mjs', needs: 'preview' },
  { name: 'members', script: 'members-check.mjs', needs: 'preview' },
  { name: 'news', script: 'news-check.mjs', needs: 'preview' },
  { name: 'polls', script: 'polls-check.mjs', needs: 'dev' },
];

async function reachable(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const r = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

async function waitUntil(url, seconds = 30) {
  for (let i = 0; i < seconds * 4; i++) {
    if (await reachable(url)) return true;
    await sleep(250);
  }
  return false;
}

const started = [];
function start(cmd, args) {
  const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
  started.push(p);
  return p;
}

console.log('audit: preparing targets\n');

// ALWAYS rebuild. This used to build only when dist/index.html was missing, which
// made the audit quietly test whatever was last built: a members change reported
// "21 cards, data says 23", read exactly like a filtering bug, and was a stale
// dist. An audit that can pass against code you did not write is worse than no
// audit. The build costs a few seconds; a false green costs an hour.
console.log('  building dist/ (csp and preview both need it)');
{
  const r = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error('  build failed'); process.exit(1); }
}

let previewUp = await reachable(PREVIEW);
if (!previewUp) {
  start('npx', ['vite', 'preview', '--port', '5281', '--host', '127.0.0.1']);
  previewUp = await waitUntil(PREVIEW);
}
console.log(`  preview ${previewUp ? 'up' : 'UNAVAILABLE'} at ${PREVIEW}`);

// The dev server is the user's; never start or stop one, just report.
const devUp = await reachable(DEV);
console.log(`  dev     ${devUp ? 'up' : 'not running'} at ${DEV}`);
console.log('');

const results = [];
for (const s of SUITES) {
  const target = s.needs === 'preview' ? PREVIEW : s.needs === 'dev' ? DEV : null;
  if (s.needs === 'preview' && !previewUp) { results.push([s.name, 'SKIP', 'preview unavailable']); continue; }
  if (s.needs === 'dev' && !devUp) { results.push([s.name, 'SKIP', 'dev server not running, start it with npm run dev']); continue; }
  const args = [join('scripts', s.script)];
  if (target) args.push(target);
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const summary = out.trim().split('\n').filter(Boolean).pop() || '(no output)';
  results.push([s.name, r.status === 0 ? 'PASS' : 'FAIL', summary.trim()]);
}

for (const p of started) { try { p.kill(); } catch { /* ignore */ } }

console.log('audit results\n');
const pad = Math.max(...results.map(([n]) => n.length));
for (const [name, status, detail] of results) {
  const mark = status === 'PASS' ? 'ok  ' : status === 'SKIP' ? '--  ' : 'FAIL';
  console.log(`  ${mark} ${name.padEnd(pad)}  ${detail}`);
}

const failed = results.filter(([, s]) => s === 'FAIL');
const skipped = results.filter(([, s]) => s === 'SKIP');
console.log('');
if (failed.length) {
  console.log(`AUDIT FAIL · ${failed.length} suite(s) failed${skipped.length ? `, ${skipped.length} skipped` : ''}`);
  process.exit(1);
}
if (skipped.length) {
  // A skip is not a pass. Saying so is the whole point of this script.
  console.log(`AUDIT INCOMPLETE · ${results.length - skipped.length} passed, ${skipped.length} skipped`);
  process.exit(2);
}
console.log(`AUDIT PASS · all ${results.length} suites`);
