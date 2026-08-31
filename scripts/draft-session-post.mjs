// Generate a shareable social post for a past session, in the AI Sundays voice.
// Reuses the SAME prompt/engine as the dashboard's Post Maker + the recap page's
// "Draft a LinkedIn post" button, so the CLI and the UI produce consistent output.
//
// Builds the brief from the committed src/data.json (about + demos + tools + people),
// so it draws on the AI ideas parsed out of the session note.
//
// Run:  GEMINI_API_KEY=…  node scripts/draft-session-post.mjs <YYYY-MM-DD> [linkedin|instagram]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleGeneratePost } from '../api/_postmaker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const date = process.argv[2];
const format = process.argv[3] === 'instagram' ? 'instagram' : 'linkedin';
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.error('Usage: node scripts/draft-session-post.mjs <YYYY-MM-DD> [linkedin|instagram]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(join(ROOT, 'src', 'data.json'), 'utf8'));
const s = data.sessions.find((x) => x.date === date);
if (!s) { console.error(`No session for ${date} in src/data.json (run npm run build:data first).`); process.exit(1); }

const fmtLong = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Mirror SessionRecap.buildNotes so CLI + UI stay consistent.
function buildNotes(session) {
  const title = session.number != null ? `Session #${session.number}` : date;
  const lines = [`Session: ${title}.`];
  if (session.number != null) lines.push(`This was AI Sundays meetup #${session.number}.`);
  lines.push(`It happened in Copenhagen on ${fmtLong(session.date)}.`);
  if (session.location) lines.push(`Format/location: ${session.location}.`);
  if (session.summary) lines.push(`What it was about: ${session.summary}`);
  if (session.demos?.length) {
    lines.push('People demoed:');
    for (const d of session.demos) lines.push(`- ${d.presenter}: ${d.topic}`);
  }
  if (session.tools?.length) lines.push(`AI tools and ideas discussed: ${session.tools.map((t) => t.name).slice(0, 18).join(', ')}.`);
  if (session.attendees?.length) lines.push(`People there: ${session.attendees.join(', ')}.`);
  if (session.photos?.length) lines.push(`We took ${session.photos.length} photos.`);
  return lines.join('\n');
}

const notes = buildNotes(s);
const { json } = await handleGeneratePost({ body: { notes, format } });
if (!json.ok) {
  console.error('Generation failed:', json.error || (json.configured === false ? 'no LLM key set (GEMINI_API_KEY/OPENROUTER_API_KEY)' : 'unknown'));
  process.exit(1);
}
console.log(`\n===== ${format.toUpperCase()} POST · ${date} =====\n`);
console.log(json.text);
console.log('\n===== end =====\n');
