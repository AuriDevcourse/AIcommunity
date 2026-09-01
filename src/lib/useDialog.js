import { useEffect, useRef } from 'react';

// The three things a modal owes a keyboard user, in one hook: Escape to close,
// focus moved in on open and restored to the trigger on close, and Tab kept
// inside the panel while it is open.
//
// AuthControls, Learn, PostMaker and SessionRecap each bound Escape by hand and
// stopped there, so the Edit Session and Add photos dialogs were left with a
// background that stayed tabbable behind them and focus still sitting on the
// button that opened them.
//
// Usage: attach the returned ref to the PANEL (not the overlay), and give the
// panel role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}.

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const visible = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';

export function useDialog(onClose) {
  const ref = useRef(null);
  // onClose is nearly always an inline arrow, so a new identity every render. Keep
  // it in a ref and run the effect ONCE, or every parent render re-runs setup and
  // yanks focus back to the first control mid-typing.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return undefined;
    const returnTo = document.activeElement;

    const items = () => [...panel.querySelectorAll(FOCUSABLE)].filter(visible);
    (items()[0] || panel).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); panel.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      // Wrap at both ends, and pull focus back in if it escaped the panel.
      if (e.shiftKey && (active === first || !panel.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !panel.contains(active))) { e.preventDefault(); first.focus(); }
    };

    // Capture phase, so the dialog sees Escape before anything underneath it.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) returnTo.focus();
    };
  }, []);

  return ref;
}
