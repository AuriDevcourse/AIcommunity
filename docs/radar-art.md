# Radar section art

Four banner strips, one per layer, at `public/radar/sections/<category>.webp`. They
exist so the four layers are told apart by sight rather than only by reading a
heading, and because the page was a wall of text.

## Current set: cropped from the brand banner artwork (2026-09-12)

The shipping set is cut from four existing brand artworks, not generated. Sources
are `assets/radar-banners/banner-0{1..4}.png`; `npm run radar:banners` rebuilds
all four.

```bash
npm run radar:banners
```

| Section | Source | Band | Scale |
|---|---|---|---|
| Coding agents | banner-01 | bottom | 1.23x |
| Models | banner-03 | y=360 | 1.89x |
| Build layer | banner-02 | bottom | 1.07x |
| Everyday work | banner-04 | top | 3.15x |

28KB for the set, down from 120KB for the generated one.

**What to know before touching the crops:**

- **The sources are text-backdrop frames, not banner art.** Each is a decorated
  border of green waves and yellow suns around an empty cream centre. A naive
  centre crop on banner-01, 02 or 04 returns a blank cream strip. The band that
  carries shapes is the top or bottom edge. Cut a contact sheet of top / middle
  / bottom before picking.
- **banner-03's sun is taller than any band that fits.** The sun is 361px in a
  1062px-tall square; the band is 148px. A `middle` crop slices it into a flat
  yellow slab that no longer reads as a sun. `y=360` catches the whole dome
  rising off the bottom edge with the rays still around it. That offset was
  found by eye, so treat it as a fixed value, not something to re-derive.
- **Band height is computed from the output ratio**, so the crop is always a
  uniform scale. Do not type a height: that is how you get a stretch.
- **Models is the odd one out and that is deliberate.** Its band has no green in
  it, so the sunrise floats on the cream page with no visible edge while the
  other three are green-filled rectangles. It reads as the hero rather than as a
  break in the set. Shifting the band down to pick up green costs the dome.
- **Sources live in `assets/`, not `public/`.** Everything under `public/` is
  copied verbatim into `dist/`, and these are 3.4MB of PNG that no page loads.
- **They are named `banner-0N.png` on purpose.** `.gitignore` blocks `* 2.*` and
  `* 3.*` (the guard against sync-client duplicates), so "Banner 2.png" and
  "Banner 3.png" were silently untrackable under their original names. Half the
  source set would have vanished on the first commit.
- **These strips are decorative and carry `alt=""`.** If one ever becomes
  load-bearing it needs real alt text, and at that point it should be inline SVG
  rather than a raster.

**What was lost in the swap.** The generated set had a distinct motif per layer:
a sunrise and rainbow for Models, bridge arches for Build, a loop of arrows and a
staircase for Coding agents, a page and clock for Everyday work. The brand
artworks carry no per-category semantics, so the new set separates the layers by
silhouette and rhythm only. It is on-brand and it breaks up the text, but it no
longer illustrates what each layer is.

---

## Previous set: generated with Nano Banana Pro

Kept because the failure log is the valuable part. Superseded 2026-09-12.

Generated with Nano Banana Pro (Gemini 3 Pro Image) via the `nano-banana-pro`
skill, then cropped and converted with sharp. The prompts are recorded here so
the set can be regenerated or extended without guessing at the look.

## The look these have to match

The reference is the brand hero band (`public/brand/hero-dark.webp`) and the
wordmark (`public/brand/og.png`). Both are **1970s groovy**: thick bulbous
shapes with fat rounded ends, a rising sun, a lime horizon wave, cream
characters scattered through a deep green sky. Confident and warm.

That word, groovy, is what the first two attempts missed. Anything that reads as
generic flat-design icons is wrong even when the palette is right.

## Regenerating

```bash
export GEMINI_API_KEY=$(grep -E '^GEMINI_API_KEY=' .env.local | cut -d= -f2-)
uv run ~/.claude/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "<STYLE> <SUBJECT>" --filename "<name>.png" --resolution 2K
```

Then crop to the shipping size. **7.1:1, not thinner.** The source is about
6.5:1; cropping it into a thin strip cuts the shapes in half:

```js
sharp(src).resize(2000, 280, { fit: 'cover', position: 'centre' })
  .webp({ quality: 84 }).toFile('public/radar/sections/<category>.webp')
```

Each file lands around 23-31KB, 120KB for the set. The component renders them at
their natural ratio (`w-full`, no fixed height), so a thinner crop is not a safe
change.

## The style block

Prepend this to every subject, unchanged.

