// Transport-agnostic API handlers shared by the production Express server and
// the Vite dev middleware. Each handler takes a plain request object and returns
// `{ status, body }` — no framework types leak in, so the two entry points can
// never drift in validation or behaviour again.

import {
  LIMITS,
  createStore,
  makeId,
  newVoterToken,
  withAllTallies,
  compactVotes,
  dropLegacyVotesFor,
  isCreator,
} from './store.js';

const ok = (body) => ({ status: 200, body: { ok: true, ...body } });
const fail = (status, error) => ({ status, body: { ok: false, error } });

// Simple in-process fixed-window limiter. Enough to stop a bored member (or a
// loop) flooding the JSON files; this is a meetup dashboard, not a bank.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return function check(key) {
    const now = Date.now();
    const bucket = hits.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      }
      return true;
    }
    bucket.count += 1;
    return bucket.count <= max;
  };
}

export function createApi({ dataDir }) {
  const store = createStore({ dataDir });
  const writeLimit = createRateLimiter({ windowMs: 60_000, max: 40 });
  const feedbackLimit = createRateLimiter({ windowMs: 60_000, max: 8 });

  const state = (token) => withAllTallies(store.readState(), token);

  // ------------------------------------------------------------- feedback --

  // The log is described in its own header as "reviewed at quarterly health
  // check" — i.e. an organiser's notebook, not a public wall. Reading back every
  // entry (with names) to anyone who opens the panel is a privacy leak once this
  // is reachable beyond localhost, so it is opt-in.
  //
  // FEEDBACK_LOG_PUBLIC=true restores the old behaviour. Otherwise the endpoint
  // reports only how many entries exist, which is all the UI needs to confirm a
  // submission landed.
  function getFeedback() {
    if (String(process.env.FEEDBACK_LOG_PUBLIC || '').toLowerCase() === 'true') {
      return { status: 200, body: { entries: store.readFeedback(), visible: true } };
    }
    return { status: 200, body: { entries: [], count: store.readFeedback().length, visible: false } };
  }

  function postFeedback({ body, ip }) {
    if (!feedbackLimit(ip)) return fail(429, 'too many submissions — try again in a minute');
    const text = body?.text;
    if (!text || typeof text !== 'string' || !text.trim()) return fail(400, 'empty text');
    const timestamp = store.appendFeedback({
      text,
      category: body.category || 'general',
      from: body.from || 'anon',
    });
    return ok({ timestamp });
  }

  // ---------------------------------------------------------------- polls --

  // The caller's token decides what "my vote" and "my poll" mean — the client
  // must never infer identity from a typed name.
  function getPolls({ token } = {}) {
    return { status: 200, body: state(token) };
  }

  function createPoll({ body, ip }) {
    if (!writeLimit(ip)) return fail(429, 'slow down');
    const question = String(body?.question || '').trim().slice(0, LIMITS.QUESTION_MAX);
    const subtitle = String(body?.subtitle || '').trim().slice(0, LIMITS.SUBTITLE_MAX);
    const name = String(body?.name || '').trim().slice(0, LIMITS.NAME_MAX);
    const allowSuggestions = body?.allowSuggestions !== false;
    if (!question || !name) return fail(400, 'question and name required');

    return store.serialise(() => {
      const s = store.readState();
      if (s.polls.length >= LIMITS.MAX_POLLS) return fail(400, 'poll limit reached');
      // The token is minted server-side and returned once. Only the browser
      // that created the poll can later delete it — a name is not a credential.
      const creatorToken = newVoterToken();
      s.polls.push({
        id: makeId(question, 'poll'),
        question,
        subtitle,
        createdBy: name,
        creatorToken,
        createdAt: new Date().toISOString(),
        allowSuggestions,
        options: [],
        votes: [],
      });
      store.writeState(s);
      return ok({ pollId: s.polls[s.polls.length - 1].id, creatorToken, state: withAllTallies(s, creatorToken) });
    });
  }

  function deletePoll({ params, body, ip, token: hdr }) {
    if (!writeLimit(ip)) return fail(429, 'slow down');
    const token = String(hdr || body?.token || '').trim();
    if (!token) return fail(403, 'only the creator of this poll can delete it');

    return store.serialise(() => {
      const s = store.readState();
      const idx = s.polls.findIndex((p) => p.id === params.pollId);
      if (idx === -1) return fail(404, 'poll not found');
      if (!isCreator(s.polls[idx], token)) {
        return fail(403, 'only the creator of this poll can delete it');
      }
      s.polls.splice(idx, 1);
      store.writeState(s);
      return ok({ state: withAllTallies(s, token) });
    });
  }

  function addOption({ params, body, ip, token: hdr }) {
    if (!writeLimit(ip)) return fail(429, 'slow down');
    const text = String(body?.text || '').trim().slice(0, LIMITS.TEXT_MAX);
    const name = String(body?.name || '').trim().slice(0, LIMITS.NAME_MAX);
    const token = String(hdr || body?.token || '').trim();
    if (!text || !name) return fail(400, 'text and name required');

    return store.serialise(() => {
      const s = store.readState();
      const poll = s.polls.find((p) => p.id === params.pollId);
      if (!poll) return fail(404, 'poll not found');
      if (!poll.allowSuggestions && !isCreator(poll, token)) {
        return fail(403, 'this poll does not accept suggestions');
      }
      if (poll.options.length >= LIMITS.MAX_OPTIONS_PER_POLL) return fail(400, 'option limit reached');
      const dupe = poll.options.find((o) => o.text.trim().toLowerCase() === text.toLowerCase());
      if (dupe) return ok({ duplicate: true, optionId: dupe.id, state: withAllTallies(s, token) });
      const option = { id: makeId(text, 'opt'), text, createdBy: name, createdAt: new Date().toISOString() };
      poll.options.push(option);
      store.writeState(s);
      return ok({ optionId: option.id, state: withAllTallies(s, token) });
    });
  }

  function vote({ params, body, ip, token: hdr }) {
    if (!writeLimit(ip)) return fail(429, 'slow down');
    const optionId = String(body?.optionId || '').trim();
    const name = String(body?.name || '').trim().slice(0, LIMITS.NAME_MAX);
    // First vote from a fresh browser mints the identity and returns it.
    const token = String(hdr || body?.token || '').trim() || newVoterToken();
    if (!optionId || !name) return fail(400, 'optionId and name required');

    return store.serialise(() => {
      const s = store.readState();
      const poll = s.polls.find((p) => p.id === params.pollId);
      if (!poll) return fail(404, 'poll not found');
      if (!poll.options.find((o) => o.id === optionId)) return fail(404, 'option not found');
      poll.votes = (poll.votes || []).filter((v) => v.token !== token);
      // Absorb any pre-token row for this name so one person is not tallied twice.
      dropLegacyVotesFor(poll, name);
      poll.votes.push({ optionId, name, token, ts: new Date().toISOString() });
      // Keep one record per voter so the log cannot grow without bound.
      compactVotes(poll);
      store.writeState(s);
      return ok({ token, state: withAllTallies(s, token) });
    });
  }

  function unvote({ params, ip, token: hdr, body }) {
    if (!writeLimit(ip)) return fail(429, 'slow down');
    const token = String(hdr || body?.token || '').trim();
    // Token only: matching on name would let anyone clear another member's vote.
    if (!token) return fail(400, 'no vote to clear');

    return store.serialise(() => {
      const s = store.readState();
      const poll = s.polls.find((p) => p.id === params.pollId);
      if (!poll) return fail(404, 'poll not found');
      poll.votes = (poll.votes || []).filter((v) => v.token !== token);
      store.writeState(s);
      return ok({ state: withAllTallies(s, token) });
    });
  }

  return { store, getFeedback, postFeedback, getPolls, createPoll, deletePoll, addOption, vote, unvote };
}

// Maps a method + path (already stripped of the /api/poll prefix) onto a
// handler, so both entry points route identically.
export function routePoll(method, path) {
  const clean = (path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (method === 'GET' && clean === '/') return { handler: 'getPolls', params: {} };
  if (method === 'POST' && clean === '/') return { handler: 'createPoll', params: {} };

  let m = clean.match(/^\/([^/]+)$/);
  if (m && method === 'DELETE') return { handler: 'deletePoll', params: { pollId: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/([^/]+)\/option$/);
  if (m && method === 'POST') return { handler: 'addOption', params: { pollId: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/([^/]+)\/vote$/);
  if (m && method === 'POST') return { handler: 'vote', params: { pollId: decodeURIComponent(m[1]) } };
  if (m && method === 'DELETE') return { handler: 'unvote', params: { pollId: decodeURIComponent(m[1]) } };

  return null;
}
