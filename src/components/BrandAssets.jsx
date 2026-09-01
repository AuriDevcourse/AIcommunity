import { useState } from 'react';
import { ArrowLeft, Download, Check, Copy, Palette, Type, ShieldAlert, Signature, Shapes, Image, Wallpaper } from 'lucide-react';

// Footer page: every brand file in the repo, downloadable, plus the locked
// palette. It exists because people kept asking Auri for "the logo" and getting
// a screenshot. Everything here is served from /public, so a download is a plain
// same-origin anchor, no endpoint and nothing to rate-limit.
//
// Nothing is generated for this page, and nothing is described as available that
// is not actually there: a dead download on a brand page is worse than a missing
// one.
//
// Deliberately NOT offered, though the files exist: brand/icon-mono.svg (drawn in
// currentColor, so an <img> preview renders it flat black and it reads as broken),
// brand/hero.png (3.4MB original), brand/hero.webp (superseded by the two
// themed bands) and brand/icon-badge.svg (pulled from the page on request; the
// file stays in /public, it is just not listed here).

const LOCKUPS = [
  {
    file: '/brand/logo.svg',
    name: 'Wordmark, standard',
    as: 'ai-sundays-wordmark.svg',
    meta: 'SVG · 1769 × 615',
    note: 'For cream, white and any light ground. The default: use this one unless the ground is dark.',
    ground: 'light',
  },
  {
    file: '/brand/logo-dark.svg',
    name: 'Wordmark, inverted',
    as: 'ai-sundays-wordmark-dark.svg',
    meta: 'SVG · 1769 × 615',
    note: 'For deep green and dark grounds. Same geometry, recoloured so the sun stays visible.',
    ground: 'dark',
  },
];

const MARKS = [
  {
    file: '/favicon.svg',
    name: 'App mark',
    as: 'ai-sundays-mark.svg',
    meta: 'SVG · 620 × 620',
    note: 'The rounded green tile. Source for every raster icon in the repo, and legible down to 16px.',
    ground: 'light',
  },
  {
    file: '/brand/favicon-mark-inv.svg',
    name: 'App mark, inverted',
    as: 'ai-sundays-mark-inverted.svg',
    meta: 'SVG · 620 × 620',
    note: 'Amber tile, green mark. Shipped for dark browser chrome.',
    ground: 'dark',
  },
  {
    file: '/brand/icon.svg',
    name: 'Sunrise icon',
    as: 'ai-sundays-icon.svg',
    meta: 'SVG · 512 × 512',
    note: 'Full colour, transparent ground. Sits on any surface that is not busy.',
    ground: 'light',
  },
];

const RASTER = [
  { file: '/brand/og.png', name: 'Social card', as: 'ai-sundays-og.png', meta: 'PNG · 1200 × 630 · 57 KB', note: 'The Open Graph image the site serves to LinkedIn and Slack.' },
  { file: '/icon-512.png', name: 'App icon, 512', as: 'ai-sundays-icon-512.png', meta: 'PNG · 512 × 512', note: 'PWA install icon.' },
  { file: '/icon-192.png', name: 'App icon, 192', as: 'ai-sundays-icon-192.png', meta: 'PNG · 192 × 192', note: 'PWA install icon, small.' },
  { file: '/apple-touch-icon.png', name: 'Apple touch icon', as: 'ai-sundays-apple-touch-icon.png', meta: 'PNG · 180 × 180', note: 'Flattened onto the tile green, so iOS does not render a dark notch in the corners.' },
  { file: '/favicon-32.png', name: 'Favicon, 32', as: 'ai-sundays-favicon-32.png', meta: 'PNG · 32 × 32', note: 'For anything that still refuses an SVG favicon.' },
];

const IMAGERY = [
  { file: '/brand/hero-light.webp', name: 'Hero band, light', as: 'ai-sundays-hero-light.webp', meta: 'WebP · 39 KB', note: 'The illustrated horizon at the top of the dashboard, light theme.' },
  { file: '/brand/hero-dark.webp', name: 'Hero band, dark', as: 'ai-sundays-hero-dark.webp', meta: 'WebP · 50 KB', note: 'Same band, dark theme. Not an inverted copy: inverting the art turns the green horizon magenta.' },
  { file: '/brand/pattern.webp', name: 'Pattern', as: 'ai-sundays-pattern.webp', meta: 'WebP · 45 KB', note: 'Tiling brand pattern. Backgrounds and slide fills, never behind body text.' },
];

