# References, feature-maps, and image prompts

## What a "ref" is

A ref is a style reference image in `refs/style/` (currently `Cast Ref 1.jpg` …
`Cast Ref 28.jpg`, note: `Cast Ref 13.png`). It carries a *look* — a medium,
palette, lighting, and signature treatment — that gets transferred onto new
subjects via image-to-image.

Each ref has a **feature-map** in `refs/analysis/cast-ref-NN.json` (2-digit,
zero-padded). `refAnalysisFile(n)` in `src/plan.mjs` maps a number → filename.

## Feature-map (KEEP) schema

```json
{
  "ref": "Cast Ref 7.jpg",
  "name": "floral-crab-meadow",
  "keep": [
    "KEEP — the making of the image, copy exactly:",
    "· MEDIUM: <how it's made — photography or render technique, sharpness, grain>",
    "· GROUND / BACKGROUND: <what's behind the subject>",
    "· LIGHT: <lighting quality>",
    "· PALETTE: <named colours>",
    "· <SIGNATURE TREATMENT>: <stickers / halftone / chrome / low-poly / fisheye / etc.>",
    "· MOOD: <one line>",
    "· No readable text, no letters, no numerals, no logo, no watermark anywhere."
  ]
}
```

**KEEP describes the RECIPE, never the specific subject.** It is copied verbatim
for every slide; the subject is swapped per slide by REPLACE. So write the medium
("a hyper-saturated low-angle editorial portrait in bright daylight"), not the
person ("a woman with braids"). First line is literally
`"KEEP — the making of the image, copy exactly:"`; each bullet starts with `· `
and an ALL-CAPS label; end with the no-text line. 6–8 bullets. English.

## Adding a new ref

1. Drop the image into `refs/style/` (any name; keep the extension real).
2. Write its feature-map to `refs/analysis/<slug-or-cast-ref-NN>.json`. Look at
   the image first, then describe the medium per the schema above. Match the tone
   of existing files (`refs/analysis/cast-ref-01.json` … `95ae8841…json`).
3. If you use the `cast-ref-NN` naming, `compose --ref NN` finds it automatically.
   Otherwise pass the exact analysis filename where a ref is expected.
4. Preview it: `node tools/ref-slides.mjs NN NN` renders 2 sample slides.

Batch authoring (many refs) parallelizes well across subagents — give each a
range of refs, the schema above, and two example KEEP blocks.

## Per-slide art prompt (REPLACE)

On art-capable slides in `RUBRICS`, `art: { s, c, k }`:

- **s (subject)** — tied to the slide's message, a real scene/object. Bold and
  editorial beats generic ("a mouth caught mid-stumble" > "a person talking").
- **c (composition)** — leave the type zone open. Text sits low (lower-left) for
  most layouts, or around the centre for `splash`. Phrase it "the lower-left
  third stays open", **not** "kept dark".
- **k (colour)** — a hue, or for ref-faithful covers, "true to the reference's
  own bright, saturated palette".

`composePrompt(keep, ["SUBJECT: …", "COMPOSITION: …", "COLOUR: …"])` wraps these
with the REPLACE header and `ART_DIRECTIVE`. `tools/compose.mjs` also appends a
theme-appropriate readability cue ("the type zone kept uncluttered") — keep that
gentle; do not force the whole image dark or light.

## The house film-grain (fx)

`src/fx.mjs` exports `FX_FILTER` (an SVG `feTurbulence` grain) and `fxPage()`.
`compose.mjs` grains the **photo only** (before compositing the slide), so type
stays crisp. It's on by default; `--no-fx` disables it. Earlier experiments with
chromatic aberration / scanlines / vignette were dropped — grain only.

## Cost & cache

Every generation is cached on `sha256(model | prompt) + ref bytes` in
`assets/generated/pack-*.png`. Identical prompt + ref = instant, free. So iterate
on copy and layout freely; only genuinely new image prompts spend
(`gpt-image-2` ≈ $0.07). Deleting a ref orphans its feature-map and any deck that
used it — flag that rather than silently breaking.
