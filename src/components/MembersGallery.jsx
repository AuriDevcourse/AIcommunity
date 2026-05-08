import { getMemberProfile, getInitials, getDisplayName, mergeMembersWithProfiles, sortByProfileCompleteness } from '../lib/members-profile.js';

export default function MembersGallery({ members }) {
  const merged = mergeMembersWithProfiles(members);
  const sorted = sortByProfileCompleteness(merged);
  return (
    <div className="space-y-10">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Community</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">Members</div>
        <p className="mt-2 text-sm text-muted">{merged.length} people building with AI in Copenhagen.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
        {sorted.map((m) => (
          <MemberCard key={m.name} member={m} />
        ))}
      </div>
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
        <div className="w-full h-full flex items-center justify-center text-3xl font-semibold tracking-tight text-muted">
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
