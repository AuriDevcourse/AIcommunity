import profiles from '../../data/members-profile.json';

const prettify = (s) => String(s || '').replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
// Split a name/email into meaningful tokens (drop initials & noise, keep >=3 chars).
const nameTokens = (s) => String(s || '').toLowerCase().split(/[\s._-]+/).filter((t) => t.length >= 3);

// Resolve a calendar guest to a known member. Guests invited by email often show
// only a last name (e.g. "Petrauskas" -> Justas Petrauskas) or an email local part,
// so match the exact name first, then any shared name token.
//
// There used to be an exact-email branch ahead of these, which is why member
// addresses were stored in members-profile.json and shipped to every browser in
// the bundle. The addresses are gone; `name` already carries the email local part
// when the calendar has no display name, so token matching still resolves those.
// Returns { label, photo } where label is the person's first name.
export function resolveGuest({ name }) {
  // 1) exact display-name key
  if (profiles[name]?.photo) return { label: name.split(/\s+/)[0], photo: profiles[name].photo };

  // 2) shared name token (first OR last name). Prefer a profile that has a photo
  //    so we surface the real person.
  const guestTokens = nameTokens(name);
  let fallbackHit = null;
  for (const [full, p] of Object.entries(profiles)) {
    const keyTokens = nameTokens(full);
    if (!keyTokens.some((kt) => guestTokens.includes(kt))) continue;
    if (p.photo) return { label: full.split(/\s+/)[0], photo: p.photo };
    if (!fallbackHit) fallbackHit = { label: full.split(/\s+/)[0], photo: null };
  }
  if (fallbackHit) return fallbackHit;

  // 3) unknown guest: clean up the raw name / email local part
  return { label: prettify(name).split(/\s+/)[0], photo: null };
}
