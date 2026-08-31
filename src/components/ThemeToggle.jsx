import { useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../lib/theme.js';

const OPTIONS = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark',   label: 'Dark',   Icon: Moon },
  { key: 'system', label: 'System', Icon: Monitor },
];

/**
 * Three-state theme control. A radiogroup rather than a two-state switch,
 * because "follow my OS" is a real third answer and a binary toggle silently
 * throws it away the first time you press it.
 *
 * Declaring role="radiogroup" is a promise about the keyboard: arrows move
 * between options, Tab enters and leaves the group as a single stop. That is
 * what the roving tabIndex below implements. Without it a screen reader
 * announces "1 of 3" and the arrow keys do nothing.
 *
 * `compact` is the header form: a segmented row of icon buttons.
 * The default form is a labelled row for the mobile menu.
 */
export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();
  const refs = useRef([]);

  const selected = Math.max(0, OPTIONS.findIndex((o) => o.key === theme));

  // Arrow keys both move focus and change the selection, which is the expected
  // behaviour for a radiogroup whose options apply immediately.
  const onKeyDown = (e) => {
    const last = OPTIONS.length - 1;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = selected === last ? 0 : selected + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = selected === 0 ? last : selected - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setTheme(OPTIONS[next].key);
    refs.current[next]?.focus();
  };

  const common = (key, index) => ({
    ref: (el) => { refs.current[index] = el; },
    type: 'button',
    role: 'radio',
    'aria-checked': theme === key,
    tabIndex: index === selected ? 0 : -1,
    onClick: () => setTheme(key),
  });

  if (compact) {
    return (
      <div
        role="radiogroup"
        aria-label="Colour theme"
        onKeyDown={onKeyDown}
        className="hidden sm:flex items-center gap-0.5 rounded-full border border-border bg-pill p-0.5"
      >
        {OPTIONS.map(({ key, label, Icon }, i) => (
          <button
            key={key}
            {...common(key, i)}
            aria-label={label}
            title={label}
            className={`tap-target flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              theme === key
                ? 'bg-foreground text-background'
                : 'text-muted hover:text-foreground hover:bg-accent'
            }`}
          >
            <Icon size={14} strokeWidth={2} aria-hidden />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" onKeyDown={onKeyDown} className="grid gap-0.5">
      <div className="px-3 pt-2 pb-1 h-section">Theme</div>
      {OPTIONS.map(({ key, label, Icon }, i) => (
        <button
          key={key}
          {...common(key, i)}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
            theme === key ? 'bg-accent text-foreground' : 'text-muted hover:bg-accent hover:text-foreground'
          }`}
        >
          <Icon size={18} strokeWidth={2} aria-hidden />
          <span className="flex-1 text-left">{label}</span>
        </button>
      ))}
    </div>
  );
}
