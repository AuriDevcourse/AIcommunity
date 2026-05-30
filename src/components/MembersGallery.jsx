import { useMemo, useState } from 'react';
import { getMemberProfile, getInitials, getDisplayName, mergeMembersWithProfiles } from '../lib/members-profile.js';

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
      alt={name}
      loading="lazy"
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

export default function MembersGallery({ members }) {
  const merged = mergeMembersWithProfiles(members);
  // Reshuffle on every mount (each time the tab opens) so the sequence keeps
  // changing. Members with photos still lead, but their order varies each visit.
  const sorted = useMemo(() => {
    const withPhoto = merged.filter((m) => getMemberProfile(m.name).photo);
    const without = merged.filter((m) => !getMemberProfile(m.name).photo);
    return [...shuffle(withPhoto), ...shuffle(without)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-10">
      <div>
        <div className="h-section">Community</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">Members</div>
        <p className="mt-2 text-sm text-muted">{merged.length} people building with AI in Copenhagen.</p>
      </div>

      {sorted.length === 0 ? (
        <div className="card card-pad text-sm text-muted">No members yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
          {sorted.map((m) => (
            <MemberCard key={m.name} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }) {
  const profile = getMemberProfile(member.name);
  const displayName = getDisplayName(member);
  const hasPhoto = Boolean(profile.photo);
  const hasLinkedin = Boolean(profile.linkedin);
  const bugSrc = profile.linkedinBug === 'black' ? '/linkedin-bug-black.png' : '/linkedin-bug-white.png';

  const photoBlock = (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-accent">
      {hasPhoto ? (
        <img src={profile.photo} alt={displayName} loading="lazy" className="w-full h-full object-cover" />
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
          title={`${displayName} on LinkedIn`}
        >
          {photoBlock}
        </a>
      ) : (
        photoBlock
      )}
      <div className="mt-3 text-sm font-semibold text-foreground leading-tight">{displayName}</div>
    </div>
  );
}
