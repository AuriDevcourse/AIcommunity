// Writes that actually look at the response.
//
// fetch() only rejects on a network error, so `await authedFetch(...)` resolves
// perfectly happily on a 401. Every `try { await authedFetch(...) } catch {}`
// around a write in this app was therefore dead code: the catch could not fire,
// nothing checked res.ok, and a refused write looked exactly like a successful
// one until the next reload put the old value back.
//
// Callers get a plain result to branch on, never an exception to forget.
import { authedFetch } from './supabase.js';

// Used only when the server sent no message of its own.
const FALLBACK = {
  401: 'Please sign in to do that.',
  403: "You don't have permission to do that.",
  404: 'That is no longer there. Refresh and try again.',
  413: 'That file is too large.',
  429: 'Too many requests. Please slow down and try again shortly.',
};

// Resolves to { ok: true, data } or { ok: false, status, error }, where `error`
// is a sentence safe to put in front of a person.
export async function writeJson(url, options = {}) {
  let res;
  try {
    res = await authedFetch(url, options);
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server. Check your connection and try again.' };
  }
  let body = null;
  try { body = await res.json(); } catch { /* empty or non-JSON body, fine */ }
  // The API answers { ok: false, error } with a real status, but belt and braces:
  // a 200 carrying ok:false is still a failure.
  if (!res.ok || body?.ok === false) {
    return {
      ok: false,
      status: res.status,
      error: body?.error || FALLBACK[res.status] || `That didn't save (HTTP ${res.status}).`,
    };
  }
  return { ok: true, status: res.status, data: body };
}
