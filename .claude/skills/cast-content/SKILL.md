---
name: cast-content
description: >-
  Generate on-brand (cast) / Mubert Cast social content — carousel slides, post
  covers, whole decks, and profile-feed mockups for Instagram (1080×1350) and
  TikTok (1080×1920) — by composing a post from six axes: product × rubric ×
  density × ref × theme × format. Use this whenever working in the (cast)–Farm repo or when the
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
post  =  product ×  rubric  ×  density  ×  ref  ×  theme  ×  format
         (brand)     (copy)     (how        (image   (light /   (canvas +
                                 graphic)     style)   dark /     platform
                                                       color)     safe-areas)
```

| Axis | What it decides | Lives in |
|---|---|---|
| **product** | the brand: assets, palette, voice, copy | `src/product.ts` + `products/<id>/` |
| **rubric** | the SHAPE a post follows — beats and slot roles, no words | `references/templates.md` |
| **density** | which slides get a generated background | `data/density.json` |
| **ref** | the visual style of those backgrounds | `refs/style/*` + `refs/analysis/*.json` |
| **theme** | light / dark / color palette | the product's `colorTheme` |
| **format** | the canvas and the platform's safe-areas | `src/formats.ts` |

`--product` defaults to `cast` everywhere; today that is the only one registered.

Everything renders through headless Chrome (`src/chrome.ts`) from clean HTML/CSS
(`src/carousel.css`, `src/layouts.ts`) — no browser deps. Backgrounds are
image-to-image via WaveSpeed (`src/providers.ts`, key in `.env`).

## The structure — this is the spec, not a suggestion

Every deck is built to exactly this, in this order:

```
HOOK                 the user's biggest pain
STORY / EDUCATION    help for the user — or storytelling + objection handling
PAYOFF / SOLUTION    positioned within, or at the end
```

### THE HOOK IS THE WHOLE POST

Slide 1 decides whether the other eight are read. Nothing else in this file matters as
much. A weak hook on a beautiful deck is a deck nobody swipes.

**These five are examples, not a form to fill in.** They come from other verticals and
they work — but they are here to show you what a strong hook *does*. Write your own. What
is binding is the list of traits below them, not the shapes themselves.

| # | Template | Original |
|---|---|---|
| 1 | How long it actually takes to `<get the result>` | How long it actually takes to see results |
| 2 | `<N>` ways to `<get the result>` | 5 ways to copy/paste your dream body onto you |
| 3 | Here is how you can actually `<get the result>` | Here is how you can actually reach your dream body |
| 4 | `<N>` ways to `<get the result>` **without** `<the part they dread>` | 5 ways to reach your goal body without lifting weights |
| 5 | Here is how you know `<the thing they cannot judge alone>` | Here is how you know how much you should workout to reach your dream body |

**The traits — these are the rule.** A hook that has them is a good hook whatever shape
it takes; one that misses them fails however closely it copies a template:

- **Second person.** "your edit", "you can" — not "an episode", not "one hour of tape".
- **A concrete deliverable**, promised in the first six words.
- **Plain, blunt English.** "How long it actually takes" — not "Why one hour of tape eats
  a whole evening". If it sounds like a magazine subhead, it is the wrong register.
- **Names the thing they dread**, where there is one. This is the strongest single move
  available: say the outcome AND remove the part they have been avoiding.
- **No product.** Not a brand, not a feature, not a company.

**Three ways a hook goes wrong even after you have read the templates.** Every one of
these was written in this repo by someone who had just read them:

| trap | wrong | right |
|---|---|---|
| **Command, not promise** | "Edit your whole episode without a waveform" | "Here is how you can actually…" — the templates promise INFORMATION. An imperative orders the reader around and gives them no reason to swipe. |
| **Method, not outcome** | "…without a waveform" — a technique | The fitness examples name the END STATE: dream body, goal body, see results. Nobody wants "editing without a waveform"; they want their evening back. |
| **`without` on the wrong noun** | `<method> without <tool>` | `<outcome> without <the part they dread>`. The dread is the lost hours, not the waveform widget. |

**And the trap that produces all three: shortening for layout.** A hook that overflows its
slide has to get shorter — but shorten the WORDS, never the structure. The version above
started at 71 characters and six lines, got cut to 44, and lost the promise, the outcome
and the template in one edit. If the template will not fit, the answer is a shorter
outcome, not a different kind of sentence. As a rough gauge, `statement` at 144px fits
about 11 characters a line, so 45 characters is four lines and 55 is five — a hook slide
can carry five, since it is the only thing on it.

**Do not force a number.** "N ways to…" is one option among several, and reaching for it
by default is a mistake with a cost: the count then dictates the body, and a deck bent
into five buckets it did not have produces five artificial, overlapping ones. Use a
number when the content genuinely has that many countable things. Otherwise use a shape
that does not promise a count.

Instantiated for this product:

- "How long your podcast edit actually takes"
- "5 ways to cut an hour off your edit **without** touching a waveform"
- "Here is how you can actually finish an episode in one sitting"
- "5 ways to make your voice sound treated **without** learning EQ"
- "Here is how you know which parts of your edit to automate"

**A hook is a promise, and the deck must pay it.** Promise a number and the deck holds
exactly that many, named and countable. Promise a duration and a slide states it. Promise
a way to judge and a slide gives the test. Writing a hook the body does not deliver is
worse than a dull one: the reader swiped for something specific and did not get it. This
cuts both ways — it is also why you should not promise a count you have to invent.

### The hook is about the reader, never about us

The most common failure is picking a *product* angle and calling it a topic. Those are
answers to questions the reader has not asked yet. Start from what hurts; the feature
arrives later as relief rather than as a claim.

| Product angle (wrong hook) | The pain underneath (right hook) |
|---|---|
| "Music is generative, not stock" | "5 ways to score an episode without auditioning stock tracks" |
| "We're not a video editor" | "Here is how you can actually edit audio without opening a video timeline" |
| "Transcript-based editing" | "How long your podcast edit actually takes" |
| "Automatic censoring" | "5 ways to clean up an explicit episode without hunting the waveform" |

### How many slides

**5 to 10, chosen by the topic — not a default.** Ten is Instagram's cap on a carousel;
five is the floor at which a hook, two beats of substance, a payoff and a close still fit.

Pick the count from the material, and pick it *after* the slide plan below, not before.
A small idea told well in six slides beats the same idea padded to nine — and padding is
exactly what produces the slogan slides this section is about, because a deck stretched
past its content has empty rows that get filled with something that sounds good. If two
rows of the plan teach the same thing, that is one slide, not two.

### Pick a template first

**→ `references/templates.md`.** Five shapes — explainer, problem→fix, paired claims,
progression, chooser — each one an ordered list of beats and nothing else. Pick by the
reader's obstacle, not by what the product does: "I don't see how that could work" wants
the explainer, "which one do I pick" wants the chooser.

They live as prose in the skill rather than as code because the thing that chooses a
template is you, in this conversation. Nothing in `tools/` reads them: `compose` renders
whatever slides a post holds and never asks what shape it followed.

### The slide plan — decide what each slide TEACHES before you write a word of it

This is the step whose absence produced a nine-slide deck of aphorisms. Writing headlines
first is what generates them: a headline slot invites a good line, and a good line that
carries no information is a slogan.

So plan the deck as a list of **facts**, then write headlines over them. Literally write
the middle column first:

| slide | what the reader learns | how it is carried |
|---|---|---|
| 1 | the promise, from one of the five templates | hook |
| 2 | it is nine separate passes, and here they are | `index`, 9 rows, each with its cost |
| 3 | a waveform hides words; a transcript shows them | `comparison`, two columns |
| 4 | one concrete task, done both ways | `beforeAfter` |
| 5 | the actual sequence to follow | `steps`, 3 rows |
| 6 | which of the nine are automatic | `bento`, named features |
| 7 | their objection, answered | `callout` |
| 8 | where the product stops | `checklist`, from `boundaries` |
| 9 | close | `splash` |

If a row's middle column reads "that editing is hard" or "that we are fast", it is not a
fact and the slide has nothing to hold. Delete the row or find the fact underneath it.

**Two rules that catch most of it:**

1. **The hook is a promise — name the slide that pays it.** A hook asking "how long an
   episode actually takes" obliges a slide that says how long. The first version of the
   `edit-time` deck asked exactly that and never answered; the reader swiped for a number
   that was not there. If you cannot pay it honestly (no sourceable figure), change the
   hook to a promise you can keep: "why one hour of tape eats a whole evening" is paid by
   naming the nine passes.
2. **Give the mechanism, not the outcome.** "Editing is faster" is a claim the reader has
   heard from every tool. "A waveform is a picture of loudness, so finding a sentence
   means playing it back in real time — a transcript you search by reading" is a reason,
   and a reason is what makes the outcome believable and the product memorable.

**Worked example — the same beat, before and after.** Both are slide 3 of `edit-time`:

```
slogan   claim:      "The talking was the *work*. The rest is admin."
                     Sounds like a thesis. The reader learns nothing and cannot check it.

fact     comparison: In a waveform / The picture shows *loudness*, not words · So you
                     find a sentence by listening for it · Every search plays back in
                     *real time*
                     In a transcript / The words are *on screen* · So you find the
                     sentence by reading it · Every search runs at the speed *you read*
                     Now the reader knows WHY, and can verify it against their own week.
```

**The pre-render pass.** Cover every headline and ask, slide by slide: what does the
reader now know that they did not? "Nothing, but it sounded confident" means that slide is
a slogan — give it a number, a name, a step, a comparison, or cut it. One or two
rhetorical beats in nine slides is rhythm. Four is a mood board.

**Layouts are not neutral in this.** Some cannot hold a slogan and some invite one:

- **Carry information by construction** — `index` (row + its meta), `comparison` (two
  columns), `beforeAfter`, `steps`, `checklist`, `dontList`, `timeline`, `statRow`,
  `priceTiers`, `lineChart`. Reach for these first; the layout does the work of forcing
  you to have something to say.
- **Will happily hold a slogan** — `claim`, `callout`, `poster`, `statement`,
  `bigQuestion`, `quote`. Legitimate for the hook, the objection and the close. If more
  than three of a nine-slide deck are from this group, the deck is rhetoric.

> **There are no shipped posts to copy from.** Eleven existed and every one was deleted:
> they predated the hook rules and the slide plan, and leaving them around as things to
> imitate was worse than the gap. The references in this file are the model now.

### Objection handling is part of the body, not an afterthought

If the post tells a story rather than teaching, the body must answer the objection the
reader is already forming — "sounds like it would butcher my audio", "AI editing means
it sounds robotic", "I'd still have to check every cut". Name it and answer it on a
slide. An unanswered objection is where the swipe stops.

## Never write copy the user did not ask for

**Ask before you write. Every time.** Copy is the one thing in this repo that cannot
be derived — layouts, colour and format all follow from the system, but what the post
*says* is the user's call and yours to execute, not to invent. Picking a topic yourself
and presenting finished slides wastes the user's turn and reads as not listening.

### The order is topic → hook → plan → draft → render → caption → approval → schedule. Do not collapse it.

Eight steps, and they are **sequential**, because each is only judgeable once the one
before it is settled. Nobody can pick a hook for a topic they have not chosen, nobody can
write a caption for a picture they have not seen, and nothing gets uploaded before a human
has approved the words. The last step is the only one that leaves this machine — treat the
gate in front of it as the strictest one in the list.

| step | what is decided | who |
|---|---|---|
| **1. Topic** | what the post is about — the pain, in one line. **Topic only, no hooks yet.** | the user picks, from options you offer or one of their own |
| **2. Hook** | six candidates, handed over as a **filled table**: move · hook · chars · lines · trigger word and its class · what the deck must pay. A blank cell means the hook is not finished — see "the table IS the check" in `references/hooks.md` | the user picks |
| **3. Plan** | the template, and what each slide TEACHES — the middle column before any headline | you propose, the user corrects |
| **4. Draft** | the post JSON, shown before anything renders | you write, the user reads |
| **5. Render** | the pictures. Then **offer the studio** and look at the PNGs yourself | you run it, the user looks |
| **6. Caption** | the words beside the picture — see below. Written after the render, because it is written while looking at it | you write, the user reads |
| **7. Approval** | the user says it, in chat, in words. Only then does `status` become `approved` | **the user, and only the user** |
| **8. Schedule** | upload the slides to Postiz, queue both channels on a date, write `publish` and `status: scheduled` back into the post — see **Publishing — Postiz** | you run it, **only on an approved post and only when asked** |

`published` is not a step you perform: Postiz publishes on the date, and the status is
updated afterwards, together with each channel's `postId` so analytics can find it.

**The most common way to get this wrong is offering topics with hooks already attached.**
It looks efficient and it is not: it asks for two judgements at once, and it biases the
topic choice by how good its hook happened to sound. Offer topics as topics — a pain and
who feels it. The hook comes after.

The axes — theme, format, art — are settled at step 3 or 4, when there is something
concrete for them to apply to. Art must have its price stated before it is bought
(~$0.07 an image). Offer **"both formats at once"** whenever art is involved: it is ONE
generation serving two platforms, so it is cheaper than two runs *and* the only way both
posts carry the same picture. Never quote a doubled price for two formats — that number
is only true of the old, wrong behaviour.

The only case where you may proceed without asking is when the user's own message
already contains the topic and the angle. "Make a post" does not; "make a hot-takes
post about intros being too long" does.

### How to ask — this part is not optional either

**Use a structured question with real options. Never bury choices in prose.** A
paragraph at the end of a long message is not an offer; the user has to re-read it,
extract the options themselves and answer in free text. That is work you were supposed
to do, and it reads as if you had already moved on.

- **Give 3–4 concrete topics, not categories, and not hooks.** Each option is a pain and
  who feels it — "the edit outlasts the recording", not "5 ways to cut an hour off your
  edit". An option that reads like a feature name has already failed. Source the pain from
  `brief/product.json` (`audience`, `boundaries`) and `brief/campaigns.json` (`problem`,
  `angle`), then check that the feature which answers it actually exists in `features`.
- **Check them against what has already been published** (`out/posts/<product>/`) and say
  which ground is already covered. Offering a topic a shipped post already does wastes the
  choice. With zero posts, everything is open.
- **Be honest about each option's weakness.** "Most concrete, weakest emotionally" is
  more useful than four options that all sound equally good.
- **Ask everything still open in ONE question set** — topic, theme, format, art. Not
  one at a time, and never a second round for something you could have asked first.
- **Then show the deck JSON and stop.** Let the user read it before you render.

If the user asks for options, that is a request for the options *now*, in that turn —
not a promise to think about it while you do something else.

When the user does give a topic, still ground it: read
`products/<id>/brief/product.json` for `voice.avoid`, `features` and
`differentiators` before writing, and never invent a feature that is not listed there.

Show the JSON and let the user read it **before** you render. A render is cheap but a
wrong topic rendered is still wrong, and the JSON is where they can correct you in one
line instead of a paragraph.

## The caption — the post to everyone who does not swipe

The slides are the post to a reader who swipes. The caption is the post to everyone else,
and it is the only text the platform can index or read aloud. A post without one renders
fine and cannot be published — `checkCaption()` in `src/post.ts` says so, and the studio
shows it.

It lives on the post, not per format: `caption: { body, hashtags[], title? }`.

- **`body`** — up to **2200 characters** on both Instagram and TikTok, counted *with* the
  tags. Aim far below it. The first line is the only one shown before "more", so it has to
  survive alone — treat it as a second hook, not a summary of the first one.
- **`hashtags`** — stored **without** the `#`; `captionText()` adds it. A space inside a
  tag is an error, not a typo: it publishes as two tags.
- **`title`** — TikTok only, **≤90 characters**. Instagram ignores it.

**Rules, and they are the hook rules again:**
- **Do not repeat slide 1.** The reader has already read it. The caption's job is what the
  slides could not hold — the caveat, the specific number, the personal line, the question
  that earns a comment.
- **Same voice as the deck.** Not a press release, and not a corporate summary of one.
- **Never claim what `brief/product.json` `voice.avoid` forbids** — the caption is where
  that slips in most easily, because prose feels less checked than a headline.
- **End on one thing to do or answer.** A caption that just stops gets no comments.
- **Tags: 3–8, specific.** `#podcastediting` earns a reader; `#content` earns nothing.

## Post status — what it means and who may set it

`status` in the post JSON is a **claim about the world**, and the states are ordered:

| status | means |
|---|---|
| `draft` | being written — slides or copy may be missing |
| `review` | finished and rendered, waiting on a human. **Not approved.** |
| `approved` | a human approved it in chat. Words final, nothing uploaded |
| `scheduled` | uploaded to Postiz and queued for a date — see `publish` in the post |
| `published` | out |

**You may never set `approved` or anything past it on your own initiative.** Approval is a
human act: the user says it, in chat, in words. "Looks good to me" from you is not
approval, and neither is a clean scorecard. When a post is finished, say so and **ask**.

`checkStatus()` enforces what the later states imply — `approved` requires a valid
caption, `scheduled` requires publish targets and a date, `published` requires each
target's Postiz post id (without it the post is unmeasurable). None of these block a
render; they block publishing.

## Publishing — Postiz

The account is connected and reachable two ways: the **`postiz` skill** (CLI) and the
**`mcp__postiz__*` tools**. Prefer the MCP tools — they are already authenticated in
session and return structured output. The CLI works too, but it is installed under Node 20
where it crashes (`ERR_REQUIRE_ESM`); run it under the repo's Node 24 if you need it.

**Our three channels** (`Mubert Cast` — the others in the account belong to other products
and must never receive a (cast) post):

| channel | platform | integration id |
|---|---|---|
| Mubert Cast | `instagram-standalone` | `cmt5rodtb02twqk0y63oo6v7q` |
| Mubert Cast | `tiktok-business` | `cmt5qruv60bw9qp0yp79tl25f` |
| Mubert Cast | `youtube` | `cmt5ru5h902v1qk0yblvtpals` |

`--format ig` renders go to Instagram, `--format tiktok` renders go to TikTok. YouTube
takes video and we do not make any — leave it alone.

**The order:**
1. Confirm the post is `approved`. If it is not, stop and ask — do not upload on a guess.
2. Upload every slide PNG **to Postiz first**. Raw paths and external URLs are rejected by
   both platforms; TikTok pulls media by URL and only from a verified domain.
3. Schedule with `mcp__postiz__integrationSchedulePostTool`, one call per channel, slides
   in order as attachments, `captionText()` as the content.
4. Write the result back into the post: `status: 'scheduled'`, and a `publish` block with
   `scheduledFor` and one target per channel carrying its Postiz `postId`.

**Three ways this fails silently — check every time:**
- **TikTok `content_posting_method` must be `DIRECT_POST`.** `UPLOAD` does *not* publish;
  it drops the media into the app's inbox while the API reports success, and it makes
  TikTok discard every other setting.
- **TikTok `autoAddMusic: "yes"` attaches a RANDOM library track** on photo posts and
  overrides any chosen one. Use `"no"` unless the user asked otherwise — this is a music
  company's account.
- **Read `mcp__postiz__integrationSchema` before scheduling.** A setting that does not
  apply is discarded silently, not rejected, and the post still reports success.

**Never publish without being asked.** Scheduling is outward-facing and hard to undo —
posts cannot even be deleted through these tools, only in the Postiz app. Default to
`type: "draft"` at Postiz unless the user asked for a date.

## The one command you'll use most

```bash
node tools/compose.ts --rubric hot-takes --density half --ref 3 --theme dark
```

- `--product` — which brand (default `cast`)
- `--post` — a post id from `out/posts/<product>/`. **There are none yet** — every
  earlier post was deleted because it predated the hook and slide-plan rules. The first
  one is written from scratch, by the rules in this file.
- `--rubric` — legacy spelling of `--post`; they name the same thing
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

## Contrast is checked for you — do not eyeball it

Colour on colour is the one thing in this system that has failed silently and repeatedly,
because "looks fine" is not a measurement. Three separate defects shipped this way: an em
accent at **1.02:1** against its ground (luminances so close the letters shimmer), a
callout's answer line at .55 opacity on a flooded brand ground, and the `steps` numbers
dimmed to .4 on top of an accent that was already marginal — invisible over art.

So it is measured, automatically, on **every** command. `productFromArgv()` runs
`assertBrand()`, which runs the contrast audit, so `compose`, `studio`, `feed` and the rest
all print it. You do not need to remember a command.

| finding | severity | why |
|---|---|---|
| a better ink class exists for this ground | **error** | always fixable, so never acceptable |
| the pair is under 2.0:1 | **error** | the colours vibrate; it is painful, not just dim |
| the best available is still under 3.0:1 | warn | a fact about the palette, not a mistake — the fix is a design call |

(cast) currently carries four warnings: no accent token in its palette clears WCAG's
large-text floor against `carrot`, `pink`, `green` or `lightpink`. Fixing that means adding
an accent or dropping those grounds from the `--theme color` rotation. Do not "fix" it by
changing `colorTheme.em` — that map is already at its measured optimum and the test in
`test/unit/product.test.ts` enforces exactly that.

**The rule when writing CSS:** an element that carries an accent class must never also be
dimmed. Opacity multiplies with a contrast that is already modest, and that product is
what makes text disappear. Hierarchy on an accent-coloured element comes from size, face
or weight — none of which cost contrast. `test/unit/invariants.test.ts` cross-references
`layouts.ts` against `carousel.css` and fails on any new instance.

## The studio — review, fix and sign off

```bash
npm run studio          # http://localhost:4321
```

The dashboard for the judgement calls: look at a rendered post, mark slides `ok` or
`redo`, fix the copy, see validation problems next to the slide they belong to, and tag
the post `draft` / `review` / `approved`. (`scheduled` and `published` are shown but not
offered — those are facts about Postiz, and a click cannot make a post be queued.)

**Tell the user it exists, and offer to start it — every time a post finishes rendering.**
This is the one step the terminal genuinely cannot do: whether a slide is readable, and
whether it says anything, is a judgement made by looking. Do not describe the render and
move on. Say the post is rendered, offer `npm run studio`, and say what to look for.
Then **look at the PNGs yourself too** — the two catch different things: you catch
overflow and unreadable type, the user catches copy that is merely fine.

Start it only when the user says yes. It is a server on port 4321, and an unrequested
one is still an unrequested run.

**When to reach for it:** any time you are changing what a post says. Posts are JSON and
the studio writes them; nothing here edits TypeScript.

**Posts** live in `out/posts/<product>/<id>.json` and hold the words themselves. They are
generated — written here, in conversation — and exempted from `.gitignore` so the words
survive a cleanup of `out/`.
Render one with:

```bash
node tools/compose.ts --post <id>                 # its saved axes are the defaults
node tools/compose.ts --post <id> --format tiktok # a flag still wins
node tools/compose.ts --post <id> --no-generate   # refuse to buy art; exit 2 with the price
```

`--no-generate` is what the studio's re-render button uses, so nothing it does can spend.
Copy edits never miss the art cache anyway — the key comes from the art prompt, not the
slide text — so re-rendering after a rewrite is always free and takes seconds.

Editing a post changes that post and nothing else — which is the whole point of the split.

## The other tools

| Command | Makes |
|---|---|
| `npm run studio` | the review dashboard — mark slides, fix copy, validate, sign off |
| `node tools/score.ts --post <id>` | scorecard: four measured dimensions, two judged questions |
| `node tools/feed.ts [--format tiktok]` | a 3×4 profile-grid mockup of 12 covers — edit the `POSTS` array in the file to change what's in the grid |
| `node tools/matrix.ts` | a 10-row matrix, one rubric per row, each in a different design × ref (a system overview) |
| `node tools/ref-slides.ts 1 10` | 2 sample slides per ref (a hero + a splash) for judging refs |
| `node tools/fx.ts` | test the house film-grain on 5 slides |
| `RUN_ID=x CARD=statement node tools/layout-catalogue.ts [--format tiktok]` | one layout card in isolation (~2s) — best for design tweaks |
| `RUN_ID=$(date +%s) node tools/layout-catalogue.ts` | the whole layout catalogue on one sheet |

**Cache**: generated images are content-addressed on `model | prompt + ref bytes`
(`assets/generated/`). Re-running with the same prompt/ref is free — so **copy
edits and re-renders cost nothing**, only new image prompts spend (`gpt-image-2`
≈ $0.07 each). Always mention the ~cost before a large generation and prefer
letting the cache absorb re-runs.

## How the image backgrounds work (read before touching prompts)

Every generated background is one prompt = **KEEP + REPLACE + ART_DIRECTIVE**,
assembled by `composePrompt()` in `src/plan.ts`:

- **KEEP** — the ref's feature-map (`refs/analysis/ref-NN.json`): the
  reusable *recipe* of the medium (photography/render technique, ground, light,
  palette, signature treatment). Copied verbatim for every slide of that ref.
- **REPLACE** — per-slide `art: { s: subject, c: composition, k: colour }` from
  the rubric skeleton. Only the subject/composition/colour change per slide.
- **ART_DIRECTIVE** — a global rule (`ART_DIRECTIVE` in `plan.ts`).

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
  `plan.ts`). Density picks art slides only from these.

## Formats (the fifth axis)

`src/formats.ts` is the registry; `--format` on any tool selects one.

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
  `RUN_ID=x node tools/layout-catalogue.ts` and `cmp` against a known-good run.
- Never put a `var()` inside a value injected into `:root` unless the referenced
  variable also resolves at `:root`. It silently becomes invalid and inherits as
  empty. Compose such values in `carousel.css`, where the slide's own vars are in
  scope, and let the format supply plain numbers (that is why the scrim band is
  `--band-top`/`--band-bot`, not a whole gradient).
- **Cross-posting is one generation, not two.** `--format ig,tiktok` renders a run
  folder per format from a single set of art, generated at the tallest ratio asked
  for; the shorter frames crop it, since `.art-full` is `object-fit: cover`. Do NOT
  run compose twice for two platforms — that produces two different pictures from
  two different prompts and pays twice. The cache key uses the ratio the art was
  *generated* at, so a lone `--format ig` run is unchanged and still hits.
- Tall→wide crops the middle out and keeps it; wide→tall crops the sides and loses
  about a third of the width. That asymmetry is why the tallest wins, and why the
  9:16 framing line asks for the subject in the **middle band** rather than the
  upper two thirds — the upper third is precisely what a 4:5 crop discards.
- Adding a format = one entry in `FORMATS` (canvas, safe-area, grid tile ratio, an
  optional `framing` line for art prompts, a `vars` bag). No tool changes.

## Editing the content (rubrics)

Copy belongs to a POST: `out/posts/<product>/<id>.json`, one file per published
thing, holding its slides, the axes it renders with and the review state. Copy uses
`*asterisks*` to mark the accent word (`mark()` in `layouts.ts`).

A **rubric** is the shape a post follows — the beat sequence and what each slot is for —
and it holds no words, so it can be picked for a post by relevance. Do not put a topic in
a rubric; that is the mistake the split exists to prevent.

`src/plan.ts` is the ENGINE, not the copy — `ART_CAPABLE`, `composePrompt()`,
`refAnalysisFile()`, `ART_DIRECTIVE` — and it is the same for every brand.

Two things a slide names must resolve **against that product**: `accent` is an ink
CLASS (`accent-lime`) while `ground` and item accents are bare TOKENS (`superlime`).
They are disjoint domains and mixing them is the most common way to break a slide —
`src/validate.ts` catches it at the CLI edge, before anything is generated. Run
`npm test` after a copy edit; it validates every product's copy against its own
tokens, ink map and icon set.

**Ask for the topic first** — see "Never write copy the user did not ask for" above.
Then ground the copy in the real product and **respect the brand voice**: never claim
"ad-safe / brand-safe / copyright-proof / zero copyright claims / unlocks
advertising" — see `products/cast/brief/product.json` (`voice.avoid`, `plans`,
`features`, `differentiators`) and `products/cast/brief/campaigns.json`. These are
briefs for you, not inputs to any code. Prices in `product.json` may drift;
say "verify the live pricing page" rather than asserting them.

## Deeper references (load when the task needs them)

Six files. The first three are the writing loop and you will use them on every post;
the last three are looked up when the task touches them.

| | |
|---|---|
| **`references/hooks.md`** | The hook: five templates, the traits that bind, ten moves, the traps, the character budget, and the library of hooks already used here. **Read it before writing slide 1, every time.** |
| **`references/trigger_words.md`** | The vocabulary layer: four word classes and which move each belongs to. A visceral verb on a concrete number beats any structural change. |
| **`references/templates.md`** | The shape of the post: five templates — explainer, problem→fix, paired claims, progression, chooser — picked by the reader's obstacle. Read it before planning the slides. |
| **`references/scoring.md`** | The scorecard before publishing: four measured dimensions and two judged questions. `node tools/score.ts --post <id>`. |
| **`references/refs-and-prompts.md`** | Adding or previewing a style ref, and writing a feature-map (the KEEP block). |
| **`references/design-system.md`** | Tokens, the layouts, colour contrast, and the template gotchas that will bite you — the `class="stack"` heading trap, `cvar` vs `fillOf`, theme handling. |

## Conventions

- Every run is its own `out/runs/<id>/` — immutable, side-by-side comparable.
- Keep the four axes orthogonal. When the user asks for a variation, change the
  smallest axis (theme/ref) and reuse the cache.
- After generating, **look at the render** (Read the PNG) before declaring it
  done — catch overflow, unreadable text, or off-brand imagery yourself.
