// Presses every button in the breach deck's interactive blocks and asserts the
// page actually changed.
//
//   node scripts/learn-interact-check.mjs
//
// Needs the Learn tab reachable, same as learn-check.mjs:
//   VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite --port 5281
//
// This exists because a component that renders but does nothing passes every
// other check in this repo: the build is green, the slide walk sees it, and the
// reader gets a button that shrugs. Each assertion below compares the block's
// text before and after a press, so a dead control fails loudly.

// the page says. A component that renders but does nothing would pass every
// other check in this repo.
import { spawn } from 'node:child_process';

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--remote-debugging-port=9461', `--user-data-dir=${process.env.TEMP}/ch-try-${process.pid}`,
  '--headless=new', '--hide-scrollbars', '--no-first-run', '--window-size=1280,1100', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let k = 0; k < 60; k += 1) {
    try {
      const r = await fetch('http://127.0.0.1:9461/json/list');
      const p = (await r.json()).find((x) => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* booting */ }
    await sleep(250);
  }
  throw new Error('no target');
}
const ws = new WebSocket(await target());
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
};
const send = (m, p = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.value;

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:5281/#learn' });
await sleep(3200);

const pass = [], fail = [];
const check = (n, ok, d) => (ok ? pass : fail).push(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ' · ' + d : ''}`);

// Live text of the interactive block only.
const panel = () => ev("(()=>{const c=document.querySelector('[data-interactive]');return c?c.textContent.replace(/\\s+/g,' ').trim():'';})()");
const clickText = (t) => ev(`(()=>{const c=document.querySelector('[data-interactive]');if(!c)return false;
  const b=[...c.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)}));
  if(!b)return false; b.click(); return true;})()`);

async function openStep(title) {
  await ev("document.querySelector('[aria-label=\"Close this deck\"]')?.click()");
  await sleep(400);
  await ev(`(()=>{const b=[...document.querySelectorAll('.warm-card')].find(x=>x.textContent.includes('agent broke out'));b.focus();b.click();})()`);
  await sleep(800);
  await ev("[...document.querySelectorAll('[role=\"dialog\"] button')].find(b=>/of/.test(b.textContent))?.click()");
  await sleep(350);
  await ev(`(()=>{const p=document.querySelector('[id^="learn-contents-"]');const it=[...p.querySelectorAll('button')];
    const n=it.findIndex(b=>b.textContent.includes(${JSON.stringify(title)})); if(n>=0) it[n].click();})()`);
  await sleep(600);
  await ev("window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}))"); // reveal the beat
  await sleep(900);
}

// --- 1. escape ---------------------------------------------------------------
await openStep('This one had a door');
const e0 = await panel();
check('escape: renders before any press', e0.includes('Try to get out'), '');
await clickText('Open a web page'); await sleep(400);
const e1 = await panel();
check('escape: a blocked route says why', e1 !== e0 && /Blocked/i.test(e1), '');
await clickText('Install a software library'); await sleep(500);
const e2 = await panel();
check('escape: the working route changes the verdict', e2 !== e1 && /whole breakout/i.test(e2), '');
check('escape: it then draws the chain', /package service/i.test(e2), '');

// --- 2. scorer ---------------------------------------------------------------
await openStep('went after the marker');
const s0 = await panel();
// The grade now lands after a marking sequence: the transcript writes itself a
// line at a time, a pass sweeps down it, then the stamp. About 2s, so a short
// wait sees the writing rather than the verdict.
const MARKED = 3000;   // writing + the marking pass + the stamp
await clickText('Solve it properly'); await sleep(600);
check('scorer: the transcript writes itself first', /probing the service/i.test(await panel()), '');
await sleep(MARKED - 600);
const s1 = await panel();
check('scorer: solving is impossible and says so', s1 !== s0 && /cannot/i.test(s1), '');
check('scorer: an unsolved attempt gets no grade', /no answer/i.test(s1), '');
await clickText('Look the answer up'); await sleep(MARKED);
const s2 = await panel();
check('scorer: looking it up scores zero', /0 \/ 10/.test(s2), '');
check('scorer: and shows you left the room to do it', /leaving the sandbox/i.test(s2), '');
await clickText('Forge the working'); await sleep(MARKED);
const s3 = await panel();
check('scorer: forging scores full marks', /10 \/ 10/.test(s3) && /same as solving/i.test(s3), '');
check('scorer: the forged working is shown as never happening', /never happened/i.test(s3), '');

// --- 3. board ----------------------------------------------------------------
await openStep('Reading became writing');
const b0 = await panel();
check('board: starts with no revisions', /No revisions yet/i.test(b0), '');
// The block now demonstrates the rule before the trick: writing to the web is
// refused, editing a wiki page is not. Assert the refusal, or the slide is back
// to asserting its own point.
await clickText('Post to a forum'); await sleep(450);
check('board: writing to the web is refused on screen', /Blocked/i.test(await panel()));
await clickText('Edit a wiki page'); await sleep(500);
const b1 = await panel();
check('board: posting creates a revision', b1 !== b0 && /r48210/.test(b1), '');
await clickText('A moderator deletes the page'); await sleep(500);
const b2 = await panel();
check('board: deletion removes it and explains the backup', /deleted by a moderator/i.test(b2) && /backup page/i.test(b2), '');

// --- 4. inject ---------------------------------------------------------------
await openStep('abuse the reader');
const i0 = await panel();
check('inject: an ordinary path is harmless in both readers', /ordinary path/i.test(i0), '');
await clickText('own files'); await sleep(400);
const i1 = await panel();
check('inject: a path reads secrets in the unsafe reader', i1 !== i0 && /passwords/i.test(i1), '');
await clickText('template'); await sleep(400);
const i2 = await panel();
check('inject: a template gets run by the unsafe reader', /ran your command/i.test(i2) && /rejected/i.test(i2), '');

// --- 5. be one of them --------------------------------------------------------
// The empathy block. Both extreme paths have to reach different endings, or the
// choices are decoration.
await openStep('willing to fail for it');
check('agent: opens on the first decision', /Four decisions/.test(await panel()));
for (const b of ['Ignore it', 'Stay inside', 'Protect your own score', 'Stop']) { await clickText(b); await sleep(320); }
const refused = await panel();
check('agent: refusing all four ends with nothing happening', /never joined/i.test(refused));

await openStep('willing to fail for it');
for (const b of ['Read what they wrote', 'Use it', 'Help them', 'Carry on anyway']) { await clickText(b); await sleep(320); }
const joinedAll = await panel();
check('agent: joining all four names the real number', /700/.test(joinedAll));
check('agent: the two paths end differently', joinedAll !== refused);
check('agent: findings are attributed, not asserted', /METR/.test(joinedAll));

check('no console exceptions', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(pass.concat(fail).join('\n'));
console.log(`\nTRY ${fail.length ? 'FAIL' : 'PASS'} · ${pass.length} passed, ${fail.length} failed`);
ws.close(); chrome.kill();
process.exit(fail.length ? 1 : 0);
