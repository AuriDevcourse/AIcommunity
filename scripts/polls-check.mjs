// Checks the Area 5 poll work in a real browser.
//
//   node scripts/polls-check.mjs [baseUrl]
//
// Covers the accessibility and navigation items, which are the ones easiest to
// break silently: radiogroup semantics, roving tabindex, arrow-key selection,
// the polite live region, the sort control and the #poll/<id> deep link.
// Voting itself needs a signed-in session, so it is not exercised here.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

// The dev server, NOT vite preview: preview serves dist with no API layer, so
// /api/polls 404s, the list renders empty and every check below silently passes
// against nothing.
const BASE = process.argv[2] || process.env.POLLS_URL || 'http://127.0.0.1:5280';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9433);
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-polls-${process.pid}`;

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

const key = async (k) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: { ArrowDown: 40, ArrowUp: 38, Home: 36, End: 35 }[k] });
  }
  await sleep(180);
};

/** Poll the page until `expr` is true, up to ~12s. */
async function waitFor(expr, what) {
  for (let i = 0; i < 60; i++) {
    if (await evalJs(expr)) return true;
    await sleep(200);
  }
  console.log(`  --   timed out waiting for ${what}`);
  return false;
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
  await send('Page.navigate', { url: `${BASE}/#discussions` });
  // Wait for a poll card rather than sleeping a fixed amount. The Forum is a lazy
  // chunk AND the list comes from Upstash, so a flat 3s was sometimes short and
  // the whole suite then "passed" against an empty page.
  await waitFor(`document.querySelector('[id^="poll-"]') !== null`, 'a poll card to render');

  const info = await evalJs(`(() => {
    const card = document.querySelector('[id^="poll-"]');
    const group = card ? card.querySelector('[role="radiogroup"], [role="group"]') : null;
    const opts = group ? [...group.querySelectorAll('[role="radio"], [role="checkbox"]')] : [];
    return {
      hasCard: Boolean(card),
      hasGroup: Boolean(group),
      groupRole: group?.getAttribute('role') || null,
      groupNamed: Boolean(group?.getAttribute('aria-label')),
      count: opts.length,
      tabindexes: opts.map((o) => o.tabIndex),
      checked: opts.map((o) => o.getAttribute('aria-checked')),
      liveRegions: document.querySelectorAll('[aria-live="polite"]').length,
      shareButtons: document.querySelectorAll('button[aria-label^="Copy a link to the poll"]').length,
    };
  })()`);

  check('a poll card is on screen', info.hasCard, 'no [id^="poll-"] found; is the API layer up?');
  check('options sit in a radiogroup or group', info.hasGroup, `role=${info.groupRole}`);
  check('the group has an accessible name', info.groupNamed);
  check('options expose a radio/checkbox role', info.count > 0, `found ${info.count}`);
  check('every option reports aria-checked', info.checked.every((c) => c === 'true' || c === 'false'),
    JSON.stringify(info.checked));
  check('a polite live region exists', info.liveRegions >= 1, `found ${info.liveRegions}`);
  check('each poll offers a share link', info.shareButtons > 0, `found ${info.shareButtons}`);

  if (info.groupRole === 'radiogroup') {
    check('exactly one tab stop in the group (roving tabindex)',
      info.tabindexes.filter((t) => t === 0).length === 1, JSON.stringify(info.tabindexes));

    // Focus the group's tab stop, then walk it with the keyboard.
    await evalJs(`(() => {
      const g = document.querySelector('[id^="poll-"] [role="radiogroup"]');
      const el = [...g.querySelectorAll('[role="radio"]')].find((o) => o.tabIndex === 0);
      el.focus();
      return true;
    })()`);
    const first = await evalJs(`document.activeElement?.id || ''`);
    await key('ArrowDown');
    const second = await evalJs(`document.activeElement?.id || ''`);
    check('ArrowDown moves focus to the next option', second && second !== first, `${first} -> ${second}`);
    check('ArrowDown also selects it, as a radio group does',
      await evalJs(`document.activeElement?.getAttribute('aria-checked') === 'true'`));

    await key('Home');
    const atHome = await evalJs(`document.activeElement?.id || ''`);
    check('Home jumps to the first option', atHome === first, `${atHome} vs ${first}`);

    await key('End');
    const atEnd = await evalJs(`(() => {
      const g = document.querySelector('[id^="poll-"] [role="radiogroup"]');
      const opts = [...g.querySelectorAll('[role="radio"]')];
      return document.activeElement === opts[opts.length - 1];
    })()`);
    check('End jumps to the last option', atEnd);
  } else {
    console.log('  --   multi-select poll on screen, skipping the radio-specific checks');
  }

  // Sort control only renders with more than one poll.
  const sort = await evalJs(`(() => {
    const g = document.querySelector('[role="group"][aria-labelledby="poll-sort-label"]');
    if (!g) return { present: false };
    const b = [...g.querySelectorAll('button')];
    return { present: true, labels: b.map((x) => x.textContent.trim()), pressed: b.map((x) => x.getAttribute('aria-pressed')) };
  })()`);
  if (sort.present) {
    check('sort control exposes pressed state', sort.pressed.filter((p) => p === 'true').length === 1,
      JSON.stringify(sort.pressed));
  } else {
    console.log('  --   fewer than two polls, sort control not rendered');
  }

  // Deep link.
  const pollId = await evalJs(`(() => {
    const el = document.querySelector('[id^="poll-"]');
    return el ? el.id.replace(/^poll-/, '') : '';
  })()`);
  if (pollId) {
    await send('Page.navigate', { url: `${BASE}/#poll/${encodeURIComponent(pollId)}` });
    await waitFor(`document.getElementById('poll-' + ${JSON.stringify(pollId)}) !== null`, 'the shared poll');
    await sleep(400); // let the highlight class land
    const deep = await evalJs(`(() => {
      const el = document.getElementById('poll-' + ${JSON.stringify(pollId)});
      return { onForum: location.hash.startsWith('#poll/'), rendered: Boolean(el), highlighted: Boolean(el && el.className.includes('ring-2')) };
    })()`);
    check('#poll/<id> renders the Forum with that poll present', deep.rendered, JSON.stringify(deep));
    check('#poll/<id> highlights the shared poll', deep.highlighted, JSON.stringify(deep));
  } else {
    console.log('  --   no poll on screen, deep link not exercised');
  }
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'POLLS FAIL' : 'POLLS PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
