# Scoring a post before it goes out

```bash
node tools/score.ts --post <id>     # one post
node tools/score.ts --all           # every post
```

Adapted from a LinkedIn post-scorer skill. Its best rule is the one worth stealing:

> **Every score must cite a specific fact, never an opinion.**

What was NOT taken is that skill's entire basis. It scores a draft against the account's
own top-performing posts — top 10% by engagement, hook types, word counts. This account has
no history, and inventing benchmarks would be worse than admitting there are none. When
there IS a year of posts to learn from, that comparison becomes the sixth dimension and it
will be better than all five below. Until then, it does not exist.

So the scorecard measures what this repo can actually know about itself.

## Four measured, two judged

`tools/score.ts` decides the four it can count. It refuses to put a number on the two it
cannot, and prints them as questions instead — a machine that scores "does this promise an
outcome" is guessing, and a guessed number is worse than an open question because it looks
settled.

| dimension | measured how |
|---|---|
| **hook** | character count and estimated line count; second person; imperative opening; hook layout |
| **information** | slides on slogan-friendly layouts vs layouts that carry information by construction; slide count against 5–10 |
| **readability** | unresolved accent/ground/icon names; contrast errors and palette warnings; headlines over 65 characters |
| **brand truth** | `voice.avoid` claims present in the copy; every figure flagged for sourcing |

| judged | the question |
|---|---|
| **outcome, not method** | Does the hook promise a RESULT the reader wants, or a technique? |
| **promise paid** | Which slide delivers what the hook promised? Name it. |

## Read the score honestly

The measured half cannot see the most important thing. `edit-time` scored **37/40** while
carrying a hook its author had already been told was weak — because the hook was the right
length, in the second person, on the right layout, and every one of those is checkable.
What is wrong with it is that it promises a method rather than an outcome, and that is the
first judged question.

**A high measured score means nothing is obviously broken. It does not mean the post is
good.** Answer the two judged questions before publishing, every time.

## What a low score in each dimension means

- **hook** — go to `hooks.md`, write six candidates across different moves, count the
  characters on each, and pick. Do not refine the one you have.
- **information** — go to the slide plan in `SKILL.md`. Write the "what does the reader
  learn" column first, then headlines over it. A slogan slide has no fact underneath.
- **readability** — the name problems are hard errors and block a render anyway. The
  contrast warnings are a ceiling of the palette, not your mistake; the overflow ones are.
- **brand truth** — read `brief/product.json`. A `voice.avoid` hit is never a wording
  problem; the claim itself is one the brand does not make.
