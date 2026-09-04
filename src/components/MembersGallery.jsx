import { useMemo, useState } from 'react';
import { Search, X, ArrowDownWideNarrow } from 'lucide-react';
import { getMemberProfile, getInitials, getDisplayName, mergeMembersWithProfiles } from '../lib/members-profile.js';
import { useMembersData } from '../lib/members.js';
import ProjectsBoard from './ProjectsBoard.jsx';

// DiceBear avataaars: free, keyless, deterministic SVG avatars seeded by name.
// DiceBear has no gender flag, so we lock the hair (and facial hair) to a
// masculine or feminine set per the member's stored gender. Gender lives in
// data/members-profile.json. Unknown gender falls back to an unconstrained face.
const FEMALE_TOP = 'bob,bun,curly,curvy,straight01,straight02,straightAndStrand,longButNotTooLong,bigHair,miaWallace,fro,frida,froBand,shaggy';
const MALE_TOP = 'shortFlat,shortRound,shortWaved,shortCurly,sides,theCaesar,theCaesarAndSidePart,dreads01,dreads02,frizzle,shavedSides';
const MALE_FACIAL = 'beardLight,beardMedium,beardMajestic,moustacheFancy';

function avatarUrl(name, gender) {
  const base = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
  if (gender === 'female') return `${base}&top=${FEMALE_TOP}&facialHairProbability=0`;
  if (gender === 'male') return `${base}&top=${MALE_TOP}&facialHairProbability=55&facialHair=${MALE_FACIAL}`;
  return base;
}

function GeneratedAvatar({ name, gender }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-3xl font-semibold tracking-tight text-muted">
        {getInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={avatarUrl(name, gender)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={320}
      height={320}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SORTS = [
  ['featured', 'Featured'],
  ['name', 'Name'],
];

// The directory comes from the signed-in /api/members route, not from props: the
// names used to ride along in src/data.json and so in the public bundle.
export default function MembersGallery() {
  const { data, loading, error } = useMembersData();
  const profiles = data.profiles;
  const merged = useMemo(() => mergeMembersWithProfiles(profiles, data.members), [profiles, data.members]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');

  // "Featured" keeps the old behaviour: people with a photo lead, shuffled so the
  // order varies per visit. It is now ONE option rather than the only one, because
  // a list that reorders itself on every mount is the opposite of a sort control,
  // and there was no way to find a specific person in it.
  const featured = useMemo(() => {
    const withPhoto = merged.filter((m) => getMemberProfile(profiles, m.name).photo);
    const without = merged.filter((m) => !getMemberProfile(profiles, m.name).photo);
    return [...shuffle(withPhoto), ...shuffle(without)];
  }, [merged, profiles]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Search the display name and any aliases, so "Auri" finds Aurimas and
    // "Perednyte" finds Dovile.
    const matches = (m) => {
      if (!q) return true;
      const hay = [m.name, getDisplayName(profiles, m), ...(m.aliases || [])].join(' ').toLowerCase();
      return hay.includes(q);
    };
    const base = sortBy === 'featured'
      ? featured
      : [...merged].sort((a, b) => getDisplayName(profiles, a).localeCompare(getDisplayName(profiles, b)));
    return base.filter(matches);
  }, [query, sortBy, featured, merged, profiles]);

  const organisers = merged.filter((m) => m.status === 'Organizer').length;

  return (
    <div className="space-y-6">
      <div>
        <div className="h-section">Community</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Members</h1>
        <p className="mt-2 text-sm text-muted">
          {merged.length} people building with AI in Copenhagen
          {organisers > 0 && `, ${organisers} running it`}.
        </p>
      </div>

      {/* Roadmap item 1: the board members write themselves. Above the directory,
          because what people are building is the point; who they are is context. */}
      <ProjectsBoard />

      <div className="h-section pt-2">Directory</div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="member-search" className="sr-only">Search members by name</label>
          <input
            id="member-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members"
            className="w-full bg-background border border-border rounded-full pl-9 pr-9 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <ArrowDownWideNarrow size={13} className="text-muted" aria-hidden="true" />
          <span id="member-sort-label" className="text-muted">Sort</span>
          <div role="group" aria-labelledby="member-sort-label" className="inline-flex rounded-full border border-border overflow-hidden">
            {SORTS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                aria-pressed={sortBy === key}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  sortBy === key ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {query ? `${shown.length} of ${merged.length} members match ${query}.` : ''}
      </p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10" aria-busy="true" aria-label="Loading members">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="aspect-square w-full rounded-2xl bg-accent animate-pulse" />
              <div className="mt-3 h-3.5 w-24 rounded bg-accent animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card card-pad text-sm text-muted">
          {error.status === 401 ? 'Sign in to see the members.' : 'Could not load the members right now. Try again in a moment.'}
        </div>
      ) : merged.length === 0 ? (
        <div className="card card-pad text-sm text-muted">No members yet.</div>
      ) : shown.length === 0 ? (
        <div className="card card-pad text-sm text-muted">
          Nobody matches “{query}”. <button type="button" onClick={() => setQuery('')} className="underline underline-offset-2">Clear the search</button>.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
          {shown.map((m) => (
            <MemberCard key={m.name} member={m} profile={getMemberProfile(profiles, m.name)} displayName={getDisplayName(profiles, m)} />
          ))}
        </div>
      )}

      <p className="pt-2 text-xs text-muted">
        Listed because you have come to a session. To be removed, or to change how your
        name or photo appears, message Auri and it is done at the next build.
      </p>
    </div>
  );
}

function MemberCard({ member, profile, displayName }) {
  const hasPhoto = Boolean(profile.photo);
  const hasLinkedin = Boolean(profile.linkedin);
  const bugSrc = profile.linkedinBug === 'black' ? '/linkedin-bug-black.png' : '/linkedin-bug-white.png';

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
        <GeneratedAvatar name={displayName} gender={profile.gender} />
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
          className="group block w-full transition-transform duration-200 ease-out hover:-translate-y-0.5"
          aria-label={`${displayName} on LinkedIn (opens in a new tab)`}
        >
          {photoBlock}
        </a>
      ) : (
        photoBlock
      )}
      <div className="mt-3 text-sm font-semibold text-foreground leading-tight">{displayName}</div>
      {/* Status and attendance were both in the data and shown nowhere. Only the
          Organizer badge renders: tagging nineteen of twenty people "Active" is
          noise, and the one distinction worth seeing is who runs the thing. */}
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        {member.status === 'Organizer' && (
          <span className="pill" style={{ background: 'var(--gold-chip-a)', color: 'var(--gold-chip-fg)', borderColor: 'transparent' }}>
            Organiser
          </span>
        )}
      </div>
    </div>
  );
}
