// Durable JSON state for polls + the feedback log.
//
// Both entry points use this module — `server.js` (production Express) and the
// dev middleware in `vite.config.js` — so the two can no longer drift apart.
// Writes are atomic (tmp file + rename) and serialised through a promise chain,
// because every mutation is a read-modify-write of one JSON file.

import { appendFileSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

export const LIMITS = {
  TEXT_MAX: 200,
  QUESTION_MAX: 200,
  SUBTITLE_MAX: 400,
  NAME_MAX: 64,
  FEEDBACK_MAX: 4000,
  CATEGORY_MAX: 32,
  MAX_OPTIONS_PER_POLL: 50,
  MAX_POLLS: 30,
  MAX_VOTES_PER_POLL: 500,
};

const FEEDBACK_HEADER =
  "# AI Workshop — Feedback Log\n\nCaptured via the dashboard's feedback button. Reviewed at quarterly health check.\n\n---\n";

export function createStore({ dataDir }) {
  const pollFile = join(dataDir, 'poll.json');
  const feedbackFile = join(dataDir, 'feedback.md');

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(feedbackFile)) writeFileSync(feedbackFile, FEEDBACK_HEADER);
  if (!existsSync(pollFile)) writeAtomic(pollFile, JSON.stringify({ polls: [] }, null, 2));

  // Serialises mutations WITHIN THIS PROCESS so two concurrent votes cannot both
  // read the same state and clobber each other. This is not cross-process
  // locking: two Node processes sharing one data dir (dev + prod on the same
  // checkout, a cluster, overlapping deploys) can still lose an update.
  // writeAtomic below prevents corruption, not lost updates.
  let queue = Promise.resolve();
  function serialise(fn) {
    const run = queue.then(fn, fn);
    // Keep the chain alive even when a mutation rejects.
    queue = run.then(noop, noop);
    return run;
  }

  function readState() {
    if (!existsSync(pollFile)) return { polls: [] };
    let raw;
    try {
      raw = JSON.parse(readFileSync(pollFile, 'utf8'));
    } catch (err) {
      // A truncated/corrupt file used to 500 every request forever. Quarantine
      // it and carry on with an empty state so the feature self-heals.
      const backup = `${pollFile}.corrupt-${Date.now()}`;
      try {
        renameSync(pollFile, backup);
        console.error(`poll store: ${pollFile} was unreadable (${err.message}); moved to ${backup}`);
      } catch {
        console.error(`poll store: ${pollFile} was unreadable (${err.message}) and could not be quarantined`);
      }
      writeAtomic(pollFile, JSON.stringify({ polls: [] }, null, 2));
      return { polls: [] };
    }
    return raw && Array.isArray(raw.polls) ? raw : { polls: [] };
  }

  function writeState(state) {
    writeAtomic(pollFile, JSON.stringify(state, null, 2));
  }

  function readFeedback() {
    const md = existsSync(feedbackFile) ? readFileSync(feedbackFile, 'utf8') : '';
    return parseFeedback(md);
  }

  function appendFeedback({ text, category, from }) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const safeText = escapeFeedbackBody(String(text).trim().replace(/\r/g, '').slice(0, LIMITS.FEEDBACK_MAX));
    const safeCategory = escapeInline(String(category || 'general').slice(0, LIMITS.CATEGORY_MAX));
    const safeFrom = escapeInline(String(from || 'anon').slice(0, LIMITS.NAME_MAX)) || 'anon';
    appendFileSync(feedbackFile, `\n## ${ts}\n**${safeCategory}** — ${safeFrom}\n\n${safeText}\n\n---\n`);
    return ts;
  }

  return { pollFile, feedbackFile, readState, writeState, serialise, readFeedback, appendFeedback };
}

function noop() {}

function writeAtomic(file, contents) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
    writeFileSync(tmp, contents);
    renameSync(tmp, file);
  } catch (err) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch {}
    throw err;
  }
}

// ---------------------------------------------------------------- feedback --