// The locked palette, values copied from the :root block in src/index.css, which
// in turn came from the brand repo's palette.md. Contrast figures are measured,
// not estimated, and they are the reason some of these colours are fenced off.
const PALETTE = [
  { hex: '#124A30', name: 'Brand green', role: 'Primary. Buttons, the wordmark, the icon tile.', contrast: '9.07 with cream on top' },
  { hex: '#0B2E1E', name: 'Deep green', role: 'Dark-theme page ground, and the badge tile.', contrast: '13.05 with cream on top' },
  { hex: '#F8B800', name: 'Brand yellow', role: 'The sun, chips, accents.', contrast: '1.57 on cream', warn: true },
  { hex: '#F8F0E4', name: 'Cream', role: 'Light-theme page ground.', contrast: 'carries ink at 16.70' },
  { hex: '#111111', name: 'Ink', role: 'All body text on light grounds.', contrast: '16.70 on cream' },
  { hex: '#D4F53A', name: 'Lime', role: 'Gradient end-stop and deliberate accents only.', contrast: 'not a text colour', warn: true },
  { hex: '#F08A00', name: 'Amber', role: 'Gradient end-stop only.', contrast: '2.23 on cream', warn: true },
  { hex: '#6B6355', name: 'Muted', role: 'Secondary text, labels, captions.', contrast: '5.25 on cream' },
];

const RULES = [
  'Never recolour the wordmark. Both colourways already exist above; pick the one that matches the ground.',
  'In the inverted lockup the sun sits outside the blob, so it has to contrast with the page, not with the blob. Two shades of green next to each other is how the sun went missing twice.',
  'Yellow, lime and amber are never text and never a control that has to be seen. Yellow on cream measures 1.57.',
  'Do not stretch, rotate or add effects to the mark. Scale it, and leave clear space around it equal to the height of the sun.',
];

function Section({ title, icon: Icon, children, hint }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-1.5 h-section">
        {Icon && <Icon size={11} strokeWidth={2.2} />}
        <span>{title}</span>
      </h2>
      {hint && <p className="mt-2 text-sm text-muted max-w-2xl">{hint}</p>}
      {children}
    </section>
  );
}

// One downloadable file. The preview sits on the ground the file is drawn for,
// so an inverted lockup is never shown on cream where it looks broken.
function AssetCard({ asset }) {
  const dark = asset.ground === 'dark';
  return (
    <div className="card card-pad flex flex-col gap-3">
      <div
        className={`grid place-items-center rounded-xl border border-border h-28 px-4 ${dark ? 'bg-[var(--brand-deep)]' : 'bg-[var(--brand-cream)]'}`}
      >
        <img
          src={asset.file}
          alt={`${asset.name} preview`}
          loading="lazy"
          className="max-h-16 max-w-full object-contain"
        />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-snug">{asset.name}</div>
        <div className="mt-0.5 text-[11px] text-muted num">{asset.meta}</div>
        <p className="mt-1.5 text-xs text-muted leading-relaxed">{asset.note}</p>
      </div>
      <a
        href={asset.file}
        download={asset.as}
        className="btn btn-sm btn-ghost self-start"
        aria-label={`Download ${asset.name}`}
      >
        <Download size={14} strokeWidth={2.2} /> Download
      </a>
    </div>
  );
}

// Raster and imagery rows: a thumbnail, the facts, one download. Denser than the
// card grid because there is nothing to judge visually except the thumbnail.
function AssetRow({ asset }) {
  return (
    <li className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
      <span className="grid place-items-center w-14 h-14 flex-shrink-0 rounded-lg border border-border bg-[var(--brand-cream)] overflow-hidden">
        <img src={asset.file} alt="" loading="lazy" className="max-h-12 max-w-12 object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{asset.name}</span>
        <span className="block text-[11px] text-muted num">{asset.meta}</span>
        <span className="block mt-0.5 text-xs text-muted leading-relaxed">{asset.note}</span>
      </span>
      <a
        href={asset.file}
        download={asset.as}
        className="flex-shrink-0 grid place-items-center w-9 h-9 rounded-full border border-border text-muted hover:text-foreground hover:bg-accent transition-colors"
        aria-label={`Download ${asset.name}`}
      >
        <Download size={15} strokeWidth={2.2} />
      </a>
    </li>
  );
}

