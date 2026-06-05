import { useCallback, useEffect, useRef, useState } from 'react';
import { MessagesSquare, Send, Trash2, Pencil, Check, ChevronUp, ChevronDown, Reply, X, ImagePlus, Loader2 } from 'lucide-react';

const MAX_IMG_BYTES = 3 * 1024 * 1024; // ~3MB, stays under serverless payload limits

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
import { useMemberName } from '../lib/auth.jsx';
import { SignInGate } from './AuthControls.jsx';

const MAX = 1000;
const ci = (s) => String(s || '').trim().toLowerCase();

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function myVote(c, name) {
  if (!name) return null;
  const n = ci(name);
  if ((c.voters?.up || []).some((v) => ci(v) === n)) return 'up';
  if ((c.voters?.down || []).some((v) => ci(v) === n)) return 'down';
  return null;
}

export default function SessionThread({
  date,
  channel,
  title = 'Session discussion',
  subtitle = "Questions, what you'll demo, and links to share for this session.",
  bare = false,
  sortBy = 'time', // 'time' (oldest first) or 'score' (most-upvoted first, for Ideas)
  composerPlaceholder,
  postLabel = 'Post message',
  emptyLabel = 'No messages yet. Start the conversation.',
}) {
  const ch = channel || date;
  const [comments, setComments] = useState(null);
  const [configured, setConfigured] = useState(true);
  const { authMode, name, setName, isReady: named } = useMemberName();
  const [editingName, setEditingName] = useState(!name);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const replyBusy = useRef(false);
  const [attachments, setAttachments] = useState([]); // uploaded image URLs
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!ch) return;
    try {
      const r = await fetch(`/api/threads?key=${encodeURIComponent(ch)}`);
      const j = await r.json();
      setComments(j.comments || []);
      setConfigured(j.configured !== false);
    } catch {
      setComments([]);
    }
  }, [ch]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 6000);
    return () => clearInterval(id);
  }, [load]);

  async function post(body) {
    const r = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ch, name: name.trim(), ...body }),
    });
    const j = await r.json();
    if (j.configured === false) setConfigured(false);
    return j;
  }

  async function addImages(fileList) {
    setUploadErr('');
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    const room = 4 - attachments.length;
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        if (f.size > MAX_IMG_BYTES) { setUploadErr(`${f.name} is too large (max 3MB).`); continue; }
        const image = await fileToBase64(f);
        const r = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, name: f.name }),
        });
        const j = await r.json();
        if (j.ok) setAttachments((a) => [...a, j.url]);
        else setUploadErr(j.error || 'Upload failed.');
      }
    } catch {
      setUploadErr('Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submitTop() {
    if (!named || (!text.trim() && attachments.length === 0) || busy || uploading) return;
    setBusy(true);
    try {
      const j = await post({ action: 'post', text: text.trim(), images: attachments });
      if (j.ok) { setText(''); setAttachments([]); setComments((c) => [...(c || []), j.comment]); }
    } finally { setBusy(false); }
  }

  async function submitReply(parentId, replyText, done) {
    if (!named || !replyText.trim() || replyBusy.current) return; // guard against double-submit
    replyBusy.current = true;
    try {
      const j = await post({ action: 'post', text: replyText.trim(), parentId });
      if (j.ok) { setComments((c) => [...(c || []), j.comment]); setReplyTo(null); done?.(); }
    } finally {
      replyBusy.current = false;
    }
  }

  async function vote(id, dir) {
    if (!named) return;
    const j = await post({ action: 'vote', id, dir });
    if (j.ok) setComments((c) => (c || []).map((x) => (x.id === id ? j.comment : x)));
  }

  async function remove(id) {
    setComments((c) => (c || []).filter((x) => x.id !== id && x.parentId !== id)); // optimistic
    await post({ action: 'delete', id });
    load();
  }

  const list = comments || [];
  const roots = list.filter((c) => !c.parentId).sort((a, b) => (
    sortBy === 'score'
      ? (b.score - a.score) || (b.createdAt || '').localeCompare(a.createdAt || '')
      : (a.createdAt || '').localeCompare(b.createdAt || '')
  ));
  const repliesByParent = {};
  for (const c of list.filter((x) => x.parentId)) (repliesByParent[c.parentId] = repliesByParent[c.parentId] || []).push(c);
  for (const k of Object.keys(repliesByParent)) repliesByParent[k].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  const sharedProps = { name, named, onVote: vote, onRemove: remove, replyTo, setReplyTo, onReply: submitReply };

  return (
    <div className={bare ? '' : 'card card-pad'}>
      <div className="flex items-center gap-1.5 h-section">
        <MessagesSquare size={11} strokeWidth={2.2} />
        <span>{title}</span>
        {list.length > 0 && <span className="pill pill-mute num ml-1">{list.length}</span>}
      </div>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}

      {!configured && (
        <div className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">Discussion needs a store. Add Upstash Redis and redeploy (same store as Polls).</div>
      )}

      <ul className="mt-4 space-y-3">
        {comments === null && Array.from({ length: 2 }).map((_, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2 py-0.5">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-3.5 w-3/4" />
            </div>
          </li>
        ))}
        {comments !== null && roots.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">{emptyLabel}</li>
        )}
        {roots.map((c) => (
          <li key={c.id}>
            <Comment c={c} {...sharedProps} />
            {repliesByParent[c.id]?.length > 0 && (
              <ul className="mt-3 ml-9 space-y-3 border-l border-border pl-3">
                {repliesByParent[c.id].map((r) => (
                  <li key={r.id}><Comment c={r} isReply {...sharedProps} /></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {/* New top-level message */}
      <div className="mt-4 rounded-xl border border-border bg-background p-3">
        {authMode ? (
          !named && <SignInGate label="Sign in to post" />
        ) : (editingName || !named ? (
          <div className="mb-2">
            <label className="text-[11px] font-medium text-muted">Your name</label>
            <div className="mt-1 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && named) setEditingName(false); }}
                placeholder="Required to post"
                maxLength={48}
                autoFocus={editingName && !named}
                className={`flex-1 bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-foreground ${named ? 'border-border' : 'border-warn/60'}`}
              />
              {named && (
                <button onClick={() => setEditingName(false)} className="grid place-items-center w-11 rounded-lg bg-foreground text-background transition-transform enabled:hover:scale-[1.03]" aria-label="Save name">
                  <Check size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="pill pill-ok"><Check size={11} strokeWidth={2.8} />{name.trim()}</span>
              <span className="text-xs text-muted truncate">posting as you</span>
            </span>
            <button onClick={() => setEditingName(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
              <Pencil size={12} /> Change
            </button>
          </div>
        ))}

        {(!authMode || named) && (
          <>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitTop(); } }}
                placeholder={named ? (composerPlaceholder || 'Write a message…') : 'Add your name above first…'}
                rows={2}
                maxLength={MAX}
                disabled={!named}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 pb-6 text-sm resize-y focus:outline-none focus:border-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={`pointer-events-none absolute bottom-2 right-3 text-[10px] num ${text.length > MAX - 60 ? 'text-warn' : 'text-muted'}`}>{text.length}/{MAX}</span>
            </div>

            {/* Image / GIF attachments */}
            {(attachments.length > 0 || uploading) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((url, i) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    <button
                      onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 grid place-items-center w-5 h-5 rounded-full bg-background border border-border text-muted hover:text-err"
                      aria-label="Remove image"
                    ><X size={12} /></button>
                  </div>
                ))}
                {uploading && <div className="h-16 w-16 grid place-items-center rounded-lg border border-dashed border-border text-muted"><Loader2 size={16} className="animate-spin" /></div>}
              </div>
            )}
            {uploadErr && <p className="mt-1.5 text-[11px] text-err">{uploadErr}</p>}

            <input ref={fileRef} type="file" accept="image/*,image/gif" multiple hidden onChange={(e) => e.target.files && addImages(e.target.files)} />

            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={!named || uploading || attachments.length >= 4}
                title="Add image or GIF"
                className="grid place-items-center w-10 h-10 flex-shrink-0 rounded-full border border-border bg-pill text-muted hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Add image or GIF"
              ><ImagePlus size={16} /></button>
              <button
                onClick={submitTop}
                disabled={!named || (!text.trim() && attachments.length === 0) || busy || uploading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01]"
              >
                <Send size={14} strokeWidth={2.2} /> {busy ? 'Posting…' : postLabel}
              </button>
            </div>
            {named && <p className="mt-1.5 text-[11px] text-muted hidden sm:block">Tip: ⌘ / Ctrl + Enter to post. Images & GIFs up to 3MB.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Comment({ c, isReply, name, named, onVote, onRemove, replyTo, setReplyTo, onReply }) {
  const mine = myVote(c, name);
  const own = named && ci(c.name) === ci(name);
  const replying = replyTo === c.id;
  const [replyText, setReplyText] = useState('');

  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 grid place-items-center flex-shrink-0 rounded-full bg-accent border border-border font-semibold num ${isReply ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]'}`}>{initials(c.name)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold leading-none">{c.name}</span>
          <span className="text-[11px] text-muted num leading-none">{timeAgo(c.createdAt)}</span>
        </div>
        {c.text && <p className="text-sm leading-snug whitespace-pre-wrap break-words mt-1">{c.text}</p>}

        {c.images?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {c.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt="" loading="lazy" className="max-h-56 max-w-full rounded-lg border border-border object-cover" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-1 text-muted">
          <button
            onClick={() => onVote(c.id, 'up')}
            disabled={!named}
            className={`grid place-items-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 ${mine === 'up' ? 'text-ok bg-ok/10' : 'hover:text-foreground hover:bg-accent'}`}
            aria-label="Upvote" aria-pressed={mine === 'up'}
          ><ChevronUp size={16} strokeWidth={2.4} /></button>
          <span className={`text-xs font-semibold num w-4 text-center ${c.score > 0 ? 'text-ok' : c.score < 0 ? 'text-err' : ''}`}>{c.score}</span>
          <button
            onClick={() => onVote(c.id, 'down')}
            disabled={!named}
            className={`grid place-items-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 ${mine === 'down' ? 'text-err bg-err/10' : 'hover:text-foreground hover:bg-accent'}`}
            aria-label="Downvote" aria-pressed={mine === 'down'}
          ><ChevronDown size={16} strokeWidth={2.4} /></button>

          {!isReply && (
            <button
              onClick={() => { setReplyTo(replying ? null : c.id); setReplyText(''); }}
              disabled={!named}
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            ><Reply size={13} /> Reply</button>
          )}
          {own && (
            <button
              onClick={() => onRemove(c.id)}
              className="ml-auto grid place-items-center w-7 h-7 rounded-md hover:text-err hover:bg-accent transition-colors"
              aria-label="Delete message"
            ><Trash2 size={13} /></button>
          )}
        </div>

        {replying && (
          <div className="mt-2 flex items-start gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onReply(c.id, replyText, () => setReplyText('')); } }}
              placeholder={`Reply to ${c.name.split(/\s+/)[0]}…`}
              rows={2}
              maxLength={MAX}
              autoFocus
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-foreground"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onReply(c.id, replyText, () => setReplyText(''))}
                disabled={!replyText.trim()}
                className="grid place-items-center w-9 h-9 rounded-lg bg-foreground text-background transition disabled:opacity-40 enabled:hover:scale-[1.03]"
                aria-label="Send reply"
              ><Send size={15} strokeWidth={2.2} /></button>
              <button
                onClick={() => setReplyTo(null)}
                className="grid place-items-center w-9 h-9 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
                aria-label="Cancel reply"
              ><X size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
