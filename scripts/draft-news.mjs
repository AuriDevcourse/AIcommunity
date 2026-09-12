// Draft an AI-news roundup for review. Pulls a handful of public AI RSS feeds,
// asks Gemini flash (free tier) to pick + summarize the most relevant stories for
// a builder-focused Copenhagen AI community, and writes data/news-draft.json.
//
// This NEVER touches data/news.json. Auri reviews the draft and copies the good
// items across by hand, curation stays human; only the gathering is automated.
//
// IP/scraping hygiene: we read public RSS (titles + short descriptions + links),
// write our OWN short summaries, attribute the source, and link back. No wholesale
// copying of article bodies or images.
//
// Run: GEMINI_API_KEY=… node scripts/draft-news.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'data', 'news-draft.json');

// Pinned alias, never a dated version (dated Gemini models get retired, see the
// gemini-flash-latest lesson). Free text tier.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const KEY = process.env.GEMINI_API_KEY || '';

// The rule asks for six European stories out of twelve, and for a long time
// every feed here was American. The curator met the quota the only way it could:
// by filing Hugging Face posts under "europe" because the founders are French.
// It also meant the single biggest European story of a fortnight could be missed
// outright (Mistral's EUR 3bn round, 8 Sep 2026, appeared in none of the top
// five). The last three feeds exist so the European half is actually European.
const FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica', url: 'https://arstechnica.com/ai/feed/' },
  { name: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Sifted', url: 'https://sifted.eu/feed' },
  { name: 'Tech.eu', url: 'https://tech.eu/feed/' },
  { name: 'EU-Startups', url: 'https://www.eu-startups.com/feed/' },
];

const DAYS = 14; // rule: news must be from the past two weeks
const UA = 'Mozilla/5.0 (compatible; AISundaysNewsBot/1.0; +https://www.aisundays.org)';

const strip = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? strip(m[1]) : '';
}
function linkOf(block) {
  // RSS: <link>url</link>. Atom: <link href="url" .../>.
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
  if (rss && strip(rss[1])) return strip(rss[1]);
  const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return atom ? atom[1] : '';
}

async function fetchFeed(feed) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(feed.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const xml = await r.text();
    const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
    const cutoff = Date.now() - DAYS * 86400000;
    const out = [];
    for (const b of blocks.slice(0, 25)) {
      const title = tag(b, 'title');
      const url = linkOf(b);
      const dateStr = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published');
      const ts = dateStr ? Date.parse(dateStr) : NaN;
      if (!title || !url) continue;
      if (!Number.isNaN(ts) && ts < cutoff) continue; // older than the window
      const desc = (tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 320);
      out.push({ source: feed.name, title, url, date: Number.isNaN(ts) ? '' : new Date(ts).toISOString().slice(0, 10), desc });
    }
    return out;
  } catch {
    return [];
  }
}

const SYSTEM = `You curate an AI-news roundup for a small Copenhagen meetup of people who BUILD things with AI (a "shipping community", not researchers). From the candidate articles, pick EXACTLY 12 stories from the last two weeks: AT LEAST 6 "global" (worldwide / rest-of-world AI) and AT LEAST 6 "europe" (Europe-related AI/tech). Favor: new models/tools builders can actually use, agent frameworks, notable product launches, European AI companies/funding/events, and EU/Denmark AI policy. Avoid: pure funding gossip, thinkpieces, duplicates.

Return STRICT JSON only (no markdown fences), shape:
{
  "items": [
    {
      "id": "kebab-case-slug",
      "category": "global" | "europe",
      "date": "YYYY-MM-DD",
      "title": "rewritten, specific, <= 80 chars",
      "subtitle": "one-line angle, <= 110 chars",
      "summary": "2-3 sentences in your own words, concrete, no hype",
      "whyItMatters": "1-2 sentences",
      "whyForUs": "1 sentence on why a Copenhagen builder should care",
      "sourceName": "the source name",
      "sourceUrl": "the article url"
    }
  ]
}
Rules: return exactly 12 items with at least 6 of each category. Write your OWN summaries (never copy article text). Use "europe" only when the story is genuinely European: a company headquartered in Europe, a launch or funding round or event that happened in Europe, or EU/Danish policy. The founders' nationality is not enough, and neither is a European office of an American company. If you cannot find six genuinely European stories in the candidates, return fewer and say so in the last item's whyForUs rather than filing a global story under "europe". Plain text, no emojis, never the em dash character.`;

// The stories that already went out. URL and title-key catch the same article
// arriving again; the titles go to the model so it can also spot the same story
// under a different headline from a different outlet, which the keys cannot.
const titleKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function readPublished() {
  try {
    const j = JSON.parse(readFileSync(join(ROOT, 'data', 'news.json'), 'utf8'));
    const items = Array.isArray(j.items) ? j.items : [];
    return {
      titles: items.map((i) => i.title).filter(Boolean),
      keys: new Set(items.map((i) => titleKey(i.title))),
      urls: new Set(items.flatMap((i) => (i.sources || []).map((s) => s.url)).filter(Boolean)),
    };
  } catch {
    return { titles: [], keys: new Set(), urls: new Set() };
  }
}

