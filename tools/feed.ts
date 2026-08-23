#!/usr/bin/env node
// Mock a profile grid — 3 columns × 4 rows of post COVERS (first slide), each a
// different rubric / design / ref, so we can see how the feed reads.
//   node tools/feed.ts [--format ig|tiktok]
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../src/providers.ts';
import { pool } from '../src/pool.ts';
import { Chrome } from '../src/chrome.ts';
import { rendererFor } from '../src/layouts.ts';
import { rubricsFor, refAnalysisFile, composePrompt } from '../src/plan.ts';
import type { RefAnalysis, RenderSlide } from '../src/types.ts';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.ts';
import { slidePage } from '../src/page.ts';
import { assetsFor } from '../src/assets.ts';
import { cachePath } from '../src/cache.ts';
import { productFromArgv, productTag } from '../src/product.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const FMT = formatFromArgv();
const P = productFromArgv();
const { renderSlide } = rendererFor(P);
const RUBRICS = rubricsFor(P);
const fonts = assetsFor(P).FONTS;
const W = FMT.w, H = FMT.h, HANDLE = P.handle, model = 'gpt-image-2';
// The third copy of this map, and the last. It was identical to compose.ts's, which was
// identical to the one now on the product — three tables that had to agree by hand about
// which accent pops against which ground, with nothing checking that they did.
const GA = P.colorTheme.em;

// 12 covers, ALL dark theme. Grid fills row-major (3 cols); balanced so every row
// has 2 image covers + 1 flat dark type cover, images scattered across the grid.
// (A = generated art photo · F = flat dark type-only)
// Entries start as {r, ref?, art?} and are enriched in place with the built slide, the
// ref analysis and the rendered cover — so the shape has to be declared up front.
type Post = {
  r: string; ref?: number; art?: boolean;
  s?: RenderSlide; analysis?: RefAnalysis; refFile?: string; refBytes?: Buffer; cover?: string;
};
const POSTS: Post[] = [
  { r: 'hot-takes',              ref: 3,  art: true },  //  0  A
  { r: 'myth-vs-fact'                              },  //  1  F  (big question)
  { r: 'feature-drop',           ref: 12, art: true },  //  2  A
  { r: 'inspiration',            ref: 4,  art: true },  //  3  A
  { r: 'unnecessary-censorship', ref: 27, art: true },  //  4  A
  { r: 'plan-picker'                              },  //  5  F  (big question)
  { r: 'before-after'                             },  //  6  F  (statement, no art)
  { r: 'how-to',                 ref: 19, art: true },  //  7  A
  { r: 'mistakes',               ref: 5,  art: true },  //  8  A
  { r: 'one-workflow',           ref: 2,  art: true },  //  9  A
  { r: 'inspiration'                              },  // 10  F  (statement, no art)
  { r: 'before-after',           ref: 23, art: true },  // 11  A
];

const CACHE = join(ROOT, 'assets/generated'); mkdirSync(CACHE, { recursive: true });
const OUT = join(ROOT, `out/runs/feed${productTag(P)}${formatTag(FMT)}`); mkdirSync(join(OUT, 'covers'), { recursive: true });

// build each cover slide (slide 0 of its rubric) with theme applied
for (const p of POSTS) {
  const sl = RUBRICS[p.r]!.slides[0]!;
  const { art, theme: _t, ...copy } = sl;
  const s = { ...copy, minimal: true, handle: HANDLE, index: 1, total: 1 };   // dark theme = default (near-black, light type)
  if (p.art && art) {
    s.replace = [`SUBJECT: ${art.s}.`, `COMPOSITION: ${art.c}.`, `COLOUR: true to the reference's own bright, saturated, poppy palette.`,
      ...(FMT.framing ? [`${FMT.framing}.`] : [])];
    p.analysis = JSON.parse(readFileSync(join(ROOT, 'refs/analysis', refAnalysisFile(p.ref!)), 'utf8'));
    p.refFile = join(ROOT, 'refs/style', p.analysis!.ref);
    p.refBytes = readFileSync(p.refFile);
  }
  p.s = s;
}

