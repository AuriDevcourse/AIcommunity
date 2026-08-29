import { useMemo, useState } from 'react';
import { Search, X, Linkedin } from 'lucide-react';
import {
  getMemberProfile, getInitials, getDisplayName, mergeMembersWithProfiles, sortByProfileCompleteness,
} from '../lib/members-profile.js';

// Names are the only identifier the notes provide, so disambiguate duplicates
// with an occurrence counter rather than an array index — the key then survives
// re-sorting instead of following a position.
function withKeys(members) {
  const seen = new Map();
  return members.map((m) => {
    const n = (seen.get(m.name) || 0) + 1;
    seen.set(m.name, n);
    return { ...m, _key: n === 1 ? m.name : `${m.name}#${n}` };
  });
}

// Area 7.4 — a stable hue per person, so the initials tiles read as a set of
// individuals rather than a grid of identical grey squares.
function hueFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

// Area 7.6 — attendance is already in the parsed session notes; nobody was
// showing it. Matching is loose because notes use first names inconsistently.
function attendanceIndex(sessions) {
  const counts = new Map();
  for (const s of sessions || []) {
    for (const raw of s.attendees || []) {
      const key = String(raw).trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function attendedCount(counts, name) {
  const full = String(name).trim().toLowerCase();
  if (counts.has(full)) return counts.get(full);
  const first = full.split(/\s+/)[0];
  return counts.get(first) || 0;
}

const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'name', label: 'A–Z' },
  { key: 'active', label: 'Most sessions' },
];

export default function MembersGallery({ members, sessions }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');

  const counts = useMemo(() => attendanceIndex(sessions), [sessions]);
  const merged = useMemo(() => withKeys(mergeMembersWithProfiles(members)), [members]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = merged;
    if (q) list = list.filter((m) => getDisplayName(m).toLowerCase().includes(q));
    if (sort === 'name') return [...list].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    if (sort === 'active') {
      return [...list].sort(
        (a, b) =>
          attendedCount(counts, b.name) - attendedCount(counts, a.name) ||
          getDisplayName(a).localeCompare(getDisplayName(b))
      );
    }
    return sortByProfileCompleteness(list);
  }, [merged, query, sort, counts]);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Community</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Members</h2>
        <p className="mt-2 text-sm text-muted">{merged.length} people building with AI in Copenhagen.</p>
      </div>

      {/* Areas 7.2 + 7.3 */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        <div className="relative flex-1 min-w-[12rem] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label className="sr-only" htmlFor="member-search">Search members</label>
          <input
            id="member-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full bg-pill border border-border rounded-full pl-7 pr-7 py-1.5 text-xs text-foreground focus:border-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Sort members">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sort === s.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        /* Area 7.9 */
        <div className="card card-pad text-sm text-muted">
          No members match “{query}”.{' '}
          <button onClick={() => setQuery('')} className="text-foreground font-medium underline underline-offset-2">
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-8">
          {visible.map((m) => (
            <MemberCard key={m._key} member={m} attended={attendedCount(counts, m.name)} />
          ))}
        </div>
      )}

      {/* Area 7.10 — people in these photos should know how to get out of them. */}
      <p className="text-xs text-muted border-t border-border pt-5">
        Photos and links are shared with permission. Want yours changed or removed? Message Auri and it
        will be gone from the next build.
      </p>
    </div>
  );
}

function MemberCard({ member, attended }) {
  const profile = getMemberProfile(member.name);
  const displayName = getDisplayName(member);
  const hasPhoto = Boolean(profile.photo);
  const hasLinkedin = Boolean(profile.linkedin);
  const bugSrc = profile.linkedinBug === 'black' ? '/linkedin-bug-black.png' : '/linkedin-bug-white.png';
  const hue = hueFor(displayName);

  const photoBlock = (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-accent">
      {hasPhoto ? (
        <img
          src={profile.photo}
          alt=""
          loading="lazy"
          decoding="async"
          width={320}
          height={320}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-3xl font-semibold tracking-tight"
          style={{
            background: `linear-gradient(145deg, hsl(${hue} 55% 92%), hsl(${(hue + 40) % 360} 55% 84%))`,
            color: `hsl(${hue} 45% 28%)`,
          }}
          aria-hidden="true"
        >
          {getInitials(displayName)}
        </div>
      )}
      {hasLinkedin && (
        <div className="absolute right-3 top-3 h-6 w-6 overflow-hidden rounded-md opacity-90 transition-opacity duration-200 group-hover:opacity-100">
          <img src={bugSrc} alt="" aria-hidden="true" className="w-full h-full" />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center text-center">
      {hasLinkedin ? (
        <a
          href={profile.linkedin}
          target="_blank"
          rel="noreferrer"
          className="group block w-full transition-transform duration-200 ease-out hover:-translate-y-0.5 rounded-2xl"
          /* Area 7.8 — the link's accessible name used to be the bare image. */
          aria-label={`${displayName} on LinkedIn (opens in a new tab)`}
        >
          {photoBlock}
        </a>
      ) : (
        photoBlock
      )}

      <div className="mt-3 text-sm font-semibold text-foreground leading-tight">{displayName}</div>

      {/* Areas 7.1 + 7.5 + 7.6 */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted">
        {member.status === 'Organizer' && <span className="pill pill-acc">Organiser</span>}
        {attended > 0 && <span className="num">{attended} session{attended === 1 ? '' : 's'}</span>}
        {hasLinkedin && (
          <span className="inline-flex items-center gap-0.5">
            <Linkedin size={10} strokeWidth={2.2} aria-hidden="true" />
            LinkedIn
          </span>
        )}
      </div>
    </div>
  );
}
