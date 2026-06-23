import { useEffect, useMemo, useRef, useState } from 'react';
import { PenLine, Sparkles, Copy, Check, Linkedin, Instagram, Globe, ThumbsUp, MessageSquare, Repeat2, Send, Shuffle, Square, Heart, MessageCircle, Bookmark, MoreHorizontal, ChevronDown, Images } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';
import { authedFetch } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const LI_BLUE = '#0a66c2';
// Where each platform hides the rest behind "…more" (approx, matches real apps).
const FOLD = { linkedin: 210, instagram: 125 };
const igHandle = (name) => String(name || 'you').toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
const countWords = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// Random placeholder identity for the preview — purely cosmetic, just to see how
// the post looks in-feed. NOT who the post is written as (that's you, the writer).
const NAMES = ['Mia Larsen', 'Tomas Berg', 'Aisha Khan', 'Lukas Novak', 'Sofia Rossi', 'Daniel Park', 'Nina Holm', 'Omar Haddad', 'Elena Costa', 'Jonas Vik', 'Priya Nair', 'Felix Brandt'];
const TITLES = ['Indie hacker', 'Product designer', 'Full-stack developer', 'AI engineer', 'Startup founder', 'UX designer', 'Data scientist', 'Creative technologist', 'Frontend developer', 'Solo founder'];

function randomAuthor() {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const title = TITLES[Math.floor(Math.random() * TITLES.length)];
  const img = 1 + Math.floor(Math.random() * 70);
  return { name, headline: `${title} · AI Workshop Copenhagen`, avatar: `https://i.pravatar.cc/96?img=${img}` };
}

// Fisher-Yates copy — used to reshuffle which photos lead the preview collage.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FORMATS = [
  { id: 'linkedin', label: 'LinkedIn post', icon: Linkedin },
  { id: 'instagram', label: 'Instagram caption', icon: Instagram },
];

// Guided fields → a structured brief the model turns into a post.
const QUESTIONS = [
  { key: 'topic', label: 'What did you explore this session?', placeholder: 'e.g. generative AI for 3D modeling', big: true },
  { key: 'tools', label: 'Tools tested or mentioned', placeholder: 'e.g. Hyper3D Rodin, MeshyAI, Tripo, ChatGPT' },
  { key: 'credit', label: 'Who presented? (credit them)', placeholder: 'e.g. Ignas' },
  { key: 'standout', label: 'A standout result, winner, or surprise?', placeholder: 'e.g. Rodin was the clear winner, but only on one prompt' },
  { key: 'next', label: "What's next time?", placeholder: 'e.g. a 15-30 min hackathon' },
];

function sessionLine(s) {
  return s ? `Meetup: AI Workshop${s.number != null ? ` #${s.number}` : ''}, ${fmtDate(s.date)}.` : '';
}

const toolNames = (s) => (s?.tools || []).map((t) => t.name).filter(Boolean);
const presenterNames = (s) => (s?.demos || []).map((d) => d.presenter).filter(Boolean);

// Loose first-name match so the author ("Aurimas Baciauskas") is recognised as the
// session presenter ("Auri") — handles nicknames / prefixes either direction.
const firstTok = (n) => String(n || '').trim().toLowerCase().split(/\s+/)[0];
const sameName = (a, b) => {
  const x = firstTok(a), y = firstTok(b);
  return !!x && !!y && (x === y || (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x))));
};

// Brief built straight from a session's own data — no manual fields needed. The
// author's own demo is framed as "I" so the post never credits the writer in the
// third person; everyone else is credited by name.
function sessionBrief(s, extra, authorName) {
  const lines = [sessionLine(s)];
  if (s.summary) lines.push(`What we explored: ${s.summary}`);
  const tools = toolNames(s);
  if (tools.length) lines.push(`Tools and ideas discussed: ${tools.join(', ')}.`);
  if (s.demos?.length) {
    lines.push('Who presented (you are the author — credit the OTHERS by name, write your own demo as "I"):');
    for (const d of s.demos) {
      const who = sameName(d.presenter, authorName) ? 'I (the author — not third person)' : d.presenter;
      lines.push(`- ${who}${d.topic ? `: ${d.topic}` : ''}`);
    }
  }
  if (s.attendees?.length) lines.push(`People there: ${s.attendees.length}.`);
  if (extra.trim()) lines.push(`\nMy own angle to weave in: ${extra.trim()}`);
  return lines.join('\n');
}

