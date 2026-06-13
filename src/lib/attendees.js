import profiles from '../../data/members-profile.json';

const prettify = (s) => String(s || '').replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
// Split a name/email into meaningful tokens (drop initials & noise, keep >=3 chars).
const nameTokens = (s) => String(s || '').toLowerCase().split(/[\s._-]+/).filter((t) => t.length >= 3);

// Resolve a calendar guest to a known member. Guests invited by email often show
// only a last name (e.g. "Petrauskas" -> Justas Petrauskas) or an email-prefix, so
// we match on email first, then exact name, then any shared name token.
// Returns { label, photo } where label is the person's first name.
export function resolveGuest({ name, email }) {
  // 1) exact email match
  const byEmail = email && Object.entries(profiles).find(([, p]) => p.email?.toLowerCase() === email.toLowerCase());
  if (byEmail) {
    const [full, p] = byEmail;
    return { label: (p.displayName || full).split(/\s+/)[0], photo: p.photo || null };
  }
  // 2) exact display-name key
  if (profiles[name]?.photo) return { label: name.split(/\s+/)[0], photo: profiles[name].photo };

  // 3) shared name token (first OR last name), or a token found in the email prefix.
  //    Prefer a profile that has a photo so we surface the real person.
  const guestTokens = nameTokens(name);
  const emailPrefix = email ? email.split('@')[0].toLowerCase() : '';
  let fallbackHit = null;
  for (const [full, p] of Object.entries(profiles)) {
    const keyTokens = nameTokens(full);
    const overlaps =
      keyTokens.some((kt) => guestTokens.includes(kt)) ||
      (emailPrefix && keyTokens.some((kt) => emailPrefix.includes(kt)));
    if (!overlaps) continue;
    if (p.photo) return { label: full.split(/\s+/)[0], photo: p.photo };
    if (!fallbackHit) fallbackHit = { label: full.split(/\s+/)[0], photo: null };
  }
  if (fallbackHit) return fallbackHit;

  // 4) unknown guest: clean up the raw name / email-prefix
  return { label: prettify(name).split(/\s+/)[0], photo: null };
}
