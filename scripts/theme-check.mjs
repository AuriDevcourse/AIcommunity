// Drives the real theme toggle over the Chrome DevTools Protocol and asserts
// the whole contract: the three-way choice, persistence, that an explicit
// choice beats the OS, contrast on the dark palette, and, the part a
// screenshot cannot prove, that the saved theme is applied before first paint.
//
// The no-flash check works by blocking the app bundle so React never runs. If
// data-theme is still set with React blocked, only the render-blocking script
// in <head> can have set it, which is exactly the pre-paint case.
//
//   npm run build && npx vite preview --port 5281 --host 127.0.0.1
//   node scripts/theme-check.mjs [baseUrl]

import { spawn } from 'node:child_process';
const BASE = process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:5281';

// The two grounds, from the brand palette (docs/improvement-plan.md links it;
// source of truth is the ai-sundays brand repo's palette.md). Named here rather
// than inlined, because these were hardcoded as white/near-black and every one
// of them had to be found by hand when the palette changed.
const LIGHT_BG = 'rgb(248, 240, 228)';   // cream  #F8F0E4
const DARK_BG  = 'rgb(11, 46, 30)';      // deep green #0B2E1E
const LIGHT_META = '#F8F0E4';
const DARK_META  = '#0B2E1E';
const CHROME = process.env.CHROME || (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'google-chrome');
const PORT = Number(process.env.CDP_PORT || 9345);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class Cdp {
  constructor(ws){ this.ws=ws; this.id=0; this.p=new Map();
    ws.addEventListener('message', e => { const m=JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { this.p.get(m.id)(m.result); this.p.delete(m.id); } }); }
  send(method, params={}) { const id=++this.id; this.ws.send(JSON.stringify({id,method,params}));
    return new Promise(r=>this.p.set(id,r)); }
  static connect(u){ return new Promise((res,rej)=>{ const ws=new WebSocket(u);
    ws.addEventListener('open',()=>res(new Cdp(ws))); ws.addEventListener('error',rej); }); }
}
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox',
  `--remote-debugging-port=${PORT}`,`--user-data-dir=/tmp/chrome-toggle-${process.pid}`,'about:blank'],{stdio:'ignore'});
