// Who is an organizer.
//
// One list of emails in ORGANIZER_EMAILS (comma-separated), compared against the
// email on the VERIFIED Supabase session. No table, no admin UI: adding a co-host
// is one env edit and a redeploy. Auri, 2026-09-02: only the organizer may delete
// (photos, polls, other people's posts). Members add and edit.
const list = () => String(process.env.ORGANIZER_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isOrganizer(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  // Supabase marks the address verified once the provider (Google) or the
  // confirmation mail has vouched for it. An unverified address must not carry
  // the role: anyone can type the organizer's email into the sign-up form.
  const verified = user?.email_confirmed_at || user?.confirmed_at || user?.user_metadata?.email_verified;
  if (!verified) return false;
  return list().includes(email);
}

export const ORGANIZER_ONLY = { status: 403, json: { ok: false, error: 'Only an organizer can do that.' } };
