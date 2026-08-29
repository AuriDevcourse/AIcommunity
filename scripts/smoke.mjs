// Loads every route in headless Chrome and fails on any console error or
// uncaught exception. A `vite build` only proves the bundle parses — it will
// happily ship a temporal-dead-zone ReferenceError that throws on first render.
//
//   node scripts/smoke.mjs [baseUrl]

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9334);
const PROFILE = `/tmp/chrome-smoke-${process.pid}`;
const ROUTES = ['home', 'discussions', 'learn', 'news', 'members', 'sessions', 'tools'];

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

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  let problems = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      problems.push(`uncaught: ${d.exception?.description || d.text}`);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      problems.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text;
      // A missing favicon or a blocked third-party image is not an app fault.
      if (!/favicon|net::ERR_|Failed to load resource/i.test(t)) problems.push(`log: ${t}`);
    }
  });

  for (const route of ROUTES) {
    problems = [];
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(120);
    await cdp.send('Page.navigate', { url: `${BASE}/#${route}` });
    await sleep(2600);

    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `({ mounted: !!document.querySelector('#root main'), title: document.title, text: (document.body.innerText||'').trim().length })`,
      returnByValue: true,
    });
    const v = result.value || {};
    const bad = problems.length > 0 || !v.mounted || v.text < 40;

    if (bad) {
      failures++;
      console.log(`  \x1b[31m✗\x1b[0m #${route.padEnd(12)} mounted=${v.mounted} text=${v.text}`);
      problems.slice(0, 3).forEach((p) => console.log(`      ${p.slice(0, 160)}`));
    } else {
      console.log(`  \x1b[32m✓\x1b[0m #${route.padEnd(12)} "${v.title}"`);
    }
  }
} catch (err) {
  failures++;
  console.error('smoke failed:', err.message);
} finally {
  chrome.kill();
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(failures === 0 ? '\n\x1b[32mSMOKE PASS\x1b[0m\n' : `\n\x1b[31mSMOKE FAIL\x1b[0m · ${failures} route(s)\n`);
process.exit(failures === 0 ? 0 : 1);
