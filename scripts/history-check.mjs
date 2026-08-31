// Proves the browser Back and Forward buttons move between tabs.
//
//   node scripts/history-check.mjs [baseUrl]
//
// Tab changes used to be written with history.replaceState, so no history entry
// was ever created and Back walked out of the site entirely. This drives real
// Page.navigateToHistoryEntry calls, not a synthetic popstate, so it fails if the
// entries are not really there.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9422);
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-history-${process.pid}`;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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

const hash = () => evalJs('location.hash');
const activeTab = () => evalJs(`(document.querySelector('nav a[aria-current="page"], nav button[aria-current="page"]')?.textContent || '').trim()`);

/** Click a top-nav tab by its visible label. */
async function clickTab(label) {
  const ok = await evalJs(`(() => {
    const els = [...document.querySelectorAll('nav a, nav button')];
    const el = els.find((e) => e.textContent.trim() === ${JSON.stringify(label)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`no nav item labelled ${label}`);
  await sleep(320);
}

/** Real Back / Forward, driven through the browser's own history list. */
async function go(delta) {
  const { currentIndex, entries } = await send('Page.getNavigationHistory');
  const target = entries[currentIndex + delta];
  if (!target) throw new Error(`no history entry at offset ${delta}`);
  await send('Page.navigateToHistoryEntry', { entryId: target.id });
  await sleep(400);
}

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
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(2200);

  const startEntries = (await send('Page.getNavigationHistory')).entries.length;
  check('lands on home', (await hash()) === '' || (await hash()) === '#home', `hash=${await hash()}`);

  await clickTab('Learn');
  check('Learn is active', (await hash()) === '#learn', `hash=${await hash()}`);

  await clickTab('News');
  check('News is active', (await hash()) === '#news', `hash=${await hash()}`);

  const afterEntries = (await send('Page.getNavigationHistory')).entries.length;
  check('two tab clicks added two history entries', afterEntries - startEntries === 2,
    `${startEntries} -> ${afterEntries}`);

  await go(-1);
  check('Back returns to Learn', (await hash()) === '#learn', `hash=${await hash()}`);
  check('Back also updated the rendered tab', (await activeTab()) === 'Learn', `active=${await activeTab()}`);

  await go(-1);
  const h = await hash();
  check('Back again returns to home, still inside the app', h === '' || h === '#home', `hash=${h}`);

  await go(1);
  check('Forward returns to Learn', (await hash()) === '#learn', `hash=${await hash()}`);
  check('Forward also updated the rendered tab', (await activeTab()) === 'Learn', `active=${await activeTab()}`);

  // Loading straight into a tab must not add a spurious entry.
  await send('Page.navigate', { url: `${BASE}/#tools` });
  await sleep(1800);
  const before = (await send('Page.getNavigationHistory')).entries.length;
  await sleep(500);
  const after = (await send('Page.getNavigationHistory')).entries.length;
  check('a deep link adds no extra entry of its own', after === before, `${before} -> ${after}`);
  check('the deep link renders its tab', (await hash()) === '#tools', `hash=${await hash()}`);
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'HISTORY FAIL' : 'HISTORY PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
