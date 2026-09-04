import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, authEnabled } from './supabase.js';
import { clearMembersCache } from './members.js';

const NAME_KEY = 'aiworkshop_voter_name';
const AuthCtx = createContext(null);

function displayNameOf(user) {
  if (!user) return '';
  const m = user.user_metadata || {};
  return m.full_name || m.name || (user.email ? user.email.split('@')[0] : '') || 'Member';
}

function avatarOf(user) {
  const m = user?.user_metadata || {};
  return m.avatar_url || m.picture || '';
}

function descriptionOf(user) {
  return user?.user_metadata?.description || '';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(authEnabled);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!authEnabled) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setUser(data.session?.user ?? null); setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // Session gone by any route (expiry, sign-out in another tab, revoked):
      // drop the cached member directory with it.
      if (!session?.user) clearMembersCache();
      setUser(session?.user ?? null);
      if (session?.user) setModalOpen(false);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const value = {
    enabled: authEnabled,
    user,
    loading,
    name: displayNameOf(user),
    avatarUrl: avatarOf(user),
    description: descriptionOf(user),
    openAuth: useCallback(() => setModalOpen(true), []),
    closeAuth: useCallback(() => setModalOpen(false), []),
    modalOpen,
    updateProfile: async ({ name, description, avatarUrl }) => {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: name, description, avatar_url: avatarUrl },
      });
      if (!error && data?.user) setUser(data.user);
      return { error };
    },
    signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }),
    signInWithEmail: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUpWithEmail: (email, password, fullName) =>
      supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin } }),
    // Drop the in-memory member directory with the session, so the next person
    // on this browser does not inherit it.
    signOut: () => { clearMembersCache(); return supabase.auth.signOut(); },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Unified identity for interactive features (polls, suggestions, threads).
// - With Supabase configured: identity comes from the signed-in account; actions
//   require login (isReady = signed in). The typed-name UI is hidden.
// - Without Supabase (current state): falls back to the typed-name + localStorage
//   flow, so the app behaves exactly as before.
export function useMemberName() {
  const { enabled, user, name: authName } = useAuth();
  const [typed, setTyped] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem(NAME_KEY) || '' : ''));
  const setName = useCallback((v) => {
    setTyped(v);
    try { localStorage.setItem(NAME_KEY, v); } catch { /* ignore */ }
  }, []);

  if (enabled) {
    return { authMode: true, authed: Boolean(user), name: user ? authName : '', setName: () => {}, isReady: Boolean(user) };
  }
  return { authMode: false, authed: Boolean(typed.trim()), name: typed, setName, isReady: Boolean(typed.trim()) };
}
