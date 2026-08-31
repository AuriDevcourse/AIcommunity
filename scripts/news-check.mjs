// Checks the News tab: search, the sticky filter bar, keyboard-navigable chips,
// reading time and source counts, and the last-reviewed line.
//
//   node scripts/news-check.mjs [baseUrl]
//
// news.json is bundled at build time, so vite preview is fine here.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9466);
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-news-${process.pid}`;

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
  for (let i = 0; i < 60; i++) { if (await evalJs(expr)) return true; await sleep(200); }
  console.log(`  --   timed out waiting for ${what}`);
  return false;
}

async function search(text) {
  await evalJs(`(() => {
    const el = document.getElementById('news-search');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(350);
}

const cardCount = () => evalJs(`document.querySelectorAll('article').length`);
const key = async (k) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35 }[k] });
  }
  await sleep(250);
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
  await send('Page.navigate', { url: `${BASE}/#news` });
  await waitFor(`document.getElementById('news-search') !== null`, 'the news tab');
  await sleep(400);

  const total = await cardCount();
  check('all stories render', total === 12, `${total} cards`);
  check('the last-reviewed line is shown', await evalJs(`/Last reviewed/.test(document.body.innerText)`));
  // Plain string checks, not a regex: a backslash inside a template literal
  // is an escape, so /\d+/ written there arrives as /d+/ and silently fails.
  const meta = await evalJs(`(() => {
    const s = [...document.querySelectorAll('article span')].map((x) => x.textContent).find((t) => t.includes('min'));
    return s || '';
  })()`);
  check('reading time renders', meta.includes('min'), JSON.stringify(meta));
  check('source count renders', /source/.test(meta), JSON.stringify(meta));
  check('the separator has spaces around it', !/·(?!\s)/.test(meta.replace(/\s+/g, ' ')) || / · /.test(meta.replace(/\s+/g, ' ')), JSON.stringify(meta));
  check('the filter bar is sticky',
    await evalJs(`(() => { const g = document.querySelector('[aria-label="Filter stories by region"]'); return g && getComputedStyle(g.parentElement.parentElement).position === 'sticky'; })()`));
  check('external links carry a visible affordance',
    await evalJs(`document.querySelectorAll('article a svg').length`) > 0);

  await search('deepseek');
  const few = await cardCount();
  check('search narrows the list', few > 0 && few < total, `${few} of ${total}`);

  await search('zzzznothing');
  check('an empty search result explains itself',
    await evalJs(`/Nothing matches/.test(document.body.innerText)`));

  await search('');
  check('clearing the search restores every story', (await cardCount()) === total);

  // Keyboard on the filter chips.
  await evalJs(`(() => {
    const g = document.querySelector('[aria-label="Filter stories by region"]');
    [...g.querySelectorAll('button')].find((b) => b.tabIndex === 0).focus();
    return true;
  })()`);
  const firstChip = await evalJs(`document.activeElement?.textContent.trim()`);
  await key('ArrowRight');
  const secondChip = await evalJs(`document.activeElement?.textContent.trim()`);
  check('ArrowRight moves between filter chips', secondChip && secondChip !== firstChip, `${firstChip} -> ${secondChip}`);
  check('moving also applies the filter',
    await evalJs(`document.activeElement?.getAttribute('aria-pressed') === 'true'`));
  check('the filtered list is smaller than all stories', (await cardCount()) < total);

  await key('Home');
  check('Home returns to the All chip', (await evalJs(`document.activeElement?.textContent.trim()`)) === firstChip);
  check('one tab stop across the chip set',
    await evalJs(`[...document.querySelectorAll('[aria-label="Filter stories by region"] button')].filter((b) => b.tabIndex === 0).length`) === 1);
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'NEWS FAIL' : 'NEWS PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
