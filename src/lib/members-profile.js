import profiles from '../../data/members-profile.json';

export function getMemberProfile(name) {
  return profiles[name] || {};
}

export function getDisplayName(member) {
  const profile = getMemberProfile(member.name);
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

export function mergeMembersWithProfiles(members) {
  const filtered = members.filter(isKnown);
  const existing = new Set(filtered.map((m) => m.name));
  const synthetic = Object.keys(profiles)
    .filter((name) => !existing.has(name))
    .map((name) => ({ name, status: 'Active' }));
  return [...filtered, ...synthetic];
}

export function sortByProfileCompleteness(members) {
  const score = (p) => (p.photo ? 2 : 0) + (p.linkedin ? 1 : 0);
  const order = (p) => (typeof p.order === 'number' ? p.order : 50);
  return [...members].sort((a, b) => {
    const pa = getMemberProfile(a.name);
    const pb = getMemberProfile(b.name);
    const tier = score(pb) - score(pa);
    if (tier !== 0) return tier;
    return order(pa) - order(pb);
  });
}
