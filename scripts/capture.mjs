// Screenshot helper driven over the Chrome DevTools Protocol.
//
//   node scripts/capture.mjs <outdir>
//
// The plain `--screenshot` CLI flag ignores --force-prefers-color-scheme and
// cannot do full-page captures, so this launches Chrome with a debugging port
// and drives it directly: Emulation.setEmulatedMedia for the colour scheme,
// Page.captureBeyondViewport for the whole scroll height.
//
// Requires the dev server (npm run dev) on BASE_URL. No npm dependencies —
// Node's global WebSocket does the CDP transport.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node scripts/capture.mjs <outdir>');
  process.exit(1);
}
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5281';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9222);
const PROFILE = `/tmp/chrome-capture-${process.pid}`;

const SHOTS = [
  { name: 'home-light', hash: 'home', w: 1440, h: 1000, scheme: 'light' },
  { name: 'home-dark', hash: 'home', w: 1440, h: 1000, scheme: 'dark' },
  { name: 'news-light', hash: 'news', w: 1440, h: 1000, scheme: 'light' },
  { name: 'members-light', hash: 'members', w: 1440, h: 1000, scheme: 'light' },
  { name: 'sessions-light', hash: 'sessions', w: 1440, h: 1000, scheme: 'light' },
  { name: 'tools-light', hash: 'tools', w: 1440, h: 1000, scheme: 'light' },
  { name: 'home-mobile', hash: 'home', w: 390, h: 844, scheme: 'light', mobile: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 30000);
    });
  }
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => resolve(new Cdp(ws)));
      ws.addEventListener('error', reject);
    });
  }
}

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

let cdp;
try {
  // Wait for the debugging endpoint to answer.
  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const version = await getJson('/json/version');
      if (version.webSocketDebuggerUrl) {
        target = version.webSocketDebuggerUrl;
        break;
      }
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error('Chrome debugging port never opened');

  const browser = await Cdp.connect(target);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const pageWs = (await getJson('/json/list')).find((t) => t.id === targetId)?.webSocketDebuggerUrl;
  if (!pageWs) throw new Error('could not find the page target');
  cdp = await Cdp.connect(pageWs);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const shot of SHOTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shot.w,
      height: shot.h,
      deviceScaleFactor: shot.mobile ? 2 : 1,
      mobile: Boolean(shot.mobile),
    });
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-color-scheme', value: shot.scheme }],
    });

    // Reload rather than just changing the hash, so the emulated scheme is
    // applied from first paint and React remounts the tab cleanly.
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(150);
    await cdp.send('Page.navigate', { url: `${BASE}/#${shot.hash}` });

    // Wait for the app to actually render something rather than a fixed sleep.
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const { result } = await cdp.send('Runtime.evaluate', {
        expression: `!!document.querySelector('#root main') && document.images.length >= 0 && [...document.images].every(i => i.complete)`,
        returnByValue: true,
      });
      if (result.value) {
        ready = true;
        break;
      }
    }
    if (!ready) console.warn(`  ${shot.name}: render check timed out, capturing anyway`);
    await sleep(400);

    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    const file = join(OUT, `${shot.name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`  ${shot.name.padEnd(20)} ${String(Math.round(Buffer.from(data, 'base64').length / 1024)).padStart(5)} KB`);
  }
  console.log(`captured to ${OUT}`);
} catch (err) {
  console.error('capture failed:', err.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
