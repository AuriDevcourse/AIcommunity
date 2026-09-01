// Checks the Members tab: search, the sort control, the organiser badge and the
// attendance counts.
//
//   node scripts/members-check.mjs [baseUrl]
//
// The data is baked into src/data.json at build time, so this runs fine against
// vite preview; no API layer is involved.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import data from '../src/data.json' with { type: 'json' };

const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9444);
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-members-${process.pid}`;

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

async function waitFor(expr, what) {
  for (let i = 0; i < 60; i++) {
    if (await evalJs(expr)) return true;
    await sleep(200);
  }
  console.log(`  --   timed out waiting for ${what}`);
  return false;
}

/** Set the search box through React's own setter so onChange fires. */
async function search(text) {
  await evalJs(`(() => {
    const el = document.getElementById('member-search');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(350);
}

const cardNames = () => evalJs(`[...document.querySelectorAll('.grid > div')].map(c => (c.querySelector('.font-semibold')?.textContent || '').trim()).filter(Boolean)`);

const clickSort = async (label) => {
  await evalJs(`(() => {
    const g = document.querySelector('[role="group"][aria-labelledby="member-sort-label"]');
    [...g.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click();
    return true;
  })()`);
  await sleep(300);
};

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
  await send('Page.navigate', { url: `${BASE}/#members` });
  await waitFor(`document.getElementById('member-search') !== null`, 'the members tab');
  await sleep(400);

  // Counts come from the data, not a literal. The roster changes (Roman joined
  // at #09) and a hardcoded 20 turns that into a red suite for no reason.
  const expected = data.members.length;
  const all = await cardNames();
  check('every member renders', all.length === expected, `${all.length} cards, data says ${expected}`);
  check('no Unknown placeholder cards', !all.some((n) => /^Unknown/.test(n)), all.filter((n) => /Unknown/.test(n)).join(', '));
  check('the three previously invisible members render',
    ['Andrei Prusu', 'Pavel Kucera', 'Ernestas Sažinas'].every((n) => all.includes(n)),
    all.join(', '));

  // Read the expectation from the data rather than hardcoding a number: the
  // badge count is a product decision that changes (Auri removed his own).
  const expectedOrganisers = data.members.filter((m) => m.status === 'Organizer').length;
  const renderedOrganisers = await evalJs(`[...document.querySelectorAll('.grid span')].filter(s => s.textContent.trim() === 'Organiser').length`);
  check('organiser badges match the data', renderedOrganisers === expectedOrganisers,
    `rendered ${renderedOrganisers}, data says ${expectedOrganisers}`);
  // Attendance counts were REMOVED from the member cards on 2026-09-01: how often
  // someone turns up is not a standing worth publishing next to their name. Assert
  // they are gone, so nobody reinstates them by accident.
  check('no attendance count is published on a member card',
    await evalJs(`[...document.querySelectorAll('.grid span')].filter(s => /^\\d+ sessions?$/.test(s.textContent.trim())).length`) === 0);

  // Search
  await search('auri');
  const auri = await cardNames();
  check('searching an alias finds the member', auri.length === 1 && /Aurimas/.test(auri[0]), auri.join(', '));

  await search('perednyte');
  const dov = await cardNames();
  check('searching a display-name surname works', dov.length === 1 && /Dovile/.test(dov[0]), dov.join(', '));

  await search('zzzznobody');
  check('an empty result shows a message, not a blank grid',
    await evalJs(`/Nobody matches/.test(document.body.innerText)`));

  await search('');
  check('clearing the search restores everyone', (await cardNames()).length === expected);

  // Sort
  await clickSort('Name');
  const byName = await cardNames();
  const sortedCopy = [...byName].sort((a, b) => a.localeCompare(b));
  check('Name sorts alphabetically', JSON.stringify(byName) === JSON.stringify(sortedCopy), byName.slice(0, 3).join(', '));

  // The Sessions sort went with the counts: it ranked people by attendance.
  check('there is no Sessions sort option',
    await evalJs(`[...document.querySelectorAll('[role="group"][aria-labelledby="member-sort-label"] button')].map(b => b.textContent.trim()).join(",")`) === 'Featured,Name');

  check('the sort control reports which option is pressed',
    await evalJs(`[...document.querySelectorAll('[role="group"][aria-labelledby="member-sort-label"] button')].filter(b => b.getAttribute('aria-pressed') === 'true').length`) === 1);

  check('a removal note is present', await evalJs(`/To be removed/.test(document.body.innerText)`));
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'MEMBERS FAIL' : 'MEMBERS PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
