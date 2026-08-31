// Proves that mutating routes take identity from the verified session and never
// from the request body.
//
//   node scripts/identity-check.mjs
//
// Before the identity fix, every handler read `body.name`. A signed-in member
// could vote as anyone, post under anyone's name, and delete anyone's topic or
// comment. Each case below is one of those attacks, run against the real
// handlers with an in-memory store.

import { handlePolls } from '../api/_polls-core.js';
import { handleThreads } from '../api/_threads.js';
import { handleTopics } from '../api/_topics.js';

const alice = { id: 'uid-alice', email: 'alice@example.com', user_metadata: { full_name: 'Alice Doe' } };
const bob = { id: 'uid-bob', email: 'bob@example.com', user_metadata: { full_name: 'Bob Roe' } };

let pass = 0;
const fails = [];
function check(label, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  FAIL ${label}${detail ? `, ${detail}` : ''}`); }
}

// ------------------------------------------------------------- in-memory stores
function pollStore() {
  let polls = [];
  const votes = {};
  return {
    async listPolls() { return polls; },
    async savePolls(a) { polls = a; },
    async getVotes(id) { return votes[id] || {}; },
    async putVote(id, key, value) { (votes[id] ||= {})[key] = value; },
    async delVote(id, key) { if (votes[id]) delete votes[id][key]; },
    _votes: votes,
  };
}
function threadStore() {
  const comments = {};
  const votes = {};
  return {
    async list(d) { return comments[d] || (comments[d] = []); },
    async save(d, a) { comments[d] = a; },
    async getVotes(d) { return votes[d] || (votes[d] = {}); },
    async setVote(d, f, v) { (votes[d] ||= {})[f] = v; },
    async delVote(d, f) { if (votes[d]) delete votes[d][f]; },
    async purge(d) { delete comments[d]; delete votes[d]; },
    _votes: votes,
  };
}
function topicStore() {
  let topics = [];
  return { async list() { return topics; }, async save(a) { topics = a; } };
}

console.log('\nPOLLS');
{
  const store = pollStore();
  await handlePolls({
    method: 'POST', user: alice, store,
    body: { action: 'create', question: 'Best day?', options: ['Sat', 'Sun'], createdBy: 'Somebody Else' },
  });
  const [poll] = await store.listPolls();
  check('create is attributed to the session, not body.createdBy',
    poll.createdBy === 'Alice Doe', `got ${poll.createdBy}`);

  // Alice votes.
  await handlePolls({ method: 'POST', user: alice, store, body: { action: 'vote', pollId: poll.id, optionIds: ['o1'] } });
  // Bob now tries to overwrite her vote by sending her name.
  await handlePolls({ method: 'POST', user: bob, store, body: { action: 'vote', pollId: poll.id, name: 'Alice Doe', optionIds: ['o2'] } });

  const votes = store._votes[poll.id];
  check('one vote row per user id, not per name', Object.keys(votes).length === 2,
    `keys: ${Object.keys(votes).join(',')}`);
  check("Bob cannot overwrite Alice's vote", votes['uid-alice']?.optionIds[0] === 'o1',
    `alice now has ${votes['uid-alice']?.optionIds}`);
  check('Bob\'s vote is recorded under his own name', votes['uid-bob']?.name === 'Bob Roe',
    `got ${votes['uid-bob']?.name}`);

  const res = await handlePolls({ method: 'GET', store });
  check('both votes counted once each', res.json.polls[0].totalVoters === 2,
    `totalVoters ${res.json.polls[0].totalVoters}`);
}

console.log('\nPOLLS · legacy name-keyed vote');
{
  const store = pollStore();
  await handlePolls({ method: 'POST', user: alice, store, body: { action: 'create', question: 'Q?', options: ['a', 'b'] } });
  const [poll] = await store.listPolls();
  // Simulate a vote cast before the fix: keyed on the normalised display name.
  await store.putVote(poll.id, 'alice doe', { name: 'Alice Doe', optionIds: ['o1'] });
  await handlePolls({ method: 'POST', user: alice, store, body: { action: 'vote', pollId: poll.id, optionIds: ['o2'] } });
  const votes = store._votes[poll.id];
  check('re-voting clears the legacy row instead of double-counting',
    Object.keys(votes).length === 1 && votes['uid-alice']?.optionIds[0] === 'o2',
    `keys: ${Object.keys(votes).join(',')}`);
}

console.log('\nTHREADS');
{
  const store = threadStore();
  const date = '2026-09-06';
  // Alice posts, claiming to be Bob.
  const posted = await handleThreads({
    method: 'POST', user: alice, store,
    body: { action: 'post', date, text: 'hello', name: 'Bob Roe' },
  });
  check('post is bylined from the session, not body.name',
    posted.json.comment.name === 'Alice Doe', `got ${posted.json.comment.name}`);
  check('post records the owning user id', posted.json.comment.userId === 'uid-alice');

  const id = posted.json.comment.id;

  // Bob tries to delete Alice's comment by passing her name.
  const del = await handleThreads({
    method: 'POST', user: bob, store,
    body: { action: 'delete', date, id, name: 'Alice Doe' },
  });
  check("Bob cannot delete Alice's comment", del.status === 403, `status ${del.status}`);
  check('the comment survived', (await store.list(date)).length === 1);

  // Alice can delete her own.
  const own = await handleThreads({ method: 'POST', user: alice, store, body: { action: 'delete', date, id } });
  check('Alice can delete her own comment', own.status === 200 && (await store.list(date)).length === 0,
    `status ${own.status}`);
}

console.log('\nTHREADS · votes and legacy ownership');
{
  const store = threadStore();
  const date = '2026-09-06';
  const posted = await handleThreads({ method: 'POST', user: alice, store, body: { action: 'post', date, text: 'idea' } });
  const id = posted.json.comment.id;

  await handleThreads({ method: 'POST', user: alice, store, body: { action: 'vote', date, id, dir: 'up' } });
  await handleThreads({ method: 'POST', user: bob, store, body: { action: 'vote', date, id, dir: 'down', name: 'Alice Doe' } });
  const fields = Object.keys(store._votes[date]);
  check('vote fields are keyed per user id', fields.length === 2, `fields: ${fields.join(',')}`);
  check("Alice's up-vote survived Bob's attempt to overwrite it",
    store._votes[date][`${id}|uid-alice`]?.dir === 'up');

  // A comment written before the fix has a name and no userId.
  const legacy = { id: 'legacy1', name: 'Alice Doe', text: 'old', images: [], createdAt: '2026-01-01T00:00:00Z', parentId: null };
  await store.save(date, [...(await store.list(date)), legacy]);
  const byBob = await handleThreads({ method: 'POST', user: bob, store, body: { action: 'delete', date, id: 'legacy1', name: 'Alice Doe' } });
  check('legacy comment is not deletable by another member', byBob.status === 403, `status ${byBob.status}`);
  const byAlice = await handleThreads({ method: 'POST', user: alice, store, body: { action: 'delete', date, id: 'legacy1' } });
  check('legacy comment is still deletable by its author', byAlice.status === 200, `status ${byAlice.status}`);
}

console.log('\nTOPICS');
{
  const store = topicStore();
  const created = await handleTopics({
    method: 'POST', user: alice, store,
    body: { action: 'create', title: 'Local models', name: 'Bob Roe' },
  });
  check('topic is attributed to the session, not body.name',
    created.json.topic.createdBy === 'Alice Doe', `got ${created.json.topic.createdBy}`);
  const id = created.json.topic.id;

  const del = await handleTopics({ method: 'POST', user: bob, store, body: { action: 'delete', id, name: 'Alice Doe' } });
  check("Bob cannot delete Alice's topic (this cascades into purgeThread)",
    del.status === 403, `status ${del.status}`);
  check('the topic survived', (await store.list()).length === 1);

  const own = await handleTopics({ method: 'POST', user: alice, store, body: { action: 'delete', id } });
  check('Alice can delete her own topic', own.status === 200, `status ${own.status}`);
}

console.log('\nTYPED-NAME MODE (no Supabase configured, user = null)');
{
  const store = pollStore();
  await handlePolls({ method: 'POST', user: null, store, body: { action: 'create', question: 'Q?', options: ['a', 'b'] } });
  const [poll] = await store.listPolls();
  const voted = await handlePolls({ method: 'POST', user: null, store, body: { action: 'vote', pollId: poll.id, name: 'Guest', optionIds: ['o1'] } });
  check('typed name still works when auth is unavailable', voted.status === 200, `status ${voted.status}`);
  const missing = await handlePolls({ method: 'POST', user: null, store, body: { action: 'vote', pollId: poll.id, optionIds: ['o1'] } });
  check('a missing name is still rejected', missing.status === 400, `status ${missing.status}`);
}

console.log(`\n${fails.length ? 'FAIL' : 'PASS'}, ${pass} assertions passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(`  · ${f}`)); process.exit(1); }
