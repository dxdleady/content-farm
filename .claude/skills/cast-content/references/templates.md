# Templates — the blanks a post is written into

A template is **shape and nothing else**: an ordered list of beats, each saying what that
slide is for. No words, no topic. Pick one for a post by relevance, then write into it.

Every template has the same outer structure, because that is the content spec:

```
HOOK  →  STORY / EDUCATION (+ objection)  →  PAYOFF / CLOSE
```

What differs between them is only **how the education is carried**. That is the one axis
worth having templates for.

> These five were derived, not invented. Every post that existed in this repo was
> classified by what each of its slides *does* — hook, figure, assert, list, sequence,
> contrast — and these are the middles that actually recurred. If a new post does not fit
> any of them, that is worth noticing: either the post has no structure yet, or there is a
> sixth template and it should be added here.

**Slide count is 5–10**, chosen by the topic. Optional beats are marked `?` — drop them
when the post has nothing for them rather than padding. Padding is how slogan slides get
written.

---

## explainer

**When:** the reader does not believe the outcome is possible. Show WHY it works before
showing how — the mechanism is what makes the claim credible.

| # | beat | layouts | what goes here |
|---|---|---|---|
| 1 | hook | `statement` `bigQuestion` | The promise. See `hooks.md`. |
| 2 | contrast | `comparison` `beforeAfter` | **The mechanism**, as two columns. Why the alternative is faster, in terms the reader can check against their own week. This is the slide the template exists for. |
| 3 | list | `index` `tags` | What that mechanism changes, named item by item. |
| 4 | sequence | `steps` | The actual moves, in order. Three is usually right. |
| 5? | contrast | `beforeAfter` | One concrete task, done both ways. |
| 6? | list | `bento` `iconRow` | What the product does automatically, as named features. |
| 7? | assert | `callout` | The objection, in their words, then answered. |
| 8? | aside | `checklist` `dontList` | What it does NOT do, from `brief/product.json` boundaries. |
| 9 | close | `splash` | The payoff line and the handle. Must pay the hook. |

---

## problem → fix

**When:** the reader knows something is wrong but not what. Name the cost, itemise it,
hand them the sequence that removes it. The most common shape.

| # | beat | layouts | what goes here |
|---|---|---|---|
| 1 | hook | `statement` `bigQuestion` | The promise. |
| 2? | figure | `stat` `statRow` | One number that makes the cost concrete. **Only with a sourceable figure** — never invent an industry average. |
| 3 | assert | `claim` | The reframe: what they think the problem is, versus what it is. |
| 4 | list | `tags` `index` `dontList` | The problem itemised. This slide carries most of the information. |
| 5 | sequence | `steps` `processVertical` | The fix, in order. |
| 6? | list | `bento` `checklist` | What runs automatically once they switch. |
| 7? | assert | `callout` | The objection, answered. |
| 8? | aside | `checklist` | The limits. |
| 9 | close | `splash` | |

---

## paired claims

**When:** a belief the reader holds is wrong. Each beat is a claim and its counter,
repeated — myth/fact, assumption/reality, what-they-say/what-happens.

| # | beat | layouts | what goes here |
|---|---|---|---|
| 1 | hook | `statement` `bigQuestion` | |
| 2 | claim | `statement` | Claim 1, stated the way they believe it. |
| 3 | counter | `claim` | The correction — **with the reason**, not just the contradiction. |
| 4 | claim | `statement` | Claim 2. |
| 5 | counter | `claim` | Its counter. |
| 6? | claim | `statement` | Claim 3. |
| 7? | counter | `claim` | Its counter. |
| 8? | list | `checklist` `iconRow` | What to do instead, collected. |
| 9 | close | `splash` | |

⚠ This is the template most likely to produce slogans: an unbroken run of `statement` and
`claim` is exactly the shape a mood board takes. Every counter must carry a *reason*. If
three pairs in a row teach nothing checkable, use `problem-fix` instead.

---

## progression

**When:** the value is visible as a change of state. Repeat the same before/after beat
across several dimensions so the pattern does the arguing.

| # | beat | layouts | what goes here |
|---|---|---|---|
| 1 | hook | `statement` `bigQuestion` | |
| 2? | list | `checklist` | What the pass covers, so the pairs have a frame. |
| 3 | contrast | `beforeAfter` | Pair 1. |
| 4 | contrast | `beforeAfter` | Pair 2. |
| 5? | contrast | `beforeAfter` | Pair 3. |
| 6 | assert | `claim` | What the pattern adds up to. |
| 7? | figure | `stat` | The result as one number, if there is an honest one. |
| 8? | assert | `callout` | The objection. |
| 9 | close | `splash` | |

---

## chooser

**When:** the reader has to pick between options — plans, modes, approaches — and does not
know how to judge. **Give them the criterion, not just the menu.**

| # | beat | layouts | what goes here |
|---|---|---|---|
| 1 | hook | `statement` `bigQuestion` | |
| 2 | offer | `priceTiers` | The options, side by side. |
| 3 | list | `checklist` `index` | What each one is actually for. |
| 4 | contrast | `comparison` | The two that get confused, separated. |
| 5? | define | `definition` | The one term they need in order to choose. |
| 6 | assert | `claim` | **The criterion**: how to know which is theirs. Without this it is a price list. |
| 7? | aside | `footnote` | The caveat. Prices drift — say "verify the live pricing page". |
| 8 | close | `splash` | |

---

## Choosing between them

Ask what the reader's obstacle is, not what the product does:

| the obstacle | template |
|---|---|
| "I don't see how that could work" | **explainer** — lead with the mechanism |
| "I know it's bad, I don't know what to change" | **problem → fix** |
| "I already know how this works" (and they are wrong) | **paired claims** |
| "Show me it's actually better" | **progression** |
| "Which one do I pick?" | **chooser** |

If two fit, prefer the one whose middle you can fill with facts rather than assertions —
see the slide plan section in `SKILL.md`.

## Adding a template

Only when a real post does not fit any of these, and the shape it wants would plausibly
serve a second post. A template with one user is a rename, not an abstraction. Record it
here with the same three things: when to reach for it, the beats in order, and which beats
are optional.
