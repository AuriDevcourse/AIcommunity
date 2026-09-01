// Proves guardMutation's behaviour in the three environment shapes it can be in.
//
//   node scripts/guard-check.mjs
//
// The case that matters is the middle one: before 2026-09-01 a deployment with
// no Supabase env accepted anonymous writes to every mutating route, because the
// auth check was wrapped in `if (authConfigured())`. Typed-name mode is still
// supported, it just has to be asked for now.
//
// Each case re-imports the module with a cache-busting query so the env is read
// fresh, since _guard.js reads process.env at module scope.
const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: Boolean(cond), detail });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${detail && !cond ? ` · ${detail}` : ''}`);
};

const AUTH = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key' };
const req = (headers = {}) => ({ headers, socket: { remoteAddress: '198.51.100.7' } });

// _guard.js logs a console.error every time it refuses an unconfigured write.
// That is wanted in production and noise here: the audit reports each suite by
// its LAST output line, and an interleaved stderr write can land after the
// verdict. Swallow it for the duration of the cases.
const realError = console.error;
console.error = () => {};
process.on('exit', () => { console.error = realError; });

async function withEnv(env, fn) {
  const saved = {};
  const keys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'ALLOW_ANONYMOUS_WRITES', 'KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'];
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  try {
    const mod = await import(`../api/_guard.js?case=${encodeURIComponent(JSON.stringify(env))}`);
    return await fn(mod);
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

console.log('\nguard-check\n');

// 1. No auth configured, no opt-in → the regression case. Must refuse.
await withEnv({}, async ({ guardMutation, requireUser }) => {
  const g = await guardMutation(req());
  check('unconfigured auth REFUSES a write', g && g.status === 503, `got ${g ? g.status : 'null (allowed!)'}`);
  const u = await requireUser(req());
  check('unconfigured auth REFUSES requireUser', Boolean(u.blocked), JSON.stringify(u));
});

// 2. No auth configured, explicit opt-in → typed-name mode still works.
await withEnv({ ALLOW_ANONYMOUS_WRITES: 'true' }, async ({ guardMutation, requireUser }) => {
  const g = await guardMutation(req());
  check('opt-in restores typed-name mode', g === null, `got ${JSON.stringify(g)}`);
  const u = await requireUser(req());
  check('opt-in makes requireUser report unconfigured', u.configured === false, JSON.stringify(u));
});

// 3. The opt-in must be exactly "true", not any truthy string.
await withEnv({ ALLOW_ANONYMOUS_WRITES: '1' }, async ({ guardMutation }) => {
  const g = await guardMutation(req());
  check('opt-in of "1" is NOT accepted', g && g.status === 503, `got ${g ? g.status : 'null (allowed!)'}`);
});

// 4. Auth configured, no token → the normal signed-out case, still 401.
await withEnv(AUTH, async ({ guardMutation }) => {
  const g = await guardMutation(req());
  check('configured auth still 401s an anonymous write', g && g.status === 401, `got ${g ? g.status : 'null (allowed!)'}`);
});

// 5. The daily quota. It needs a KV store, so stub one: the module talks to
//    Upstash over plain fetch, and every call it makes here is an INCR or EXPIRE.
//    Without this the quota silently returns true (documented fail-open) and a
//    passing test would prove nothing.
await withEnv({ ...AUTH, KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' }, async (mod) => {
  let counter = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts?.body || '[]');
    // The token check hits Supabase; say the caller is a valid user.
    if (String(url).includes('supabase')) {
      return { ok: true, json: async () => ({ id: 'user-1' }) };
    }
    if (body[0] === 'INCR') return { ok: true, json: async () => ({ result: ++counter }) };
    return { ok: true, json: async () => ({ result: 1 }) };
  };
  try {
    const req = { headers: { authorization: 'Bearer tok' }, socket: { remoteAddress: '1.1.1.1' } };
    // Rate window and daily cap share the counter here, so give the rate limit
    // plenty of room and let the daily cap of 3 be the thing that bites.
    const calls = [];
    for (let i = 0; i < 5; i++) calls.push(await mod.guardMutation(req, { bucket: 'paid', limit: 1000, dailyLimit: 3 }));
    const blockedAt = calls.findIndex((c) => c !== null);
    check('a daily quota blocks once it is exceeded', blockedAt !== -1, 'never blocked');
    const last = calls[calls.length - 1];
    check('the daily-quota refusal is a 429 that says it resets', Boolean(last) && last.status === 429 && /resets/i.test(last.json.error), JSON.stringify(last));
  } finally {
    globalThis.fetch = realFetch;
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? `GUARD FAIL · ${failed.length} of ${results.length}` : `GUARD PASS · ${results.length} passed`}\n`);
process.exit(failed.length ? 1 : 0);