> Bold flat vector illustration in a playful 1970s retro poster style, wide
> horizontal banner, 7:1 aspect ratio. Deep forest green background, hex 0B2E1E.
> Palette strictly limited to golden yellow hex F8B800, amber orange hex F08A00,
> warm cream hex F8F0E4 and bright lime green hex D4F53A. All shapes are THICK,
> CHUNKY and BULBOUS with generously rounded ends, like a confident groovy sticker
> sheet. Absolutely flat: no outlines, no gradients, no shading, no highlights, no
> texture, no 3D, no perspective. Crisp hard vector edges everywhere, perfectly
> sharp, no blur or soft focus anywhere. A thick bright lime green wave sweeps
> across the entire width as a horizon line, dipping and rising, with shapes
> sitting above it and partly hidden behind it. Draw ONLY the shapes listed below,
> spaced evenly along the full width with calm green space between them. No
> confetti, no scattered specks, no small filler dots, no background pattern.
> Confident, joyful, uncluttered. No text, no letters, no numbers.

Why each clause is there:

- **The hex codes** are the locked brand palette (`src/index.css`, `--brand-*`).
  Naming colours in words gets you a different green.
- **"THICK, CHUNKY and BULBOUS" plus "groovy sticker sheet".** This is the clause
  that buys the brand's personality. Without it you get competent, generic,
  forgettable flat icons.
- **The lime wave as a horizon.** The single strongest brand signature. It also
  gives every banner a shared spine, so four separate images read as one set.
- **"Draw ONLY the shapes listed" and the no-confetti ban.** Without it the model
  fills empty space with small specks.
- **"no blur or soft focus".** See the failure log below.
- **"No text"** three ways. Text is the reliable failure in every image model,
  and a banner with a misspelt word on it is unshippable.

## The four subjects

The subject is always a numbered left-to-right list of shapes. Asking for a scene
("pipes connecting across the banner") returns a dense illustration; a numbered
sequence returns a composed strip.

| File | Layer | Subject appended to the style block |
|---|---|---|
| `models.webp` | Models, the engine | Theme, a sunrise: a huge golden sun rising from behind the lime wave left of centre, with eight thick chunky amber rays fanning around it. On the right, three very thick nested cream arcs like a fat bold rainbow arching over the wave. Scattered in the green sky, two chunky cream four-pointed sparkles and three fat cream circles of different sizes. |
| `build.webp` | Build layer, the plumbing | Theme, connected plumbing: three very thick chunky arches in cream, lime and cream standing on the lime wave like a row of bridge spans across the banner, with fat golden circles sitting where the arches meet. A chunky cream four-pointed sparkle and two fat cream circles in the green sky above. |
| `agents.webp` | Coding agents, the worker | Exactly six shapes, evenly spaced left to right: 1, a chunky cream four-pointed sparkle. 2, a staircase of three chunky cream rounded blocks rising to the right. 3, a large ring made of three very thick cream arrows chasing each other in a circle, sitting above the wave. 4, a fat golden circle like a small sun. 5, a chunky lime four-pointed sparkle. 6, a thick cream arch standing on the wave. |
| `work.webp` | Everyday work, the desk | Theme, a calm desk on a Sunday: left of centre a chunky cream rounded rectangle standing upright like a page, next to it a fat golden circle like a clock face with two thick lime hands inside, then a chunky cream wavy squiggle lying above the wave, and a small golden half sun rising behind the wave on the right. One cream four-pointed sparkle in the sky. |

## Failure log, so nobody repeats it

Four attempts got here. Each failure is worth knowing:

1. **Too dense.** "Generous empty space" was ignored and produced an allover
   pattern that fought the text underneath. An adjective does not constrain
   density.
2. **Too bland.** Overcorrecting with a hard shape count ("only five or six
   shapes", "seventy percent empty green") produced three shapes floating in a
   void. Technically on-palette, no personality, and it looked like a mistake.
   **The overwhelm on that page was words, not pictures.** Do not solve a text
   problem by starving the art.
3. **Blurred.** Passing the brand hero via `--input-image` as a style reference
   put the model in edit mode, so it tried to preserve the source and left a
   smeared horizontal band across the result. **Describe the style in text; do
   not pass a reference image.** Text-only output is consistently sharp.
4. **Confetti.** Asking for even full-width distribution without banning filler
   made it scatter small specks everywhere. Name every shape and ban the rest.

The working recipe is attempt four: rich named shapes, a numbered left-to-right
list, the groovy language, the lime wave spine, and an explicit ban on filler.

## Rules if you add a fifth

- One banner per category, keyed by `categories[].art` in `data/radar.json`.
- Deep green ground in both themes. The hero band needed separate light and dark
  files because inverting the art turns the green magenta; these avoid the
  problem by staying dark in both, reading as a deliberate band.
- `alt=""`. They are decorative and the heading underneath carries the meaning.
- Keep the lime wave. It is what makes four separate images look like one set.
