// Covers the app shell and the archive timeline, the three plan items that had
// no suite of their own:
//
//   1.3   the sticky header lifts only once the page has scrolled
//   1.10  the print stylesheet strips app chrome and the cream ground
//   8.8   the Sessions archive renders a timeline carrying the recorded gaps
//
// It also covers the Download assets footer page: every brand file it advertises
// has to actually exist and actually download, or the page is worse than absent.
//
//   node scripts/shell-check.mjs [baseUrl]
//
// The print rules are asserted through Emulation.setEmulatedMedia rather than a
// real print job: a @media print block that nobody exercises is a block that
// silently rots the next time a class is renamed.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9446);
const PROFILE = `${process.env.TEMP || '/tmp'}/chrome-shell-${process.pid}`;

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

let pass = 0;
const fails = [];
const check = (label, cond, detail = '') => {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  FAIL ${label}${detail ? `, ${detail}` : ''}`); }
};

const header = () => evalJs(`(() => {
  const h = document.querySelector('header');
  return { cls: h.className, shadow: getComputedStyle(h).boxShadow, display: getComputedStyle(h).display };
})()`);

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  // Desktop: the header shadow is not viewport-dependent, but the timeline and
  // the nav both have mobile variants and this keeps one shape under test.
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  // ---- 1.3 header shadow on scroll
  await send('Page.navigate', { url: `${BASE}/#home` });
  await sleep(2600);
  const atTop = await header();
  check('at the top the header carries no shadow',
    !/is-scrolled/.test(atTop.cls) && (atTop.shadow === 'none' || atTop.shadow === ''),
    `shadow="${atTop.shadow}"`);

  await evalJs(`window.scrollTo({ top: 600, behavior: 'instant' }); true`);
  await sleep(500);
  const scrolled = await header();
  check('scrolled, the header gains .is-scrolled and a real shadow',
    /is-scrolled/.test(scrolled.cls) && scrolled.shadow !== 'none' && scrolled.shadow !== '',
    `cls="${scrolled.cls}" shadow="${scrolled.shadow}"`);

  await evalJs(`window.scrollTo({ top: 0, behavior: 'instant' }); true`);
  await sleep(500);
  const backAtTop = await header();
  check('back at the top the shadow goes away again', !/is-scrolled/.test(backAtTop.cls), `cls="${backAtTop.cls}"`);

  // ---- 1.10 print
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(400);
  const printed = await evalJs(`(() => {
    const cs = getComputedStyle(document.body);
    const h = document.querySelector('header');
    const sticky = [...document.querySelectorAll('*')].filter((el) => {
      const p = getComputedStyle(el).position;
      return p === 'sticky' || p === 'fixed';
    }).length;
    return {
      header: getComputedStyle(h).display,
      bg: cs.backgroundColor,
      color: cs.color,
      sticky,
    };
  })()`);
  check('print hides the app header', printed.header === 'none', `display="${printed.header}"`);
  check('print flattens the ground to white and the text to black',
    /rgb\(255,\s*255,\s*255\)/.test(printed.bg) && /rgb\(0,\s*0,\s*0\)/.test(printed.color),
    `bg="${printed.bg}" color="${printed.color}"`);
  check('nothing is sticky or fixed on paper, which would repeat per page',
    printed.sticky === 0, `${printed.sticky} element(s) still positioned`);
  await send('Emulation.setEmulatedMedia', { media: '' });
  await sleep(200);
  const afterPrint = await header();
  check('leaving print restores the header on screen', afterPrint.display !== 'none', `display="${afterPrint.display}"`);

  // ---- 8.8 archive timeline
  await send('Page.navigate', { url: `${BASE}/#sessions` });
  await sleep(3200);
  const toggle = await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Timeline/.test(b.textContent) && b.hasAttribute('aria-expanded'));
    if (!btn) return { found: false };
    const before = document.querySelectorAll('ol li').length;
    const summary = btn.textContent.replace(/\\s+/g, ' ').trim();
    btn.click();
    return { found: true, summary, before };
  })()`);
  check('the Sessions tab renders a Timeline panel', toggle.found, JSON.stringify(toggle));
  if (!toggle.found) throw new Error('no timeline toggle');
  check('the collapsed panel summarises the span and the gap count',
    /\d+ sessions/.test(toggle.summary) && /recorded gap/.test(toggle.summary), `summary="${toggle.summary}"`);
  check('it is collapsed until asked, so the photo grid stays above the fold',
    toggle.before === 0, `${toggle.before} rows rendered while collapsed`);
  await sleep(500);
  // Read after the render, not in the same tick as the click: React had not yet
  // written the new attribute when this was asserted inline, and the suite
  // reported a component bug that did not exist.
  const expanded = await evalJs(`[...document.querySelectorAll('button')].find((b) => /Timeline/.test(b.textContent) && b.hasAttribute('aria-expanded')).getAttribute('aria-expanded')`);
  check('the toggle reports its state', expanded === 'true', `aria-expanded="${expanded}"`);

  const rail = await evalJs(`(() => {
    const lis = [...document.querySelectorAll('ol li')];
    const text = lis.map((l) => l.textContent.replace(/\\s+/g, ' ').trim());
    const dates = lis.map((l) => l.querySelector('.num')).map((e) => (e ? e.textContent.trim() : null)).filter(Boolean);
    return {
      rows: lis.length,
      gaps: text.filter((t) => /^Unlogged,/.test(t)),
      first: text[0] || null,
      last: text[text.length - 1] || null,
      dates,
    };
  })()`);
  check('every session is on the rail, plus one row per recorded gap',
    rail.rows === 10 && rail.gaps.length === 1, `rows=${rail.rows} gaps=${rail.gaps.length}`);
  check('the gap names its window and its reason',
    /Unlogged, Feb 2026 to Apr 2026/.test(rail.gaps[0] || '') , `gap="${rail.gaps[0]}"`);
  check('the rail runs oldest first', /29 Jun/.test(rail.first || '') && /30 Aug/.test(rail.last || ''),
    `first="${rail.first}" last="${rail.last}"`);

  const opened = await evalJs(`(() => {
    const li = [...document.querySelectorAll('ol li')].find((l) => l.querySelector('button'));
    li.querySelector('button').click();
    return true;
  })()`);
  await sleep(900);
  const routed = await evalJs(`location.hash`);
  check('a timeline row opens that session recap', opened && /^#recap\/\d{4}-\d{2}-\d{2}$/.test(routed), `hash="${routed}"`);

  // ---- Download assets, the footer page
  await send('Page.navigate', { url: `${BASE}/#home` });
  await sleep(2600);
  const fromFooter = await evalJs(`(() => {
    const btn = [...document.querySelectorAll('footer button')].find((b) => /Download assets/.test(b.textContent));
    if (!btn) return { found: false };
    btn.click();
    return { found: true };
  })()`);
  check('the footer carries a Download assets link', fromFooter.found);
  await sleep(1600);
  const assets = await evalJs(`(() => {
    const links = [...document.querySelectorAll('a[download]')];
    const imgs = [...document.querySelectorAll('main img')];
    return {
      hash: location.hash,
      title: document.title,
      h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : null,
      links: links.length,
      sameOrigin: links.every((a) => a.href.startsWith(location.origin)),
      named: links.every((a) => /^ai-sundays-[a-z0-9-]+\.(svg|png|webp)$/.test(a.getAttribute('download') || '')),
      labelled: links.every((a) => (a.getAttribute('aria-label') || a.textContent).trim().length > 3),
      imgs: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      swatches: [...document.querySelectorAll('button[aria-label^="Copy "]')].length,
      hexes: [...document.querySelectorAll('button[aria-label^="Copy "]')]
        .map((b) => (b.getAttribute('aria-label').match(/#[0-9A-Fa-f]{6}/) || [null])[0]),
    };
  })()`);
  check('it routes to #assets', assets.hash === '#assets', `hash="${assets.hash}"`);
  check('the page titles itself, not the tab it came from',
    /Download assets/.test(assets.title) && assets.h1 === 'Download assets', `title="${assets.title}" h1="${assets.h1}"`);
  check('every brand file is offered as a real download',
    assets.links === 14 && assets.sameOrigin && assets.named,
    `links=${assets.links} sameOrigin=${assets.sameOrigin} named=${assets.named}`);
  check('every download control has an accessible name', assets.labelled === true);
  check('no preview image is broken', assets.imgs > 0 && assets.broken === 0,
    `imgs=${assets.imgs} broken=${assets.broken}`);
  check('the locked palette renders as copyable swatches',
    assets.swatches === 8 && assets.hexes.every(Boolean), `swatches=${assets.swatches}`);

  const backHome = await evalJs(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => /^Back$/.test(b.textContent.trim()));
    if (!btn) return null;
    btn.click();
    return true;
  })()`);
  await sleep(900);
  const homeHash = await evalJs(`location.hash`);
  check('Back returns to Home', backHome === true && homeHash === '#home', `hash="${homeHash}"`);
} catch (e) {
  fails.push(`threw: ${e.message}`);
  console.log(`\n  ERROR ${e.message}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(`\n${fails.length ? 'SHELL FAIL' : 'SHELL PASS'} · ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
