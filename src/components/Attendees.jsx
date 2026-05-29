import { useEffect, useState } from 'react';
import { Check, HelpCircle, Users } from 'lucide-react';
import profiles from '../../data/members-profile.json';
import { getInitials } from '../lib/members-profile.js';

const firstName = (s) => String(s || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
const prettify = (s) => String(s || '').replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Resolve a calendar guest to a known member. Guests invited by email often have
// no displayName (so `name` is just the email prefix) — match on email first,
// then exact name, then first-name. Returns { label, photo }.
function resolveGuest({ name, email }) {
  const byEmail = email && Object.entries(profiles).find(([, p]) => p.email?.toLowerCase() === email.toLowerCase());
  if (byEmail) {
    const [full, p] = byEmail;
    return { label: (p.displayName || full).split(/\s+/)[0], photo: p.photo || null };
  }
  if (profiles[name]?.photo) return { label: name.split(/\s+/)[0], photo: profiles[name].photo };
  const fn = firstName(name);
  const hitKey = Object.keys(profiles).find((k) => firstName(k) === fn && profiles[k].photo);
  if (hitKey) return { label: hitKey.split(/\s+/)[0], photo: profiles[hitKey].photo };
  // unknown guest: clean up the email-prefix name
  return { label: prettify(name).split(/\s+/)[0], photo: null };
}

function Avatar({ guest, tentative }) {
  const { label, photo } = resolveGuest(guest);
  return (
    <span className={`flex items-center gap-1.5 ${tentative ? 'opacity-60' : ''}`} title={tentative ? `${label} (maybe)` : label}>
      {photo ? (
        <img src={photo} alt="" className="w-6 h-6 rounded-full object-cover border border-border" />
      ) : (
        <span className="w-6 h-6 rounded-full grid place-items-center bg-accent border border-border text-[9px] font-semibold num">{getInitials(label)}</span>
      )}
      <span className="text-sm">{label}</span>
    </span>
  );
}

export default function Attendees({ date }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    fetch(`/api/attendees?date=${date}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setData(j); })
      .catch(() => { if (alive) setData({ configured: false }); });
    return () => { alive = false; };
  }, [date]);

  if (!data || data.configured === false) return null; // RSVP source not connected — stay silent
  const accepted = data.accepted || [];
  const tentative = data.tentative || [];
  if (!data.found || (accepted.length === 0 && tentative.length === 0)) return null;

  return (
    <div className="mt-5 pt-4 border-t border-border">
      <div className="flex items-center gap-1.5 h-section">
        <Users size={11} strokeWidth={2.2} />
        <span>Coming</span>
        <span className="pill pill-ok ml-1"><Check size={10} strokeWidth={2.8} />{accepted.length}</span>
        {tentative.length > 0 && <span className="pill pill-warn"><HelpCircle size={10} strokeWidth={2.5} />{tentative.length} maybe</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2.5">
        {accepted.map((g) => <Avatar key={g.email || g.name} guest={g} />)}
        {tentative.map((g) => <Avatar key={g.email || g.name} guest={g} tentative />)}
      </div>
    </div>
  );
}