async function curate(candidates, alreadyPublished = []) {
  const list = candidates.map((c, i) => `${i + 1}. [${c.source}] ${c.title} (${c.date})\n   ${c.desc}\n   ${c.url}`).join('\n');
  const exclude = alreadyPublished.length
    ? `\n\nThese stories ran in the previous roundup. Do not pick any of them again, including the same story reported by a different outlet or under a different headline:\n${alreadyPublished.map((t) => `- ${t}`).join('\n')}`
    : '';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Candidate articles:\n\n${list}${exclude}` }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 4000, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

async function main() {
  if (!KEY) {
    console.error('draft-news: GEMINI_API_KEY not set, skipping (no draft written).');
    process.exit(0);
  }

  console.log(`draft-news: pulling ${FEEDS.length} feeds…`);
  const all = [];
  for (const f of FEEDS) {
    const items = await fetchFeed(f);
    console.log(`  ${f.name}: ${items.length} recent`);
    all.push(...items);
  }
  if (all.length === 0) {
    console.error('draft-news: no candidate articles found, skipping.');
    process.exit(0);
  }

  // Dedupe by normalized title; cap the list sent to the model.
  const seen = new Set();
  let candidates = all.filter((c) => {
    const k = c.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(k)) return false; seen.add(k); return true;
  });

  // Anything already published is out. A fortnightly roundup runs on a rolling
  // window, so a story that broke near the end of the last window is still in
  // this one's feeds, and running it twice is the most visible way to look like
  // nobody read it. Nvidia buying Hugging Face made both windows and got caught
  // by hand rather than here.
  const published = readPublished();
  const beforeDedupe = candidates.length;
  candidates = candidates.filter((c) => !published.urls.has(c.url) && !published.keys.has(titleKey(c.title)));
  const dropped = beforeDedupe - candidates.length;
  if (dropped) console.log(`  dropped ${dropped} already in data/news.json`);
  candidates = candidates.slice(0, 60);

  console.log(`draft-news: ${candidates.length} unique candidates → asking ${MODEL} to curate…`);
  const picked = await curate(candidates, published.titles);

  // Shape into the news.json item format, but keep it in the SEPARATE draft file.
  const shaped = picked.map((it, i) => ({
    id: String(it.id || `story-${i + 1}`).slice(0, 60),
    category: it.category === 'europe' || it.category === 'eu-policy' ? 'europe' : 'global',
    date: /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : '',
    title: String(it.title || '').slice(0, 120),
    subtitle: String(it.subtitle || '').slice(0, 160),
    summary: String(it.summary || ''),
    whyItMatters: String(it.whyItMatters || ''),
    whyForUs: String(it.whyForUs || ''),
    sources: [{ name: String(it.sourceName || 'Source'), url: String(it.sourceUrl || '') }],
    image: null,
  }));

  // Rule: exactly 12 items, at least 6 global + at least 6 european. Take 6 of each,
  // then top up to 12 from the leftovers if one bucket ran short (and warn, never
  // silently ship an unbalanced/short roundup).
  const globals = shaped.filter((x) => x.category === 'global');
  const europes = shaped.filter((x) => x.category === 'europe');
  if (globals.length < 6 || europes.length < 6) {
    console.warn(`draft-news: only ${globals.length} global / ${europes.length} european candidates, rule wants >=6 of each (12 total). Widen feeds or the date window.`);
  }
  const picked12 = [...globals.slice(0, 6), ...europes.slice(0, 6)];
  for (const x of shaped) { if (picked12.length >= 12) break; if (!picked12.includes(x)) picked12.push(x); }
  const items = picked12.slice(0, 12).map((x, i) => ({ ...x, n: i + 1 }));

  const draft = {
    generatedAt: new Date().toISOString(),
    // Copy this across as `curatedAt` (YYYY-MM-DD) when promoting a draft into
    // data/news.json. The News tab reads it for its "last reviewed" line, and a
    // date derived from git would report unrelated commits instead.
    curatedAt: new Date().toISOString().slice(0, 10),
    note: 'AUTO-GENERATED DRAFT for review. Copy good items into data/news.json by hand, then run `npm run fetch:news`. Not shown in the app.',
    windowLabel: '',
    items,
  };
  writeFileSync(OUT, JSON.stringify(draft, null, 2));
  console.log(`draft-news: wrote ${items.length} draft items → data/news-draft.json`);
}

main().catch((e) => { console.error('draft-news failed:', e.message); process.exit(1); });
