#!/usr/bin/env node
// Sample each reference as REAL slides: 2 per ref (a portrait hero + a splash),
// generated through the new KEEP feature-maps, rendered with (cast) chrome + type,
// then laid out one row per ref (original | slide A | slide B) for judging.
//   node tools/ref-slides.mjs 1 10        # refs 1..10
//   node tools/ref-slides.mjs 1 28 --theme dark
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../src/providers.ts';
import { pool } from '../src/pool.ts';
import { Chrome } from '../src/chrome.ts';
import { renderSlide } from '../src/layouts.ts';
import { refAnalysisFile, composePrompt } from '../src/plan.ts';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const FMT = formatFromArgv();
const W = FMT.w, H = FMT.h, HANDLE = 'mubert.com/tools/cast';
// only a non-4:5 canvas enters the cache key, so Instagram art already on disk still hits
const ratioTag = FMT.ratio === '4:5' ? '' : `|${FMT.ratio}`;
const model = (process.argv.find(a => a.startsWith('--model=')) ?? '').split('=')[1] || 'gpt-image-2';
const from = Number(process.argv[2]) || 1;
const to = Number(process.argv[3]) || 10;
const refs = Array.from({ length: to - from + 1 }, (_, i) => from + i);

// two fixed slide templates so every ref is judged on the same ground.
const TEMPLATES = [
  { copy: { layout: 'statement', accent: 'accent-lime', title: 'Say it like you *mean* it' },
    art: { s: 'a single striking face caught mid-expression — a shout, a sharp glance, a laugh — cropped hard and close, full of attitude and rendered fully in the medium', c: 'the face sits high and to the right, cropped by the top and right edges; the lower-left third is decisive negative space in the medium, kept dark enough for type', k: "the reference's own palette, saturated and bold" } },
  { copy: { layout: 'splash', accent: 'accent-lime', title: 'Made to be *heard*.' },
    art: { s: 'a single oversized iconic object rendered in the reference\'s exact medium — a studio microphone, a cassette, or a bold hand-cut shape — hard-edged, graphic and confident', c: 'the object sits large and off-centre, cropped by an edge; the middle band stays a cleaner (but still fully textured, never blurred) zone so a logo can sit over it', k: "the reference's own palette, saturated and bold" } },
];

const CACHE = join(ROOT, 'assets/generated'); mkdirSync(CACHE, { recursive: true });
const OUT = join(ROOT, `out/runs/ref-slides${formatTag(FMT)}`); mkdirSync(join(OUT, 'cards'), { recursive: true });
const buildPrompt = (keep, art) => composePrompt(keep, [`SUBJECT: ${art.s}.`, `COMPOSITION: ${art.c}.`, `COLOUR: ${art.k}.`,
  ...(FMT.framing ? [`${FMT.framing}.`] : [])]);

// build the job list (ref × 2 templates)
const jobs = [];
for (const n of refs) {
  const af = join(ROOT, 'refs/analysis', refAnalysisFile(n));
  if (!existsSync(af)) { console.log(`  ! ref ${n}: no feature-map, skipped`); continue; }
  const analysis = JSON.parse(readFileSync(af, 'utf8'));
  const refFile = join(ROOT, 'refs/style', analysis.ref);
  const refBytes = readFileSync(refFile);
  TEMPLATES.forEach((t, ti) => jobs.push({ n, ti, analysis, refFile, refBytes, t }));
}

console.log(`generating ${jobs.length} slides (${refs.length} refs × 2)  model ${model}\n`);
let spent = 0;
await pool(jobs, Number(process.env.CONCURRENCY || 4), async (j) => {
  const prompt = buildPrompt(j.analysis.keep, j.t.art);
  const cache = join(CACHE, `pack-${createHash('sha256').update(`${model}|${prompt}${ratioTag}`).update(j.refBytes).digest('hex').slice(0, 16)}.png`);
  const bg = join(OUT, 'cards', `ref${String(j.n).padStart(2, '0')}-${j.ti + 1}.bg.png`);
  if (existsSync(cache)) { copyFileSync(cache, bg); j.bg = bg; return; }
  for (let a = 1; a <= 2; a++) {
    try { const buf = await MODELS[model].call({ prompt, refs: [j.refFile], ratio: FMT.ratio }); writeFileSync(cache, buf); writeFileSync(bg, buf); j.bg = bg; spent += MODELS[model].price; console.log(`  ✓ ref ${j.n} · ${j.ti + 1}`); return; }
    catch (e) { if (a === 2) console.log(`  ✗ ref ${j.n} · ${j.ti + 1}: ${e.message.slice(0, 80)}`); else await new Promise(r => setTimeout(r, 4000)); }
  }
});