function buildBrief(fields, session, extra) {
  const lines = [];
  if (session) lines.push(`Meetup: AI Workshop${session.number != null ? ` #${session.number}` : ''}, ${fmtDate(session.date)}.`);
  if (fields.topic) lines.push(`What we explored: ${fields.topic}`);
  if (fields.tools) lines.push(`Tools tested or mentioned: ${fields.tools}`);
  if (fields.credit) lines.push(`Presented by (credit them): ${fields.credit}`);
  if (fields.standout) lines.push(`Standout / result / surprise: ${fields.standout}`);
  if (fields.next) lines.push(`What's next time: ${fields.next}`);
  if (extra.trim()) lines.push(`\nExtra notes: ${extra.trim()}`);
  return lines.join('\n');
}

function renderPostText(text) {
  return text.split(/(\s+)/).map((tok, i) => {
    const isTag = /^#[\w]+$/.test(tok);
    const isLink = /^https?:\/\//.test(tok) || /^[\w-]+\.(com|ai|app|dk|io|org|net|dev)\b/.test(tok);
    if (isTag || isLink) return <span key={i} style={{ color: LI_BLUE }}>{tok}</span>;
    return tok;
  });
}

function Collage({ photos }) {
  if (!photos?.length) return null;
  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  const img = 'w-full h-full object-cover';
  // key={url} on every image so a shuffle remounts them all together — the big
  // featured one swaps with the rest instead of clinging to its previous picture.
  if (shown.length === 1) return <img key={shown[0]} src={shown[0]} alt="" className="w-full max-h-[320px] object-cover" />;
  if (shown.length === 2) return <div className="grid grid-cols-2 gap-0.5 h-60">{shown.map((p) => <img key={p} src={p} alt="" className={img} />)}</div>;
  if (shown.length === 3) return (
    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-72">
      <img key={shown[0]} src={shown[0]} alt="" className={`${img} row-span-2`} />
      <img key={shown[1]} src={shown[1]} alt="" className={img} />
      <img key={shown[2]} src={shown[2]} alt="" className={img} />
    </div>
  );
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-80">
      <img key={shown[0]} src={shown[0]} alt="" className={`${img} col-span-2 row-span-3`} />
      <img key={shown[1]} src={shown[1]} alt="" className={img} />
      <img key={shown[2]} src={shown[2]} alt="" className={img} />
      <div key={shown[3]} className="relative">
        <img src={shown[3]} alt="" className={img} />
        {extra > 0 && <div className="absolute inset-0 bg-black/55 grid place-items-center text-white text-lg font-semibold">+{extra}</div>}
      </div>
    </div>
  );
}

// Blinking caret shown at the tail of the text while it streams in.
function Caret() {
  return <span className="inline-block w-[2px] h-[1em] -mb-[0.15em] ml-px bg-current opacity-70 animate-pulse" aria-hidden />;
}

// Renders post text. It streams in fully and STAYS open once written — no snapping
// back to a fold. The "…more" / "…less" toggle is just there if you want to see the
// in-feed look; it never auto-collapses after generating.
function FoldedText({ text, limit, prefix, streaming }) {
  const [expanded, setExpanded] = useState(true);
  // Keep it open while/after streaming; only the user collapses it.
  useEffect(() => { if (streaming) setExpanded(true); }, [streaming]);
  const folded = !streaming && !expanded && text.length > limit;
  const shown = folded ? text.slice(0, limit).replace(/\s+\S*$/, '') : text;
  return (
    <span>
      {prefix}
      {renderPostText(shown)}
      {folded && <>… <button onClick={() => setExpanded(true)} className="text-[#8e8e8e] hover:text-[#262626] font-normal">more</button></>}
      {streaming && <Caret />}
    </span>
  );
}

