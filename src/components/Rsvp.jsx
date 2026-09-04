import { useCallback, useEffect, useState } from 'react';
import { Check, HelpCircle, CalendarCheck, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { authedFetch } from '../lib/supabase.js';
import { getInitials } from '../lib/members-profile.js';
import { resolveGuest } from '../lib/attendees.js';
import { useMembersData } from '../lib/members.js';

const ci = (s) => String(s || '').trim().toLowerCase();
const firstNameOf = (s) => String(s || '').trim().split(/\s+/)[0];

// Stale-while-revalidate cache: keep the last known lists in localStorage so the
// "Coming" list paints instantly on load (no empty flash), then we re-fetch and
// only swap state in if something actually changed, so people aren't re-rendered
// one by one, only the diff (someone left / someone new) lands.
const RSVP_CK = (d) => `aiworkshop_rsvp_${d}`;
const CAL_CK = (d) => `aiworkshop_attendees_${d}`;
const readCache = (k) => { try { const c = localStorage.getItem(k); return c ? JSON.parse(c) : null; } catch { return null; } };
const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

function PersonAvatar({ person, tentative }) {
  const [failed, setFailed] = useState(false);
  const showImg = person.avatar && !failed;
  return (
    <span className={`flex items-center gap-1.5 ${tentative ? 'opacity-60' : ''}`} title={tentative ? `${person.name} (maybe)` : person.name}>
      {showImg ? (
        <img src={person.avatar} alt="" loading="lazy" onError={() => setFailed(true)} className="w-6 h-6 rounded-full object-cover border border-border bg-accent" />
      ) : (
        <span className="w-6 h-6 rounded-full grid place-items-center bg-accent border border-border text-[9px] font-semibold ">{getInitials(person.name)}</span>
      )}
      <span className="text-sm">{firstNameOf(person.name)}</span>
    </span>
  );
}

// Merge the two RSVP sources, in-app RSVPs (Going/Maybe) and Google Calendar
// accepts (accepted/tentative), into ONE deduped list. A person who both tapped
// Going here AND accepted the invite shows once; "coming" beats "maybe". Keyed by
// first name (the calendar often only exposes a first name), good enough for a
// small meetup.
function mergeAttendees(rsvp, cal, profiles = {}) {
  const map = new Map(); // ci(firstName) -> { name, avatar, status }
  const add = (rawName, avatar, status) => {
    const name = firstNameOf(rawName);
    const key = ci(name);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) { map.set(key, { name, avatar: avatar || '', status }); return; }
    if (status === 'coming') existing.status = 'coming'; // upgrade maybe -> coming
    if (!existing.avatar && avatar) existing.avatar = avatar; // fill a missing photo
  };
  for (const p of rsvp?.going || []) add(p.name, p.avatar, 'coming');
  for (const p of rsvp?.maybe || []) add(p.name, p.avatar, 'maybe');
  for (const g of cal?.accepted || []) { const r = resolveGuest(g, profiles); add(r.label, r.photo, 'coming'); }
  for (const g of cal?.tentative || []) { const r = resolveGuest(g, profiles); add(r.label, r.photo, 'maybe'); }
  const all = [...map.values()];
  return {
    coming: all.filter((p) => p.status === 'coming'),
    maybe: all.filter((p) => p.status === 'maybe'),
  };
}

