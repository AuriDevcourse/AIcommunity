// Verifies the recap photo lightbox is actually operable on a phone.
//
//   node scripts/lightbox-check.mjs [baseUrl]
//
// The side arrows are `hidden sm:flex`, so before the bottom bar existed a touch
// viewer could open a session's photos and never reach the second one. This opens
// the lightbox at 390px, checks the controls are visible, and pages with both a
// tap and a swipe.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';
const RECAP = process.env.RECAP_DATE || '2025-07-27'; // 12 photos
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9411);
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-lightbox-${process.pid}`;

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

// A real touch sequence, so the component's own touch handlers run.
async function swipe(fromX, toX, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (fromX + toX) / 2, y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: toX, y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(350);
}

let pass = 0;
const fails = [];
const check = (label, cond, detail = '') => {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  FAIL ${label}${detail ? `, ${detail}` : ''}`); }
};

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  await send('Page.navigate', { url: `${BASE}/#recap/${RECAP}` });
  await sleep(2600);

  const opened = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button[aria-label^="Open photo"]')];
    if (!b.length) return { ok: false, reason: 'no photo thumbnails found' };
    b[0].click();
    return { ok: true, count: b.length };
  })()`);
  check('recap page renders photo thumbnails', opened.ok, opened.reason);
  if (!opened.ok) throw new Error(opened.reason);
  await sleep(500);

  const state = () => evalJs(`(() => {
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const q = (s) => document.querySelector(s);
    const counter = [...document.querySelectorAll('span')].find((e) => /^\\d+ \\/ \\d+$/.test(e.textContent.trim()));
    const img = q('img[alt^="Session photo"]');
    return {
      open: Boolean(img),
      href: location.hash,
      alt: img?.getAttribute('alt') || null,
      src: img?.getAttribute('src') || null,
      counter: counter ? counter.textContent.trim() : null,
      prevVisible: vis(q('button[aria-label="Previous photo"]')),
      nextVisible: vis(q('button[aria-label="Next photo"]')),
      sideArrowVisible: vis(q('button[aria-label="Previous"]')) || vis(q('button[aria-label="Next"]')),
    };
  })()`);

  const s1 = await state();
  check('lightbox opened', s1.open);
  check('photo has descriptive alt text', /^Session photo \d+ of \d+$/.test(s1.alt || ''), `alt="${s1.alt}"`);
  check('counter is shown', /^1 \/ \d+$/.test(s1.counter || ''), `counter="${s1.counter}"`);
  check('touch prev/next controls are visible at 390px', s1.prevVisible && s1.nextVisible,
    `prev=${s1.prevVisible} next=${s1.nextVisible}`);
  check('desktop side arrows stay hidden at 390px', !s1.sideArrowVisible);

  // Tap "next".
  await evalJs(`document.querySelector('button[aria-label="Next photo"]').click()`);
  await sleep(350);
  const s2 = await state();
  check('tapping next advances the photo', s2.counter === `2 / ${s1.counter.split('/')[1].trim()}` && s2.src !== s1.src,
    `counter="${s2.counter}"`);

  // Swipe left → forward.
  await swipe(300, 120, 420);
  const s3 = await state();
  check('swiping left advances the photo', s3.open && s3.src !== s2.src, `open=${s3.open} counter="${s3.counter}"`);

  // Swipe right → back.
  await swipe(120, 300, 420);
  const s4 = await state();
  check('swiping right goes back', s4.open && s4.src === s2.src, `open=${s4.open} counter="${s4.counter}"`);
  check('a swipe never dismisses the lightbox', s4.open, 'the overlay closed mid-gesture');

  // A mostly-vertical drag must not page.
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230, y: 600 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  const s5 = await state();
  check('a vertical drag does not change the photo', s5.open && s5.src === s4.src, `open=${s5.open} counter="${s5.counter}"`);

  // A right-swipe from the left edge is the platform's back gesture. The overlay
  // claims horizontal drags (touch-action: pan-y), so it must page the photo
  // instead of navigating away from the recap route.
  const beforeEdge = await state();
  await swipe(8, 240, 420);
  const sEdge = await state();
  check('an edge swipe pages the photo instead of navigating back',
    sEdge.open && sEdge.href === beforeEdge.href,
    `open=${sEdge.open} hash="${sEdge.href}"`);

  // A genuine tap on the backdrop must still dismiss it. (The bottom nav bar
  // swallows its own taps, so aim at the gutter beside the photo.)
  // Dismissing is a separate, deliberate action, so let the gesture's own
  // suppression window lapse first.
  await sleep(600);
  // A real click: CDP touch events do not synthesise one, and click-to-dismiss is
  // what we are asserting.
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: 6, y: 200, button: 'left', clickCount: 1 });
  }
  await sleep(350);
  const s6 = await state();
  check('a tap on the backdrop still closes it', !s6.open);
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'LIGHTBOX FAIL' : 'LIGHTBOX PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
