// Who the caller is, one source of truth for every mutating route.
//
// The rule: identity NEVER comes from the request body. `guardMutation` proves
// the caller holds a valid Supabase session; these helpers turn that verified
// session into the display name, avatar and storage key the handlers use.
//
// Before this existed, each handler read `body.name`, so a signed-in member
// could act as anyone: overwrite another person's vote, post under their name,
// or delete their topics and comments.
//
// Mirrors the client's helpers (src/lib/auth.jsx) so the same person renders
// identically wherever their name appears.

export function nameOf(user) {
  const m = user?.user_metadata || {};
  return String(
    m.full_name || m.name || (user?.email ? user.email.split('@')[0] : '') || 'Member',
  ).slice(0, 48);
}

export function avatarOf(user) {
  const m = user?.user_metadata || {};
  return String(m.avatar_url || m.picture || '').slice(0, 500);
}

// Stable per-person key for vote hashes. The Supabase user id, not the display
// name, a name can be changed in the profile editor, and two members can share
// one. Votes keyed on a name let anyone overwrite anyone.
export function voterKey(user) {
  return String(user?.id || '').slice(0, 64);
}

// Collapse a name for comparison (legacy records stored a name and no user id).
export const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Does this verified caller own a record?
//
// Records written after the identity fix carry `userId`, which is the only thing
// checked. Older records have a name and nothing else, so they fall back to
// matching against the name on the VERIFIED session, never a name from the
// body, which is what made the original hole.
export function ownsRecord(record, user, nameField = 'name') {
  if (!user) return false;
  if (record?.userId) return record.userId === user.id;
  return normName(record?.[nameField]) === normName(nameOf(user));
}

// Identity for a request, resolving the "no Supabase configured" case.
//
// When auth is not configured at all the app runs in typed-name mode (documented
// degradation for a deployment without Supabase). There is no session to trust
// and nothing to protect, so the body's name is accepted. Whenever auth IS
// configured, `requireUser` has already rejected unauthenticated callers and the
// body is ignored.
export function identityFor(user, body) {
  if (user) {
    return { name: nameOf(user), avatar: avatarOf(user), userId: user.id, key: voterKey(user) };
  }
  const typed = String(body?.name || '').trim().slice(0, 48);
  return { name: typed, avatar: '', userId: null, key: normName(typed) };
}
