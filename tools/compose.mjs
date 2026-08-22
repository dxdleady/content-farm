#!/usr/bin/env node
// Compose ONE post from the plan: rubric × density × ref (× theme × format).
//   node tools/compose.mjs --rubric hot-takes --density half --ref 3 [--theme light|dark|color]
//   node tools/compose.mjs --rubric feature-drop --density minimal --format tiktok
// density: minimal | light | half | full  (ids from data/density.json)
//   minimal → 0 art · light → cover+splash · half → every other · full → all art-capable
// theme:   light (cream, dark type) · dark (near-black, light type) · color (rotating brand grounds)
// format:  ig (1080×1350, default) · tiktok (1080×1920, safe-areas + 9:16 art)
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUBRICS, ART_CAPABLE, refAnalysisFile, composePrompt } from '../src/plan.mjs';
import { MODELS } from '../src/providers.ts';
import { pool } from '../src/pool.ts';
import { Chrome } from '../src/chrome.ts';
import { renderSlide, inkFor } from '../src/layouts.mjs';
import { fxPage } from '../src/fx.ts';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX = !process.argv.includes('--no-fx');   // house film-grain on every photo

// --- colour theme: one rotating brand ground per slide + a contrasting em accent ---
const COLOR_ROT = ['carrot', 'purpleblue', 'pink', 'green', 'violet65', 'mainorange', 'blue67', 'superlime', 'lightpink'];
const GA = { carrot: 'accent-purple', purpleblue: 'accent-lime', pink: 'accent-lime', green: 'accent-purple', violet65: 'accent-lime', mainorange: 'accent-purple', blue67: 'accent-lime', superlime: 'accent-purple', lightpink: 'accent-purple' };
const HUE = { carrot: 'carrot orange', purpleblue: 'blue-violet', pink: 'hot pink', green: 'bright grass green', violet65: 'electric violet', mainorange: 'bright orange', blue67: 'cobalt blue', superlime: 'acid lime-green', lightpink: 'soft candy pink' };
const isLightInk = (g) => inkFor(g).includes('text-main'); // light ink ⇒ the ground is dark
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const FMT = formatFromArgv();
const W = FMT.w, H = FMT.h, HANDLE = 'mubert.com/tools/cast';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const rubricId = arg('rubric');
const densityId = arg('density', 'minimal');
const ref = arg('ref', null);
const theme = arg('theme', 'light');
const model = arg('model', 'gpt-image-2');
if (!RUBRICS[rubricId]) { console.error(`unknown rubric "${rubricId}". have: ${Object.keys(RUBRICS).join(', ')}`); process.exit(1); }
if (!['light', 'dark', 'color'].includes(theme)) { console.error(`unknown theme "${theme}". have: light, dark, color`); process.exit(1); }

const DENSITY = JSON.parse(readFileSync(join(ROOT, 'data/density.json'), 'utf8')).levels;
const level = DENSITY.find(l => l.id === densityId || String(l.level) === String(densityId));
if (!level) { console.error(`unknown density "${densityId}". have: ${DENSITY.map(l => l.id).join(', ')}`); process.exit(1); }

const rubric = RUBRICS[rubricId];

// --- which slides become generated backgrounds, per density ---
const artCapableIdx = rubric.slides.map((s, i) => (ART_CAPABLE.has(s.layout) && s.art ? i : -1)).filter(i => i >= 0);
let artIdx = [];
if (level.id === 'minimal') artIdx = [];
else if (level.id === 'light') artIdx = [...new Set([artCapableIdx[0], artCapableIdx.at(-1)])].filter(i => i != null);
else if (level.id === 'half') artIdx = artCapableIdx.filter((_, k) => k % 2 === 0);
else artIdx = artCapableIdx; // full
const artSet = new Set(artIdx);

if (artSet.size && !ref) { console.error(`density "${level.id}" needs art — pass --ref <1..28>`); process.exit(1); }

