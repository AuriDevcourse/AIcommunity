// The member directory, fetched from the signed-in /api/members route.
//
// It used to be a static import of src/data.json, which put every name in the
// public bundle. Now the bundle carries counts and this hook loads the people
// once per page load, shared by every component that asks (Members gallery, the
// RSVP list, session recaps).
import { useEffect, useState } from 'react';
import { authedFetch } from './supabase.js';

let cache = null;
let inflight = null;

export async function loadMembersData() {
  if (cache) return cache;
  if (!inflight) {
    inflight = authedFetch('/api/members')
      .then(async (r) => {
        if (r.status === 401) throw Object.assign(new Error('Sign in to see the members.'), { status: 401 });
        if (!r.ok) throw new Error(`members API returned HTTP ${r.status}`);
        const j = await r.json();
        cache = { members: j.members || [], profiles: j.profiles || {}, attendeesByDate: j.attendeesByDate || {}, you: j.you || {} };
        return cache;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

// Drop the cached directory, e.g. on sign-out, so the next signed-in user does
// not see a previous session's copy.
export function clearMembersCache() { cache = null; }

const EMPTY = { members: [], profiles: {}, attendeesByDate: {}, you: {} };

// Is the signed-in caller an organizer? Decided by the server from the verified
// session (ORGANIZER_EMAILS) and returned with /api/members as `you.organizer`.
// Used only to show or hide controls; every route re-checks the role itself.
export function useIsOrganizer() {
  const { data } = useMembersData();
  return Boolean(data?.you?.organizer);
}

// { data, loading, error }. Pass enabled=false to skip the request entirely
// (a signed-out visitor on a public page), in which case data is empty.
export function useMembersData(enabled = true) {
  const [state, setState] = useState(() => ({ data: cache || EMPTY, loading: enabled && !cache, error: null }));
  useEffect(() => {
    if (!enabled) { setState({ data: EMPTY, loading: false, error: null }); return; }
    let alive = true;
    setState(cache ? { data: cache, loading: false, error: null } : { data: EMPTY, loading: true, error: null });
    loadMembersData()
      .then((d) => { if (alive) setState({ data: d, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ data: EMPTY, loading: false, error: e }); });
    return () => { alive = false; };
  }, [enabled]);
  return state;
}
