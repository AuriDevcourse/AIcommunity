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

// `deck` is any text on the card that opens it, so this walks more than the one
// deck it was written for.
async function openStep(title, deck = 'agent broke out') {
  await ev("document.querySelector('[aria-label=\"Close this deck\"]')?.click()");
  await sleep(400);
  await ev(`(()=>{const b=[...document.querySelectorAll('.warm-card')].find(x=>x.textContent.includes(${JSON.stringify(deck)}));b.focus();b.click();})()`);
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

// --- 6. the four blanks, in the prompting deck --------------------------------
// The claim on that slide is a count, so the count is what gets asserted. A
// version of this block that opened the gaps but never reached 81 would look
// completely fine on screen.
await openStep('So it guesses', 'Prompting that actually works');
const g0 = await panel();
check('guesses: renders the bare request before any press', /Write release notes for this PR/.test(g0));
check('guesses: no reading is shown yet', !/what it went with/.test(g0));
await clickText('Format'); await sleep(350);
const g1 = await panel();
check('guesses: opening a blank shows three readings', g1 !== g0 && /markdown table/i.test(g1));
check('guesses: exactly one is marked as taken', (g1.match(/what it went with/g) || []).length === 1);
for (const b of ['Length', 'Audience', 'Tone']) { await clickText(b); await sleep(300); }
const g2 = await panel();
check('guesses: all four open reaches the real count', /81 versions/.test(g2));
check('guesses: four blanks, four picks', (g2.match(/what it went with/g) || []).length === 4);
await clickText('Start over'); await sleep(350);
check('guesses: start over clears every blank', !/what it went with/.test(await panel()));

// --- 7. one turn at a time, in the agent deck ---------------------------------
// The lesson is authorship: two of the four lines are the reader's own code. A
// block that showed all four at once, or labelled them all "the model", would
// still look like a transcript and teach the opposite of the slide.
await openStep('The model never runs anything', 'Build your first AI agent');
const t0 = await panel();
check('loop: opens on the first turn only', /What should I wear/.test(t0) && !/end_turn/.test(t0));
await clickText('Run the next turn'); await sleep(350);
const t1 = await panel();
check('loop: the model asks for a tool rather than running it', /tool_use/.test(t1) && /it asked, nothing ran/.test(t1));
await clickText('Run the next turn'); await sleep(350);
check('loop: the result is attributed to your code', /your function ran, not the model/.test(await panel()));
await clickText('Run the next turn'); await sleep(350);
const t3 = await panel();
check('loop: the last turn ends the loop', /end_turn/.test(t3) && /Two of those four lines are yours/.test(t3));
await clickText('Start over'); await sleep(350);
check('loop: start over returns to one turn', !/end_turn/.test(await panel()));

// --- 8. will it fit, in the local-LLM deck -----------------------------------
// The numbers are computed from the rule of thumb the deck teaches two slides
// earlier, so they are asserted as numbers. A block that drifted from the rule
// would still render a plausible-looking table.
await openStep('Find yours', 'Run your own local LLM');
const f0 = await panel();
check('fit: asks before it answers', /Pick the memory/.test(f0) && !/fits in memory/.test(f0));
await clickText('8 GB'); await sleep(350);
const f8 = await panel();
check('fit: 8 GB tops out at 3B', /3B/.test(f8) && /5 GB free/.test(f8));
check('fit: a model that does not fit still answers', /about a word a second/.test(f8));
await clickText('32 GB'); await sleep(350);
const f32 = await panel();
check('fit: more memory raises the ceiling', /32B is your ceiling/.test(f32));
check('fit: 70B is still out of reach at 32 GB', /40\.3 GB/.test(f32));

check('no console exceptions', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(pass.concat(fail).join('\n'));
console.log(`\nTRY ${fail.length ? 'FAIL' : 'PASS'} · ${pass.length} passed, ${fail.length} failed`);
ws.close(); chrome.kill();
process.exit(fail.length ? 1 : 0);
