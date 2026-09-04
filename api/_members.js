// The member directory, served only to signed-in members.
//
// Until 2026-09-02 `data.members` and every session's attendee list were part of
// src/data.json, a static import, so all 23 names shipped inside the public JS
// bundle and the "members-only" wall protected nothing. build-data now writes the
// people data to api/_members-data.js (server-side only) and leaves counts in the
// bundle. This module reads that file and shapes the response.
import membersData from './_members-data.js';
import { isOrganizer } from './_roles.js';

// `you` tells the client what the caller may do, decided server-side from the
// verified session. The client only uses it to show or hide controls; every
// route re-checks the role itself.
export function membersPayload(user = null) {
  const { members = [], profiles = {}, attendeesByDate = {} } = membersData || {};
  return {
    ok: true,
    members,
    profiles,
    attendeesByDate,
    you: { organizer: isOrganizer(user) },
    generatedAt: membersData?.generatedAt || null,
  };
}

export async function handleMembers({ method, user = null }) {
  if (method !== 'GET') return { status: 405, json: { ok: false, error: 'method not allowed' } };
  return { status: 200, json: membersPayload(user) };
}
