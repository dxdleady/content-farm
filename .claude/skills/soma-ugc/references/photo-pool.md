# The photo pool

## Where the pictures come from

| source | what it is |
|---|---|
| `~/Desktop/My UGC avatar/*.jpeg` | the raw pool — 52 frames of **one consistent character** plus her food/flat-lay shots and two ready-made SOMA ad slides. UUID filenames. |
| `products/soma/avatar/*.jpg` | the staged pool — the frames already picked, renamed by what they show. This is what decks reference. |
| `products/soma/ugc/assets/gen/*.png` | generated frames kept for reuse, named by what they actually depict. |
| `products/soma/ugc/assets/screens/*.png` | app screenshots, copied from `soma-landing/public/assets/kinetic/site/` (589×1280). |
| `products/soma/ugc/assets/` | CTA furniture — `screen-home.png`, `appstore-badge.png`, `app-icon.png`, plus `soma-ad-1/2.jpg` (finished App-Store ad slides from the founders, usable as alternative closers). |
| `products/soma/refs/style/soma-*.jpg` | 27 brand lifestyle photos — **style references for generation only**, never used as slide backgrounds. |

## Staged pool by type

Pick across types when building a deck — that is what "balance" means.

**Avatar, gym / movement** — `gym-dumbbells` (clean, no watermark; the workhorse hook),
`gym-bench-rest`, `gym.jpg`, `gym-shake`, `gym-towel-drink`, `pilates-reformer`,
`redlight-gym`, `jump-rope`, `hike-vest`, `walk`, `walk-outfit`, `walk-headphones`,
`walk-sunglasses`.

**Avatar, at home / mirror** — `mirror-selfie`, `black-set-mirror`, `white-set-mirror`,
`mirror-white-2/3/4/5`, `golden-mirror`, `pajama-morning`, `cream-outfit-bedroom`,
`couch-tee`, `grey-hoodie`, `hoodie-jacket`, `kitchen-dress`, `smoothie-selfie`,
`blue-top-drink`, `green-set-selfie`, `brown-set`, `pink-set`, `navy-bag`, `graphic-tee`,
`white-top-selfie`, `black-bra-selfie`, `black-top-portrait`, `hands-hair`, `glow-skin`,
`rest-glow`, `rest`, `rest-skin`.

**Food, no person** — `egg-toast-plate`, `eggs-toast`, `food`, `yogurt-berries`,
`banana-bread`, `granola-bark`, `pastries`, `brunch-toast`, `tomato-toast`, `dates-snack`,
`bagel-desk`, `cookies-tray`.

**Flat-lay / texture / detail** — `watch-matcha-flatlay` (watch + laptop + bottle on a mat;
the "track something" frame), `mug-knee`, `legs-coffee`, `shirt-texture`.

**Generated (`assets/gen/`)** — `eggs-plate` (eggs + toast + raspberries, top-down),
`gym-corner-shake` (dark gym floor, shake on a bench), `park-aerial` (tree-lined path from
above), `desk-tea` (desk through a round mirror), `bedroom-mirror` (leaning mirror, robe on
a hook), `bed-phone-dawn` (person on white bed with phone — reads as a real selfie),
`cafe-water` (bottle + lemon water on a café table).

## Rejected, and why — do not re-add

| frame | problem |
|---|---|
| `290DDBB1…` | third-party watermark "@hustl._" across the top |
| gen `bg-9d65891d…` | ghost double-exposure — two bodies fused over dumbbells |
| gen `bg-23ebd8c0…` | a huge human head-and-shoulders shadow on a wall the prompt said had no people |
| gen `bg-8eb0d3f3…` | a translucent person melted into the floorboards |
| gen `bg-c29676ca…` | a blank white board floating on a bed; reads as a rendering error |
| gen `bg-545a81ed…` | so dark the subject is unreadable at any dim |

They are still in `assets/generated/` (the cache is content-addressed and never pruned) —
that is exactly why staged copies live in `assets/gen/` under real names. **Only stage what
you have looked at.**

## Adding a photo

```bash
cp "$HOME/Desktop/My UGC avatar/<UUID>.jpeg" products/soma/avatar/<what-it-shows>.jpg
```

Then look at it (Read the file) before referencing it: check for watermarks, check the top
and bottom edges, and check it is not already in the pool under another name — several
frames of the same outfit exist and two of them in one deck read as a mistake.

## Duplicate discipline

A photo may serve several decks, but never twice inside one, and avoid reusing the same
frame in two posts scheduled for the same day. The check that caught this last time was
simply listing every deck's photo paths and looking for repeats:

```bash
cd products/soma/ugc && node -e 'const fs=require("fs");const seen={};
for (const f of fs.readdirSync(".").filter(x=>x.startsWith("deck-")))
  for (const s of JSON.parse(fs.readFileSync(f)).slides)
    if (s.photo) (seen[s.photo] ??= []).push(f);
for (const [p,fs_] of Object.entries(seen)) if (fs_.length>1) console.log(p, fs_.join(" "))'
```
