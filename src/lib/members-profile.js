// Helpers over the profile map (LinkedIn, photo, display name, gender, order).
//
// The map used to be a static import of data/members-profile.json, so it shipped
// in the public bundle. It now arrives with /api/members (see lib/members.js) and
// every helper takes it as the first argument.

export function getMemberProfile(profiles, name) {
  return (profiles && profiles[name]) || {};
}

export function getDisplayName(profiles, member) {
  const profile = getMemberProfile(profiles, member.name);
  return profile.displayName || member.name;
}

export function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isKnown(member) {
  if (member.status === 'Number only') return false;
  if (/^Unknown\b/i.test(member.name)) return false;
  return true;
}

export function mergeMembersWithProfiles(profiles, members) {
  const filtered = (members || []).filter(isKnown);
  const existing = new Set(filtered.map((m) => m.name));
  const synthetic = Object.keys(profiles || {})
    .filter((name) => !existing.has(name))
    .map((name) => ({ name, status: 'Active' }));
  return [...filtered, ...synthetic];
}

export function sortByProfileCompleteness(profiles, members) {
  const score = (p) => (p.photo ? 2 : 0) + (p.linkedin ? 1 : 0);
  const order = (p) => (typeof p.order === 'number' ? p.order : 50);
  return [...members].sort((a, b) => {
    const pa = getMemberProfile(profiles, a.name);
    const pb = getMemberProfile(profiles, b.name);
    const tier = score(pb) - score(pa);
    if (tier !== 0) return tier;
    return order(pa) - order(pb);
  });
}