// A swatch that copies its own hex. The copy target is the whole tile, so it is
// one tab stop per colour rather than a tile plus a button.
function Swatch({ colour }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(colour.hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked, the hex is on screen anyway */ }
  }
  return (
    <button
      type="button"
      onClick={copy}
      // h-full + flex, or a swatch with less text than its row-mates centres
      // itself in the row and the colour bands stop lining up.
      className="card text-left overflow-hidden h-full flex flex-col transition-transform hover:-translate-y-0.5"
      aria-label={`Copy ${colour.name}, ${colour.hex}`}
    >
      {/* The border matters for cream and any other pale value: without it a
          light swatch on a white card has no edge and reads as empty space. */}
      <span className="block h-16 w-full border-b border-border" style={{ background: colour.hex }} />
      <span className="block p-3">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{colour.name}</span>
          {copied
            ? <Check size={14} strokeWidth={2.6} className="text-ok flex-shrink-0" />
            : <Copy size={13} strokeWidth={2.2} className="text-muted flex-shrink-0" />}
        </span>
        <span className="mt-0.5 block text-xs text-muted num tabular-nums">{copied ? 'Copied' : colour.hex}</span>
        <span className="mt-1.5 block text-xs text-muted leading-relaxed">{colour.role}</span>
        <span className={`mt-1.5 inline-block text-[11px] ${colour.warn ? 'text-warn' : 'text-muted'}`}>
          {colour.contrast}
        </span>
      </span>
    </button>
  );
}

export default function BrandAssets({ onBack }) {
  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={2.2} /> Back
      </button>

      <div className="mt-5 flex items-center gap-2.5">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent text-foreground flex-shrink-0">
          <Download size={18} strokeWidth={2} />
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Download assets</h1>
      </div>
      <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">
        The AI Sundays logos, icons and colours, straight from the repo. Use them for anything
        about this community: slides, event pages, posts, a side event you are hosting with us.
        Prefer the SVGs, they scale to any size and stay sharp.
      </p>

      <Section
        title="Wordmark"
        icon={Signature}
        hint="The full lockup. Two colourways, one per ground. Nothing else needs to exist."
      >
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {LOCKUPS.map((a) => <AssetCard key={a.file} asset={a} />)}
        </div>
      </Section>

      <Section
        title="Marks and icons"
        icon={Shapes}
        hint="Square formats, for avatars, app grids, favicons and anywhere the wordmark is too wide to read."
      >
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MARKS.map((a) => <AssetCard key={a.file} asset={a} />)}
        </div>
      </Section>

      <Section title="Raster and social" icon={Image} hint="Already sized. Reach for these only when a PNG is required.">
        <ul className="mt-2">
          {RASTER.map((a) => <AssetRow key={a.file} asset={a} />)}
        </ul>
      </Section>

      <Section title="Imagery" icon={Wallpaper}>
        <ul className="mt-2">
          {IMAGERY.map((a) => <AssetRow key={a.file} asset={a} />)}
        </ul>
      </Section>

      <Section
        title="Colours"
        icon={Palette}
        hint="Locked. Every pairing used for text was measured, not eyeballed. Click a swatch to copy its hex."
      >
        <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {PALETTE.map((c) => <Swatch key={c.hex} colour={c} />)}
        </div>
      </Section>

      <Section title="Type" icon={Type}>
        <div className="mt-3 card card-pad">
          <div className="text-2xl font-semibold tracking-tight">Geist</div>
          <p className="mt-1 text-xs text-muted">
            Headings and body. Variable weight, shipped as <span className="num">@fontsource-variable/geist</span>.
          </p>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Geist Mono
            </div>
            <p className="mt-1 text-xs text-muted">
              Numerals, dates, code. Tabular figures, so columns of numbers line up.
            </p>
          </div>
          <p className="mt-4 text-xs text-muted leading-relaxed">
            Both are open source under the SIL Open Font License. Install from npm or download them
            from the Geist site rather than copying the woff2 files out of this repo.
          </p>
        </div>
      </Section>

      <Section title={`${RULES.length} rules`} icon={ShieldAlert}>
        <ol className="mt-3 flex flex-col gap-2.5">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-muted leading-relaxed">
              <span className="flex-shrink-0 num tabular-nums text-foreground font-semibold">{i + 1}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="mt-10 pt-5 border-t border-border">
        <p className="text-sm text-muted leading-relaxed">
          The marks belong to the AI Sundays community. Use them to talk about us, not to suggest we
          made or endorsed something we did not. Need a format that is not here? Ask in the Forum.
        </p>
      </div>
    </div>
  );
}
