# Design system & template gotchas

Everything visual is `src/carousel.css` (styles) + `src/layouts.mjs` (per-layout
HTML). Both are tuned; make surgical changes and re-render a single card to
check: `RUN_ID=wb CARD=<layout> node tools/layout-catalogue.mjs`. Add
`--format tiktok` to check the same card on the tall canvas.

## The `:root` scale (edit once, changes everywhere)

In `src/carousel.css`:
- `--pad: 72px` (page margin), `--zone: 44px` (gap between zones), `--blk: 56px`
  (the single title↔content gap), `--row: 26px` (list row padding).
- **Use `--pad-t/-r/-b/-l`, not `--pad`, for anything that positions against an
  edge.** They are `--pad` plus the format's safe-area, and a hardcoded `72px` or
  a bare `--pad` silently ignores the platform's UI. This bit `.edge`,
  `.chartwrap`, `.chyron`, `.figure__corner`, `.grid-head`, `.feat` and
  `.steps--full` — all now parametrised.
- Type: `--t-hero: 144px` (statement / big-question headlines), `--t-head: 92px`
  (most card headings), `--t-body: 42px`, `--t-meta: 24px`, `--t-note: 28px`.
  Claim is its own thing: `.claim` = 180px grotesk (Inter), the one non-serif
  headline.
- Fonts: `--f-display` = Playfair (headlines), `--f-ui` = Inter (body/labels).

Zones top→bottom on every card: `logo + pagination → ( kicker ) → content (pinned
low) → footer`.

## Layouts (`layouts.mjs`)

~21 layouts, each returns the inner HTML of one slide. Art-capable ones (can take
a full-bleed background) are listed in `ART_CAPABLE`. Key helpers:
- `mark(text, accentClass)` — wraps `*asterisks*` as the italic accent word.
- `fillOf(x)` / `inkFor(token)` / `inkClassInk(class)` — colour helpers. See the
  trap below.
- `art(s)`, `panel(s)`, `bleed()` — background image treatments (add the scrim).
- `chrome(s)`, `kicker(s)`, `foot(s)` — the shared frame.

## Traps that will bite you (all fixed once — don't reintroduce)

### 1. Never put `class="stack"` on a heading element
`.stack` is `display:flex; flex-direction:column; gap:var(--blk)`. If you put it
directly on an `<h1>/<h2>`, the heading becomes a flex **column**: the text and
the `.em` accent span turn into separate vertical items with a 56px gap — so the
coloured word "hangs" on its own line and copy breaks raggedly. **Wrap the
heading instead:** `<div class="stack"><h1 class="h-display …">…</h1></div>`. The
heading must stay a normal block so text flows inline (accent word inline) with a
tight line-height (~.96).

### 2. Accent classes vs bare tokens — use `fillOf`, not `cvar`
`cvar(x)` expects a **bare token** (`superlime`, `purpleblue`). Passing an
ink-class like `accent-lime` yields the invalid `var(--c-accent-accent-lime)`,
which silently drops the whole declaration → borders/fills/rules vanish. This bit
`callout`, `comparison`, `beforeAfter`, `priceTiers`, `claim`, `quote`. For a
value that may be either, use `fillOf(x)` (maps ink-classes → real vars, passes
bare tokens through). For readable ink over an accent fill use `inkClassInk(cls)`
or `inkFor(bareToken)`.

### 3. Bottom-pinning requires a `.stack` wrapper
`body--tb > .stack{ margin-top:auto }` pins content low. A heading placed
directly in `.body--tb` (no `.stack` wrapper) floats to the top instead — the bug
that hit `poster`, `photo`, and `list`. Wrap content in `<div class="stack">`.

### 4. Full-bleed backgrounds and `max-width`
`.body--tb > .stack > *{ max-width:100% }` clamps children to the content width.
A full-bleed element (e.g. `.chartwrap`) needs a more specific rule
(`.body--tb > .stack > .chartwrap{ max-width:none }`) or the negative-margin
bleed collapses.

### 5. Format overrides must be exact no-ops by default
`src/formats.mjs` injects a `:root` block at render time; `carousel.css` reads it
through `var(…, <default>)`. Every default must reproduce Instagram exactly:
`--safe-t/r/b: 0px`, `--stack-mb: 0` (content hugs the floor), `--band-top` /
`--band-bot: 100%` (the extra vertical scrim collapses to nothing), `--t-claim:
180px`, `--t-figure: 720px`, `--feat-row: 148px`. The gate is byte-equality:
render `tools/layout-catalogue.mjs` before and after and `cmp` the cards.

### 6. A `var()` inside an injected `:root` value dies silently
If the referenced variable does not also resolve **at `:root`**, the whole custom
property is invalid at computed-value time and inherits as *empty* — so
`var(--x, fallback)` quietly takes the fallback and nothing renders. That is why
the tall-format scrim is `--band-top` / `--band-bot` (plain percentages) with the
gradient composed in `carousel.css` on `.slide`, where `--scrim-ink` is in scope.

### 7. Bottom-anchored vs centred content
`.body--tb > .stack` uses `margin-bottom: var(--stack-mb, 0)`; a tall format sets
it to `auto` so the copy centres in the safe box instead of leaving the upper half
empty. The one exception is the giant figure — `:has(.figure__v)` forces it back
to the floor, because its unit is pinned to the bottom-right corner and centring
the number orphans it half a frame away.

## Themes

- **light** → `theme:"light"` → `.slide--light` (cream `#EEEBEA`, dark ink). On
  light theme, `accent-lime` (superlime) vanishes on cream — swap it to
  `accent-purple`. A theme-aware light `.bg-scrim` keeps art bright with dark type.
- **dark** → default (near-black `--c-background-dark`, light ink). The standard
  `.bg-scrim` darkens the type zone for light text.
- **color** → per-slide `ground` (a rotating brand token) flooded with
  `inkFor(ground)` picking readable ink; the accent (`GA` map in `compose.mjs`)
  is chosen to pop against that ground. On art slides the image is tinted to the
  ground hue and the theme/scrim is set so type reads.

The wordmark (`assets/logos/cast-wordmark.svg`) is `fill="currentColor"`, so it
follows the theme automatically — light on dark, dark on light.

## Regenerating derived assets

```bash
python3 tools/build_css.py         # tokens/tokens.json → tokens/tokens.css
python3 tools/normalize_icons.py   # Figma exports → assets/icons-clean
python3 tools/unify_icon_stroke.py # single stroke weight across icons
```
