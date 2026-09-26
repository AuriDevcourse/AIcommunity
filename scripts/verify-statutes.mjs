// Compares the Danish clauses on /forening/ against the signed statutes in the
// Obsidian vault, word for word. The web page is a transcription of a legal
// document, and a transcription that drifts is worse than no page at all: the
// room would be reading one text and signing another.
//
//   node scripts/verify-statutes.mjs [path-to-Vedtaegter (DA).md]
//
// Default vault path is the Windows desktop location. Pass the path on any
// other machine.

import { readFileSync, existsSync } from 'node:fs';

const VAULT = process.argv[2]
  || 'C:/Users/User/Documents/Obsidian Vault/AI Workshop/Forening/Vedtaegter (DA).md';
const PAGE = 'public/forening/index.html';

if (!existsSync(VAULT)) {
  console.error(`Vault statutes not found at:\n  ${VAULT}\nPass the path as an argument.`);
  process.exit(2);
}

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const strip = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// --- the page, Danish block only ---
const page = readFileSync(PAGE, 'utf-8');
const from = page.indexOf('id="statutes-da"');
const to = page.indexOf('id="statutes-en"');
if (from < 0 || to < 0) {
  console.error('Could not find the statutes-da / statutes-en blocks in the page.');
  process.exit(2);
}
const daBlock = page.slice(from, to);

const web = new Map();
for (const m of daBlock.matchAll(
  /<p class="clause"><span class="cnum">([\d.]+)<\/span>([\s\S]*?)<\/p>/g)) {
  web.set(m[1], strip(m[2]));
}

// --- the vault ---
const vault = readFileSync(VAULT, 'utf-8');
// The vault wraps long clauses across several lines, so a clause runs until the
// next clause number, section header, or blank-line-separated block. Matching
// single lines truncated § 1.1 and reported a difference that did not exist.
const src = new Map();
const lines = vault.split(/\r?\n/);
let cur = null;
let buf = [];
const flush = () => {
  if (cur) src.set(cur, buf.join(' ').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\s+/g, ' ').trim());
  cur = null; buf = [];
};
for (const raw of lines) {
  const line = raw.trim();
  const m = line.match(/^(\d+\.\d+)\s+(.*)$/);
  if (m) { flush(); cur = m[1]; buf = [m[2]]; continue; }
  // A heading, a horizontal rule or a lettered/numbered sub-item ends the clause.
  if (/^#|^---|^[a-z]\)|^\d+\.\s/.test(line)) { flush(); continue; }
  if (!line) { flush(); continue; }
  if (cur) buf.push(line);
}
flush();

let bad = 0;
const missing = [...src.keys()].filter((k) => !web.has(k));
const extra = [...web.keys()].filter((k) => !src.has(k));

console.log(`page: ${web.size} Danish clauses · vault: ${src.size} clauses`);

if (missing.length) { console.log(`FAIL in the vault but not on the page: ${missing.join(', ')}`); bad++; }
else console.log('ok   every clause in the vault appears on the page');

if (extra.length) { console.log(`FAIL on the page but not in the vault: ${extra.join(', ')}`); bad++; }
else console.log('ok   the page invents no clauses');

const differing = [...web.keys()]
  .filter((k) => src.has(k) && web.get(k) !== src.get(k))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (differing.length) {
  bad++;
  console.log(`FAIL ${differing.length} clause(s) differ in wording:`);
  for (const k of differing) {
    console.log(`\n  § ${k}`);
    console.log(`    vault: ${src.get(k)}`);
    console.log(`    page : ${web.get(k)}`);
  }
} else {
  console.log('ok   every clause matches the vault word for word');
}

console.log(bad ? `\n${bad} check(s) failed` : '\nstatutes verified');
process.exit(bad ? 1 : 0);
