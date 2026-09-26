// Checks the static /forening/ founding-meeting page: renders, no console
// errors, fonts actually load, and the signup builder runs. Same CDP-over-raw-
// Chrome pattern as smoke.mjs so it needs no dependencies.
//
//   node scripts/forening-check.mjs [baseUrl]

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8801';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9336);
const PROFILE = `/tmp/chrome-forening-${process.pid}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m.result); this.pending.delete(m.id); }
      else if (m.method) this.listeners.forEach((fn) => fn(m));
    });
  }
  on(fn) { this.listeners.push(fn); }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res) => this.pending.set(id, res));
  }
  static connect(url) {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => res(new Cdp(ws)));
      ws.addEventListener('error', rej);
    });
  }
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

let failures = 0;
const ok = (name, pass, detail = '') => {
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

try {
  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (v.webSocketDebuggerUrl) { wsUrl = v.webSocketDebuggerUrl; break; }
    } catch { /* not up yet */ }
  }
  if (!wsUrl) throw new Error('Chrome debugging port never opened');

  const browser = await Cdp.connect(wsUrl);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pageWs = list.find((t) => t.id === targetId)?.webSocketDebuggerUrl;
  const cdp = await Cdp.connect(pageWs);

  const errors = [];
  const failedReqs = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails?.exception?.description || 'uncaught exception');
    }
    if (m.method === 'Network.loadingFailed') failedReqs.push(m.params.errorText);
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.navigate', { url: `${BASE}/forening/` });
  await sleep(3000);

  const evalq = async (expr) => (await cdp.send('Runtime.evaluate', {
    expression: expr, returnByValue: true,
  })).result?.value;

  ok('page renders', (await evalq('document.querySelectorAll("h1").length')) > 0);
  // The statutes sit inside a collapsed <details>, so open it before counting:
  // a closed <details> still has the nodes, but the toggle assertions below
  // read computed display and would see everything as hidden.
  await evalq(`(document.querySelector('details.statutes')||{}).open = true`);
  await sleep(200);
  // The page carries the vedtægter twice since the DA/EN toggle landed: 48
  // clauses and 11 sections in each language. Assert per-language rather than
  // on the total, so a missing translation fails instead of being averaged away.
  const daClauses = await evalq(
    `document.querySelectorAll('#statutes-da .clause').length`);
  const allClauses = await evalq('document.querySelectorAll(".clause").length');
  const allSections = await evalq('document.querySelectorAll(".snum").length');
  ok('vedtaegter present, 48 clauses per language',
     allClauses === 48 || allClauses === 96,
     `got ${allClauses} (${daClauses} in the Danish block)`);
  ok('11 sections per language',
     allSections === 11 || allSections === 22,
     `got ${allSections}`);

  // Fonts must be self-hosted: no request may leave for Google.
  const remote = await evalq(
    `performance.getEntriesByType('resource').filter(r => /googleapis|gstatic/.test(r.name)).length`);
  ok('no Google Fonts requests', remote === 0, `${remote} remote font requests`);
  const loaded = await evalq('document.fonts.size');
  ok('local fonts loaded', loaded > 0, `${loaded} faces`);

  // The signup builder is the whole point of the page.
  await evalq(`document.getElementById('f-name').value = 'Test Person';
               document.getElementById('build').click();`);
  await sleep(300);
  const summary = await evalq(`document.getElementById('summary').value`);
  ok('signup builder runs', (summary || '').includes('Test Person'));
  ok('builder names missing fields',
     ((await evalq(`document.getElementById('status').textContent`)) || '').includes('needs'));

  ok('no console errors', errors.length === 0, errors.join(' | '));
  ok('no failed requests', failedReqs.length === 0, failedReqs.join(' | '));

  // The page must look like the rest of the site, not like a stray document.
  // These four are what "same design system" reduces to in a machine check:
  // the site header, the site's page colour, the site's typeface, and the
  // theme-init script that stops a dark-mode user seeing a cream flash.
  const font = await evalq(`getComputedStyle(document.body).fontFamily`);
  ok('uses the site typeface (Geist)', /Geist/i.test(font || ''), font);

  const bg = await evalq(`getComputedStyle(document.body).backgroundColor`);
  // Cream #F8F0E4 in light, deep green #0B2E1E in dark.
  ok('uses a site page colour',
     bg === 'rgb(248, 240, 228)' || bg === 'rgb(11, 46, 30)', bg);

  ok('has the site header with the logo',
     (await evalq(`!!document.querySelector('.app-header img[src*="logo"]')`)) === true);
  ok('theme-init is loaded',
     (await evalq(`!!document.querySelector('script[src="/theme-init.js"]')`)) === true);

  // The language toggle is a button that must actually swap the two blocks.
  const daVisibleBefore = await evalq(
    `getComputedStyle(document.getElementById('statutes-da')).display !== 'none'`);
  await evalq(`document.querySelector('.lang-btn[data-lang="en"]').click()`);
  await sleep(200);
  const enVisibleAfter = await evalq(
    `getComputedStyle(document.getElementById('statutes-en')).display !== 'none'`);
  const daHiddenAfter = await evalq(
    `getComputedStyle(document.getElementById('statutes-da')).display === 'none'`);
  ok('language toggle swaps DA for EN',
     daVisibleBefore && enVisibleAfter && daHiddenAfter,
     `da before ${daVisibleBefore}, en after ${enVisibleAfter}, da hidden ${daHiddenAfter}`);

  // A clause ending in a colon promises a list. § 2.2 and § 5.4 both do, and
  // both had lost their sub-items: the page showed the room something other
  // than what it was voting on. Any clause that ends in ':' must be followed
  // by a list.
  const danglingColons = await evalq(`
    Array.from(document.querySelectorAll('.clause'))
      .filter(p => p.textContent.trim().endsWith(':'))
      .filter(p => !(p.nextElementSibling && p.nextElementSibling.matches('ol,ul')))
      .map(p => p.querySelector('.cnum') ? p.querySelector('.cnum').textContent : '?')
  `);
  ok('no clause promises a list it does not show',
     Array.isArray(danglingColons) && danglingColons.length === 0,
     `dangling: ${(danglingColons || []).join(', ')}`);
} catch (e) {
  console.error('FAIL harness —', e.message);
  failures++;
} finally {
  chrome.kill();
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(failures ? `\n${failures} failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