// render each generated background into a real slide
const fonts = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8').replace(/url\((woff2\/[^)]+)\)/g, (_, r) => `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'assets/fonts', r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT, 'tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const sheet = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
const page = inner => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style><style>${tokens}</style><style>${sheet}</style><style>${formatCss(FMT)}</style><style>html,body{margin:0;background:#000}</style></head><body>${inner}</body></html>`;

const chrome = await Chrome.launch();
const byRef = new Map();
try {
  const p = await chrome.newPage(W, H);
  for (const j of jobs) {
    if (!j.bg) continue;
    const s = { ...j.t.copy, minimal: true, handle: HANDLE, index: j.ti + 1, total: 2, bgFile: j.bg };
    const png = join(OUT, 'cards', `ref${String(j.n).padStart(2, '0')}-${j.ti + 1}.png`);
    writeFileSync(join(OUT, 'cards', `s.html`), page(renderSlide(s)));
    writeFileSync(png, await chrome.shoot(p, `file://${join(OUT, 'cards', 's.html')}`, W, H));
    if (!byRef.has(j.n)) byRef.set(j.n, { name: j.analysis.name, ref: j.analysis.ref, a: null, b: null });
    byRef.get(j.n)[j.ti === 0 ? 'a' : 'b'] = png;
  }
  await chrome.close(p);

  // review sheet: one row per ref — original | slide A | slide B
  const TH = 300, thH = Math.round(TH * H / W), GAP = 14, PAD = 20;
  const rowsArr = [...byRef.entries()].sort((a, b) => a[0] - b[0]);
  const rowH = thH + 34;
  const pageW = PAD * 2 + 3 * TH + 2 * GAP + 260;
  const pageH = PAD * 2 + rowsArr.length * (rowH + GAP);
  const enc = pth => 'file://' + encodeURI(pth).replace(/#/g, '%23');
  const rowHtml = ([n, r]) => `<div style="display:grid;grid-template-columns:${TH}px ${TH}px ${TH}px 240px;gap:${GAP}px;margin-bottom:${GAP}px;align-items:start">
    <div><img src="${enc(join(ROOT, 'refs/style', r.ref))}" style="width:${TH}px;height:${thH}px;object-fit:cover;border-radius:6px;display:block"><div style="color:#888;font:11px Inter;padding-top:6px">original</div></div>
    <img src="${enc(r.a)}" style="width:${TH}px;height:${thH}px;border-radius:6px;display:block">
    <img src="${enc(r.b)}" style="width:${TH}px;height:${thH}px;border-radius:6px;display:block">
    <div style="padding-top:2px"><b style="color:#eee;font:700 22px Inter">Ref ${n}</b><div style="color:#9a9a9a;font:400 15px Inter;padding-top:4px">${r.name}</div></div>
  </div>`;
  const sh = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body style="margin:0;background:#141414;padding:${PAD}px;width:${pageW}px;font-family:Inter">
    <div style="color:#f3f3f3;font:700 30px Inter;margin-bottom:16px">(cast) — ref sweep · 2 slides per ref</div>
    ${rowsArr.map(rowHtml).join('')}</body></html>`;
  const shp = join(OUT, 'ref-slides.html'); writeFileSync(shp, sh);
  const sp = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'ref-slides.png'), await chrome.shoot(sp, `file://${shp}`, pageW, pageH));
} finally { chrome.kill(); }

console.log(`\nsheet -> ${OUT}/ref-slides.png   ~$${spent.toFixed(2)}`);