// The log is parsed back with a line-anchored regex, so user text must never be
// able to forge a `## ` heading, a `**bold** — ` byline, or an `---` separator.
function escapeFeedbackBody(text) {
  return text
    .split('\n')
    .map((line) => {
      if (/^\s{0,3}#{1,6}\s/.test(line)) return line.replace(/#/, '\\#');
      // The parser boundary is /\n---/ — it fires on ANY line starting with ---,
      // trailing text included, so match that exactly or entries get truncated.
      if (/^-{3,}/.test(line)) return `\\${line}`;
      return line;
    })
    .join('\n');
}

// Mirror of escapeFeedbackBody, so the backslashes we add for the parser's
// benefit never reach the reader.
function unescapeFeedbackBody(text) {
  return text
    .split('\n')
    .map((line) => (/^\\(-{3,}|\s{0,3}#{1,6}\s)/.test(line) ? line.slice(1) : line))
    .join('\n');
}

function escapeInline(s) {
  return s.replace(/[\r\n]+/g, ' ').replace(/[*_`|]/g, '').trim();
}

export function parseFeedback(md) {
  // `$` under /m matches at EVERY line end, so the lazy body stopped at the
  // first newline and every multi-line entry was truncated to one line.
  // `(?![\s\S])` is a true end-of-input assertion.
  const entries = [...md.matchAll(/^## (.+?)\n\*\*(.+?)\*\* — (.+?)\n\n([\s\S]*?)(?=\n---|\n## |(?![\s\S]))/gm)].map((m) => ({
    timestamp: m[1],
    category: m[2],
    from: m[3],
    text: unescapeFeedbackBody(m[4]).trim(),
  }));
  return entries.reverse();
}

// ------------------------------------------------------------------- polls --

export function normName(s) {
  return String(s || '').trim().toLowerCase();
}

export function makeId(text, prefix) {
  const slug = String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  // randomUUID, not Date.now(): two ids created in the same millisecond used to
  // collide, which silently merged two options into one.
  return `${slug || prefix || 'item'}-${randomUUID().slice(0, 8)}`;
}

export function newVoterToken() {
  return randomUUID();
}

// A voter is identified by their token when they have one, falling back to the
// normalised display name for records written before tokens existed.
function voterKey(vote) {
  return vote.token ? `t:${vote.token}` : `n:${normName(vote.name)}`;
}

// `callerToken` is never echoed back — it only decides the `myVote` / `mine`
// flags, so the client can render ownership without guessing from a name.
// Note the returned shape deliberately omits `creatorToken` and per-vote
// tokens; leaking either would hand over the credential.
export function withTallies(poll, callerToken) {
  const latest = new Map();
  for (const v of poll.votes || []) latest.set(voterKey(v), v);
  const counts = new Map();
  const voters = new Map();
  let myVote = null;
  for (const v of latest.values()) {
    counts.set(v.optionId, (counts.get(v.optionId) || 0) + 1);
    if (!voters.has(v.optionId)) voters.set(v.optionId, []);
    voters.get(v.optionId).push(v.name);
    if (callerToken && v.token === callerToken) myVote = v.optionId;
  }
  const options = (poll.options || [])
    .map((o) => ({ ...o, votes: counts.get(o.id) || 0, voters: voters.get(o.id) || [] }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return {
    id: poll.id,
    question: poll.question,
    subtitle: poll.subtitle,
    createdBy: poll.createdBy,
    createdAt: poll.createdAt,
    allowSuggestions: poll.allowSuggestions !== false,
    // Legacy polls have no creatorToken and can never be deleted from the UI;
    // that is deliberate — better than letting anyone claim them by name.
    mine: Boolean(callerToken && poll.creatorToken && poll.creatorToken === callerToken),
    myVote,
    options,
  };
}

export function withAllTallies(state, callerToken) {
  return {
    polls: (state.polls || [])
      .map((p) => withTallies(p, callerToken))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  };
}

// Collapse the vote log to one record per voter. Without this the array grew
// forever, since every vote appended a new row and only the last one counted.
//
// Eviction is by last activity, not first appearance: `Map.set` on an existing
// key keeps its original slot, so a plain slice() dropped the voters who joined
// earliest even when they had just re-voted. Delete-then-set moves the key to
// the end, and the final sort by timestamp makes the order explicit rather than
// dependent on Map internals.
export function compactVotes(poll) {
  const latest = new Map();
  for (const v of poll.votes || []) {
    const k = voterKey(v);
    if (latest.has(k)) latest.delete(k);
    latest.set(k, v);
  }
  const ordered = [...latest.values()].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  poll.votes = ordered.slice(-LIMITS.MAX_VOTES_PER_POLL);
  return poll;
}

// Rows written before tokens existed are keyed by name. When that person votes
// again they arrive with a fresh token, which would count them twice — once as
// `n:name`, once as `t:token`. Absorb the legacy row into the new identity.
// Trade-off: someone typing an existing name can retire that legacy row. That is
// no worse than the old name-only model, applies to a set that only shrinks, and
// is strictly better than permanently double-counting a real member.
export function dropLegacyVotesFor(poll, name) {
  const nn = normName(name);
  if (!nn) return;
  poll.votes = (poll.votes || []).filter((v) => v.token || normName(v.name) !== nn);
}

// Ownership is proven by token and nothing else.
//
// Polls created before tokens existed carry no creatorToken, so nobody can
// claim them through the API — a name fallback here would reopen the exact
// impersonation hole tokens were added to close, and it is what `withTallies`
// already reports to the client as `mine: false`. To remove a legacy poll,
// edit data/poll.json directly or set ADMIN_TOKEN and pass it as the token.
export function isCreator(poll, token) {
  if (!token) return false;
  const admin = process.env.ADMIN_TOKEN;
  if (admin && token === admin) return true;
  return Boolean(poll.creatorToken) && poll.creatorToken === token;
}
