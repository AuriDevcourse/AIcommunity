// Server-side gate for mutating API routes: (1) verify the caller's Supabase
// access token, (2) rate-limit per user/IP. Both reuse env already present
// (Supabase + Upstash). Reads stay open; only POST/PATCH/DELETE call guardMutation.
//
// Typed-name mode (no Supabase) is a real supported deployment, but it must be
// CHOSEN, not inherited from a missing env var. So: when auth is unconfigured,
// mutations are refused unless ALLOW_ANONYMOUS_WRITES=true says that is intended.
// A key that silently drops out of the environment now closes the door instead of
// opening it (SECURITY.md: fail closed if env unset).
//
// If Upstash isn't configured the limiter is skipped, which is a availability
// tradeoff, not an auth one.
const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPA_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const authConfigured = () => Boolean(SUPA_URL && SUPA_ANON);
// The only way to run writes without auth. Deliberately a strict string compare:
// an unset, empty or typo'd value means "no".
const anonWritesAllowed = () => process.env.ALLOW_ANONYMOUS_WRITES === 'true';

const NO_AUTH = {
  status: 503,
  json: { ok: false, error: 'Sign-in is not configured on this deployment, so changes are disabled.' },
};

export function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || '';
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : '';
}

function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '';
}

// Verify a Supabase JWT by asking the auth server who it belongs to. 60s cache so
// a burst of requests from one user doesn't hammer Supabase.
const userCache = new Map();
async function verifyToken(token) {
  if (!token || !authConfigured()) return null;
  const hit = userCache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPA_ANON },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user?.id) return null;
    userCache.set(token, { user, exp: Date.now() + 60_000 });
    return user;
  } catch {
    return null;
  }
}

async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  return (await r.json()).result;
}

// Fixed-window counter. Returns true if the call is within the limit.
async function withinLimit(id, bucket, limit, windowSec) {
  if (!KV_URL) return true; // no store → don't block
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${bucket}:${id}:${win}`;
  try {
    const n = await kv(['INCR', key]);
    if (n === 1) await kv(['EXPIRE', key, windowSec]);
    return n <= limit;
  } catch {
    return true; // fail open on limiter errors, never lock the app out over Redis
  }
}

// Resolve the verified Supabase user for a request, for routes that need the
// caller's identity (name/avatar/id) derived from the session, never the body.
// Returns one of:
//   { configured: false }  → Supabase isn't set up (auth unavailable)
//   { blocked: {status,json} } → no/invalid token; send this response
//   { user }               → the verified Supabase user object
export async function requireUser(req) {
  if (!authConfigured()) {
    if (!anonWritesAllowed()) return { blocked: NO_AUTH };
    return { configured: false };
  }
  const user = await verifyToken(bearer(req));
  if (!user) return { blocked: { status: 401, json: { ok: false, error: 'Please sign in to do that.' } } };
  return { user };
}

// A per-minute rate limit caps how FAST a caller hits a route. It says nothing
// about the total: at 10/minute a signed-in member can make 14,400 calls to a paid
// model in a day and never trip it. For anything that costs money per call, the
// daily cap is the one that bounds the bill.
//
// Keyed by UTC day and expired after two, so the keys clean themselves up.
async function withinDailyQuota(id, bucket, limit) {
  if (!KV_URL) return true; // no store, same fail-open as the limiter
  const day = new Date().toISOString().slice(0, 10);
  const key = `q:${bucket}:${id}:${day}`;
  try {
    const n = await kv(['INCR', key]);
    if (n === 1) await kv(['EXPIRE', key, 172800]);
    return n <= limit;
  } catch {
    return true;
  }
}

// Guard a mutating request. Returns null when allowed, or { status, json } to send.
export async function guardMutation(req, { bucket = 'api', limit = 60, windowSec = 60, dailyLimit = 0 } = {}) {
  let id = null;
  if (authConfigured()) {
    const user = await verifyToken(bearer(req));
    if (!user) return { status: 401, json: { ok: false, error: 'Please sign in to do that.' } };
    id = user.id;
  } else if (!anonWritesAllowed()) {
    // Auth is not set up and nobody said that was on purpose. Refuse.
    console.error('[guard] refusing a write: Supabase auth is unconfigured and ALLOW_ANONYMOUS_WRITES is not "true"');
    return NO_AUTH;
  }
  id = id || clientIp(req) || 'anon';
  if (!(await withinLimit(id, bucket, limit, windowSec))) {
    return { status: 429, json: { ok: false, error: 'Too many requests. Please slow down and try again shortly.' } };
  }
  if (dailyLimit && !(await withinDailyQuota(id, bucket, dailyLimit))) {
    return { status: 429, json: { ok: false, error: "You've reached today's limit for this tool. It resets at midnight UTC." } };
  }
  return null;
}

// Gate a READ. Members, Photos and Forum are members-only, and the client wall
// alone was cosmetic: three curls returned every photo URL, poll and name. So the
// routes behind those tabs now ask who is reading.
//
// Mirrors the client rule in App.jsx: when Supabase is not configured there is
// no sign-in, so nothing is gated and reads stay open. When it is configured, a
// missing or invalid token is a 401. Returns one of:
//   { open: true, user: null }     → auth unconfigured, serve everything
//   { blocked: {status,json} }     → send this response
//   { user }                       → the verified reader
export async function requireReader(req) {
  if (!authConfigured()) return { open: true, user: null };
  const user = await verifyToken(bearer(req));
  if (!user) return { blocked: { status: 401, json: { ok: false, error: 'Sign in to see this.' } } };
  return { user };
}

// Responses that depend on the Authorization header must never sit in a shared
// edge cache, or one member's reply is served to the next stranger.
export const PRIVATE_CACHE = 'private, no-store';