let ws;
for (let i=0;i<60;i++){ try { const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const t=(await r.json()).find(x=>x.type==='page'); if(t){ws=t.webSocketDebuggerUrl;break;} } catch{} await sleep(250); }
if(!ws) throw new Error('no CDP');
const cdp = await Cdp.connect(ws);
await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
const evalJs = async (expr) => {
  const r = await cdp.send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
  if (r.exceptionDetails) throw new Error(expr+' -> '+JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};
const goto = async (url) => { await cdp.send('Page.navigate',{url});
  for(let i=0;i<80;i++){ if(await evalJs("document.readyState==='complete' && !!document.querySelector('header')")) break; await sleep(150);} await sleep(400); };

const fails = [];
const check = (name, cond, detail='') => { console.log((cond?'  \u2713 ':'  \u2717 ')+name+(detail?' · '+detail:'')); if(!cond) fails.push(name); };

// Force the OS preference to LIGHT so an explicit "dark" choice is provably the toggle's doing.
await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
await goto(BASE+'#home');

const btnCount = await evalJs(`document.querySelectorAll('[role="radiogroup"][aria-label="Colour theme"] [role="radio"]').length`);
check('header radiogroup has 3 options', btnCount===3, 'found '+btnCount);
check('default is system (no data-theme attr)', await evalJs(`!document.documentElement.hasAttribute('data-theme')`));
check('system + OS light renders light', (await evalJs(`getComputedStyle(document.body).backgroundColor`))===LIGHT_BG);

const clickTheme = async (label) => {
  await evalJs(`document.querySelector('[role="radiogroup"][aria-label="Colour theme"] [role="radio"][aria-label="${label}"]').click()`);
  await sleep(250);
};

await clickTheme('Dark');
check('click Dark sets data-theme="dark"', (await evalJs(`document.documentElement.getAttribute('data-theme')`))==='dark');
const darkBg = await evalJs(`getComputedStyle(document.body).backgroundColor`);
check('dark background applied', darkBg===DARK_BG, darkBg);
check('dark persisted to localStorage', (await evalJs(`localStorage.getItem('aiw.theme')`))==='dark');
check('aria-checked follows selection', (await evalJs(`document.querySelector('[role="radio"][aria-label="Dark"]').getAttribute('aria-checked')`))==='true');
check('theme-color meta follows', (await evalJs(`document.querySelector('meta[name=theme-color]').content`))===DARK_META);

// Reload: the choice must be on <html> before the app bundle runs, or it flashes.
// No-flash proof: block the app bundle so React never runs, then reload. If
// data-theme is still "dark", only the render-blocking script in <head> can
// have set it, which is exactly what happens before first paint.
await cdp.send('Network.enable');
await cdp.send('Network.setBlockedURLs',{urls:['*/assets/index-*.js']});
await cdp.send('Page.reload',{ignoreCache:true});
for (let i=0;i<60;i++){ if(await evalJs("document.readyState==='complete'")) break; await sleep(150);} await sleep(500);
const reactRan = await evalJs(`document.getElementById('root').childElementCount > 0`);
check('bundle really was blocked (React did not run)', reactRan===false, 'root children: '+(reactRan?'>0':'0'));
check('data-theme set with React blocked (no flash)', (await evalJs(`document.documentElement.getAttribute('data-theme')`))==='dark');
check('background already dark with React blocked', (await evalJs(`getComputedStyle(document.body).backgroundColor`))===DARK_BG);
check('theme-color meta set with React blocked', (await evalJs(`document.querySelector('meta[name=theme-color]').content`))===DARK_META);
check('script is render-blocking in <head>', await evalJs(`(() => {
  const t = document.querySelector('script[src="/theme-init.js"]');
  const m = document.querySelector('script[type="module"]');
  return !!t && t.closest('head') !== null && !t.defer && !t.async
    && (!m || (t.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
})()`));

await cdp.send('Network.setBlockedURLs',{urls:[]});
await cdp.send('Page.reload',{ignoreCache:true});
for (let i=0;i<80;i++){ if(await evalJs("document.readyState==='complete' && !!document.querySelector('header')")) break; await sleep(150);} await sleep(400);
check('recovers once the bundle loads again', (await evalJs(`!!document.querySelector('[role="radiogroup"][aria-label="Colour theme"]')`)));

await clickTheme('Light');
check('click Light sets data-theme="light"', (await evalJs(`document.documentElement.getAttribute('data-theme')`))==='light');

// Explicit light must beat an OS that says dark.
await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
await sleep(200);
check('explicit Light beats OS dark', (await evalJs(`getComputedStyle(document.body).backgroundColor`))===LIGHT_BG);
// The dark meta was asserted but the light one never was, so a wrong light
// value would have shipped silently.
check('theme-color meta follows back to light', (await evalJs(`document.querySelector('meta[name=theme-color]').content`))===LIGHT_META);

await clickTheme('System');
check('System clears data-theme', await evalJs(`!document.documentElement.hasAttribute('data-theme')`));
check('System clears localStorage', (await evalJs(`localStorage.getItem('aiw.theme')`))===null);
await sleep(200);
const sysBg = await evalJs(`getComputedStyle(document.body).backgroundColor`);
check('System + OS dark renders dark', sysBg===DARK_BG, sysBg);

// Contrast spot-check on the dark palette (no regex: escaping it through
// heredoc -> template literal -> CDP eats the backslashes).
const contrast = await evalJs(`(() => {
  const nums = (c) => c.split("(")[1].split(")")[0].split(",").map(Number);
  const lum = (c) => { const p = nums(c).slice(0,3).map(n => { n = n/255; return n <= 0.03928 ? n/12.92 : Math.pow((n+0.055)/1.055, 2.4); });
    return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]; };
  const ratio = (a,b) => { const v = [lum(a), lum(b)].sort((p,q)=>q-p); return (v[0]+0.05)/(v[1]+0.05); };
  const bg = getComputedStyle(document.body).backgroundColor;
  const probe = (cls) => { const el = document.createElement("span"); el.className = cls; document.body.appendChild(el);
    const c = getComputedStyle(el).color; el.remove(); return c; };
  return { bg, foreground: ratio(probe("text-foreground"), bg).toFixed(2), muted: ratio(probe("text-muted"), bg).toFixed(2) };
})()`);
check('dark --foreground contrast >= 4.5', Number(contrast.foreground)>=4.5, contrast.foreground+':1');
check('dark --muted contrast >= 4.5', Number(contrast.muted)>=4.5, contrast.muted+':1');


// ---- Keyboard: role="radiogroup" is a promise about the arrow keys. ----
await evalJs(`document.querySelector('[role="radiogroup"][aria-label="Colour theme"] [role="radio"][aria-label="Light"]').click()`);
await sleep(200);
const roving = await evalJs(`(() => {
  const rs = [...document.querySelectorAll('[role="radiogroup"][aria-label="Colour theme"] [role="radio"]')];
  return rs.map(r => r.tabIndex);
})()`);
check('roving tabIndex (one stop, not three)', roving.filter(t => t === 0).length === 1, JSON.stringify(roving));

await evalJs(`document.querySelector('[role="radiogroup"][aria-label="Colour theme"] [role="radio"][aria-label="Light"]').focus()`);
for (const [key, code, expected] of [['ArrowRight','ArrowRight','dark'], ['ArrowRight','ArrowRight','system'], ['Home','Home','light'], ['End','End','system']]) {
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:key==='Home'?36:key==='End'?35:39});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:key==='Home'?36:key==='End'?35:39});
  await sleep(200);
  const got = await evalJs(`document.querySelector('[role="radiogroup"][aria-label="Colour theme"] [role="radio"][aria-checked="true"]').getAttribute('aria-label').toLowerCase()`);
  check(`${key} selects ${expected}`, got === expected, 'got '+got);
  const focused = await evalJs(`document.activeElement.getAttribute('aria-label')`);
  check(`${key} moves focus too`, (focused||'').toLowerCase() === expected, 'focus on '+focused);
}

