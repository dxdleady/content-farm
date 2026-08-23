// One full black-minimal set per content rubric (no graphics), all laid out on ONE page.
// Content is grounded in the product's brief/product.json + brief/campaigns.json;
// copy avoids the voice.avoid claims listed there.
//   RUN_ID=rubric-sets node tools/rubric-sets.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';
import { rendererFor } from '../src/layouts.ts';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.ts';
import type { RenderSlide } from '../src/types.ts';
import { slidePage } from '../src/page.ts';
import { assetsFor } from '../src/assets.ts';
import { productFromArgv, productTag } from '../src/product.ts';
import { rubricsFor } from '../src/plan.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FMT = formatFromArgv();
const P = productFromArgv();
const { renderSlide } = rendererFor(P);
const RUBRICS = rubricsFor(P);
const fonts = assetsFor(P).FONTS;
const W = FMT.w, H = FMT.h;

const page = (inner: string) => slidePage(inner, FMT, P);

const HANDLE = P.handle;

// ---- the ten rubric sets (black minimalism, no bg art), 8+ slides each ----
//
// These 95 slides used to be a second copy, pasted here. Diffed against RUBRICS before
// deletion: nine of the ten rubrics were byte-identical, and the tenth — before-after —
// differed only in that this copy carried three kickers the canonical one does not:
// slides 3/4/5 (the three beforeAfter rows) were labelled "Voice", "Length" and "Sound".
// They are dropped here rather than folded into RUBRICS, because adding them is a copy
// change and this phase is a move; if you want them, add them to src/plan.ts and
// re-baseline the three rubric goldens.
//
// This file has no golden coverage of its own, which is exactly why the duplicate was
// dangerous: it could drift from the real rubrics with nothing to catch it.
const DECKS = Object.entries(RUBRICS).map(([id, r]) => ({ id, ...r }));

const BUCKET_COLOR = { bright: '#E8FF59', product: '#7B8CFF', guide: '#6EE7A8' };

const OUT = join(ROOT, `out/runs/${process.env.RUN_ID || 'rubric-sets'}${productTag(P)}${formatTag(FMT)}`);
mkdirSync(join(OUT, 'cards'), { recursive: true });

const chrome = await Chrome.launch();
try {
  // A target per shot: holding one across the loop intermittently wedges
  // Page.captureScreenshot — see Chrome.shootFresh.
  const blocks: Array<{ deck: (typeof DECKS)[number]; thumbs: string[] }> = [];
  for (const deck of DECKS) {
    const total = deck.slides.length;
    const thumbs: string[] = [];
    for (let i = 0; i < deck.slides.length; i++) {
      const s = { minimal: true, handle: HANDLE, ...deck.slides[i], index: i + 1, total } as RenderSlide;
      // Whole deck runs light — cream ground reads far better at a glance than black-on-black.
      s.theme = 'light';
      // superlime vanishes on cream; promote it to a readable accent.
      if (s.accent === 'accent-lime') s.accent = 'accent-purple';
      const id = `${deck.id}-${String(i + 1).padStart(2, '0')}-${s.layout}`;
      const hp = join(OUT, 'cards', `${id}.html`);
      writeFileSync(hp, page(renderSlide(s)));
      const pngPath = join(OUT, 'cards', `${id}.png`);
      writeFileSync(pngPath, await chrome.shootPooled(`file://${hp}`, W, H));
      thumbs.push(pngPath);
    }
    blocks.push({ deck, thumbs });
    process.stdout.write(`  ✓ ${deck.name} (${total})\n`);
  }

  // ---- compose everything onto ONE page ----
  const THUMB = 196, GAP = 10, PAD = 44, HEADER = 78, BLOCKGAP = 30;
  const thumbH = Math.round(THUMB * H / W);
  const maxN = Math.max(...blocks.map(b => b.thumbs.length));
  const pageW = PAD * 2 + maxN * THUMB + (maxN - 1) * GAP;
  const TITLE = 96; // h1 + subtitle block above the rows
  const pageH = PAD * 2 + TITLE
    + blocks.length * (HEADER + thumbH) + (blocks.length - 1) * BLOCKGAP + 40;

  const block = ({ deck, thumbs }: { deck: (typeof DECKS)[number]; thumbs: string[] }) => `
    <div class="blk">
      <div class="hd">
        <span class="n">${String(DECKS.indexOf(deck) + 1).padStart(2, '0')}</span>
        <span class="nm">${deck.name}</span>
        <span class="bk" style="--b:${BUCKET_COLOR[deck.bucket as keyof typeof BUCKET_COLOR]}">${deck.bucket}</span>
        <span class="ct">${thumbs.length} slides</span>
        <span class="pr">${deck.promise}</span>
      </div>
      <div class="row">${thumbs.map((t: string) => `<img src="file://${t}">`).join('')}</div>
    </div>`;

  const sheetHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#cfccc6;color:#1a1a1a;font-family:Inter,-apple-system,sans-serif;padding:${PAD}px;width:${pageW}px}
      h1{font:700 40px/1 Inter;letter-spacing:-1.5px;margin-bottom:6px}
      .sub{font:400 20px/1.4 Inter;color:#6a675f;margin-bottom:30px}
      .blk{margin-bottom:${BLOCKGAP}px}
      .hd{display:flex;align-items:baseline;gap:14px;height:${HEADER}px;padding-bottom:14px}
      .n{font:700 30px/1 Inter;color:#a7a49d;letter-spacing:-1px}
      .nm{font:700 30px/1 Inter;letter-spacing:-1px}
      .bk{font:700 14px/1 Inter;letter-spacing:2px;text-transform:uppercase;color:#1a1a1a;background:var(--b);padding:7px 12px;border-radius:20px}
      .ct{font:600 15px/1 Inter;color:#8a877f;letter-spacing:.5px}
      .pr{font:400 19px/1.35 Inter;color:#575651;margin-left:6px;max-width:${pageW - 520}px}
      .row{display:flex;gap:${GAP}px}
      .row img{width:${THUMB}px;height:${thumbH}px;display:block;border-radius:8px;background:#EEEBEA;border:1px solid rgba(0,0,0,.08)}
    </style></head><body>
      <h1>(cast) — content rubrics · light theme</h1>
      <div class="sub">One full set per rubric · ${DECKS.reduce((t, d) => t + d.slides.length, 0)} slides · grounded in product.json / campaigns.json</div>
      ${blocks.map(block).join('')}
    </body></html>`;
  const shp = join(OUT, 'rubric-sets.html');
  writeFileSync(shp, sheetHtml);
  const sp = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'rubric-sets.png'), await chrome.shoot(sp, `file://${shp}`, pageW, pageH));
  console.log(`\nONE PAGE -> ${OUT}/rubric-sets.png  (${pageW}x${pageH})  ${DECKS.reduce((t, d) => t + d.slides.length, 0)} slides`);
} finally { chrome.kill(); }
