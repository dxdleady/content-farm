# SOMA UGC slideshows — start here

TikTok slide-shows, 1080×1920: text over a real phone photo, no logo on the hook, the app
only in the closing slide. 20 posts are authored and ready in this folder.

**If you are working with Claude Code, you do not need this file** — say what you want and
the `soma-ugc` skill (in `.claude/skills/`) carries the rules. This is the human path.

## Setup, once

```bash
git clone <this repo> && cd content-farm
node -v                      # must be 24+  (brew install node)
```

You need **Google Chrome** installed (the renderer drives it headless) and, only if you
want to generate backgrounds, a `.env` with `GEMINI_API_KEY=…`. Rendering from photos
needs no key and costs nothing.

## Render the existing 20 posts

```bash
node tools/ugc.ts products/soma/ugc/deck-5secrets.json
```

Each post lands in `out/ugc/<deck>/` — numbered slides plus `caption.txt`, ready to upload.
All of them:

```bash
for f in products/soma/ugc/deck-*.json; do node tools/ugc.ts "$f"; done
node tools/ugc-sheets.ts --all      # one review picture per post
```

## Render them as *yourself* — pools

A deck names its photos as `../avatar/gym-dumbbells.jpg`. Those names are **slots**, not
just files: *"her, mid-workout, clean frame"*. A **pool** is one person's answer to every
slot — so a second person renders the same 20 posts with her own character without editing
a single deck.

```bash
node tools/ugc-pool.ts --slots            # what the decks ask for, and where each is used
node tools/ugc-pool.ts --new sarah        # creates pools/sarah/ + pool.json (every slot, blank)
# drop your photos into products/soma/ugc/pools/sarah/
# fill pool.json: "gym-dumbbells.jpg": "my-gym-shot.jpg"   (one photo may answer several slots)
node tools/ugc-pool.ts --check sarah      # what is still open, and which decks already render
node tools/ugc.ts products/soma/ugc/deck-5secrets.json --pool sarah
```

Output goes to `out/ugc/sarah-<deck>/`, so both people's versions coexist. You do not have
to fill all 57 slots — `--check` tells you which posts are already renderable, and the
renderer refuses a deck with open slots instead of rendering a gap.

**Bringing an AI-generated character:** generate her frames wherever you like (the pool is
just JPEGs), then treat the slot list as the shot list. Keep one consistent face across the
whole pool — the format only works if the account reads as one person. Check every frame
for a watermark before you put it in.

## Write a new post

1. **Hook** — from `products/soma/brief/content-plan.json` (`slideshows` = the founders'
   plan, `hookBank` = the spoken hooks). Do not invent one when the plan has unused rows.
2. **Photos** — pool first. Generate a background only where no real frame fits, one or two
   per post at most, and never make a deck of stills.
3. **Copy** — one concrete thing per slide: a number, a threshold, a mechanism. Check it
   against `products/soma/brief/product.json` (`voice.avoid` — health claims are the risk
   surface).
4. **Caption** — in the deck, as `"caption"`. First line is a second hook, then exactly
   three hashtags from the approved list.
5. **Look at it** — `node tools/ugc-sheets.ts <deck>` and check every slide.

Copy an existing deck as the shape; `deck-5secrets.json` is the reference build.

## What lives where

| | |
|---|---|
| `deck-*.json` | the posts — slides, photos, captions. The source of truth. |
| `../avatar/` | the authored photo pool (the slots) |
| `pools/<id>/` | other people's pools: their photos + `pool.json` |
| `assets/gen/` | generated backgrounds worth reusing |
| `assets/screens/` | app screenshots for product-forward decks |
| `assets/` | CTA furniture — App Store badge, app icon, phone screenshot |
| `../brief/` | product facts and the content plan |
| `out/ugc/<deck>/` | renders. Disposable — everything is rebuilt from the deck. |
