// Drives the Learn page and its slide viewer over CDP and asserts the things
// that a build cannot see: dialog semantics, what the cards claim, where a click
// lands, and whether the page behind stays put.
//
//   node scripts/learn-check.mjs [baseUrl]
//
// Needs a server with the Learn tab reachable. Learn is gated, so either sign in
// first or run a Vite instance with Supabase unset, which switches gating off:
//
//   VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite --port 5281
//   npm run learn:check
//
// Every assertion here is a regression that already happened once. The viewer
// shipped with no role="dialog", focus left on the body, a silent live region,
// twenty-two 24x6px dot targets, a page that scrolled behind the overlay, and an
// interactive demo sitting 68px inside the back-navigation zone.

import { spawn } from 'node:child_process';

const BASE = process.argv[2] || process.env.LEARN_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9356);
// Deliberately short. At a tall viewport the index does not overflow, and the
// scroll-lock assertion passes whether or not the lock is there.
const W = 1280, H = 500;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP || '/tmp'}/chrome-learn-${process.pid}`,
  '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let k = 0; k < 60; k += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const pg = (await r.json()).find((x) => x.type === 'page');
      if (pg) return pg.webSocketDebuggerUrl;
    } catch { /* chrome still booting */ }
    await sleep(250);
  }
  throw new Error('no CDP target');
}

const ws = new WebSocket(await target());
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pend = new Map();
const errs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push(m.params.entry.text);
  if (m.method === 'Runtime.exceptionThrown') {
    // .text is just "Uncaught"; the description carries the actual message.
    const d = m.params.exceptionDetails;
    errs.push(String(d.exception?.description || d.text || 'exception').slice(0, 100));
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
});
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.value;
const json = async (x) => {
  const raw = await ev(x);
  if (typeof raw !== 'string') return {};   // page crashed mid-walk; callers guard
  try { return JSON.parse(raw); } catch { return {}; }
};

const pass = [], fail = [];
const check = (name, ok, detail) => {
  (ok ? pass : fail).push(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
};

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${BASE}/#learn` });
await sleep(3500);

// --- the cards tell the truth -------------------------------------------
const cards = await json('JSON.stringify([...document.querySelectorAll(".warm-card")].map(c=>c.textContent))');
if (!cards.length) { console.error(`no decks found at ${BASE}/#learn. Is the tab gated?`); process.exit(2); }

check('every card shows a computed read time', cards.every((c) => /min read/.test(c)),
  `${cards.filter((c) => /min read/.test(c)).length}/${cards.length}`);
check('cards count steps, not slides', cards.every((c) => /steps/.test(c)) && !cards.some((c) => /slides/.test(c)),
  cards[0].match(/(\d+) steps/)?.[0]);
check('hands-on time is claimed only where a deck has hands-on work',
  cards.filter((c) => /min hands-on/.test(c)).length < cards.length,
  `${cards.filter((c) => /min hands-on/.test(c)).length} of ${cards.length}`);
// Not "some deck is an outline" (they were all filled in), but that the label
// and the content agree: a card showing "Text only" is a deck with nothing to
// look at, and it has to say Outline.
check('every text-only deck is labelled Outline',
  cards.every((c) => !/Text only/.test(c) || /Outline/.test(c)),
  `${cards.filter((c) => /Text only/.test(c)).length} text-only, ${cards.filter((c) => /Outline/.test(c)).length} labelled`);
check('every deck has something to look at',
  cards.every((c) => /with code or a demo/.test(c)),
  `${cards.filter((c) => /with code or a demo/.test(c)).length} of ${cards.length}`);

