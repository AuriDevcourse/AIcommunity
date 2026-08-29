import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared across every open modal, so the last one to close is the one that
// restores scrolling. A per-instance save/restore would unlock the page as soon
// as any one of two stacked dialogs closed.
let lockCount = 0;
let savedOverflow = '';

// Shared modal behaviour: focus trap, Escape to close, background scroll lock,
// and focus returned to whatever opened it. Previously each modal implemented
// none of this, so Tab walked out of the dialog into the page behind it.
export function useModal({ open, onClose }) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  // Callers pass an inline arrow (`onClose={() => setOpen(false)}`), so the
  // identity changes on EVERY render. Holding it in a ref — and depending only
  // on `open` below — is what stops the effect from tearing down and re-running
  // on each keystroke, which stole focus out of the textarea and back onto the
  // close button.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    restoreTo.current = document.activeElement;

    if (lockCount === 0) savedOverflow = document.body.style.overflow;
    lockCount += 1;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    // Focus the first control, falling back to the container itself.
    const first = node?.querySelector(FOCUSABLE);
    (first || node)?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        // stopImmediatePropagation, not stopPropagation: two stacked dialogs
        // both listen on `document`, and only the top one should close.
        e.stopImmediatePropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed'
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.style.overflow = savedOverflow;
      // Only restore focus if it is still inside the closing dialog.
      const active = document.activeElement;
      if (!active || active === document.body || node?.contains(active)) {
        restoreTo.current?.focus?.();
      }
    };
    // Deliberately only `open` — see the onCloseRef note above.
  }, [open]);

  return ref;
}
