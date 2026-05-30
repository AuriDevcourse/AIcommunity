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