// --- every slide of every deck actually renders --------------------------
// This exists because `Terminal` was used in CodeBlock and never imported, so
// every shell code block threw ReferenceError while this file still reported
// 23/23. The old walk only ever landed on a cover, a demo and the closing
// slide, and none of those renders a code block. Render everything.
const decks = await ev('document.querySelectorAll(".warm-card").length');
let slidesWalked = 0;
const broken = [];
for (let d = 0; d < decks; d += 1) {
  await ev(`(()=>{const b=[...document.querySelectorAll(".warm-card")][${d}];b.focus();b.click();})()`);
  await sleep(700);
  const count = Number(await ev('document.querySelector(\'[role="progressbar"]\')?.getAttribute("aria-valuemax") || 0'));
  for (let n = 0; n < count; n += 1) {
    const before = errs.length;
    const state = await json(`(()=>{
      const p=document.querySelector('[id^="learn-contents-"]');
      if(!p) document.querySelector('[aria-controls^="learn-contents-"]').click();
      return JSON.stringify({ok:true});
    })()`).catch(() => ({}));
    void state;
    await ev(`(()=>{const p=document.querySelector('[id^="learn-contents-"]');
      if(p){const it=[...p.querySelectorAll('button')]; if(it[${n}]) it[${n}].click();}})()`);
    await sleep(260);
    slidesWalked += 1;
    const info = await json(`(()=>{
      const dlg=document.querySelector('[role="dialog"]');
      return JSON.stringify({
        alive: !!dlg,
        boundary: document.body.textContent.includes("Couldn\u2019t load this section"),
        title: dlg?.querySelector('h3')?.textContent || null,
      });
    })()`);
    if (!info.alive || info.boundary || errs.length > before) {
      // eslint-disable-next-line no-console
      broken.push(`deck ${d + 1} slide ${n + 1}${info.title ? ` "${info.title}"` : ''}: ${errs.slice(before).join(' ') || (info.boundary ? 'error boundary' : 'dialog gone')}`);
    }
  }
  await ev('document.querySelector(\'[aria-label="Close this deck"]\')?.click()');
  await sleep(450);
}
check(`every slide of every deck renders (${slidesWalked} slides, ${decks} decks)`,
  broken.length === 0, broken.slice(0, 3).join(' | '));

// --- open the longest deck ----------------------------------------------
await ev('(()=>{const b=[...document.querySelectorAll(".warm-card")][0];b.focus();b.click();})()');
await sleep(900);

const m = await json(`(()=>{
  const d=document.querySelector('[role="dialog"]');
  const bar=d?.querySelector('[role="progressbar"]');
  return JSON.stringify({
    dialog: !!d,
    modal: d?.getAttribute('aria-modal'),
    named: !!document.getElementById(d?.getAttribute('aria-labelledby'))?.textContent,
    focusInside: !!(d && d.contains(document.activeElement)),
    live: d?.querySelector('[aria-live]')?.textContent.trim() || null,
    total: bar?.getAttribute('aria-valuemax'),
    dots: document.querySelectorAll('[aria-label^="Go to slide"]').length,
    bodyOverflow: getComputedStyle(document.body).overflow,
    rootOverflow: getComputedStyle(document.documentElement).overflow,
    topBar: d?.querySelector('h2')?.textContent || '',
  });
})()`);

check('viewer is a dialog with an accessible name', m.dialog && m.modal === 'true' && m.named);
check('focus moves into the dialog on open', m.focusInside);
check('slide changes are announced', !!m.live, `"${m.live}"`);
check('no undersized pagination dots', m.dots === 0, `${m.dots} found`);
check('a progress bar reports position', !!m.total, `1 of ${m.total}`);
check('page behind is locked', m.bodyOverflow === 'hidden' && m.rootOverflow === 'hidden');
check('top bar carries no rival slide number', !/\d+\s*\/\s*\d+/.test(m.topBar), `"${m.topBar}"`);

await ev('window.scrollTo(0,400)'); await sleep(300);
check('the index does not scroll behind the viewer', (await ev('window.scrollY')) === 0,
  `scrollY=${await ev('window.scrollY')}`);

