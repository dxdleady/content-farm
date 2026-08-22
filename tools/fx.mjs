#!/usr/bin/env node
// House post-effect applied to the PHOTO ONLY (not the type): heavy chromatic
// aberration + coarse grain + scanlines + vignette, baked into the background
// before the slide is rendered, so the type sits clean on top.
// Test: 5 hero slides — orig ref | plain photo | treated photo.
//   node tools/fx.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../src/providers.mjs';
import { pool } from '../src/pool.mjs';
import { Chrome } from '../src/chrome.mjs';
import { renderSlide } from '../src/layouts.mjs';
import { refAnalysisFile, composePrompt } from '../src/plan.mjs';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const FMT = formatFromArgv();
const W = FMT.w, H = FMT.h, HANDLE = 'mubert.com/tools/cast', model = 'gpt-image-2';
const ratioTag = FMT.ratio === '4:5' ? '' : `|${FMT.ratio}`;
const REFS = [1, 3, 5, 7, 9];
const hero = {
  copy: { layout: 'statement', accent: 'accent-lime', title: 'Say it like you *mean* it' },
  art: { s: 'a single striking face caught mid-expression — a shout, a sharp glance, a laugh — cropped hard and close, full of attitude and rendered fully in the medium', c: 'the face sits high and to the right, cropped by the top and right edges; the lower-left third is decisive negative space in the medium, kept dark enough for type', k: "the reference's own palette, saturated and bold" },
};

// ---- the house effect, on the PHOTO only ----
export const FX_FILTER = `
<filter id="castfx" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0" result="ng"/>
  <feComponentTransfer in="ng" result="grain">
    <feFuncR type="linear" slope="0.5" intercept="0.25"/>
    <feFuncG type="linear" slope="0.5" intercept="0.25"/>
    <feFuncB type="linear" slope="0.5" intercept="0.25"/>
  </feComponentTransfer>
  <feBlend in="grain" in2="SourceGraphic" mode="overlay" result="out"/>
</filter>`;