// --- ref analysis (only needed if we generate) ---
let analysis = null, refFile = null, refBytes = null;
if (artSet.size) {
  const af = join(ROOT, 'refs/analysis', refAnalysisFile(ref));
  if (!existsSync(af)) { console.error(`no feature-map ${af}`); process.exit(1); }
  analysis = JSON.parse(readFileSync(af, 'utf8'));
  refFile = join(ROOT, 'refs/style', analysis.ref);
  refBytes = readFileSync(refFile);
}

const refTag = ref ? `-r${String(ref).match(/\d+/)?.[0]}` : '';
const deckName = `${rubricId}-${level.id}-${theme}${refTag}${formatTag(FMT)}`;
const OUT = join(ROOT, `out/runs/compose-${deckName}`);
mkdirSync(OUT, { recursive: true });

// --- build the concrete deck slides ---
const total = rubric.slides.length;
// The art skeletons were written against 4:5. A taller canvas adds its own framing
// line so the subject doesn't end up centred behind the type or under the platform UI.
const mkReplace = (art, colour) => [
  `SUBJECT: ${art.s}.`, `COMPOSITION: ${art.c}.`, `COLOUR: ${colour}.`,
  ...(FMT.framing ? [`${FMT.framing}.`] : []),
];
const slides = rubric.slides.map((sl, i) => {
  const { art, theme: _skip, ...copy } = sl;      // drop art + any authored theme
  const s = { ...copy, minimal: true, handle: HANDLE, index: i + 1, total };
  const isArt = artSet.has(i) && art;
  if (theme === 'light') {
    s.theme = 'light';
    if (s.accent === 'accent-lime') s.accent = 'accent-purple';
    if (isArt) s.replace = mkReplace(art, `${art.k}, bright and true to the reference's palette; the type zone kept uncluttered`);
  } else if (theme === 'color') {
    const g = COLOR_ROT[i % COLOR_ROT.length];
    s.accent = GA[g];                               // em word pops against the ground
    if (isArt) {                                    // art tinted to the ground hue; tone matches its ink
      if (!isLightInk(g)) s.theme = 'light';        // bright ground ⇒ dark ink ⇒ light scrim
      s.replace = mkReplace(art, `dominated by ${HUE[g]}, bright and saturated; the type zone kept uncluttered`);
    } else {
      s.ground = g;                                 // flat brand-colour flood (readable ink auto-picked)
    }
  } else { // dark
    if (isArt) s.replace = mkReplace(art, `${art.k}, bright and true to the reference's palette; the type zone kept uncluttered`);
  }
  return s;
});

// --- generate the art backgrounds (content-addressed cache) ---
const CACHE = join(ROOT, 'assets/generated');
mkdirSync(CACHE, { recursive: true });
const buildPrompt = (replace) => composePrompt(analysis.keep, replace);
// The ratio is part of the identity of a generated image, but it only enters the key
// for non-4:5 formats — otherwise every Instagram image already in assets/generated/
// would miss and get re-bought.
const ratioTag = FMT.ratio === '4:5' ? '' : `|${FMT.ratio}`;
const cacheFor = (prompt) => join(CACHE, `pack-${createHash('sha256').update(`${model}|${prompt}${ratioTag}`).update(refBytes).digest('hex').slice(0, 16)}.png`);

