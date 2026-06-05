import { createClient } from '@supabase/supabase-js';

// Configured via env. When the keys are absent (e.g. before the Supabase project
// is set up), authEnabled is false and the app keeps its typed-name flow.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authEnabled = Boolean(url && anon);

// PKCE flow returns the auth result as a `?code=` query param instead of a URL
// hash, so it never collides with this app's hash-based tab routing (#cockpit).
export const supabase = authEnabled
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

// Current Supabase access token (or '' in typed-name / unauthenticated mode).
export async function accessToken() {
  if (!authEnabled) return '';
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
  } catch {
    return '';
  }
}

// fetch() that attaches the signed-in user's bearer token, so mutating API routes
// can verify the caller server-side. Use for every POST/PATCH/DELETE to /api/*.
export async function authedFetch(input, options = {}) {
  const token = await accessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(input, { ...options, headers });
}
