import { useCallback, useEffect, useState } from 'react';
import { Check, HelpCircle, CalendarCheck, LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { authedFetch } from '../lib/supabase.js';
import { getInitials } from '../lib/members-profile.js';

const ci = (s) => String(s || '').trim().toLowerCase();

function RsvpAvatar({ person, tentative }) {
  const [failed, setFailed] = useState(false);
  const showImg = person.avatar && !failed;
  return (
    <span className={`flex items-center gap-1.5 ${tentative ? 'opacity-60' : ''}`} title={tentative ? `${person.name} (maybe)` : person.name}>
      {showImg ? (
        <img src={person.avatar} alt="" loading="lazy" onError={() => setFailed(true)} className="w-6 h-6 rounded-full object-cover border border-border bg-accent" />
      ) : (
        <span className="w-6 h-6 rounded-full grid place-items-center bg-accent border border-border text-[9px] font-semibold num">{getInitials(person.name)}</span>
      )}
      <span className="text-sm">{person.name.split(/\s+/)[0]}</span>
    </span>
  );
}

// In-dashboard RSVP for the next session. Signed-in members tap Going / Maybe;
// the list of who's coming shows live. Distinct from the Google-Calendar accepts
// (those render in <Attendees/>). Stays silent when Supabase/Upstash aren't set up.
export default function Rsvp({ date }) {
  const { enabled, user, name, openAuth } = useAuth();
  const [data, setData] = useState(null); // { going, maybe, counts, configured }
  const [mine, setMine] = useState(null); // 'going' | 'maybe' | null
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!date) return;
    try {
      const r = await fetch(`/api/rsvp?date=${date}`);
      const j = await r.json();
      setData(j);
    } catch {
      setData({ configured: false });
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Derive "my" status from the list by matching my display name (no user IDs are
  // exposed by the API, so name-match is how the client recognises itself).
  useEffect(() => {
    if (!data || !user) { setMine(null); return; }
    const me = ci(name);
    if ((data.going || []).some((p) => ci(p.name) === me)) setMine('going');
    else if ((data.maybe || []).some((p) => ci(p.name) === me)) setMine('maybe');
    else setMine(null);
  }, [data, user, name]);

  if (!enabled || !date || (data && data.configured === false)) return null;

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
      if (j.ok) setData((d) => ({ ...d, going: j.going, maybe: j.maybe, counts: j.counts }));
      else { setMine(mine); load(); } // revert on failure
    } catch {
      setMine(mine); load();
    } finally {
      setBusy(false);
    }
  }

  const going = data?.going || [];
  const maybe = data?.maybe || [];
  const hasAny = going.length > 0 || maybe.length > 0;

  return (
    <div className="mt-6">
      {/* Primary RSVP control */}
      <div className="flex flex-wrap items-center gap-2">
        {user ? (
          <>
            <button
              onClick={() => choose('going')}
              disabled={busy}
              aria-pressed={mine === 'going'}
              className={`btn btn-sm ${mine === 'going' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <CalendarCheck size={14} strokeWidth={2.2} /> {mine === 'going' ? "You're going" : "I'm going"}
            </button>
            <button
              onClick={() => choose('maybe')}
              disabled={busy}
              aria-pressed={mine === 'maybe'}
              className={`btn btn-sm ${mine === 'maybe' ? 'btn-primary' : 'btn-ghost'}`}
            >
              <HelpCircle size={14} strokeWidth={2.2} /> Maybe
            </button>
          </>
        ) : (
          <button onClick={openAuth} className="btn btn-sm btn-ghost">
            <LogIn size={14} strokeWidth={2.2} /> Sign in to RSVP
          </button>
        )}
      </div>

      {/* Who's coming (in-app RSVPs) */}
      {hasAny && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 h-section">
            <CalendarCheck size={11} strokeWidth={2.2} />
            <span>Going</span>
            <span className="pill pill-ok ml-1"><Check size={10} strokeWidth={2.8} />{going.length}</span>
            {maybe.length > 0 && <span className="pill pill-warn"><HelpCircle size={10} strokeWidth={2.5} />{maybe.length} maybe</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2.5">
            {going.map((p, i) => <RsvpAvatar key={`g-${p.name}-${i}`} person={p} />)}
            {maybe.map((p, i) => <RsvpAvatar key={`m-${p.name}-${i}`} person={p} tentative />)}
          </div>
        </div>
      )}
    </div>
  );
}
