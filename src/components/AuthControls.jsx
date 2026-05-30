import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, LogOut, X, Loader2, Mail, Lock, User, Pencil } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';

function GoogleG({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function AuthControls() {
  const { enabled, loading, user, name, avatarUrl, signOut, openAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!enabled) return null; // Supabase not configured: header stays as-is.
  if (loading) return <div className="h-8 w-16 rounded-full bg-accent animate-pulse" aria-hidden />;

  if (!user) {
    return (
      <>
        <button
          onClick={openAuth}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3.5 py-1.5 text-xs font-semibold transition-transform hover:scale-[1.03]"
        >
          <LogIn size={13} strokeWidth={2.4} /> Sign in
        </button>
        <AuthModal />
      </>
    );
  }

  const initial = (name || 'M').trim().charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-pill pl-1 pr-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
      >
        <Avatar url={avatarUrl} initial={initial} size={24} />
        <span className="max-w-[120px] truncate">{name}</span>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-2 w-48 z-50 rounded-xl border border-border bg-background shadow-[0_20px_40px_rgba(0,0,0,0.12)] p-1">
            <div className="px-3 py-2 text-[11px] text-muted truncate">{user.email}</div>
            <button
              onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
              className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <Pencil size={14} /> Edit profile
            </button>
            <button
              onClick={() => { setMenuOpen(false); signOut(); }}
              className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export function AuthModal() {
  const { modalOpen, closeAuth, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => { if (modalOpen) { setError(''); setInfo(''); setTimeout(() => emailRef.current?.focus(), 50); } }, [modalOpen, mode]);

  // Only show the Google button if the provider is actually enabled in Supabase,
  // so a misconfig can't surface a broken "provider not enabled" button.
  useEffect(() => {
    let active = true;
    const base = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!base || !key) return;
    fetch(`${base}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((j) => { if (active) setGoogleEnabled(Boolean(j?.external?.google)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function google() {
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) setError(err.message || 'Google sign-in is not available.');
  }

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeAuth(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeAuth]);

  if (!modalOpen) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'signup') {
        const { data, error: err } = await signUpWithEmail(email.trim(), password, fullName.trim());
        if (err) throw err;
        if (!data.session) setInfo('Check your email to confirm your account, then sign in.');
      } else {
        const { error: err } = await signInWithEmail(email.trim(), password);
        if (err) throw err;
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm p-4" onClick={closeAuth}>
      <div className="card w-full max-w-sm p-6 my-auto max-h-[90dvh] overflow-y-auto shadow-[0_30px_60px_rgba(0,0,0,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold tracking-tight">{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
          <button onClick={closeAuth} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted mb-4">Sign in to post, vote, and join the discussion. Browsing stays open to everyone.</p>

        {googleEnabled && (
          <>
            <button
              onClick={google}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background py-2.5 text-sm font-semibold hover:bg-accent transition-colors"
            >
              <GoogleG /> Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted">or with email</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-2.5">
          {mode === 'signup' && (
            <Field icon={User} value={fullName} onChange={setFullName} placeholder="Full name" type="text" autoComplete="name" />
          )}
          <Field ref={emailRef} icon={Mail} value={email} onChange={setEmail} placeholder="Email" type="email" autoComplete="email" required />
          <Field icon={Lock} value={password} onChange={setPassword} placeholder="Password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} />

          {error && <div className="text-xs text-err">{error}</div>}
          {info && <div className="text-xs text-ok">{info}</div>}

          <button
            type="submit"
            disabled={busy || !email.trim() || password.length < 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01]"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-muted">
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo(''); }}
            className="font-semibold text-foreground hover:underline underline-offset-2"
          >
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const Field = forwardRef(function Field({ icon: Icon, value, onChange, ...props }, ref) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-foreground">
      <Icon size={15} strokeWidth={2} className="text-muted flex-shrink-0" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
        {...props}
      />
    </label>
  );
});

// Inline prompt the interactive composers show when auth is on but nobody's signed in.
export function SignInGate({ label = 'Sign in to participate' }) {
  const { openAuth } = useAuth();
  return (
    <button
      onClick={openAuth}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:border-foreground/40 transition-colors"
    >
      <LogIn size={13} strokeWidth={2.2} /> {label}
    </button>
  );
}

// Avatar image with an initial fallback (used in the header + profile editor).
function Avatar({ url, initial, size = 24 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]); // retry when the avatar changes
  const px = { width: size, height: size };
  if (url && !failed) {
    return <img src={url} alt="" style={px} onError={() => setFailed(true)} className="rounded-full object-cover bg-accent" />;
  }
  return (
    <span style={px} className="grid place-items-center rounded-full bg-foreground text-background font-semibold" >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
    </span>
  );
}

const AVATAR_STYLES = ['avataaars', 'adventurer', 'micah', 'thumbs', 'notionists', 'bottts'];

function ProfileModal({ open, onClose }) {
  const { user, name: currentName, description: currentDesc, avatarUrl: currentAvatar, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const googlePhoto = user?.user_metadata?.picture || '';

  useEffect(() => {
    if (open) { setName(currentName || ''); setDescription(currentDesc || ''); setAvatar(currentAvatar || ''); setError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const seed = (name || currentName || user?.email || 'member').trim();
  const generated = useMemo(
    () => AVATAR_STYLES.map((s) => `https://api.dicebear.com/9.x/${s}/svg?seed=${encodeURIComponent(seed)}`),
    [seed]
  );

  if (!open) return null;

  async function save() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setBusy(true); setError('');
    const { error: err } = await updateProfile({ name: name.trim(), description: description.trim(), avatarUrl: avatar.trim() });
    setBusy(false);
    if (err) setError(err.message || 'Could not save.'); else onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6 my-auto max-h-[90dvh] overflow-y-auto shadow-[0_30px_60px_rgba(0,0,0,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Edit profile</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-4">
          <Avatar url={avatar} initial={(name.trim() || 'M').charAt(0).toUpperCase()} size={64} />
          <p className="text-xs text-muted leading-relaxed">Pick a generated avatar{googlePhoto ? ', use your Google photo,' : ''} or paste an image URL.</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {googlePhoto && (
            <button onClick={() => setAvatar(googlePhoto)} className={`rounded-full overflow-hidden border-2 transition-colors ${avatar === googlePhoto ? 'border-foreground' : 'border-border hover:border-foreground/50'}`} title="Google photo">
              <img src={googlePhoto} alt="" className="w-10 h-10 object-cover" />
            </button>
          )}
          {generated.map((url) => (
            <button key={url} onClick={() => setAvatar(url)} className={`rounded-full overflow-hidden border-2 transition-colors ${avatar === url ? 'border-foreground' : 'border-border hover:border-foreground/50'}`}>
              <img src={url} alt="" loading="lazy" className="w-10 h-10 object-cover bg-accent" />
            </button>
          ))}
        </div>

        <input
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="…or paste an image URL"
          className="mt-3 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-foreground"
        />

        <label className="block mt-4">
          <span className="text-[11px] font-medium text-muted">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-foreground" />
        </label>

        <label className="block mt-3">
          <span className="text-[11px] font-medium text-muted">About you</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={280} placeholder="What you're building, your interests…" className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-foreground" />
        </label>

        {error && <div className="mt-2 text-xs text-err">{error}</div>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-pill px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
          <button onClick={save} disabled={busy || !name.trim()} className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02]">
            {busy && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