// generate the art covers (cached)
let spent = 0;
const artPosts = POSTS.filter(p => p.s!.replace);
console.log(`generating ${artPosts.length} art covers…`);
await pool(artPosts, 4, async (p) => {
  const prompt = composePrompt(p.analysis!.keep, p.s!.replace!);
  const cache = cachePath({ model, prompt, ratio: FMT.ratio, refBytes: p.refBytes! });
  const bg = join(OUT, 'covers', `${p.r}-${p.ref}.bg.png`);
  if (existsSync(cache)) { copyFileSync(cache, bg); p.s!.bgFile = bg; delete p.s!.replace; return; }
  for (let a = 1; a <= 2; a++) {
    try { const buf = await MODELS[model as keyof typeof MODELS].call({ prompt, refs: [p.refFile!], ratio: FMT.ratio }); writeFileSync(cache, buf); writeFileSync(bg, buf); p.s!.bgFile = bg; delete p.s!.replace; spent += MODELS[model as keyof typeof MODELS].price; console.log(`  ✓ ${p.r} r${p.ref}`); return; }
    catch (e) { if (a === 2) console.log(`  ✗ ${p.r} r${p.ref}: ${(e as Error).message.slice(0, 80)}`); else await new Promise(r => setTimeout(r, 4000)); }
  }
});

// render covers

const wordmark = readFileSync(P.wordmark, 'utf8');
const page = (inner: string) => slidePage(inner, FMT, P);
const enc = (p: string) => 'file://' + encodeURI(p).replace(/#/g, '%23');

const chrome = await Chrome.launch();
try {
  // A target per shot: holding one across the loop intermittently wedges
  // Page.captureScreenshot — see Chrome.shootFresh.
  for (const p of POSTS) {
    p.cover = join(OUT, 'covers', `${POSTS.indexOf(p)}.png`);
    writeFileSync(join(OUT, '_c.html'), page(renderSlide(p.s!)));
    writeFileSync(p.cover, await chrome.shootPooled(`file://${join(OUT, '_c.html')}`, W, H));
  }

  // profile grid — the platform crops covers to its own tile ratio, so the mockup does too
  const TILE = 420, tH = Math.round(TILE / FMT.grid.tile), GAPX = 4, PAD = 26;
  const cols = FMT.grid.cols, gridW = cols * TILE + (cols - 1) * GAPX;
  const pageW = gridW + PAD * 2;
  const rows = Math.ceil(POSTS.length / cols);
  const headerH = FMT.id === 'tiktok' ? 290 : 150;
  const pageH = PAD + headerH + rows * tH + (rows - 1) * GAPX + PAD;
  const tiles = POSTS.map(p => `<img src="${enc(p.cover!)}" style="width:${TILE}px;height:${tH}px;object-fit:cover;display:block">`).join('');
  const avatar = `<div class="av" style="width:104px;height:104px;border-radius:50%;background:#e8ff59;display:flex;align-items:center;justify-content:center;flex:0 0 auto;overflow:hidden;color:#111">${wordmark}</div>`;
  const bio = 'Audio-first podcast editing — record to publish-ready. mubert.com/tools/cast';
  // TikTok stacks the profile centred above the grid; Instagram runs it along the left
  const header = FMT.id === 'tiktok'
    ? `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;height:${headerH}px;text-align:center">
        ${avatar}
        <div style="font:700 26px Inter;color:#fff">@cast.tools</div>
        <div style="display:flex;gap:34px;color:#ddd;font:400 18px Inter">
          <span><b style="color:#fff">12</b> Following</span><span><b style="color:#fff">31.4k</b> Followers</span><span><b style="color:#fff">402.1k</b> Likes</span></div>
        <div style="color:#9a9a9a;font:400 17px Inter;max-width:660px">${bio}</div>
      </div>`
    : `<div style="display:flex;align-items:center;gap:26px;height:${headerH}px;padding:0 6px">
        ${avatar}
        <div>
          <div style="font:700 30px Inter;color:#fff">cast.tools</div>
          <div style="display:flex;gap:26px;margin-top:10px;color:#ddd;font:400 19px Inter">
            <span><b style="color:#fff">248</b> posts</span><span><b style="color:#fff">31.4k</b> followers</span><span><b style="color:#fff">12</b> following</span></div>
          <div style="margin-top:10px;color:#9a9a9a;font:400 18px Inter">${bio}</div>
        </div></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
    .grid{display:grid;grid-template-columns:repeat(${cols},${TILE}px);gap:${GAPX}px}
    .av svg{width:62px;height:auto;display:block}</style></head>
    <body style="margin:0;background:#000;padding:${PAD}px;width:${pageW}px;font-family:Inter">
    ${header}<div style="height:8px"></div><div class="grid">${tiles}</div></body></html>`;
  writeFileSync(join(OUT, 'feed.html'), html);
  const sp = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'feed.png'), await chrome.shoot(sp, `file://${join(OUT, 'feed.html')}`, pageW, pageH));
} finally { chrome.kill(); }
console.log(`\nfeed -> ${OUT}/feed.png  (${FMT.grid.label})   ~$${spent.toFixed(2)}`);