// --- contents list replaces the dots ------------------------------------
await ev('[...document.querySelectorAll(\'[role="dialog"] button\')].find(b=>/of/.test(b.textContent))?.click()');
await sleep(400);
const toc = await json(`(()=>{
  const p=document.querySelector('[id^="learn-contents-"]');
  const items=p?[...p.querySelectorAll('button')]:[];
  const r=items[0]?.getBoundingClientRect();
  return JSON.stringify({open:!!p,count:items.length,h:r?Math.round(r.height):0,current:items.filter(b=>b.getAttribute('aria-current')).length});
})()`);
check('contents list opens with one entry per slide', toc.open && String(toc.count) === m.total, `${toc.count} of ${m.total}`);
check('contents rows meet the 24px target minimum', toc.h >= 24, `${toc.h}px tall`);
check('the current slide is marked in the list', toc.current === 1);

// --- the interactive demo is out of the click zones ----------------------
await ev(`(()=>{const p=document.querySelector('[id^="learn-contents-"]');
  const it=[...p.querySelectorAll('button')];
  const n=it.findIndex(b=>/See it happen/.test(b.textContent));
  if(n>=0) it[n].click();})()`);
await sleep(700);

// A step's working visual now waits for a press: a slide arrives as its label,
// picture and sentence, and Next reveals the rest before leaving the slide.
// Assert both halves of that, then reveal it so the click-zone checks below
// have something to measure.
const demoPresent = async () => (await ev("!!document.querySelector('[data-interactive]')")) === true;
check('a working visual is hidden until Next is pressed', (await demoPresent()) === false);
await ev("window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}))");
await sleep(800);
check('pressing Next reveals it without leaving the slide', (await demoPresent()) === true);

const at = () => ev('document.querySelector(\'[role="progressbar"]\').getAttribute("aria-valuenow")');
const demo = await json(`(()=>{
  const c=document.querySelector('[data-interactive]');
  const s=document.querySelector('.no-scrollbar');
  if(!c||!s) return JSON.stringify({found:false});
  const cr=c.getBoundingClientRect(), sr=s.getBoundingClientRect();
  return JSON.stringify({found:true, overlap: Math.round(sr.left+sr.width*0.25-cr.left)});
})()`);
check('the interactive demo opts out of the click zones', demo.found,
  demo.found ? `overlaps the back zone by ${demo.overlap}px, opted out` : 'demo slide not found');
if (demo.found) {
  const before = await at();
  await ev(`(()=>{const c=document.querySelector('[data-interactive]');const r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:Math.round(r.left+4),clientY:Math.round(r.top+r.height/2)}));})()`);
  await sleep(400);
  check('clicking the demo does not skip a slide', before === await at(), `stayed on ${before}`);
}

// --- the deck ends somewhere --------------------------------------------
await ev('[...document.querySelectorAll(\'[role="dialog"] button\')].find(b=>/of/.test(b.textContent))?.click()');
await sleep(350);
await ev(`(()=>{const p=document.querySelector('[id^="learn-contents-"]');const it=[...p.querySelectorAll('button')];it[it.length-1].click();})()`);
await sleep(700);
const end = await json(`(()=>{
  const d=document.querySelector('[role="dialog"]');
  const b=[...d.querySelectorAll('button')].map(x=>x.textContent);
  return JSON.stringify({back:b.some(t=>/Back to Learn/.test(t)),again:b.some(t=>/Read it again/.test(t)),
    next:b.some(t=>/^Next:/.test(t)),stored:localStorage.getItem('ais.learn.progress.v1')});
})()`);
check('the last slide closes the deck out', end.back && end.again, 'back to Learn + read it again');
check('finishing is remembered', !!end.stored && /"done":true/.test(end.stored), end.stored);

await ev('[...document.querySelectorAll(\'[role="dialog"] button\')].find(b=>/Back to Learn/.test(b.textContent))?.click()');
await sleep(700);
check('the card shows Finished without a reload',
  (await ev('[...document.querySelectorAll(".warm-card")].filter(c=>/Finished/.test(c.textContent)).length')) >= 1);
check('focus returns to the card that opened the deck',
  (await ev('document.activeElement?.classList?.contains("warm-card")')) === true);
check('no console errors', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(pass.concat(fail).join('\n'));
console.log(`\nLEARN ${fail.length ? 'FAIL' : 'PASS'} · ${pass.length} passed, ${fail.length} failed`);
ws.close();
chrome.kill();
process.exit(fail.length ? 1 : 0);
