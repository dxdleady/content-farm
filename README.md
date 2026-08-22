# (cast) — Content Farm

Generator for carousel images in the (cast) / Mubert Cast brand style —
**1080×1350** for Instagram, **1080×1920** for TikTok. Layout, tokens, fonts,
icons and logos come from Figma; slide backgrounds are generated image-to-image
from a style reference.

## Model

A post is a composition of five independent axes:

```
post = rubric × density × ref × theme × format
```

| Axis | Decides | Lives in |
|---|---|---|
| **rubric** | content: slides + copy | `src/plan.mjs` (`RUBRICS`), `data/rubrics.json` |
| **density** | which slides get a generated background | `data/density.json` |
| **ref** | visual style of the backgrounds | `refs/style/*` + `refs/analysis/*.json` |
| **theme** | `light` · `dark` · `color` | `tools/compose.mjs` |
| **format** | canvas + platform safe-areas: `ig` · `tiktok` | `src/formats.mjs` |

Two independent halves: **layout** (21 pure HTML/CSS cards on one grid + type
scale, rendered by headless Chrome, works flat or over art) and **backgrounds**
(one reference → a whole pack; the medium transfers, subject/composition/colour
change per slide).

## Requirements

There are **no npm dependencies** — every module is a Node builtin. What the repo
needs instead lives outside npm:

| Dependency | Version | Why |
|---|---|---|
| **Node** | **≥ 22.4.0** | `src/chrome.mjs` drives the DevTools protocol over the *global* `WebSocket`, which is only unflagged from 22.4. On Node 20 every render throws. `process.loadEnvFile()` also needs ≥ 20.12. |
| **Google Chrome** | 112+ | headless renderer (`--headless=new`). Found at the macOS default path, or set `CHROME_BIN`. |
| **API keys** | — | `WAVESPEED_API_KEY` (image-to-image backgrounds), `GEMINI_API_KEY` (text-to-image fallback). Without them the layout half still renders; slides fall back to CSS gradients. |
| **Python 3** | 3.8+ | only for `tools/*.py` (icon/CSS helpers). Stdlib only — nothing to `pip install`. |

```bash
nvm use                 # honours .nvmrc (22)
cp .env.example .env    # then paste the keys
npm run doctor          # checks node, Chrome, keys — exits 1 on a blocker
```

`npm install` is not needed and installs nothing.

## Quick start

```bash
# one post: rubric × density × ref × theme
node tools/compose.mjs --rubric hot-takes --density half --ref 3 --theme dark

# 3×4 profile-grid mockup (edit the POSTS array in the file)
node tools/feed.mjs [--format tiktok]

# 10-row matrix — one rubric per row, each a different design × ref
node tools/matrix.mjs

# 2 sample slides per reference (judge refs)
node tools/ref-slides.mjs 1 28

# single layout card in isolation (~2s)
RUN_ID=wb CARD=statement node tools/layout-catalogue.mjs

# the same post for TikTok — 1080×1920, safe-areas, 9:16 art
node tools/compose.mjs --rubric hot-takes --density half --ref 3 --format tiktok
```

- `--rubric`: `hot-takes · inspiration · feature-drop · one-workflow ·
  plan-picker · how-to · mistakes · myth-vs-fact · before-after ·
  unnecessary-censorship`
- `--density`: `minimal` (0 art) · `light` (cover+splash) · `half` (every other) ·
  `full` (all art-capable slides)
- `--ref`: `1`–`28`
- `--theme`: `light` (default) · `dark` · `color`
- `--format`: `ig` (1080×1350, default) · `tiktok` (1080×1920)
- `--no-fx`: disable the house film-grain (on by default)

Each run lands in its own `out/runs/<id>/` — immutable, nothing overwritten.

## Formats

`src/formats.mjs` is the registry. Both formats are **1080 wide**, so the entire
type scale, every measure and every grid carries over untouched — what changes is
the vertical rhythm and the platform UI that sits on top of the image.