// ---- The toggle is mounted twice. Clicking one must update the other. ----
await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await sleep(300);
await evalJs(`document.querySelector('button[aria-label="Open menu"]').click()`);
await sleep(350);
const groups = await evalJs(`document.querySelectorAll('[role="radiogroup"][aria-label="Colour theme"]').length`);
check('both toggles mounted at 390px', groups === 2, 'found '+groups);

// The sheet variant has no per-radio aria-label, so address it by position.
await evalJs(`(() => {
  const g = [...document.querySelectorAll('[role="radiogroup"][aria-label="Colour theme"]')];
  const sheet = g.find(el => !el.querySelector('[aria-label="Dark"]')) || g[1];
  sheet.querySelectorAll('[role="radio"]')[1].click();
})()`);
await sleep(300);
const sync = await evalJs(`(() => {
  const g = [...document.querySelectorAll('[role="radiogroup"][aria-label="Colour theme"]')];
  return g.map(el => [...el.querySelectorAll('[role="radio"]')].map(r => r.getAttribute('aria-checked')).join(','));
})()`);
check('both radiogroups agree after one is clicked', sync[0] === sync[1], JSON.stringify(sync));
check('clicking the sheet applied dark', (await evalJs(`document.documentElement.getAttribute('data-theme')`))==='dark');
await cdp.send('Emulation.clearDeviceMetricsOverride');

chrome.kill();
console.log(fails.length ? `\nTHEME FAIL · ${fails.length}: ${fails.join(', ')}` : '\nTHEME PASS');
process.exit(fails.length ? 1 : 0);
