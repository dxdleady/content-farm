# (cast) — Content Farm

Generator for carousel images in the (cast) / Mubert Cast brand style —
**1080×1350** for Instagram, **1080×1920** for TikTok. Layout, tokens, fonts,
icons and logos come from Figma; slide backgrounds are generated image-to-image
from a style reference.

## Model

A post is a composition of six independent axes:

```
post = product × rubric × density × ref × theme × format
```

| Axis | Decides | Lives in |
|---|---|---|
| **product** | which brand: assets, palette, voice, copy | `src/product.ts` + `products/<id>/` |
| **rubric** | the SHAPE a post follows — beats and slot roles, no words | `src/plan.ts` |
| **density** | which slides get a generated background | `data/density.json` |
| **ref** | visual style of the backgrounds | `refs/style/*` + `refs/analysis/*.json` |
| **theme** | `light` · `dark` · `color` | the product's `colorTheme` |
| **format** | canvas + platform safe-areas: `ig` · `tiktok` | `src/formats.ts` |

Every tool takes `--product <id>` (or `$PRODUCT`), defaulting to `cast`. The default
product's tag is the empty string, so its output paths are exactly what they always were.

### Adding a product

1. `products/<id>/` with `tokens/tokens.json`, `logos/wordmark.svg`, `copy/rubrics.ts`.
2. `python3 tools/build_css.py --product <id>`.
3. An entry in `src/product.ts` and its rubrics in `src/plan.ts`'s `BY_PRODUCT`.
4. `npm test` — `test/unit/product.test.ts` validates every registered product's assets,
   colour vocabulary and copy, and `src/validate.ts` runs the same checks at every CLI
   edge so a bad accent costs a message rather than a generation.

What a product does NOT get is a fork of `carousel.css`. Colour and geometry reach it
through custom properties; the 34 literal font-sizes and ~50 optical letter-spacing
corrections in that file are tuned to Playfair and Inter, and a brand with other faces
gets correct colour, correct geometry and *approximate* headline fitting. The last mile
is `Product.overrideCss`. Do not try to make `carousel.css` font-agnostic.

Two independent halves: **layout** (21 pure HTML/CSS cards on one grid + type
scale, rendered by headless Chrome, works flat or over art) and **backgrounds**
(one reference → a whole pack; the medium transfers, subject/composition/colour
change per slide).

## Requirements

There are **no npm dependencies** — every module is a Node builtin. What the repo
needs instead lives outside npm:

| Dependency | Version | Why |
|---|---|---|
| **Node** | **≥ 24** | Three floors stacked up: `process.loadEnvFile()` needs 20.12; the *global* `WebSocket` that `src/chrome.ts` drives the DevTools protocol with is only unflagged from 22.4; and native TypeScript type stripping — which is how the `.ts` sources run with no build step — is default-on from 23.6. |
| **Google Chrome** | 112+ | headless renderer (`--headless=new`). Found at the macOS default path, or set `CHROME_BIN`. |
| **API keys** | — | `WAVESPEED_API_KEY` (image-to-image backgrounds), `GEMINI_API_KEY` (text-to-image fallback). Without them the layout half still renders; slides fall back to CSS gradients. |
| **Python 3** | 3.8+ | only for `tools/*.py` (icon/CSS helpers). Stdlib only — nothing to `pip install`. |

```bash
nvm use                 # honours .nvmrc (24)
cp .env.example .env    # then paste the keys
npm run doctor          # checks node, type stripping, Chrome, keys — exits 1 on a blocker
```

**`dependencies` is empty and stays empty** — nothing the generator runs comes from npm.
The two `devDependencies` (`typescript`, `@types/node`) exist only so `npm run typecheck`
works; `npm install` is not needed to render anything.

## Tests

```bash
npm test          # ~330 cases, no Chrome, no keys, under a second
npm run typecheck # tsc --noEmit
npm run test:png  # pixel goldens — needs Chrome, ~40s
```

Three tiers, each catching what the one before it cannot:

| | What it covers | Cost |
|---|---|---|
| `test/unit` | pure logic, frozen prompt digests, all 15 provider adapters via a `fetch` double, and static invariants over the repo (every layout name resolves, every relative import exists) | ms |
| `test/html` | `renderSlide()` output for 325 slides, byte-compared. Deterministic and machine-independent — this is the tier that validates a refactor | ms |
| `test/png` | what only Chrome decides: `carousel.css`, fonts, wrapping, overflow | ~40s |

Goldens are captured from the code as it is, not as it should be — a case that throws
today has its throw pinned too. Re-baseline deliberately:

```bash
UPDATE_GOLDENS=1 npm test        # HTML tier
npm run goldens:capture:png      # PNG tier
```

PNG byte-identity is a **same-machine** gate. The manifest records the Chrome version,
platform and asset hashes; if they do not match, the tier *skips* with a re-baseline hint
rather than failing, so a Chrome update does not produce a false red.

## Quick start