function LinkedInPreview({ author, text, photos, streaming }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)] text-[#1f1f1f]">
      <div className="p-4">
        <div className="flex items-start gap-2">
          <img src={author.avatar} alt="" className="w-12 h-12 rounded-full object-cover bg-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight flex items-center gap-1">
              {author.name} <span className="text-[#666] font-normal">· You</span>
            </div>
            <div className="text-xs text-[#666] leading-snug line-clamp-1">{author.headline}</div>
            <div className="text-xs text-[#666] flex items-center gap-1 mt-0.5">now · <Globe size={11} /></div>
          </div>
        </div>
        <div className="mt-3 text-sm whitespace-pre-wrap leading-relaxed break-words">
          {text ? <FoldedText text={text} limit={FOLD.linkedin} streaming={streaming} />
            : <span className="text-[#999]">Your generated post will appear here as it would on LinkedIn.</span>}
        </div>
      </div>
      <Collage photos={photos} />
      <div className="px-4 pt-2 pb-1 border-t border-[#eee] mt-1 flex items-center justify-between text-[#666]">
        {[['Like', ThumbsUp], ['Comment', MessageSquare], ['Repost', Repeat2], ['Send', Send]].map(([label, Icon]) => (
          <div key={label} className="flex items-center gap-1.5 text-xs font-medium py-1.5">
            <Icon size={16} strokeWidth={2} /><span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Square photo grid for the Instagram preview (fills its aspect-square frame).
function SquareCollage({ photos }) {
  const shown = photos.slice(0, 4);
  const img = 'w-full h-full object-cover';
  if (shown.length === 1) return <img src={shown[0]} alt="" className={img} />;
  if (shown.length === 3) return (
    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
      <img src={shown[0]} alt="" className={`${img} row-span-2`} />
      <img src={shown[1]} alt="" className={img} />
      <img src={shown[2]} alt="" className={img} />
    </div>
  );
  return <div className={`grid gap-0.5 w-full h-full ${shown.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>{shown.map((p, i) => <img key={i} src={p} alt="" className={img} />)}</div>;
}

function InstagramPreview({ author, text, photos, streaming }) {
  const handle = igHandle(author.name);
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)] text-[#262626]">
      <div className="flex items-center gap-2 p-3">
        <img src={author.avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-accent outline outline-1 outline-[#eee]" />
        <span className="text-sm font-semibold leading-tight truncate flex-1">{handle}</span>
        <MoreHorizontal size={18} />
      </div>
      <div className="aspect-square w-full overflow-hidden bg-[#fafafa]">
        {photos?.length ? <SquareCollage photos={photos} />
          : <div className="w-full h-full grid place-items-center text-[#bbb] text-xs">Pick a session with photos</div>}
      </div>
      <div className="flex items-center gap-4 px-3 pt-3">
        <Heart size={24} strokeWidth={1.8} />
        <MessageCircle size={24} strokeWidth={1.8} />
        <Send size={22} strokeWidth={1.8} />
        <Bookmark size={22} strokeWidth={1.8} className="ml-auto" />
      </div>
      <div className="px-3 pt-2 text-sm font-semibold">128 likes</div>
      <div className="px-3 pb-3 pt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {text ? <FoldedText text={text} limit={FOLD.instagram} streaming={streaming} prefix={<span className="font-semibold mr-1">{handle}</span>} />
          : <span className="text-[#999]">Your caption will appear here as it would on Instagram.</span>}
      </div>
    </div>
  );
}

// Custom session picker (replaces the native <select> so it matches the UI):
// cover thumbnail + photo-count badge, keyboard + screen-reader accessible
// (combobox/listbox pattern).
function SessionSelect({ sessions, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const selected = sessions.find((s) => s.date === value) || null;
  const optLabel = (s) => `${s.number != null ? `#${s.number} · ` : ''}${fmtDate(s.date)}`;

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, sessions.findIndex((s) => s.date === value)));
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (s) => { onChange(s.date); setOpen(false); btnRef.current?.focus(); };

  const onKey = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(sessions.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(sessions.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (sessions[hi]) choose(sessions[hi]); }
  };

  const Thumb = ({ s, size }) => (s.photos?.[0]
    ? <img src={s.photos[0]} alt="" className={`${size} rounded object-cover flex-shrink-0`} />
    : <span className={`${size} rounded bg-accent flex-shrink-0 grid place-items-center text-muted`}><Images size={12} /></span>);

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && hi >= 0 ? `sess-opt-${hi}` : undefined}
        className="w-full flex items-center gap-2 bg-background border border-border rounded-md px-2.5 py-2 text-sm text-left focus:outline-none focus:border-foreground transition-colors"
      >
        {selected ? (
          <>
            <Thumb s={selected} size="w-6 h-6" />
            <span className="truncate">{optLabel(selected)}</span>
            {selected.photos?.length ? <span className="pill pill-mute flex-shrink-0">{selected.photos.length}</span> : null}
          </>
        ) : (
          <span className="text-muted truncate">Pick one for photos + pre-fill…</span>
        )}
        <ChevronDown size={16} className={`ml-auto flex-shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-md border border-border bg-background shadow-[0_12px_30px_rgba(0,0,0,0.14)] py-1">
          {sessions.map((s, i) => {
            const isSel = s.date === value;
            return (
              <li
                key={s.date}
                id={`sess-opt-${i}`}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setHi(i)}
                onClick={() => choose(s)}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer ${i === hi ? 'bg-accent' : ''}`}
              >
                <Thumb s={s} size="w-7 h-7" />
                <span className={`min-w-0 flex-1 truncate text-sm ${isSel ? 'font-semibold' : ''}`}>{optLabel(s)}</span>
                {s.photos?.length ? <span className="pill pill-mute flex-shrink-0">{s.photos.length}</span> : null}
                {isSel && <Check size={14} strokeWidth={2.5} className="flex-shrink-0 text-foreground" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PostMaker({ sessions = [] }) {
  // Sessions only carry photos committed under /sessions/. Photos uploaded later
  // (Vercel Blob) live behind /api/photos, like the recap uses — merge them in so
  // the picker thumbnails + selected-session photos match what the recap shows.
  const [uploadsByDate, setUploadsByDate] = useState({});
  useEffect(() => {
    let alive = true;
    fetch('/api/photos').then((r) => r.json()).then((j) => {
      if (alive) setUploadsByDate(j?.byDate || {});
    }).catch(() => { /* keep committed photos only */ });
    return () => { alive = false; };
  }, []);

  const merged = useMemo(() => sessions.map((s) => {
    const base = s.photos || [];
    const uploaded = (uploadsByDate[s.date] || []).map((p) => p.url).filter((u) => !base.includes(u));
    return uploaded.length ? { ...s, photos: [...base, ...uploaded] } : s;
  }), [sessions, uploadsByDate]);

  const withContent = useMemo(() => [...merged]
    .filter((s) => s.summary || s.demos?.length || s.attendees?.length || s.photos?.length)
    .sort((a, b) => b.date.localeCompare(a.date)), [merged]);

  const [mode, setMode] = useState('guided'); // 'guided' | 'free'
  const [fields, setFields] = useState({ topic: '', tools: '', credit: '', standout: '', next: '' });
  const [extra, setExtra] = useState('');
  const [freeText, setFreeText] = useState('');
  const [format, setFormat] = useState('linkedin');
  const [output, setOutput] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [author, setAuthor] = useState(randomAuthor); // preview-only placeholder

  // The post is always written as YOU (the signed-in writer) — this drives the
  // first-person voice in the text, separate from the cosmetic preview person.
  const { name: myName } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | streaming | error | notconfigured
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);
  const busy = status === 'loading' || status === 'streaming';

  // Cancel any in-flight generation if the user leaves (stops spend too).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Preselect a session when a recap deep-linked here ("Create a social media post").
  useEffect(() => {
    try {
      const d = sessionStorage.getItem('postmaker.session');
      if (d) { setSelectedDate(d); sessionStorage.removeItem('postmaker.session'); }
    } catch { /* ignore */ }
  }, []);

  const setField = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  // Derive the selected session from the date so it always reflects the live
  // (photo-merged) list, not a stale snapshot taken at click time.
  const selectedSession = useMemo(
    () => withContent.find((s) => s.date === selectedDate) || null,
    [withContent, selectedDate],
  );

  // Just record the choice. "From the Session" reads the session live; "Clean
  // Sheet" stays blank (its whole point) — the session material lives in the other
  // mode, so there's nothing to pre-fill here.
  const prefill = (date) => setSelectedDate(date);

  // Default to the latest session on load so you never land on the empty manual
  // form — the newest session is almost always what you want to post about.
  useEffect(() => {
    if (!selectedDate && withContent.length) setSelectedDate(withContent[0].date);
  }, [withContent, selectedDate]);

  // With a session picked, its own data is the content — just press Generate.
  const hasContent = mode === 'free'
    ? freeText.trim()
    : (selectedSession ? true : (fields.topic.trim() || extra.trim()));

  function stop() {
    abortRef.current?.abort();
  }

  async function generate() {
    if (!hasContent || busy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus('loading');
    setError('');
    setOutput('');
    try {
      const body = mode === 'free'
        ? [sessionLine(selectedSession), freeText.trim()].filter(Boolean).join('\n\n')
        : (selectedSession ? sessionBrief(selectedSession, extra, myName) : buildBrief(fields, null, extra));
      const voice = myName
        ? `Write this in the FIRST PERSON as ${myName}, a member of the AI Workshop Copenhagen community. Use "I" and "we" — never refer to ${myName} in the third person (if ${myName} presented, say "I demoed…").`
        : 'Write this in the FIRST PERSON (use "I" and "we") as someone who was there — never describe the writer in the third person.';
      const notes = [voice, body].join('\n\n');
      const r = await authedFetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, format, stream: true }),
        signal: ac.signal,
      });

      // Non-stream JSON reply = an early error/guard (401, 429, notconfigured…).
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('text/event-stream')) {
        const j = await r.json().catch(() => ({}));
        if (j.configured === false) { setStatus('notconfigured'); return; }
        setStatus('error');
        setError(j.error || (r.status === 429 ? 'Slow down — too many requests.' : r.status === 401 ? 'Sign in to generate posts.' : 'Generation failed.'));
        return;
      }

      // Read the SSE stream and paint tokens as they arrive.
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let acc = '';
      setStatus('streaming');
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop();
        for (const ev of events) {
          const line = ev.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          let evt; try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (evt.delta) { acc += evt.delta; setOutput(acc); }
          else if (evt.done) { setOutput(evt.text); } // house-style-cleaned final
          else if (evt.error) { setStatus('error'); setError(evt.error); return; }
        }
      }
      setStatus('idle');
    } catch (e) {
      if (e.name === 'AbortError') { setStatus('idle'); return; } // user stopped / navigated away
      setStatus('error');
      setError(e.message || 'Generation failed.');
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Preview photos: natural (stable) order by default; "Shuffle photos" reorders
  // just for the preview. Reset to natural order whenever the session changes.
  const sessionPhotos = selectedSession?.photos || [];
  const [photoOrder, setPhotoOrder] = useState(null);
  useEffect(() => { setPhotoOrder(null); }, [selectedDate]);
  const previewPhotos = photoOrder && photoOrder.length === sessionPhotos.length ? photoOrder : sessionPhotos;

  return (
    <div>
      <div className="flex items-center gap-1.5 h-section">
        <PenLine size={11} strokeWidth={2.2} />
        <span>Post maker</span>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight mt-1">Turn a session into a post</h2>
      <p className="text-sm text-muted mt-1 max-w-2xl">Pick a session — it pulls what was explored, the tools, and who presented. Add your own angle if you like, then Generate. No session? Answer a few prompts instead.</p>

      {status === 'notconfigured' && (
        <div className="card card-pad mt-5 text-sm text-warn">
          Post generation has no key yet. Add <span className="font-mono">OPENROUTER_API_KEY</span> to the dashboard env (see docs/postmaker-setup.md).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5 items-start">
        {/* Left: guided form */}
        <div className="card card-pad space-y-4">
          {withContent.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted flex-shrink-0">Session</span>
              <SessionSelect sessions={withContent} value={selectedSession?.date || ''} onChange={prefill} />
            </div>
          )}

          <div className="flex gap-2">
            {([['guided', 'From the Session'], ['free', 'Clean Sheet']]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === id ? 'bg-foreground text-background border-foreground' : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'guided' ? (
            selectedSession ? (
              <>
                {/* The session already holds the content — show it, then Generate. */}
                <div className="rounded-md border border-border bg-pill/40 p-3 space-y-2.5">
                  <span className="text-xs font-medium text-muted">From this session — what the post is written from</span>
                  {selectedSession.summary && (
                    <p className="text-sm text-foreground leading-relaxed line-clamp-4">{selectedSession.summary}</p>
                  )}
                  {presenterNames(selectedSession).length > 0 && (
                    <p className="text-xs text-muted"><span className="font-medium text-foreground">Presented by:</span> {presenterNames(selectedSession).join(', ')}</p>
                  )}
                  {toolNames(selectedSession).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {toolNames(selectedSession).slice(0, 14).map((t) => <span key={t} className="pill pill-mute">{t}</span>)}
                      {toolNames(selectedSession).length > 14 && <span className="pill pill-mute">+{toolNames(selectedSession).length - 14}</span>}
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-muted">Add your own angle (optional)</span>
                  <textarea
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    rows={2}
                    placeholder="A standout moment, a personal take, what's next time…"
                    className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm text-foreground focus:outline-none focus:border-foreground resize-y"
                  />
                </label>
              </>
            ) : (
            <>
              {QUESTIONS.map((q) => (
                <label key={q.key} className="block">
                  <span className="text-xs font-medium text-muted">{q.label}</span>
                  {q.big ? (
                    <textarea
                      value={fields[q.key]}
                      onChange={(e) => setField(q.key, e.target.value)}
                      rows={2}
                      placeholder={q.placeholder}
                      className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm text-foreground focus:outline-none focus:border-foreground resize-y"
                    />
                  ) : (
                    <input
                      value={fields[q.key]}
                      onChange={(e) => setField(q.key, e.target.value)}
                      placeholder={q.placeholder}
                      className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground"
                    />
                  )}
                </label>
              ))}
              <label className="block">
                <span className="text-xs font-medium text-muted">Anything else (optional)</span>
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  rows={2}
                  placeholder="A joke, something that broke, a personal aside…"
                  className="mt-1 w-full bg-background border border-border rounded-md p-2.5 text-sm text-foreground focus:outline-none focus:border-foreground resize-y"
                />
              </label>
            </>
            )
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-muted">Your draft or notes</span>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={18}
                placeholder="Write the post yourself, or dump rough notes and let it polish them into the community voice…"
                className="mt-1 w-full bg-background border border-border rounded-md p-3 text-sm text-foreground focus:outline-none focus:border-foreground resize-y"
              />
            </label>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex gap-2">
              {FORMATS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFormat(id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    format === id ? 'bg-foreground text-background border-foreground' : 'bg-pill text-foreground border-border hover:bg-foreground hover:text-background'
                  }`}
                >
                  <Icon size={13} strokeWidth={2} />{label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {busy && (
                <button
                  onClick={stop}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  <Square size={12} strokeWidth={2.5} className="fill-current" /> Stop
                </button>
              )}
              <button
                onClick={generate}
                disabled={!hasContent || busy}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
              >
                <Sparkles size={14} strokeWidth={2.2} />
                {busy ? 'Writing…' : output ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          </div>

          {status === 'error' && <div className="text-sm text-err">{error}</div>}

          {output && (
            <div className="flex items-center gap-2">
              <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-1.5 text-xs font-medium hover:bg-foreground hover:text-background transition-colors">
                {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy text'}
              </button>
            </div>
          )}
        </div>

        {/* Right: LinkedIn preview */}
        <div className="lg:sticky lg:top-20">
          <div className="flex items-center justify-between mb-2">
            <div className="h-section">Preview</div>
            <div className="flex items-center gap-3">
              {sessionPhotos.length > 1 && (
                <button
                  onClick={() => setPhotoOrder(shuffle(sessionPhotos))}
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                  title="Shuffle which photos lead the collage (preview only)"
                >
                  <Images size={12} /> Shuffle photos
                </button>
              )}
              <button
                onClick={() => setAuthor(randomAuthor())}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                title="Shuffle the placeholder person (preview only)"
              >
                <Shuffle size={12} /> Shuffle person
              </button>
            </div>
          </div>
          {format === 'instagram'
            ? <InstagramPreview author={author} text={output} photos={previewPhotos} streaming={status === 'streaming'} />
            : <LinkedInPreview author={author} text={output} photos={previewPhotos} streaming={status === 'streaming'} />}

          {output ? (
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span className="num">{output.length} characters · {countWords(output)} words</span>
              <span>{output.length > FOLD[format] ? `Folds after ~${FOLD[format]} chars` : 'Fits above the fold'}</span>
            </div>
          ) : (
            previewPhotos.length === 0 && <p className="text-xs text-muted mt-2">Pick a session with photos to see them in the {format === 'instagram' ? 'post' : 'collage'}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
