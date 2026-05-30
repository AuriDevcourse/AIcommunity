import { useState } from 'react';
import { PenLine, Sparkles, Copy, Check, RefreshCw, Linkedin, Instagram, Globe, ThumbsUp, MessageSquare, Repeat2, Send, Shuffle } from 'lucide-react';
import { fmtDate } from '../lib/dates.js';

const LI_BLUE = '#0a66c2';

// Random placeholder identity for the preview (so it is not always Auri).
const NAMES = ['Mia Larsen', 'Tomas Berg', 'Aisha Khan', 'Lukas Novak', 'Sofia Rossi', 'Daniel Park', 'Nina Holm', 'Omar Haddad', 'Elena Costa', 'Jonas Vik', 'Priya Nair', 'Felix Brandt'];
const TITLES = ['Indie hacker', 'Product designer', 'Full-stack developer', 'AI engineer', 'Startup founder', 'UX designer', 'Data scientist', 'Creative technologist', 'Frontend developer', 'Solo founder'];

function randomAuthor() {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const title = TITLES[Math.floor(Math.random() * TITLES.length)];
  const img = 1 + Math.floor(Math.random() * 70);
  return { name, headline: `${title} · AI Workshop Copenhagen`, avatar: `https://i.pravatar.cc/96?img=${img}` };
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

// A starting draft for "write it yourself" mode when a session is picked.
function sessionToDraft(s) {
  if (!s) return '';
  const lines = [sessionLine(s)];
  if (s.summary) lines.push(`\n${s.summary}`);
  if (s.demos?.length) {
    lines.push('\nDemos:');
    for (const d of s.demos) lines.push(`- ${d.presenter}${d.topic ? `: ${d.topic}` : ''}`);
  }
  if (s.attendees?.length) lines.push(`\nWho came: ${s.attendees.join(', ')}.`);
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
  if (shown.length === 1) return <img src={shown[0]} alt="" className="w-full max-h-[320px] object-cover" />;
  if (shown.length === 2) return <div className="grid grid-cols-2 gap-0.5 h-60">{shown.map((p, i) => <img key={i} src={p} alt="" className={img} />)}</div>;
  if (shown.length === 3) return (
    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-72">
      <img src={shown[0]} alt="" className={`${img} row-span-2`} />
      <img src={shown[1]} alt="" className={img} />
      <img src={shown[2]} alt="" className={img} />
    </div>
  );
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-80">
      <img src={shown[0]} alt="" className={`${img} col-span-2 row-span-3`} />
      <img src={shown[1]} alt="" className={img} />
      <img src={shown[2]} alt="" className={img} />
      <div className="relative">
        <img src={shown[3]} alt="" className={img} />
        {extra > 0 && <div className="absolute inset-0 bg-black/55 grid place-items-center text-white text-lg font-semibold">+{extra}</div>}
      </div>
    </div>
  );
}

function LinkedInPreview({ author, text, photos }) {
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
          {text ? renderPostText(text) : <span className="text-[#999]">Your generated post will appear here as it would on LinkedIn.</span>}
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

export default function PostMaker({ sessions = [] }) {
  const withContent = [...sessions]
    .filter((s) => s.summary || s.demos?.length || s.attendees?.length || s.photos?.length)
    .sort((a, b) => b.date.localeCompare(a.date));

  const [mode, setMode] = useState('guided'); // 'guided' | 'free'
  const [fields, setFields] = useState({ topic: '', tools: '', credit: '', standout: '', next: '' });
  const [extra, setExtra] = useState('');
  const [freeText, setFreeText] = useState('');
  const [format, setFormat] = useState('linkedin');
  const [output, setOutput] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [author, setAuthor] = useState(randomAuthor);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const setField = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  function prefill(date) {
    const s = withContent.find((x) => x.date === date) || null;
    setSelectedSession(s);
    if (!s) return;
    // Fill both modes so switching keeps your content.
    setFields((f) => ({
      ...f,
      topic: f.topic || s.summary || (s.demos || []).map((d) => d.topic).filter(Boolean).join(', '),
      credit: f.credit || (s.demos || []).map((d) => d.presenter).filter(Boolean).join(', '),
    }));
    setFreeText((t) => t || sessionToDraft(s));
  }

  const hasContent = mode === 'guided' ? (fields.topic.trim() || extra.trim()) : freeText.trim();

  async function generate() {
    if (!hasContent || status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const notes = mode === 'guided'
        ? buildBrief(fields, selectedSession, extra)
        : [sessionLine(selectedSession), freeText.trim()].filter(Boolean).join('\n\n');
      const r = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, format }),
      });
      const j = await r.json();
      if (j.configured === false) { setStatus('notconfigured'); return; }
      if (!j.ok) { setStatus('error'); setError(j.error || 'Generation failed.'); return; }
      setOutput(j.text);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Generation failed.');
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const previewPhotos = selectedSession?.photos || [];

  return (
    <div>
      <div className="flex items-center gap-1.5 h-section">
        <PenLine size={11} strokeWidth={2.2} />
        <span>Post maker</span>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight mt-1">Turn a session into a post</h2>
      <p className="text-sm text-muted mt-1 max-w-2xl">Answer a few prompts, pick a session for photos, watch the LinkedIn preview build.</p>

      {status === 'notconfigured' && (
        <div className="card card-pad mt-5 text-sm text-warn">
          Post generation has no key yet. Add <span className="font-mono">OPENROUTER_API_KEY</span> to the dashboard env (see docs/postmaker-setup.md).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5 items-start">
        {/* Left: guided form */}
        <div className="card card-pad space-y-4">
          {withContent.length > 0 && (
            <label className="flex items-center gap-3 text-sm">
              <span className="text-muted flex-shrink-0">Session</span>
              <select
                onChange={(e) => prefill(e.target.value)}
                defaultValue=""
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground"
              >
                <option value="" disabled>Pick one for photos + pre-fill…</option>
                {withContent.map((s) => (
                  <option key={s.date} value={s.date}>
                    {s.number != null ? `#${s.number} · ` : ''}{fmtDate(s.date)}{s.photos?.length ? ` · ${s.photos.length} photos` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-2">
            {([['guided', 'Answer questions'], ['free', 'Write it yourself']]).map(([id, label]) => (
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
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-muted">Your draft or notes</span>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={11}
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
            <button
              onClick={generate}
              disabled={!hasContent || status === 'loading'}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]"
            >
              <Sparkles size={14} strokeWidth={2.2} />
              {status === 'loading' ? 'Writing…' : output ? 'Regenerate' : 'Generate'}
            </button>
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
            <button
              onClick={() => setAuthor(randomAuthor())}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
              title="Shuffle the placeholder person"
            >
              <Shuffle size={12} /> Shuffle person
            </button>
          </div>
          <LinkedInPreview author={author} text={output} photos={previewPhotos} />
          {previewPhotos.length === 0 && <p className="text-xs text-muted mt-2">Pick a session with photos to see them in the collage.</p>}
        </div>
      </div>
    </div>
  );
}
