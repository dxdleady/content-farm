# SOMA — product brand pack

SOMA (soma4health.com) — vendor-independent AI health agent that reasons across a
user's wearables (Oura, Whoop, CGM, Apple Health). Registered in `src/product.ts`
as `--product soma`.

```
tokens/       tokens.json (source of truth) + tokens.css (generated — rebuild with
              `python3 tools/build_css.py --product soma` after any token edit)
logos/        wordmark.svg — traced from the brand PNG wordmark, fills currentColor
fonts/        Newsreader (display serif) + Manrope (UI sans), self-hosted woff2.
              The brand's own pool — carousel.css metrics are tuned to Playfair/Inter,
              so headline fitting is approximate until an overrideCss refit is done.
copy/decks/   authored decks (empty — posts live in out/posts/soma/)
refs/style/   27 real lifestyle photos from the brand (gym, food, recovery).
              NOT yet usable as generation refs: each needs an analysis JSON in
              refs/analysis/ before compose can point --ref at it.
```

Palette merges the two shipped site themes: Kinetic v7 dark (periwinkle `#8faef8`,
indigo `#5a7df5`, mint `#8fd3b4`, navy ground `#0c0a16`) and the light vapor theme
(sky `#3e6a8c`, terracotta `#c97f55`, clay `#a3402f`, vapor `#f6f7f7`). The
`--theme color` em map is measured, not eyeballed — two grounds (indigo, periwinkle)
sit under the WCAG 3.0 large-text floor at their best and are surfaced as warnings.

Quick sanity render:

```bash
RUN_ID=soma CARD_GROUND=mist node tools/layout-catalogue.ts --product soma
```

## UGC slideshow format (tools/ugc.ts)

The TikTok stealth-marketing format, separate from the editorial carousel. Rules,
per the brand's corrected example ("You're not buying a new body.", slides 6+):
**no logo on hook slides**, white DM Sans centered on a dimmed photo, navy
`#2a1f6d` chevron, and one CTA closer (washed photo, navy copy, app screenshot in
a phone frame, App Store badge + app icon). Text sits inside the measured SAFE
SPACE box: x 108–894, y 305–1617 on 1080×1920.

```bash
node tools/ugc.ts products/soma/ugc/deck-ghosting.json
```

`ugc/assets/` holds the CTA pieces; `fonts/dm/` holds self-hosted DM Sans.
Brand faces per the founders: **The Seasons** for the wordmark/brand display
(already baked into logos/wordmark.svg as traced outlines), **DM Sans** for text.
The Newsreader/Manrope pool above serves the editorial carousel until that format
is rebranded to match.

Still to do before first real post: ref analyses for `refs/style/`, an overrideCss
type refit for the editorial carousel, and posts via `tools/studio.ts`.