// a page that treats ONE photo and screenshots the result at slide size
const fxPage = imgUrl => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
  .wrap{position:relative;width:${W}px;height:${H}px}
  .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:url(#castfx)}
</style></head><body><div class="wrap">
  <svg width="0" height="0" style="position:absolute"><defs>${FX_FILTER}</defs></svg>
  <img class="ph" src="${imgUrl}">
</div></body></html>`;
const enc = p => 'file://' + encodeURI(p).replace(/#/g, '%23');

const fonts = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8').replace(/url\((woff2\/[^)]+)\)/g, (_, r) => `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'assets/fonts', r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT, 'tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const sheet = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
const slidePage = inner => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style><style>${tokens}</style><style>${sheet}</style><style>${formatCss(FMT)}</style><style>html,body{margin:0;background:#000}</style></head><body>${inner}</body></html>`;

const CACHE = join(ROOT, 'assets/generated'); mkdirSync(CACHE, { recursive: true });
const OUT = join(ROOT, `out/runs/fx-test${formatTag(FMT)}`); mkdirSync(join(OUT, 'cards'), { recursive: true });

const jobs = REFS.map(n => {
  const a = JSON.parse(readFileSync(join(ROOT, 'refs/analysis', refAnalysisFile(n)), 'utf8'));
  return { n, a, refFile: join(ROOT, 'refs/style', a.ref), refBytes: readFileSync(join(ROOT, 'refs/style', a.ref)) };
});
let spent = 0;
console.log('generating 5 hero photos…');
await pool(jobs, 4, async (j) => {
  const prompt = composePrompt(j.a.keep, [`SUBJECT: ${hero.art.s}.`, `COMPOSITION: ${hero.art.c}.`, `COLOUR: ${hero.art.k}.`]);
  const cache = join(CACHE, `pack-${createHash('sha256').update(`${model}|${prompt}${ratioTag}`).update(j.refBytes).digest('hex').slice(0, 16)}.png`);
  const bg = join(OUT, 'cards', `ref${j.n}.bg.png`);
  if (existsSync(cache)) { copyFileSync(cache, bg); j.bg = bg; return; }
  for (let a = 1; a <= 2; a++) {
    try { const buf = await MODELS[model].call({ ratio: FMT.ratio, prompt, refs: [j.refFile] }); writeFileSync(cache, buf); writeFileSync(bg, buf); j.bg = bg; spent += MODELS[model].price; console.log(`  ✓ ref ${j.n}`); return; }
    catch (e) { if (a === 2) console.log(`  ✗ ref ${j.n}: ${e.message.slice(0, 80)}`); else await new Promise(r => setTimeout(r, 4000)); }
  }
});

const chrome = await Chrome.launch();
try {
  const p = await chrome.newPage(W, H);
  for (const j of jobs) {
    if (!j.bg) continue;
    // 1) treat the photo
    const fxbg = join(OUT, 'cards', `ref${j.n}.fxbg.png`);
    writeFileSync(join(OUT, 'cards', '_fx.html'), fxPage(enc(j.bg)));
    writeFileSync(fxbg, await chrome.shoot(p, `file://${join(OUT, 'cards', '_fx.html')}`, W, H));
    // 2) render the slide over plain and over treated photo — type stays clean
    const mk = (bgFile, out) => { writeFileSync(join(OUT, 'cards', '_s.html'), slidePage(renderSlide({ ...hero.copy, minimal: true, handle: HANDLE, index: 1, total: 2, bgFile }))); return chrome.shoot(p, `file://${join(OUT, 'cards', '_s.html')}`, W, H); };
    j.plain = join(OUT, 'cards', `ref${j.n}.plain.png`); writeFileSync(j.plain, await mk(j.bg));
    j.fx = join(OUT, 'cards', `ref${j.n}.fx.png`); writeFileSync(j.fx, await mk(fxbg));
  }
  await chrome.close(p);

  const TH = 300, thH = Math.round(TH * H / W), GAP = 14, PAD = 20;
  const rows = jobs.filter(j => j.fx);
  const pageW = PAD * 2 + 3 * TH + 2 * GAP + 210;
  const pageH = PAD * 2 + 40 + rows.length * (thH + 40 + GAP);
  const row = j => `<div style="display:grid;grid-template-columns:${TH}px ${TH}px ${TH}px 190px;gap:${GAP}px;margin-bottom:${GAP}px;align-items:start">
    <div><img src="${enc(join(ROOT, 'refs/style', j.a.ref))}" style="width:${TH}px;height:${thH}px;object-fit:cover;border-radius:6px;display:block"><div style="color:#888;font:11px Inter;padding-top:6px">original ref</div></div>
    <div><img src="${enc(j.plain)}" style="width:${TH}px;height:${thH}px;border-radius:6px;display:block"><div style="color:#888;font:11px Inter;padding-top:6px">plain</div></div>
    <div><img src="${enc(j.fx)}" style="width:${TH}px;height:${thH}px;border-radius:6px;display:block"><div style="color:#8f8;font:11px Inter;padding-top:6px">treated photo (type clean)</div></div>
    <div style="padding-top:2px"><b style="color:#eee;font:700 20px Inter">Ref ${j.n}</b><div style="color:#9a9a9a;font:400 14px Inter;padding-top:4px">${j.a.name}</div></div></div>`;
  const sh = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body style="margin:0;background:#141414;padding:${PAD}px;width:${pageW}px;font-family:Inter">
    <div style="color:#f3f3f3;font:700 28px Inter;margin-bottom:16px">(cast) — house effect on the photo · noise only</div>
    ${rows.map(row).join('')}</body></html>`;
  writeFileSync(join(OUT, '_sheet.html'), sh);
  const sp = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'fx-test.png'), await chrome.shoot(sp, `file://${join(OUT, '_sheet.html')}`, pageW, pageH));
} finally { chrome.kill(); }
console.log(`\nsheet -> ${OUT}/fx-test.png   ~$${spent.toFixed(2)}`);
