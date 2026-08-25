# Hooks, copy and captions

## Where hooks come from

`~/Downloads/Trend and Content Research.xlsx` — the founders' research book. Two sheets
matter:

- **`Content Plan `** (note the trailing space) — the posting schedule. Columns:
  Platform · DAY · Content Format · Content Piece · Hook · CTA · STATE. Rows 4–20 are the
  TikTok slideshows, grouped into days 1–4. `STATE = Prepared` means the hook is signed
  off; `Idea` means it is still loose.
- **`Hashtags and Keywords + Hooks`** — column A is the hashtag list, column C from row 37
  is ~25 spoken hooks written for video (many are AI-scan/body-photo angles the app does
  not do yet — read them for *tone*, not as a backlog).

Reading them without Excel (no `xlsx` dep in this repo):

```bash
cd <scratch> && unzip -o -q "$HOME/Downloads/Trend and Content Research.xlsx"
node -e '…'   # sharedStrings.xml + xl/worksheets/sheetN.xml; see git history of this skill
```

The mapping of sheet → file is in `xl/_rels/workbook.xml.rels` (`rId13` = Content Plan,
`rId12` = Hashtags + Hooks).

## The 20 shipped posts

Days 1–3 are stealth (SOMA only in the closer); day 4 is product-forward.

| deck | hook | source |
|---|---|---|
| `soma-ghosting-ugc` | I've been ghosting you. | plan row 17 |
| `soma-5hacks` | 5 hacks that actually changed my body | plan row 12 |
| `soma-5secrets` | 5 secrets to actually reach your body goal | plan row 5 |
| `soma-4facts` | 4 facts about your body when you reach your goal | plan row 4 |
| `soma-4hacks` | 4 essential hacks to reach your goal body | plan row 6 |
| `soma-5workout-hacks` | 5 workout hacks I wish I knew earlier | plan row 7 |
| `soma-5workout-facts` | 5 workout facts every beginner should know | plan row 8 |
| `soma-5things` | 5 things to know about reaching your goal body | plan row 9 |
| `soma-5bizarre` | 5 bizarre life hacks my colleague taught me | plan row 10 |
| `soma-6reasons` | 6 reasons why you're stuck with your body | plan row 11 |
| `soma-10ways` | 10 ways to reach your dream body | plan row 13 |
| `soma-4reasons` | 4 reasons why you won't reach your goal body | plan row 14 |
| `soma-5hacks-help` | 5 hacks to help you reach your goal body | plan row 15 |
| `soma-bodygoals` | Ever looked at body goals on social media and felt behind? | plan row 16 |
| `soma-kindachic` | Kinda chic to be the healthy friend | plan row 18 |
| `soma-3things-love` | 3 things I love doing with SOMA | plan row 19 |
| `soma-3features` | My 3 favorite features in SOMA | plan row 20 |
| `soma-plans-fail` | Nobody tells you why most fitness plans fail | hooks sheet r51 |
| `soma-12seconds` | It took SOMA 12 seconds to build my plan | hooks sheet r63 |
| `soma-what-workout` | Struggling to pick a workout for your goal body? | hooks sheet r68 |

`soma-5hacks-gen` is **not** a post — it is the all-generated A/B variant of `soma-5hacks`,
kept for comparison. Do not schedule it.

## Copy rules

- **Second person or first person, never third.** "your body", "I stopped" — not "one
  should".
- **A hook promises; the deck pays.** "5 secrets" holds exactly five, numbered and
  countable. "4 facts" states four facts. Do not promise a count you then pad.
- **One concrete thing per slide** — a number, a threshold, a mechanism, a named action.
  If the middle of a slide could be printed on a gym poster, it is a slogan; cut it or
  find the fact underneath.
- **Numbered beats read `N — Claim`** with an em dash, then a blank line, then the payoff
  in one or two short lines.
- **No trailing periods** on fragments. Full sentences in a multi-sentence beat keep them.
- **No product until the closer.** The stealth decks may not name SOMA before the CTA
  slide — that is the whole format. The three product decks name it in the hook on
  purpose.
- **Nothing the app cannot do.** The research sheet is full of body-scan-from-a-photo
  hooks; SOMA reads wearables, sleep, meals and training. Write from what it does.

## Captions

One `caption.txt` per `out/ugc/<deck>/`, written after the render.

```
number 4 is the one everyone skips 🙃

#fitness #wellness #bestversionofyou
```

- First line = a **second hook**. It is the only line shown before "more", so it must
  survive alone and must not repeat slide 1.
- **Exactly three hashtags**, matched to the post's actual subject.
- Stealth decks: never `#soma` / `#fitnessapp`. Product decks (`3things-love`,
  `3features`, `12seconds`): those two plus one topical.
- One emoji maximum. No calls to "link in bio" — the CTA slide does that job.

The 20 shipped captions live in the post folders; read a few before writing a new one so
the voice stays one person's.