let spent = 0;
if (artSet.size) {
  mkdirSync(join(OUT, 'art'), { recursive: true });
  console.log(`compose ${deckName}\n  ref: ${analysis.ref} (${analysis.name})  model: ${model}  art slides: ${[...artSet].map(i => i + 1).join(', ')}\n`);
  const jobs = [...artSet].map(i => ({ i }));
  await pool(jobs, Number(process.env.CONCURRENCY || 3), async ({ i }) => {
    const prompt = buildPrompt(slides[i].replace);
    const dst = join(OUT, 'art', `${String(i + 1).padStart(2, '0')}-${slides[i].layout}.png`);
    const cached = cacheFor(prompt);
    if (existsSync(cached)) { copyFileSync(cached, dst); slides[i].bgFile = dst; delete slides[i].replace; console.log(`  = slide ${i + 1} cached`); return; }
    for (let a = 1; a <= 2; a++) {
      try {
        const buf = await MODELS[model].call({ prompt, refs: [refFile], ratio: FMT.ratio });
        writeFileSync(cached, buf); writeFileSync(dst, buf);
        slides[i].bgFile = dst; delete slides[i].replace; spent += MODELS[model].price;
        console.log(`  ✓ slide ${i + 1}${a > 1 ? ' (retry)' : ''}`); return;
      } catch (e) { if (a === 2) console.log(`  ✗ slide ${i + 1}: ${e.message.slice(0, 90)}`); else await new Promise(r => setTimeout(r, 4000)); }
    }
  });
} else {
  console.log(`compose ${deckName}  (minimal — no art)\n`);
}

// --- render slides + contact sheet ---
const fonts = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8')
  .replace(/url\((woff2\/[^)]+)\)/g, (_, r) => `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'assets/fonts', r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT, 'tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const sheet = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
const page = inner => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style><style>${tokens}</style><style>${sheet}</style><style>${formatCss(FMT)}</style><style>html,body{margin:0;background:#000}</style></head><body>${inner}</body></html>`;

const chrome = await Chrome.launch();
const made = [];
try {
  const p = await chrome.newPage(W, H);
  for (let i = 0; i < slides.length; i++) {
    const id = `${String(i + 1).padStart(2, '0')}-${slides[i].layout}`;
    // grain the photo first, then compose the (clean) type over the treated bg
    if (FX && slides[i].bgFile) {
      const t = join(OUT, 'art', `${id}.grain.png`);
      writeFileSync(join(OUT, '_fx.html'), fxPage(`file://${slides[i].bgFile}`, W, H));
      writeFileSync(t, await chrome.shoot(p, `file://${join(OUT, '_fx.html')}`, W, H));
      slides[i].bgFile = t;
    }
    const hp = join(OUT, `${id}.html`); writeFileSync(hp, page(renderSlide(slides[i])));
    const png = join(OUT, `${id}.png`); writeFileSync(png, await chrome.shoot(p, `file://${hp}`, W, H));
    made.push(png);
  }
  await chrome.close(p);
  const TH = 300, cols = Math.min(total, 5), gap = 12, rows = Math.ceil(made.length / cols), thH = Math.round(TH * H / W);
  const bg = theme === 'light' ? '#cfccc6' : '#141414';
  const sh = `<!doctype html><html><body style="margin:0;background:${bg};display:grid;grid-template-columns:repeat(${cols},${TH}px);gap:${gap}px;padding:${gap}px;width:max-content">
    ${made.map(m => `<img src="file://${m}" style="width:${TH}px;height:${thH}px;display:block;border-radius:6px">`).join('')}</body></html>`;
  const shp = join(OUT, 'sheet.html'); writeFileSync(shp, sh);
  const sw = cols * TH + gap * (cols + 1), shH = rows * thH + gap * (rows + 1);
  const sp = await chrome.newPage(sw, shH); writeFileSync(join(OUT, 'contact-sheet.png'), await chrome.shoot(sp, `file://${shp}`, sw, shH));
} finally { chrome.kill(); }

writeFileSync(join(OUT, 'deck.json'), JSON.stringify({ deck: deckName, rubric: rubricId, density: level.id, ref: ref ?? null, theme,
  format: { id: FMT.id, w: FMT.w, h: FMT.h, ratio: FMT.ratio, safe: FMT.safe }, slides }, null, 2));
console.log(`\n${made.length} slides -> ${OUT}  (${FMT.name} ${W}x${H})${spent ? `  ~$${spent.toFixed(2)}` : ''}`);
console.log(`sheet -> ${OUT}/contact-sheet.png`);
