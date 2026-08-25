# QA — look at every slide before it ships

## The contact sheet

Eleven slides is eleven Reads; one sheet is one. The script below renders a deck's PNGs
into a 3-column labelled grid using the repo's own Chrome client. Keep it in a scratch dir
(it is a review tool, not part of the renderer).

```js
// deck-sheets.ts — node deck-sheets.ts soma-5secrets soma-10ways …
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Chrome } from '/Users/mary_shabash/content-farm-source/src/chrome.ts';

const UGC = '/Users/mary_shabash/content-farm-source/out/ugc';
const OUT = process.env.SHEETS ?? '.';
const cell = 360, cols = 3;
const chrome = await Chrome.launch();
try {
  for (const d of process.argv.slice(2)) {
    const dir = join(UGC, d);
    const files = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
    const rows = Math.ceil(files.length / cols);
    const W = cols * cell, H = rows * (Math.round(cell * 16 / 9) + 22);
    const html = `<!doctype html><style>
body{margin:0;background:#111;font:12px monospace;color:#ddd}
.g{display:grid;grid-template-columns:repeat(${cols},${cell}px)}
.c img{width:${cell}px;height:${Math.round(cell * 16 / 9)}px;object-fit:contain;display:block;background:#000}
.c span{display:block;text-align:center;padding:3px 0}
</style><div class="g">${files.map(f =>
  `<div class="c"><img src="file://${resolve(dir, f)}"><span>${f}</span></div>`).join('')}</div>`;
    const hp = join(OUT, `${d}.html`);
    writeFileSync(hp, html);
    writeFileSync(join(OUT, `${d}.png`), await chrome.shootPooled(`file://${hp}`, W, H));
  }
} finally { await chrome.close(); }
```

Chrome sometimes hangs on `close()` after a long batch — the sheets are already written by
then, so a stuck process is safe to kill.

## Pre-ship checklist

Run down this list per deck, looking at the sheet:

1. **Watermarks** — any handle, logo or app UI belonging to someone else. Check edges.
2. **Duplicates** — the same frame twice in this deck, or in the deck posting beside it.
3. **Generated frames** — ghosts, phantom shadows, floating objects, unreadable dark.
4. **Readability** — white type on every frame, especially bright food shots and app
   screenshots. If it strains, raise `dim` before changing anything else.
5. **The hook pays** — a deck promising "5 secrets" holds five numbered beats.
6. **Every beat teaches** — no slide whose middle is a slogan.
7. **The closer points at the app** — CTA slide present, screenshot and badge visible.
8. **Caption** — exists, first line is not slide 1, exactly three matching hashtags.

## Defects this format has actually shipped

Each of these got past a "looks fine" and was caught only by looking at the pixels:

| defect | how it happened | the guard now |
|---|---|---|
| eggs plate under "Train at the same time" | generated files were named in the order prompts were written, not by what came back | name a gen file after looking at it; stage into `assets/gen/` |
| the same legs-and-coffee frame as a hook in one deck and a beat in another | pool picked per deck, never cross-checked | the duplicate scan in `photo-pool.md` |
| white text vanishing into a bright app screenshot | `dim` tuned on photos, never tested on a screenshot | `dim: 0.62` on screen slides + the permanent `text-shadow` on `.t` |
| a watermarked photo used as a hook | the frame looked great and the top edge was never checked | read the frame before staging |
| an 11-slide deck rendered with slide 8 stale | a batch render was interrupted mid-deck and the folder kept a mix of old and new PNGs | after any interrupted run, re-render the whole deck, not the missing slide |

## Verifying a batch

```bash
# every referenced file exists
cd products/soma/ugc && node -e 'const fs=require("fs"),p=require("path");
for (const f of fs.readdirSync(".").filter(x=>x.startsWith("deck-")))
  for (const [i,s] of JSON.parse(fs.readFileSync(f)).slides.entries())
    for (const k of ["photo","screenshot","badge","appIcon"])
      if (s[k] && !fs.existsSync(p.resolve(".",s[k]))) console.log(f,i+1,k,s[k])'

# a deck's shape at a glance: slides, source of each frame, hook
node -e 'const fs=require("fs");for(const f of fs.readdirSync(".").filter(x=>x.startsWith("deck-")).sort()){
  const d=JSON.parse(fs.readFileSync(f));
  const kinds=d.slides.map(s=>s.photo?(s.photo.includes("assets/gen")?"G":s.photo.includes("screens")?"S":"P"):s.bg?"g":"?").join("");
  console.log(d.deck.padEnd(22),String(d.slides.length).padStart(2),kinds.padEnd(12),(d.slides[0].text||"").split("\n")[0].slice(0,40));}'
```

`P` = pool photo · `G` = staged generated · `g` = generates on this render (spends) ·
`S` = app screen. A row with more than two of `G`/`g` breaks the generation budget.