// One RSVP control + one unified "Coming" list for the next session. Signed-in
// members tap Going / Maybe; the list combines those with the Google-Calendar
// accepts so there is a single source of truth on screen.
export default function Rsvp({ date }) {
  const { enabled, user, name, openAuth } = useAuth();
  // Member photos for the calendar guests. Only fetched when signed in; a
  // signed-out visitor gets counts from the API and never sees names.
  const { data: membersData } = useMembersData(Boolean(user));
  const profiles = membersData.profiles;
  const [rsvp, setRsvp] = useState(() => (date ? readCache(RSVP_CK(date)) : null)); // { going, maybe, ... }
  const [cal, setCal] = useState(() => (date ? readCache(CAL_CK(date)) : null));    // { accepted, tentative, ... }
  const [mine, setMine] = useState(null);  // 'going' | 'maybe' | null
  const [busy, setBusy] = useState(false);

  // Replace state only when the fetched payload differs from what we already show,
  // so an unchanged poll causes no re-render (and no avatar reflow).
  const reconcile = (setter, key, next) => {
    if (!next) return; // network error → keep the cached list
    setter((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      writeCache(key, next);
      return next;
    });
  };

  const load = useCallback(async () => {
    if (!date) return;
    // 1) paint cached lists immediately (covers a date change too)
    const cr = readCache(RSVP_CK(date)); if (cr) setRsvp(cr);
    const cc = readCache(CAL_CK(date)); if (cc) setCal(cc);
    // 2) revalidate in the background, apply only the diff
    // Both reads carry the session token: names come back only for members.
    const [r, a] = await Promise.all([
      authedFetch(`/api/rsvp?date=${date}`).then((x) => x.json()).catch(() => null),
      authedFetch(`/api/attendees?date=${date}`).then((x) => x.json()).catch(() => null),
    ]);
    reconcile(setRsvp, RSVP_CK(date), r);
    reconcile(setCal, CAL_CK(date), a);
  }, [date]);

  // Reload when sign-in state changes: the same URL answers with names for a
  // member and with counts for a visitor.
  useEffect(() => { load(); }, [load, user]);

  // Derive "my" status by matching my display name against the in-app lists (the
  // API exposes no user IDs, so name-match is how the client recognises itself).
  useEffect(() => {
    if (!rsvp || !user) { setMine(null); return; }
    const me = ci(name);
    if ((rsvp.going || []).some((p) => ci(p.name) === me)) setMine('going');
    else if ((rsvp.maybe || []).some((p) => ci(p.name) === me)) setMine('maybe');
    else setMine(null);
  }, [rsvp, user, name]);

  // Signed out there is nothing to show: an RSVP is a confirmation, and a visitor
  // has not confirmed anything. The Next Session card already says walk-ins are
  // welcome, so the control and the "coming" list appear once you are in.
  if (!enabled || !date || !user) return null;

  async function choose(status) {
    if (!user) { openAuth(); return; }
    if (busy) return;
    const next = mine === status ? null : status; // tapping the active choice clears it
    setBusy(true);
    setMine(next); // optimistic
    try {
      const r = await authedFetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, status: next }),
      });
      const j = await r.json();
      if (j.ok) setRsvp((d) => { const v = { ...d, going: j.going, maybe: j.maybe, counts: j.counts }; writeCache(RSVP_CK(date), v); return v; });
      else { setMine(mine); load(); } // revert on failure
    } catch {
      setMine(mine); load();
    } finally {
      setBusy(false);
    }
  }

  const { coming, maybe } = mergeAttendees(rsvp, cal, profiles);
  const hasAny = coming.length > 0 || maybe.length > 0;

  return (
    <div className="mt-6">
      {/* RSVP control */}
      <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => choose('going')}
              disabled={busy}
              aria-pressed={mine === 'going'}
              className={`btn btn-sm ${mine === 'going' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <CalendarCheck size={14} strokeWidth={2.2} /> {mine === 'going' ? "You're coming" : "I'm coming"}
            </button>
            <button
              onClick={() => choose('maybe')}
              disabled={busy}
              aria-pressed={mine === 'maybe'}
              className={`btn btn-sm ${mine === 'maybe' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <HelpCircle size={14} strokeWidth={2.2} /> Maybe
            </button>
      </div>

      {/* One unified "Coming" list (in-app RSVPs + calendar accepts, deduped) */}
      {hasAny && (
        <div className="mt-4">
          <h3 className="flex items-center gap-1.5 h-section">
            <Users size={11} strokeWidth={2.2} />
            <span>Coming</span>
            <span className="pill pill-ok ml-1"><Check size={10} strokeWidth={2.8} />{coming.length}</span>
            {maybe.length > 0 && <span className="pill pill-warn"><HelpCircle size={10} strokeWidth={2.5} />{maybe.length} maybe</span>}
          </h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2.5">
            {coming.map((p, i) => <PersonAvatar key={`c-${p.name}-${i}`} person={p} />)}
            {maybe.map((p, i) => <PersonAvatar key={`m-${p.name}-${i}`} person={p} tentative />)}
          </div>
        </div>
      )}
    </div>
  );
}
