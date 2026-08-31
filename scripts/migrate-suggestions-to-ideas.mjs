// One-time migration: copy the standalone Suggestions board into the Forum's
// "Ideas" thread (channel `ideas`), preserving ids, authors, timestamps and votes.
//
// Idempotent: re-running only adds suggestions/votes that aren't already in the
// ideas thread. The original suggestions store is left untouched as a backup.
//
// Run against the live Upstash store (same one local dev uses):
//   node --env-file=.env.local scripts/migrate-suggestions-to-ideas.mjs --dry   (preview)
//   node --env-file=.env.local scripts/migrate-suggestions-to-ideas.mjs         (apply)

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const DRY = process.argv.includes('--dry');

if (!KV_URL || !KV_TOKEN) {
  console.error('Missing Upstash creds. Run with: node --env-file=.env.local scripts/migrate-suggestions-to-ideas.mjs');
  process.exit(1);
}

const SUG_LIST = 'aiworkshop:suggestions';
const sugVotes = (id) => `aiworkshop:sugvotes:${id}`;
const IDEAS_THREAD = 'aiworkshop:thread:ideas';
const IDEAS_VOTES = 'aiworkshop:thrvotes:ideas';
const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function cmd(command) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}: ${await r.text()}`);
  return (await r.json()).result;
}

const getJson = async (key) => { const raw = await cmd(['GET', key]); return raw ? JSON.parse(raw) : null; };
async function hgetall(key) {
  const flat = (await cmd(['HGETALL', key])) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* skip */ } }
  return out;
}

async function main() {
  const suggestions = (await getJson(SUG_LIST)) || [];
  const existing = (await getJson(IDEAS_THREAD)) || [];
  const existingIds = new Set(existing.map((c) => c.id));
  const existingVoteFields = new Set(Object.keys(await hgetall(IDEAS_VOTES)));

  console.log(`Found ${suggestions.length} suggestions · ${existing.length} comments already in ideas thread.`);

  const newComments = [];
  const newVotes = []; // { field, value }
  let voteCount = 0;

  for (const s of suggestions) {
    if (!existingIds.has(s.id)) {
      newComments.push({
        id: s.id,
        name: s.createdBy || 'Anonymous',
        text: String(s.text || ''),
        images: [],
        createdAt: s.createdAt || new Date().toISOString(),
        parentId: null,
      });
    }
    const votes = await hgetall(sugVotes(s.id)); // { normName: { name, dir } }
    for (const v of Object.values(votes)) {
      const field = `${s.id}|${normName(v.name)}`;
      if (!existingVoteFields.has(field)) { newVotes.push({ field, value: v }); voteCount++; }
    }
  }

  console.log(`Will add ${newComments.length} ideas and ${voteCount} votes.`);
  if (DRY) {
    newComments.forEach((c) => console.log(`  + [${c.name}] ${c.text.slice(0, 60)}`));
    console.log('\nDry run, nothing written. Re-run without --dry to apply.');
    return;
  }
  if (newComments.length === 0 && newVotes.length === 0) {
    console.log('Nothing to migrate. Ideas thread already up to date.');
    return;
  }

  // Append comments (preserve any existing), then write votes.
  const merged = [...existing, ...newComments];
  await cmd(['SET', IDEAS_THREAD, JSON.stringify(merged)]);
  for (const { field, value } of newVotes) {
    await cmd(['HSET', IDEAS_VOTES, field, JSON.stringify(value)]);
  }

  console.log(`Done. Ideas thread now has ${merged.length} comments. Original suggestions store kept as backup.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
