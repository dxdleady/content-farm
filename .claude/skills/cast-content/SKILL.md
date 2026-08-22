---
name: cast-content
description: >-
  Generate on-brand (cast) / Mubert Cast social content — carousel slides, post
  covers, whole decks, and profile-feed mockups for Instagram (1080×1350) and
  TikTok (1080×1920) — by composing a post from five axes: rubric × density × ref
  × theme × format. Use this whenever working in the (cast)–Farm repo or when the
  user asks to make / compose / render (cast) or Mubert Cast posts, carousels,
  slides, covers, decks, a content feed / grid / matrix, a TikTok or vertical
  9:16 version of a post, or to add / preview a style reference, edit rubric copy,
  generate slide backgrounds via image-to-image, write a ref feature-map (KEEP
  block), or tune the layout / CSS templates. Trigger even if the user just says
  "compose a hot-takes post", "build the feed", "make it for TikTok", or "make a
  dark cover" without naming the system.
---

# (cast) content farm

A generator for carousel images in the (cast) / Mubert Cast brand style —
**1080×1350** (Instagram) or **1080×1920** (TikTok). A post is a **composition of
five independent axes** — change one, keep the rest:

```
post  =  rubric  ×  density  ×  ref  ×  theme  ×  format
         (copy)     (how        (image   (light /   (canvas +
                     graphic)     style)   dark /     platform
                                           color)     safe-areas)
```

| Axis | What it decides | Lives in |
|---|---|---|
| **rubric** | the content: slides + copy | `src/plan.mjs` (`RUBRICS`), `data/rubrics.json` |
| **density** | which slides get a generated background | `data/density.json` |
| **ref** | the visual style of those backgrounds | `refs/style/*` + `refs/analysis/*.json` |
| **theme** | light / dark / color palette | applied in `tools/compose.mjs` |
| **format** | the canvas and the platform's safe-areas | `src/formats.mjs` |

Everything renders through headless Chrome (`src/chrome.mjs`) from clean HTML/CSS
(`src/carousel.css`, `src/layouts.mjs`) — no browser deps. Backgrounds are
image-to-image via WaveSpeed (`src/providers.mjs`, key in `.env`).

## The one command you'll use most

```bash
node tools/compose.mjs --rubric hot-takes --density half --ref 3 --theme dark
```

- `--rubric` — one of: `hot-takes · inspiration · feature-drop · one-workflow ·
  plan-picker · how-to · mistakes · myth-vs-fact · before-after ·
  unnecessary-censorship`
- `--density` — `minimal` (0 art) · `light` (cover+splash) · `half` (every other
  art-capable slide) · `full` (all art-capable slides)
- `--ref` — `1`–`28` (only needed when the density generates art)
- `--theme` — `light` (cream, dark type) · `dark` (near-black, light type) ·
  `color` (rotating brand grounds) — default `light`
- `--format` — `ig` (1080×1350, default) · `tiktok` (1080×1920) — every tool
  takes this flag, and it also reads `$FORMAT`
- `--no-fx` — turn off the house film-grain (grain is **on** by default)

Output lands in its own immutable folder `out/runs/compose-<deck>/` with each
slide PNG + a `contact-sheet.png` + `deck.json`. Nothing is ever overwritten.

## The other tools

| Command | Makes |
|---|---|
| `node tools/feed.mjs [--format tiktok]` | a 3×4 profile-grid mockup of 12 covers — edit the `POSTS` array in the file to change what's in the grid |
| `node tools/matrix.mjs` | a 10-row matrix, one rubric per row, each in a different design × ref (a system overview) |
| `node tools/ref-slides.mjs 1 10` | 2 sample slides per ref (a hero + a splash) for judging refs |
| `node tools/fx.mjs` | test the house film-grain on 5 slides |
| `RUN_ID=x CARD=statement node tools/layout-catalogue.mjs [--format tiktok]` | one layout card in isolation (~2s) — best for design tweaks |
| `RUN_ID=$(date +%s) node tools/layout-catalogue.mjs` | the whole layout catalogue on one sheet |

**Cache**: generated images are content-addressed on `model | prompt + ref bytes`
(`assets/generated/`). Re-running with the same prompt/ref is free — so **copy
edits and re-renders cost nothing**, only new image prompts spend (`gpt-image-2`
≈ $0.07 each). Always mention the ~cost before a large generation and prefer
letting the cache absorb re-runs.

## How the image backgrounds work (read before touching prompts)

Every generated background is one prompt = **KEEP + REPLACE + ART_DIRECTIVE**,
assembled by `composePrompt()` in `src/plan.mjs`:

- **KEEP** — the ref's feature-map (`refs/analysis/cast-ref-NN.json`): the
  reusable *recipe* of the medium (photography/render technique, ground, light,
  palette, signature treatment). Copied verbatim for every slide of that ref.
- **REPLACE** — per-slide `art: { s: subject, c: composition, k: colour }` from
  the rubric skeleton. Only the subject/composition/colour change per slide.
- **ART_DIRECTIVE** — a global rule (`ART_DIRECTIVE` in `plan.mjs`).

**Hard-won rules — do not regress these:**
- **Stay faithful to the ref: bright, glossy, saturated, poppy.** The refs are
  bright editorial images. Do **not** push grunge, HDR crunch, crushed shadows,
  heavy grain, torn/gritty texture, or "over a dark ground" into prompts — that
  made every output dark and dirty. Let the ref's palette lead.
- **Readability comes from the scrim, not from darkening the photo.** The
  `.bg-scrim` (dark for dark theme, light for `slide--light`) darkens the type
  zone (lower-left / behind the logo). Keep the composition's type zone
  *uncluttered*, not *dark*.
- Only **art-capable** layouts can carry a background: `statement, stat, quote,
  splash, tags, bento, poster, photo, steps, symbolHero` (`ART_CAPABLE` in
  `plan.mjs`). Density picks art slides only from these.

## Formats (the fifth axis)

`src/formats.mjs` is the registry; `--format` on any tool selects one.

|  | `ig` (default) | `tiktok` |
|---|---|---|
| canvas | 1080×1350 (4:5) | 1080×1920 (9:16) |
| safe-area t / r / b | 0 / 0 / 0 | 110 / 120 / 400 |
| content | hugs the bottom of the safe box | centred in it |
| art ratio | `4:5` | `9:16` |

**Both formats are 1080 wide**, so the type scale, measures and grids are shared —
only the vertical rhythm and the platform's UI change. TikTok's safe-area is its
own chrome (top nav, right action rail, bottom caption / username / music block);
it becomes extra slide padding, so type clears it while full-bleed art still runs
to the canvas edge.

**Rules when touching this:**
- Every format-specific value is a CSS variable with a **no-op default** in
  `carousel.css` (`--safe-*: 0`, `--band-top/-bot: 100%`, `--stack-mb: 0`,
  `--t-claim`, `--t-figure`, `--feat-row`). Instagram must keep rendering
  byte-for-byte identically — check with
  `RUN_ID=x node tools/layout-catalogue.mjs` and `cmp` against a known-good run.
- Never put a `var()` inside a value injected into `:root` unless the referenced
  variable also resolves at `:root`. It silently becomes invalid and inherits as
  empty. Compose such values in `carousel.css`, where the slide's own vars are in
  scope, and let the format supply plain numbers (that is why the scrim band is
  `--band-top`/`--band-bot`, not a whole gradient).
- Generated art is cached on `model | prompt (| ratio)`; the ratio only enters the
  key for non-4:5 formats, so existing Instagram art still hits the cache. A
  TikTok run of the same rubric **does** buy new images — a 9:16 background is a
  different image, not a crop.
- Adding a format = one entry in `FORMATS` (canvas, safe-area, grid tile ratio, an
  optional `framing` line for art prompts, a `vars` bag). No tool changes.

## Editing the content (rubrics)

`src/plan.mjs` is the single source of truth: `RUBRICS[id].slides[]`, each slide
carrying its layout + copy, and (on art-capable slides) an `art` prompt. Copy
uses `*asterisks*` to mark the accent word (`mark()` in `layouts.mjs`).

Ground the copy in the real product and **respect the brand voice**: never claim
"ad-safe / brand-safe / copyright-proof / zero copyright claims / unlocks
advertising" — see `data/product.json` (`voice.avoid`, `plans`, `features`,
`differentiators`) and `data/campaigns.json`. Prices in `product.json` may drift;
say "verify the live pricing page" rather than asserting them.

## Deeper references (load when the task needs them)

- **Adding or previewing a style ref, writing a feature-map (KEEP)** →
  `references/refs-and-prompts.md`
- **Design system: tokens, the 21 layouts, and the template gotchas that will
  bite you** (the `class="stack"` heading trap, `cvar` vs `fillOf`, theme
  handling) → `references/design-system.md`

## Conventions

- Every run is its own `out/runs/<id>/` — immutable, side-by-side comparable.
- Keep the four axes orthogonal. When the user asks for a variation, change the
  smallest axis (theme/ref) and reuse the cache.
- After generating, **look at the render** (Read the PNG) before declaring it
  done — catch overflow, unreadable text, or off-brand imagery yourself.
