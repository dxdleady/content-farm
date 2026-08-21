# (cast) — Content Farm

Generator for **1080×1350** carousel images in the (cast) / Mubert Cast brand
style. Layout, tokens, fonts, icons and logos come from Figma; slide backgrounds
are generated image-to-image from a style reference.

## Model

A post is a composition of four independent axes:

```
post = rubric × density × ref × theme
```

| Axis | Decides | Lives in |
|---|---|---|
| **rubric** | content: slides + copy | `src/plan.mjs` (`RUBRICS`), `data/rubrics.json` |
| **density** | which slides get a generated background | `data/density.json` |
| **ref** | visual style of the backgrounds | `refs/style/*` + `refs/analysis/*.json` |
| **theme** | `light` · `dark` · `color` | `tools/compose.mjs` |

Two independent halves: **layout** (21 pure HTML/CSS cards on one grid + type
scale, rendered by headless Chrome, works flat or over art) and **backgrounds**
(one reference → a whole pack; the medium transfers, subject/composition/colour
change per slide).

## Quick start

```bash
# one post: rubric × density × ref × theme
node tools/compose.mjs --rubric hot-takes --density half --ref 3 --theme dark

# 3×4 Instagram-feed mockup (edit the POSTS array in the file)
node tools/feed.mjs

# 10-row matrix — one rubric per row, each a different design × ref
node tools/matrix.mjs

# 2 sample slides per reference (judge refs)
node tools/ref-slides.mjs 1 28

# single layout card in isolation (~2s)
RUN_ID=wb CARD=statement node tools/layout-catalogue.mjs
```

- `--rubric`: `hot-takes · inspiration · feature-drop · one-workflow ·
  plan-picker · how-to · mistakes · myth-vs-fact · before-after ·
  unnecessary-censorship`
- `--density`: `minimal` (0 art) · `light` (cover+splash) · `half` (every other) ·
  `full` (all art-capable slides)
- `--ref`: `1`–`28`
- `--theme`: `light` (default) · `dark` · `color`
- `--no-fx`: disable the house film-grain (on by default)

Each run lands in its own `out/runs/<id>/` — immutable, nothing overwritten.

## Layout system

Driven by `:root` in `src/carousel.css` — edit there, changes everywhere:
margins `72`, zone step `44`, block step `56`; headline scale (144 Playfair hero /
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
            compose.mjs helpers, chrome.mjs, providers.mjs, fx.mjs
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
