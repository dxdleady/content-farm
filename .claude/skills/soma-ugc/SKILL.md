---
name: soma-ugc
description: >-
  Build SOMA TikTok slideshow posts — the stealth-UGC format: text over a real
  phone photo, no product chrome, closing on the app. Use whenever the user asks
  to make / render / fix a SOMA slideshow, deck, TikTok post, carousel or
  "slide show", to pick hooks from the content plan, to write captions and
  hashtags for SOMA, to add photos to the pool, or to generate a background for a
  slide that has no real photo. Trigger even if the user just says "догенерь
  посты", "собери слайдшоу", "сделай пост про сон" or names a hook from the
  research sheet without naming the system.
---

# SOMA UGC slideshows

The TikTok stealth format — **1080×1920**, text over a phone photo, **no logo, no
wordmark, no pagination**. It is a different animal from the editorial carousel
(`tools/compose.ts`, see `cast-content`): here the post must look like a real person's
camera roll, and SOMA appears only in the closing slide.

```
post  =  hook  ×  photos  ×  copy  ×  CTA
         (from the      (pool first,   (one fact    (always the app:
          content plan)  gen last)      per slide)   screenshot + App Store)
```

| Thing | Where |
|---|---|
| renderer | `tools/ugc.ts` — `node tools/ugc.ts products/soma/ugc/deck-<id>.json [--pool <id>]` |
| decks (the source of truth — slides AND caption) | `products/soma/ugc/deck-*.json` |
| photo pool, staged | `products/soma/avatar/*.jpg` (58 files, descriptive names) |
| photo pool, raw (Mary's machine only) | `~/Desktop/My UGC avatar/*.jpeg` (52 files, UUID names) |
| other people's pools | `products/soma/ugc/pools/<id>/` + `pool.json` |
| generated backgrounds, staged | `products/soma/ugc/assets/gen/*.png` |
| app screenshots | `products/soma/ugc/assets/screens/screen-*.png` — what to shoot next and how: `screens/SHOTLIST.md` + the ready-to-run `screens/MarketingScreenshotUITests.swift` |
| CTA assets | `products/soma/ugc/assets/` — `screen-home.png`, `appstore-badge.png`, `app-icon.png` |
| output, one folder per post | `out/ugc/<deck>/` — `01-photo.png … NN-cta.png` + `caption.txt` |
| hooks, hook bank, hashtags | `products/soma/brief/content-plan.json` (extracted from the founders' xlsx) |
| product facts, and what may not be claimed | `products/soma/brief/product.json` — read `voice.avoid` before writing |
| the human onboarding path | `products/soma/ugc/README.md` |

Two review/scaffolding tools sit beside the renderer: `tools/ugc-sheets.ts` (a contact
sheet per post — `--all` for every render) and `tools/ugc-pool.ts` (`--slots` / `--new`
/ `--check`, for standing up someone else's photo pool).

Node must be **≥24**: prefix every command with `PATH="/opt/homebrew/bin:$PATH"`
(`/usr/local/bin/node` is v23 and first on PATH).

## The format — this is the brand's own spec, not a suggestion

From the founders' corrected example ("You're not buying a new body.", slides 6+):

- **photo slide** — full-bleed photo, dimmed, white **DM Sans** centred in the safe box,
  navy `#2a1f6d` chevron bottom-right. **No SOMA logo on hook slides** — that is what makes
  it native.
- **cta slide** — white-washed photo, navy heading, left-set body, the real app screenshot
  in a CSS phone frame, App Store badge + app icon.
- **safe box** x 108–894, y 305–1617 on 1080×1920 — measured from the brand's SAFE SPACE
  template, right side wider for TikTok's action rail. The renderer enforces it.

Faces: **The Seasons** = display/wordmark, **DM Sans** = all slide text (self-hosted,
`products/soma/fonts/dm/`). Newsreader/Manrope belong to the editorial carousel only.

## The deck JSON

```jsonc
{
  "deck": "soma-5secrets",              // = the out/ugc folder name
  "slides": [
    { "kind": "photo",
      "photo": "../avatar/gym-dumbbells.jpg",   // a real file — ALWAYS prefer this
      "text": "5 secrets to actually\nreach your body goal",
      "dim": 0.42 },                     // 0.42 hook · 0.3–0.4 busy/light photo · 0.62 app screen
    { "kind": "photo",
      "bg": "a tall glass of still water on a marble counter, bright daylight, no people",
      "refs": ["../refs/style/soma-18.jpg", "../refs/style/soma-09.jpg"],  // style steer
      "text": "5 — Water before\nevery meal", "dim": 0.4 },
    { "kind": "cta",
      "photo": "../avatar/blue-top-drink.jpg",
      "heading": "5 — Personalize everything",
      "body": "SOMA reads your watch, your sleep, your meals — and turns them into a plan built for your body",
      "screenshot": "assets/screen-home.png",
      "badge": "assets/appstore-badge.png",
      "appIcon": "assets/app-icon.png",
      "wash": 0.66 }
  ]
}
```

- `\n` is a hard break, a blank line starts a new paragraph. Keep lines short — the type is
  64px and breaks are yours to control, so break them by meaning.
- `screen: "assets/screens/screen-home.png"` puts an app screenshot in a **phone frame
  standing in the scene**, with the copy above it. Prefer this to a full-bleed screenshot
  every time: dense UI is the worst ground white type ever has to survive, and a phone on
  a table reads as hers rather than as an ad. Use `dim` ~0.5 on those slides.
- `align: "low"` pushes text to the bottom of the safe box; use it on a full-bleed
  app-screen slide so the copy does not sit on the UI's own headline.
- `chevron: false` removes the swipe arrow (only for a last photo slide before a CTA).
- **No trailing periods** in slide text, except full sentences in a multi-sentence beat.

## Photos: the pool first, generation last

**The pool is the product.** Real camera-roll photos are why the format reads as UGC; a
deck of generated stills reads as an ad. The rule the user set:

> **1–2 generated frames per post, maximum. Everything else from the pool. Reuse across
> decks is fine as long as no photo repeats inside one deck — or in a deck posting the
> same week.**

**Balance every deck.** Not all-avatar and not all-still-life: a hook with the avatar, then
alternate her with food / flat-lay / interior frames. A post that is five selfies is a
thirst trap; five still lifes is a magazine. Both lose the swipe.

**Check every new pool photo for third-party watermarks before using it.** `290DDBB1`
carries "@hustl._" across the top and is unusable. Look at the frame — top and bottom
edges — do not assume.

Staging a photo: copy from the raw pool into `products/soma/avatar/` under a **descriptive**
name (`gym-dumbbells.jpg`, `pajama-morning.jpg`), never the UUID. See
`references/photo-pool.md` for the current inventory by type.

### Those names are slots, and another person can answer them

`../avatar/gym-dumbbells.jpg` in a deck means *"her, mid-workout, clean frame"* — a **slot**.
A **pool** (`products/soma/ugc/pools/<id>/pool.json`) maps every slot to one person's own
file, so a second founder renders the same 20 posts as her own character without touching a
deck:

```bash
node tools/ugc-pool.ts --slots           # the shot list: every slot and where it is used
node tools/ugc-pool.ts --new sarah       # pools/sarah/ + a pool.json with every slot blank
node tools/ugc-pool.ts --check sarah     # what is open, and which decks already render
node tools/ugc.ts products/soma/ugc/deck-5secrets.json --pool sarah   # -> out/ugc/sarah-soma-5secrets/
```

The renderer refuses a deck with unfilled slots and lists them, rather than rendering a
hole. Only `../avatar/` paths are redirected — generated frames, app screens and CTA
furniture are shared by everyone. When someone brings an AI-generated character, the slot
list **is** the shot list, and the same watermark and one-consistent-face rules apply.

## Generation: when, and how not to waste it

Generate only when the beat has no honest frame in the pool — a scene the avatar was never
photographed in (a made bed at night, a café table, a gym floor at dawn). Then:

- `bg` + `refs` (two style refs from `products/soma/refs/style/`) → Gemini, ~9:16.
  Cached content-addressed in `assets/generated/` on prompt + ref bytes, so **re-rendering
  is free** and only new prompts spend.
- Once a generated frame is good, **copy it into `assets/gen/` under a descriptive name**
  and reference it as `photo` from then on. This is what makes reuse across decks cheap and
  auditable — and it is where the naming went wrong once: the file called
  `gym-corner-shake.png` actually held the eggs plate, because names were assigned by the
  order prompts were written, not by what came back. Name from the picture, after looking
  at it.
- **Look at every generated frame before it ships.** Gemini's failure modes here are
  specific and repeat: ghost double-exposure of a person, a huge human shadow on a wall
  where the prompt said "no people", a blank white board floating on a bed, a scene so dark
  the subject is gone. Four of the first ten were rejected for exactly these.
- Ask for the scene, not the mood: "a made bed with white linen, a warm bedside lamp, a
  book and a sleep mask, seen from the doorway" survives; "calm restful bedroom energy"
  produces a dark blur.
- `no people` in the prompt genuinely means no people — but it does not stop shadows and
  reflections. If a human silhouette appears, regenerate with the wording changed, do not
  ship it.

## The routine series — the second register

Wave 1 was twenty listicles. Wave 2 is eight posts about a day with SOMA, and it works
because it is a **series with one spine, not one "day in my life"** — that format is the
most saturated on TikTok, and a single generic day post loses. The same day, cut a
different way each time, makes the account read as a person.

One spine, six anchors: **06:40** waking · **07:20** breakfast · **09:00** training ·
**13:20** walk · **19:30** dinner · **22:30** bed. Times go in the copy as plain text
(`13:20 — Walk after lunch`), the way `1 — Protein first` already works.

`deck-routine-{day,morning,night,badnight,busy,week,noface,sunday}` — the whole day by
timestamp; the first hour; the evening shutdown; five hours' sleep and what the plan does
about it; the day everything moved; seven days in seven slides; a day told entirely in
objects; the Sunday reset.

**App screens are the bottleneck, not the copy.** The app has a full UI-test fixture
system — ten named scenarios, sleep source, nutrition state, subscription tier, any
onboarding question by name — so almost any state can be shot on demand
(`screens/SHOTLIST.md`). Two things it does NOT give you for free: the status-bar clock
(`xcrun simctl status_bar booted override --time 06:45` — a slide saying 6:45 must not
carry a 19:15 clock) and any dedicated evening or sleep screen. Ask for the shot before
writing a slide around a screen we do not have.

**The beat grammar is time → what I did → why.** Every beat owes the viewer something they
can copy without the app (protein first, walk after lunch, same bedtime) **and** something
only SOMA did (it moved the session, it cut the target, it told me to stop). That double
payload is what keeps the format stealth and still persuasive. `routine-badnight` is the
strongest of the eight because it shows the mechanism instead of promising an outcome.

## Copy: every slide owes the reader one concrete thing

The hook promises; the body pays. A listicle slide that says "consistency is key" teaches
nothing — it is the slogan trap. Give a number, a threshold, a mechanism, or a named
action:

| slogan (cut it) | fact (ship it) |
|---|---|
| "Consistency is key" | "1 — Consistency beats intensity / Boring workouts, repeated, are the ones that win" |
| "Sleep matters" | "4 — Sleep is training / Recovery is where the change happens" |
| "Track your progress" | "3 — Track something / What gets measured gets managed" |

**The hook is the whole post** and it comes from the content plan, not from your
imagination — the founders wrote 14 of them and the research sheet holds ~25 more. Read
`references/hooks-and-copy.md` before writing slide 1.

**The closing slide always points at the app.** Every deck, no exception: the CTA slide
with the screenshot and the App Store badge, or a product screen slide followed by one.
Stealth means SOMA is absent from the hook — not from the post.

## Captions and hashtags

The caption lives in the deck as `"caption"`, beside the slides it belongs to — it is
authored text, and `out/` is disposable. The renderer writes it out as `caption.txt` next
to the PNGs, and warns when a deck has none. Write it after the render, while looking at
it:

```
number 4 is the one everyone skips 🙃

#fitness #wellness #bestversionofyou
```

- **First line is a second hook**, not a summary of slide 1 — it is the only line TikTok
  shows before "more".
- **Exactly 3 hashtags, and they must match the post.** From the founders' list in the
  research sheet (`#fitness #gym #workout #routine #healthylifestyle #wellness
  #wellnesstips #bestversionofyou #comeback #inshape #energyboost #womenshealth #healthy
  #fitnessapp #soma`). Stealth decks never carry `#soma` or `#fitnessapp`; the three
  product-forward decks do.
- Voice: first person, lowercase-ish, one emoji at most. Never a press release.

## The loop

**topic/hook → photo plan → deck JSON → render → look at every slide → caption → the user
approves.** Sequential, and the last step is a human act — never mark a post ready
yourself.

```bash
# render one deck (free if the photos are files or cached)
PATH="/opt/homebrew/bin:$PATH" node tools/ugc.ts products/soma/ugc/deck-<id>.json

# every referenced file exists? run before a batch render
node -e 'const fs=require("fs"),p=require("path");for(const f of fs.readdirSync(".").filter(x=>x.startsWith("deck-")&&x.endsWith(".json")))for(const[i,s]of JSON.parse(fs.readFileSync(f)).slides.entries())for(const k of["photo","screenshot","badge","appIcon"])if(s[k]&&!fs.existsSync(p.resolve(".",s[k])))console.log(f,i+1,k,s[k])'
```

**Then look at the PNGs — yourself, every slide.** This is the step that caught every real
defect in this format: the broken generations, the duplicate photo across two decks, the
mismatched gen names, the white text drowning on a light app screen. A contact sheet per
deck (3 columns) makes it one glance instead of eleven — see `references/qa.md`.

## Readability — the one thing that fails silently

White DM Sans on a photo is fine until the photo is bright or busy. Three defenses, in
order:

1. **`dim`** — the veil over the photo. 0.42 on a hook, 0.3–0.4 on a calm frame, and
   **0.62 on a full-bleed app screenshot** (dense dark UI text is the worst case).
2. **`text-shadow`** on `.t` in `tools/ugc.ts` — a soft 28px black glow, always on. Do not
   remove it; it is what makes the type survive a light frame.
3. **`align: "low"`** — move the copy off the screenshot's own headline.

If all three are on and it still reads badly, the photo is wrong for that beat. Change the
photo, not the type.

## Deeper references

| | |
|---|---|
| **`references/hooks-and-copy.md`** | Where the hooks live, the 20 shipped posts and their hooks, the copy rules, and the caption library. Read before writing slide 1. |
| **`references/photo-pool.md`** | The pool inventory by type — avatar action, food, flat-lay, interiors — the watermark list, and what each generated frame actually shows. |
| **`references/qa.md`** | The contact-sheet script, the pre-ship checklist, and the defects this format has actually shipped. |