| | Instagram | TikTok |
|---|---|---|
| canvas | 1080×1350 (4:5) | 1080×1920 (9:16) |
| safe-area (t / r / b) | 0 / 0 / 0 | 110 / 120 / 400 |
| content | hugs the bottom of the safe box | centred in it |
| art ratio asked of the model | `4:5` | `9:16` |

The safe-area is TikTok's own chrome — the top nav, the right action rail, and the
caption / username / music block along the bottom. It becomes extra slide padding,
so **type** clears it while full-bleed art still runs to the canvas edge.

Formats are expressed as CSS variables injected at render time (`formatCss()`), and
`src/carousel.css` falls back to the Instagram canvas whenever they are absent.
Every TikTok-only value is an override with an exact no-op default, so Instagram
renders byte-for-byte what it did before the format axis existed.

Adding a format means one entry in `FORMATS` — canvas, safe-area, grid tile ratio,
an optional `framing` line appended to art prompts, and a `vars` bag of CSS
overrides. No tool needs to change.

**Cache note:** generated art is content-addressed on `model | prompt (| ratio)`.
The ratio only enters the key for non-4:5 formats, so every Instagram image already
in `assets/generated/` still hits — but a TikTok run of the same rubric generates
its own art, because a 9:16 background is a different image, not a crop.

## Layout system

Driven by `:root` in `src/carousel.css` — edit there, changes everywhere:
margins `72` (`--pad`; the real insets are `--pad-t/r/b/l`, which add the format's
safe-area), zone step `44`, block step `56`; headline scale (144 Playfair hero /
92 Playfair head / 180 Inter claim), body `42`, labels `24`. Zones top→bottom:
`logo + pagination → ( kicker ) → content (pinned low) → footer`.

Layouts (`src/layouts.mjs`): Hero, Claim, Giant Number, Stat Row, Pull Quote,
Numbered Steps, Checklist, Don't List, Tag Cloud, Feature Bento, Icon Row, Big
Question, Price Tiers, Callout, Fill Word, Timeline, Symbol Hero, Footnote, Line
Chart, Splash.

## Background generation

Keys in `.env` (repo root, git-ignored):

```
WAVESPEED_API_KEY=...   # image-to-image (gpt-image-2 1K default)
GEMINI_API_KEY=...      # fallback text-to-image
```

Each background prompt = **KEEP + REPLACE + ART_DIRECTIVE** (`composePrompt()` in
`src/plan.mjs`). KEEP is the reference's feature-map (`refs/analysis/*.json`) —
the reusable recipe of the medium, copied verbatim. REPLACE is the per-slide
subject / composition / colour. Stay faithful to the reference: bright, glossy,
saturated — never forced dark or grungy; text readability comes from the scrim.

Generated images are content-addressed cached (`model | prompt + ref bytes`) in
`assets/generated/` — copy edits and re-renders are free, only new prompts spend.

## Structure

```
data/       product.json, campaigns.json, rubrics.json, density.json
src/        plan.mjs (rubric skeletons + art prompts), layouts.mjs, carousel.css,
            formats.mjs (canvas + safe-areas), chrome.mjs, providers.mjs, fx.mjs
tokens/     tokens.json (source) → tokens.css
assets/     fonts (Inter + Playfair, inlined), icons-clean, logos, generated (cache)
refs/       style/ (28 references), analysis/ (feature-maps)
tools/      compose.mjs, feed.mjs, matrix.mjs, ref-slides.mjs, fx.mjs, pack-from-ref.mjs
out/runs/   one folder per run — immutable
.claude/    the `cast-content` skill
```

## Regenerate assets

```bash
python3 tools/build_css.py           # tokens.json → tokens.css
python3 tools/normalize_icons.py     # Figma exports → assets/icons-clean
python3 tools/unify_icon_stroke.py   # single icon stroke weight
```