```bash
# one post: rubric × density × ref × theme
node tools/compose.ts --rubric hot-takes --density half --ref 3 --theme dark

# 3×4 profile-grid mockup (edit the POSTS array in the file)
node tools/feed.ts [--format tiktok]

# 10-row matrix — one rubric per row, each a different design × ref
node tools/matrix.ts

# 2 sample slides per reference (judge refs)
node tools/ref-slides.ts 1 28

# single layout card in isolation (~2s)
RUN_ID=wb CARD=statement node tools/layout-catalogue.ts

# the same post for TikTok — 1080×1920, safe-areas, 9:16 art
node tools/compose.ts --rubric hot-takes --density half --ref 3 --format tiktok
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

`src/formats.ts` is the registry. Both formats are **1080 wide**, so the entire
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

### One post, several formats

```bash
node tools/compose.ts --rubric hot-takes --density full --ref 3 --format ig,tiktok
```

A comma list renders one run folder per format from **one** set of generated art. The
art is produced at the tallest ratio asked for and the shorter frames crop it — which is
free, because `.art-full` is `object-fit: cover` and every frame already crops whatever
it is handed. The only question was which direction: tall→wide keeps the middle, while
wide→tall crops the *sides* and at 4:5 → 9:16 loses about a third of the picture's width.

This is not primarily an optimisation. Generating per format meant a post cross-posted to
Instagram and TikTok showed **two different pictures**, from two different prompts — the
same post in name only. Now it is the same picture, and it costs one generation instead
of two. `deck.json` records `artRatio`, so two folders sharing it provably share images.

The 9:16 framing line was rewritten for this: it used to put the subject "in the upper
two thirds", which is exactly the band a 4:5 crop throws away. It now asks for the middle
band and warns the model that the top and bottom edges are cropped at other ratios —
convenient, since on TikTok those edges are also what the platform UI covers.

**Cache note:** generated art is content-addressed on `model | prompt (| ratio)`, where
the ratio is the one it was GENERATED at, not the one being rendered. It only enters the
key when it is not 4:5, so every Instagram image already in `assets/generated/` still
hits. A single-format Instagram run behaves exactly as it always did.

## Layout system

Driven by `:root` in `src/carousel.css` — edit there, changes everywhere:
margins `72` (`--pad`; the real insets are `--pad-t/r/b/l`, which add the format's
safe-area), zone step `44`, block step `56`; headline scale (144 Playfair hero /
92 Playfair head / 180 Inter claim), body `42`, labels `24`. Zones top→bottom:
`logo + pagination → ( kicker ) → content (pinned low) → footer`.

Layouts (`src/layouts.ts`): Hero, Claim, Giant Number, Stat Row, Pull Quote,
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
`src/plan.ts`). KEEP is the reference's feature-map (`refs/analysis/*.json`) —
the reusable recipe of the medium, copied verbatim. REPLACE is the per-slide
subject / composition / colour. Stay faithful to the reference: bright, glossy,
saturated — never forced dark or grungy; text readability comes from the scrim.

Generated images are content-addressed cached (`model | prompt + ref bytes`) in
`assets/generated/` — copy edits and re-renders are free, only new prompts spend.

## Structure

A **product** owns its brand and its words. Everything else is shared engine.

```
products/<id>/          one folder per brand — cast/ is the incumbent
  tokens/               tokens.json (source) → tokens.css
  logos/                wordmark.svg (the only one code reads) + the unread variants
  copy/posts/           one JSON per published post — the words, the axes, the review state
  copy/decks/           the 21 deck-*.json + content.json + topics.json (the older pipeline)
  brief/                product.json, campaigns.json, rubrics.json — for you, not for code

src/        product.ts (the registry), plan.ts (rubric skeletons + art prompts),
            layouts.ts, carousel.css, types.ts (the Slide union),
            formats.ts (canvas + safe-areas), chrome.ts, providers.ts, bgen.ts, render.ts
assets/     shared pools: fonts (Inter + Playfair, inlined), icons-clean, generated (cache)
refs/       style/ (ref-01…ref-28), analysis/ (feature-maps) — a look is not a brand
data/       density.json — the one live, product-neutral axis file
tools/      compose.ts, studio.ts (the review dashboard), feed.ts, matrix.ts,
            ref-slides.ts, fx.ts, pack-from-ref.ts, doctor.ts — all TypeScript,
            run directly with no build step
out/runs/   one folder per run — immutable
test/       unit + html + png tiers, goldens, corpus
.claude/    the `cast-content` skill
```

Which side of the line a file sits on is a judgement, and two are worth stating.
`src/carousel.css` is shared: it is the grid and the safe-area maths, not the look —
brand colour reaches it entirely through custom properties. The reference images are
shared too: a ref carries a *medium* (photography, render technique, light), and a
medium belongs to no brand.

## Studio — the review dashboard

```bash
npm run studio          # then open http://localhost:4321
```

A local page for the part of this work a terminal cannot help with: looking at a rendered
post, marking the slides that do not work, fixing the words, validating, and tagging the
post ready. Zero dependencies — `node:http` and one hand-written HTML file.

Two rules it obeys, both load-bearing:

- **It never writes TypeScript.** The copy lives in `products/<id>/copy/posts/*.json`,
  one file per published post, and the studio edits those in place. Render one with
  `node tools/compose.ts --post <id>`; its saved axes are the defaults, and any flag you
  pass still wins.
- **It cannot spend.** Every render it triggers passes `--no-generate`, so a cache miss is
  reported as a price and exits 2 rather than buying. Copy edits could not miss the art
  cache anyway — the key is built from the art prompt, not the slide text — but a
  guarantee beats a convention when there is a card on file.

**Why posts and not rubrics.** A "rubric" used to mean two things at once: the shape of a
post AND one specific post's words — 23 352 characters of finished copy across 102 slides.
`myth-vs-fact` was not a template you could pick for a new topic, because the topic was
already inside it. Now a post holds the words and a rubric holds only shape, so a rubric
can actually be chosen for a post by relevance. `rubricsFor()` is a view over the posts,
which is how the copy left TypeScript without a single golden moving.

## Regenerate assets

```bash
python3 tools/build_css.py           # tokens.json → tokens.css (add --product x)
python3 tools/normalize_icons.py     # Figma exports → assets/icons-clean
python3 tools/unify_icon_stroke.py   # single icon stroke weight
```
