import { useSyncExternalStore } from 'react';

/**
 * Theme = one of 'system' | 'light' | 'dark'.
 *
 * 'system' is the default and stores nothing, so a device that later changes
 * its OS preference just follows along. Only an explicit choice is persisted,
 * and it is written to <html data-theme> where the CSS reads it.
 *
 * The state lives in this module, not in a hook, because the toggle is mounted
 * twice (desktop header + mobile sheet). With per-instance useState, clicking
 * one left the other showing a stale aria-checked until a reload.
 *
 * The same key and the same attribute are set by public/theme-init.js before
 * first paint, so there is no flash of the wrong theme on load. Keep the two in
 * sync if either changes.
 */
export const THEME_KEY = 'aiw.theme';
export const THEMES = ['system', 'light', 'dark'];

/** Reads the stored choice. Private-mode Safari throws on localStorage. */
export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function systemPrefersDark() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The theme actually being rendered, with 'system' resolved. */
export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemPrefersDark() ? 'dark' : 'light';
}

/**
 * Applies the choice to the document. 'system' removes the attribute entirely
 * rather than writing a value, so the media query in index.css is what decides.
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  // The address bar on mobile is painted from this, and a dark bar over a light
  // page (or the reverse) looks broken. Match it to the resolved background.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolveTheme(theme) === 'dark' ? '#0B2E1E' : '#F8F0E4');
}

// ---- The store. One value, every mounted toggle reads it. ----

let current = typeof window === 'undefined' ? 'system' : readTheme();
const listeners = new Set();

const emit = () => { listeners.forEach((fn) => fn()); };

const getSnapshot = () => current;
const getServerSnapshot = () => 'system';

// Another tab changing the choice should not leave this one out of sync.
function onStorage(e) {
  if (e.key !== null && e.key !== THEME_KEY) return;
  const next = readTheme();
  if (next === current) return;
  current = next;
  applyTheme(current);
  emit();
}

// While on 'system' the stored value does not change when the OS flips, but the
// theme-color meta still has to follow the newly resolved background.
function onSystemChange() {
  if (current === 'system') applyTheme('system');
}

let mq = null;

function attach() {
  // public/theme-init.js normally does this before first paint. Re-applying on
  // first subscribe costs nothing and keeps the page correct if that file ever
  // fails to load, which would otherwise strand a saved Dark choice unapplied.
  applyTheme(current);
  window.addEventListener('storage', onStorage);
  if (typeof window.matchMedia === 'function') {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onSystemChange);
  }
}

function detach() {
  window.removeEventListener('storage', onStorage);
  if (mq) {
    mq.removeEventListener('change', onSystemChange);
    mq = null;
  }
}

function subscribe(listener) {
  if (listeners.size === 0) attach();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

export function setTheme(next) {
  const value = THEMES.includes(next) ? next : 'system';
  if (value === current) return;
  current = value;
  applyTheme(value);
  try {
    if (value === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, value);
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
  emit();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { theme, setTheme };
}
