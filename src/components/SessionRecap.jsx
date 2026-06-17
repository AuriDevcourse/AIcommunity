import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Link2, Check, Sparkles, Square, Copy, Loader2, Users, Mic, MapPin, CalendarDays, ImageOff, Wrench, MessagesSquare } from 'lucide-react';
import { fmtDateLong, fmtDate } from '../lib/dates.js';
import { streamDraft } from '../lib/postdraft.js';
import { useAuth, useMemberName } from '../lib/auth.jsx';

// Public, shareable recap of a single past session: cover, who came, what was
// demoed, the photo gallery, plus a one-tap LinkedIn draft. Reached via the hash
// route #recap/<date> (no auth needed to view).
export default function SessionRecap({ date, sessions, onBack }) {
  const committed = useMemo(() => (sessions || []).find((s) => s.date === date) || null, [sessions, date]);
  const [uploads, setUploads] = useState([]); // runtime Blob photos for this date
  const [name, setName] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/photos').then((r) => r.json()).catch(() => ({})),
      fetch('/api/session-meta').then((r) => r.json()).catch(() => ({})),
    ]).then(([photos, meta]) => {
      if (!alive) return;
      const byDate = photos?.byDate?.[date] || [];
      setUploads(byDate.map((p) => p.url));
      const m = (meta?.names || {})[date];
      setName(typeof m === 'string' ? m : (m?.name || null));
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [date]);

  const photos = useMemo(() => {
    const base = committed?.photos ? [...committed.photos] : [];
    const extra = uploads.filter((u) => !base.includes(u));
    return [...base, ...extra];
  }, [committed, uploads]);

  const title = name || (committed?.number != null ? `Session #${committed.number}` : fmtDate(date));

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
        <ArrowLeft size={15} strokeWidth={2.2} /> Back to sessions
      </button>

      <header className="mt-5">
        <div className="flex items-center gap-2 h-section">
          <CalendarDays size={11} strokeWidth={2.2} />
          <span>Session recap</span>
          {committed?.number != null && <span className="pill pill-mute num">#{committed.number}</span>}
        </div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{fmtDateLong(date)} · Copenhagen{committed?.location ? ` · ${committed.location}` : ''}</p>
      </header>

      {/* Cover */}
      {photos[0] && (
        <div className="mt-6 rounded-2xl overflow-hidden border border-border bg-accent">
          <img src={photos[0]} alt="" className="w-full max-h-[460px] object-cover" />
        </div>
      )}

      {/* About */}
      {committed?.summary && (
        <section className="mt-8">
          <div className="text-base leading-relaxed text-foreground whitespace-pre-line">{committed.summary}</div>
        </section>
      )}

      {/* Topics — what we talked about, split into themes */}
      {committed?.topics?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section">
            <MessagesSquare size={11} strokeWidth={2.2} /><span>What we talked about</span>
            <span className="pill pill-mute num ml-1">{committed.topics.length}</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {committed.topics.map((t, i) => (
              <div key={i} className="warm-card card-pad">
                <div className="text-sm font-semibold leading-snug">{t.title}</div>
                {t.summary && <div className="text-sm text-muted mt-1 leading-relaxed">{t.summary}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Demos */}
      {committed?.demos?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section"><Mic size={11} strokeWidth={2.2} /><span>What we demoed</span></div>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {committed.demos.map((d, i) => (
              <li key={i} className="warm-card card-pad">
                <div className="text-sm font-semibold leading-snug">{d.topic}</div>
                <div className="text-xs text-muted mt-0.5">by {d.presenter}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Attendees */}
      {committed?.attendees?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section">
            <Users size={11} strokeWidth={2.2} /><span>Who came</span>
            <span className="pill pill-mute num ml-1">{committed.attendees.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {committed.attendees.map((a) => <span key={a} className="pill">{a}</span>)}
          </div>
        </section>
      )}

      {/* Tools & ideas discussed */}
      {committed?.tools?.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-1.5 h-section">
            <Wrench size={11} strokeWidth={2.2} /><span>Tools & ideas discussed</span>
            <span className="pill pill-mute num ml-1">{committed.tools.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {committed.tools.map((t) => (
              <span key={t.name} className="pill" title={t.note || undefined}>{t.name}</span>
            ))}
          </div>
        </section>
      )}

      {/* Photo gallery */}
      <section className="mt-8">
        <div className="flex items-center gap-1.5 h-section"><MapPin size={11} strokeWidth={2.2} /><span>Photos</span>
          {photos.length > 0 && <span className="pill pill-mute num ml-1">{photos.length}</span>}
        </div>
        {!loaded ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-xl" />)}
          </div>
        ) : photos.length === 0 ? (
          <div className="empty-state mt-3 flex flex-col items-center gap-2">
            <ImageOff size={18} strokeWidth={2} />
            <span>No photos for this session yet.</span>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Open photo ${i + 1} of ${photos.length} full size`} className="block aspect-square overflow-hidden rounded-xl border border-border bg-accent group">
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Share + draft */}
      <Share date={date} session={committed} title={title} photoCount={photos.length} />
    </div>
  );
}

function Share({ date, session, title, photoCount }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/#recap/${date}` : '';

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }

  return (
    <section className="mt-10 pt-6 border-t border-border">
      <div className="flex items-center gap-1.5 h-section"><Sparkles size={11} strokeWidth={2.2} /><span>Share this recap</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={copyLink} className="btn btn-sm btn-ghost">
          {copied ? <Check size={14} strokeWidth={2.4} className="text-ok" /> : <Link2 size={14} strokeWidth={2.2} />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
      <DraftRecap date={date} session={session} title={title} photoCount={photoCount} />
    </section>
  );
}

function buildNotes(session, title, photoCount) {
  const lines = [`Session: ${title}.`];
  if (session?.number != null) lines.push(`This was AI Workshop meetup #${session.number}.`);
  lines.push(`It happened in Copenhagen on ${fmtDateLong(session?.date || '')}.`);
  if (session?.location) lines.push(`Format/location: ${session.location}.`);
  if (session?.summary) lines.push(`What it was about: ${session.summary}`);
  if (session?.topics?.length) {
    lines.push('Topics we discussed:');
    for (const t of session.topics) lines.push(`- ${t.title}${t.summary ? `: ${t.summary}` : ''}`);
  }
  if (session?.demos?.length) {
    lines.push('People demoed:');
    for (const d of session.demos) lines.push(`- ${d.presenter}: ${d.topic}`);
  }
  if (session?.tools?.length) {
    // The AI ideas/tools talked about — the heart of a "what we discussed" post.
    const names = session.tools.map((t) => t.name).slice(0, 18).join(', ');
    lines.push(`AI tools and ideas discussed: ${names}.`);
  }
  if (session?.attendees?.length) lines.push(`People there: ${session.attendees.join(', ')}.`);
  if (photoCount) lines.push(`We took ${photoCount} photos.`);
  return lines.join('\n');
}

function DraftRecap({ date, session, title, photoCount }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | streaming | done | error | unconfigured
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);
  // Drafting hits an auth-gated endpoint. When sign-in is enabled but the visitor
  // is logged out, the request 401s — so prompt them to sign in instead of showing
  // a button that just errors. (In typed-name mode the endpoint isn't auth-gated.)
  const { openAuth } = useAuth();
  const { authMode, authed } = useMemberName();
  const needsSignIn = authMode && !authed;

  useEffect(() => () => abortRef.current?.abort(), []); // cancel on unmount (stops spend)

  async function generate() {
    setText(''); setErr(''); setStatus('streaming');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await streamDraft({
        notes: buildNotes(session, title, photoCount),
        format: 'linkedin',
        signal: ctrl.signal,
        onDelta: (piece) => setText((t) => t + piece),
      });
      if (res?.configured === false) { setStatus('unconfigured'); return; }
      if (res?.text) setText(res.text);
      setStatus('done');
    } catch (e) {
      if (e.name === 'AbortError') { setStatus(text ? 'done' : 'idle'); return; }
      setErr(e.message || 'Could not generate a draft.'); setStatus('error');
    } finally {
      abortRef.current = null;
    }
  }

  function stop() { abortRef.current?.abort(); }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {needsSignIn ? (
          <button onClick={openAuth} className="btn btn-sm btn-primary">
            <Sparkles size={14} strokeWidth={2.2} /> Sign in to draft a LinkedIn post
          </button>
        ) : status === 'streaming' ? (
          <button onClick={stop} className="btn btn-sm btn-ghost"><Square size={13} strokeWidth={2.4} /> Stop</button>
        ) : (
          <button onClick={generate} className="btn btn-sm btn-primary">
            <Sparkles size={14} strokeWidth={2.2} /> {text ? 'Regenerate draft' : 'Draft a LinkedIn post'}
          </button>
        )}
        {text && status !== 'streaming' && (
          <button onClick={copy} className="btn btn-sm btn-ghost">
            {copied ? <Check size={14} strokeWidth={2.4} className="text-ok" /> : <Copy size={14} strokeWidth={2.2} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {status === 'unconfigured' && <p className="mt-2 text-xs text-warn">Drafting needs an LLM key (GEMINI_API_KEY or OPENROUTER_API_KEY).</p>}
      {status === 'error' && <p className="mt-2 text-xs text-err">{err}</p>}

      {(text || status === 'streaming') && (
        <div className="mt-3 card card-pad whitespace-pre-wrap text-sm leading-relaxed">
          {text}
          {status === 'streaming' && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-foreground/70 animate-pulse" aria-hidden />}
          {status === 'streaming' && !text && <span className="inline-flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Writing…</span>}
        </div>
      )}
    </div>
  );
}
