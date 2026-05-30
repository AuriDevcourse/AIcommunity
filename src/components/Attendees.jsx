import { useEffect, useState } from 'react';
import { Check, HelpCircle, Users } from 'lucide-react';
import profiles from '../../data/members-profile.json';
import { getInitials } from '../lib/members-profile.js';

const prettify = (s) => String(s || '').replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
// Split a name/email into meaningful tokens (drop initials & noise, keep >=3 chars).
const nameTokens = (s) => String(s || '').toLowerCase().split(/[\s._-]+/).filter((t) => t.length >= 3);

// Resolve a calendar guest to a known member. Guests invited by email often show
// only a last name (e.g. "Petrauskas" -> Justas Petrauskas) or an email-prefix, so
// we match on email first, then exact name, then any shared name token. Returns { label, photo }.
function resolveGuest({ name, email }) {
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

const cacheKey = (date) => `aiworkshop_attendees_${date}`;

function readCache(date) {
  if (typeof window === 'undefined' || !date) return null;
  try { const c = localStorage.getItem(cacheKey(date)); return c ? JSON.parse(c) : null; } catch { return null; }
}

export default function Attendees({ date }) {
  // Stale-while-revalidate: show the last known list instantly (from localStorage),
  // then re-fetch and only update if it actually changed — so the container does
  // not flash empty on every refresh.
  const [data, setData] = useState(() => readCache(date));

  useEffect(() => {
    if (!date) return;
    let alive = true;
    const cached = readCache(date);
    if (cached) setData(cached); // hydrate immediately (e.g. when the date prop changes)

    fetch(`/api/attendees?date=${date}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setData((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(j)) return prev; // unchanged → no re-render
          try { localStorage.setItem(cacheKey(date), JSON.stringify(j)); } catch { /* ignore */ }
          return j;
        });
      })
      .catch(() => { /* network error: keep the cached list rather than wiping it */ });
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
