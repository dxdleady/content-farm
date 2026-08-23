#!/usr/bin/env node
// Compose ONE post from the plan: rubric × density × ref (× theme × format).
//   node tools/compose.ts --rubric hot-takes --density half --ref 3 [--theme light|dark|color]
//   node tools/compose.ts --rubric feature-drop --density minimal --format tiktok
//   node tools/compose.ts --rubric hot-takes --density full --ref 3 --format ig,tiktok
//   node tools/compose.ts --product nova --rubric hot-takes --density minimal
//   node tools/compose.ts --post edit-time --no-generate
// density: minimal | light | half | full  (ids from data/density.json)
//   minimal → 0 art · light → cover+splash · half → every other · full → all art-capable
// theme:   light (cream, dark type) · dark (near-black, light type) · color (rotating brand grounds)
// format:  ig (1080×1350, default) · tiktok (1080×1920, safe-areas) · or both: ig,tiktok
//          Several formats = ONE set of generated art, rendered into one run folder each.
//          The art is generated at the tallest ratio asked for and the shorter frames crop
//          it, because .art-full is object-fit:cover. That is what makes the same post on
//          two platforms show the same picture — and it costs one generation, not two.
// product: which brand — assets, palette, voice and copy ($PRODUCT, default cast)
// post:    render a POST — products/<id>/copy/posts/<id>.json, which holds the actual
//          words. Its saved axes supply the defaults for density/theme/ref/format, so a
//          flag still wins if you pass one. --rubric names the same thing today, because
//          rubricsFor() is a view over the same posts; --post is the honest spelling.
// no-fx:   turn off the house film-grain
// no-generate: refuse to buy art. On a cache miss this prints which slides would need
//          generating and what it would cost, then exits 2 without spending. tools/studio.ts
//          always passes it, which is what makes its re-render button provably free rather
//          than free by convention.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rubricsFor, ART_CAPABLE, refAnalysisFile, composePrompt } from '../src/plan.ts';
import { MODELS } from '../src/providers.ts';
import { pool } from '../src/pool.ts';
import { Chrome } from '../src/chrome.ts';
import { rendererFor } from '../src/layouts.ts';
import { fxPage } from '../src/fx.ts';
import { formatsFromArgv, formatCss, artRatio, artFraming } from '../src/formats.ts';
import type { ArtPrompt, DensityLevel, RefAnalysis, RenderSlide } from '../src/types.ts';
import { slidePage } from '../src/page.ts';
import { cachePath } from '../src/cache.ts';
import { productFromArgv } from '../src/product.ts';
import { composeDeckName, composeRunDir, hookOf } from '../src/run.ts';
import { validateCopy, formatProblems } from '../src/validate.ts';
import { asRubric, checkPost, loadPost } from '../src/post.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX = !process.argv.includes('--no-fx');   // house film-grain on every photo

try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const NO_GENERATE = process.argv.includes('--no-generate');
const P = productFromArgv();
const RUBRICS = rubricsFor(P);

// --- a draft, if one was asked for: the rubric plus a human's patches ---
const argAt = (k: string): string | undefined => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const postName = argAt('post');
if (postName && argAt('rubric')) {
  console.error('--post and --rubric are mutually exclusive — pass one');
  process.exit(1);
}
const post = postName ? loadPost(P, postName) : null;
if (post && post.product !== P.id) {
  console.error(`post "${post.id}" belongs to product "${post.product}", not "${P.id}"`);
  process.exit(1);
}
if (post) {
  const errs = checkPost(post).filter(x => x.level !== 'warn');
  if (errs.length) { console.error(formatProblems(errs)); process.exit(1); }
}

// The draft's axes are DEFAULTS — an explicit flag still wins, so a saved post can be
// re-rendered for another format or theme without editing the file.
const has = (k: string) => process.argv.includes(`--${k}`);
const argvWithPostFormats = post && !has('format') && !process.env.FORMAT
  ? [...process.argv, '--format', post.axes.formats.join(',')]
  : process.argv;

const FMTS = formatsFromArgv(argvWithPostFormats);
const FMT = FMTS[0]!;                 // the one whose deck.json/console line leads
const ART_RATIO = artRatio(FMTS);     // generate once, at the tallest asked for
const ART_FRAMING = artFraming(FMTS);
// productFromArgv already checked the brand. The copy check needs the rubrics, so it
// happens here — and it happens on the money path specifically, because this is the one
// tool that spends: a wrong accent caught now is an image not bought.
const copyProblems = validateCopy(P, RUBRICS);
if (copyProblems.length) {
  console.error(`${P.id}'s copy does not resolve — ${copyProblems.length} problem(s):\n`
    + formatProblems(copyProblems));
  process.exit(1);
}
const { renderSlide, inkFor } = rendererFor(P);

// --- colour theme: one rotating brand ground per slide + a contrasting em accent ---
// The three tables moved onto the product. They are brand data by definition: the
// rotation is tuned so consecutive slides contrast in THIS palette, and HUE is the
// English name a diffusion model is given for a hex nobody has taught it. A second brand
// with different accents needs its own, and there is no defensible default.
const { rotation: COLOR_ROT, em: GA, hue: HUE } = P.colorTheme;
const isLightInk = (g: string) => inkFor(g).includes('text-main'); // light ink ⇒ the ground is dark
const HANDLE = P.handle;

const arg = (k: string, d?: string | null): string | null | undefined => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const rubricId = post ? post.id : arg('rubric');
const densityId = arg('density', post ? post.axes.density : 'minimal');
const ref = arg('ref', post?.axes.ref == null ? null : String(post.axes.ref));
const theme = arg('theme', post ? post.axes.theme : 'light');
// the default makes this non-optional in practice; arg() cannot express that
const model = arg('model', 'gpt-image-2')!;
if (!RUBRICS[rubricId!]) { console.error(`unknown rubric "${rubricId}". have: ${Object.keys(RUBRICS).join(', ')}`); process.exit(1); }
if (!['light', 'dark', 'color'].includes(theme!)) { console.error(`unknown theme "${theme}". have: light, dark, color`); process.exit(1); }

const DENSITY = JSON.parse(readFileSync(join(ROOT, 'data/density.json'), 'utf8')).levels as DensityLevel[];
const level = DENSITY.find((l: DensityLevel) => l.id === densityId || String(l.level) === String(densityId));
if (!level) { console.error(`unknown density "${densityId}". have: ${DENSITY.map((l: DensityLevel) => l.id).join(', ')}`); process.exit(1); }

// A post IS a rubric once its review state is stripped, so everything below this line is
// unchanged — it cannot tell where the copy came from.
const rubric = post ? asRubric(post) : RUBRICS[rubricId!]!;

// --- which slides become generated backgrounds, per density ---
const artCapableIdx = rubric.slides.map((s, i) => (ART_CAPABLE.has(s.layout) && s.art ? i : -1)).filter((i: number) => i >= 0);
let artIdx: number[] = [];
if (level.id === 'minimal') artIdx = [];
else if (level.id === 'light') artIdx = [...new Set([artCapableIdx[0], artCapableIdx.at(-1)])].filter(i => i != null);
else if (level.id === 'half') artIdx = artCapableIdx.filter((_: number, k: number) => k % 2 === 0);
else artIdx = artCapableIdx; // full
const artSet = new Set(artIdx);

if (artSet.size && !ref) { console.error(`density "${level.id}" needs art — pass --ref <1..28>`); process.exit(1); }

// --- ref analysis (only needed if we generate) ---
let analysis: RefAnalysis | null = null, refFile: string | null = null, refBytes: Buffer | null = null;
if (artSet.size) {
  const af = join(ROOT, 'refs/analysis', refAnalysisFile(ref!));
  if (!existsSync(af)) { console.error(`no feature-map ${af}`); process.exit(1); }
  analysis = JSON.parse(readFileSync(af, 'utf8')) as RefAnalysis;
  refFile = join(ROOT, 'refs/style', analysis!.ref);
  refBytes = readFileSync(refFile);
}

const runKey = { product: P, rubric: rubricId!, density: level.id, theme: theme!, ref,
  // The opening line, not the rubric id. `edit-time` says what shape the post is;
  // `how-long-an-episode-actually-takes` says what it is about, which is what anyone
  // scanning out/runs is actually looking for. Every rubric opens on its hook — the
  // envelope test in plan.test.ts is what guarantees slides[0] is it.
  hook: hookOf(rubric.slides) };
// One run directory per format. They share the art but not the frame, so they stay
// separate immutable folders exactly as they were before this tool learned to loop.
const RUNS = FMTS.map(f => ({
  fmt: f,
  deckName: composeDeckName({ ...runKey, format: f }),
  dir: composeRunDir({ ...runKey, format: f }),
}));
for (const r of RUNS) mkdirSync(r.dir, { recursive: true });
const deckName = RUNS[0]!.deckName;
// The generated art is format-independent by construction, so it is produced once, into
// the first run's folder, and copied into the others. Each run stays self-contained —
// the immutability rule is about being able to read a folder on its own later, not about
// having paid for its contents separately.
const ART_OUT = join(RUNS[0]!.dir, 'art');

// --- build the concrete deck slides ---
const total = rubric.slides.length;
// The art skeletons were written against 4:5. The framing line comes from the GENERATION
// ratio rather than from whichever format happens to be rendering — that is what keeps
// one prompt, and therefore one cache entry and one picture, across every format asked for.
const mkReplace = (art: ArtPrompt, colour: string) => [
  `SUBJECT: ${art.s}.`, `COMPOSITION: ${art.c}.`, `COLOUR: ${colour}.`,
  ...(ART_FRAMING ? [`${ART_FRAMING}.`] : []),
];
const slides: RenderSlide[] = rubric.slides.map((sl, i) => {
  const { art, theme: _skip, ...copy } = sl;      // drop art + any authored theme
  const s = { ...copy, minimal: true, handle: HANDLE, index: i + 1, total } as RenderSlide;
  const isArt = artSet.has(i) && art;
  if (theme === 'light') {
    s.theme = 'light';
    if (s.accent === 'accent-lime') s.accent = 'accent-purple';
    if (isArt) s.replace = mkReplace(art, `${art.k}, bright and true to the reference's palette; the type zone kept uncluttered`);
  } else if (theme === 'color') {
    const g = COLOR_ROT[i % COLOR_ROT.length]!;
    s.accent = GA[g] as RenderSlide['accent'];                               // em word pops against the ground
    if (isArt) {                                    // art tinted to the ground hue; tone matches its ink
      if (!isLightInk(g)) s.theme = 'light';        // bright ground ⇒ dark ink ⇒ light scrim
      s.replace = mkReplace(art, `dominated by ${HUE[g]}, bright and saturated; the type zone kept uncluttered`);
    } else {
      s.ground = g as RenderSlide['ground'];                                 // flat brand-colour flood (readable ink auto-picked)
    }
  } else { // dark
    if (isArt) s.replace = mkReplace(art, `${art.k}, bright and true to the reference's palette; the type zone kept uncluttered`);
  }
  return s;
});

// --- generate the art backgrounds (content-addressed cache) ---
const CACHE = join(ROOT, 'assets/generated');
mkdirSync(CACHE, { recursive: true });
const buildPrompt = (replace: string[]) => composePrompt(analysis!.keep, replace);
const cacheFor = (prompt: string) => cachePath({ model, prompt, ratio: ART_RATIO, refBytes: refBytes! });

let spent = 0;
// Slides that a --no-generate run refused to pay for. See the flag's note in the header:
// this is what lets tools/studio.ts promise a free re-render instead of hoping for one.
const wouldGenerate: number[] = [];
// slide index -> the generated PNG. A map rather than slides[i].bgFile because slides[]
// is now shared by every format and the grain step rewrites bgFile per canvas; keeping
// the pristine path here is what stops format two from inheriting format one's tile.
const art = new Map<number, string>();

if (artSet.size) {
  mkdirSync(ART_OUT, { recursive: true });
  console.log(`compose ${RUNS.map(r => r.deckName).join(' + ')}`
    + `\n  ref: ${analysis!.ref} (${analysis!.name})  model: ${model}  ratio: ${ART_RATIO}`
    + `  art slides: ${[...artSet].map(i => i + 1).join(', ')}\n`);
  const jobs = [...artSet].map((i) => ({ i })) as Array<{ i: number }>;
  await pool<{ i: number }, void>(jobs, Number(process.env.CONCURRENCY || 3), async ({ i }) => {
    const prompt = buildPrompt(slides[i]!.replace!);
    const dst = join(ART_OUT, `${String(i + 1).padStart(2, '0')}-${slides[i]!.layout}.png`);
    const cached = cacheFor(prompt);
    if (existsSync(cached)) { copyFileSync(cached, dst); art.set(i, dst); delete slides[i]!.replace; console.log(`  = slide ${i + 1} cached`); return; }
    // Not in the cache, and we were told not to buy. Collect rather than exit here — the
    // caller deserves the whole bill in one message, not the first line of it.
    if (NO_GENERATE) { wouldGenerate.push(i); return; }
    for (let a = 1; a <= 2; a++) {
      try {
        const buf = await MODELS[model as keyof typeof MODELS].call({ prompt, refs: [refFile!], ratio: ART_RATIO });
        writeFileSync(cached, buf); writeFileSync(dst, buf);
        art.set(i, dst); delete slides[i]!.replace; spent += MODELS[model as keyof typeof MODELS].price;
        console.log(`  ✓ slide ${i + 1}${a > 1 ? ' (retry)' : ''}`); return;
      } catch (e) { if (a === 2) console.log(`  ✗ slide ${i + 1}: ${(e as Error).message.slice(0, 90)}`); else await new Promise(r => setTimeout(r, 4000)); }
    }
  });
} else {
  console.log(`compose ${RUNS.map(r => r.deckName).join(' + ')}  (minimal — no art)\n`);
}

if (wouldGenerate.length) {
  const price = MODELS[model as keyof typeof MODELS].price;
  console.error(`\n--no-generate: ${wouldGenerate.length} slide(s) are not in the cache and `
    + `would cost ~$${(wouldGenerate.length * price).toFixed(2)} to generate:\n`
    + wouldGenerate.map(i => `  slide ${i + 1}  ${slides[i]!.layout}`).join('\n')
    + `\n\nNothing was rendered and nothing was spent. Re-run without --no-generate to buy them.`);
  // 2, not 1: a caller can tell "you would have to pay" apart from "you got it wrong".
  process.exit(2);
}

// --- render slides + contact sheet, once per format ---
//
// Everything above this line is format-independent: the copy, the prompts, the images.
// Everything below is not — the canvas, the grain tile and the contact sheet all depend
// on the frame. So the split is here, and it is why one generation can serve N formats.

const written: Array<{ deckName: string; dir: string; fmt: typeof FMT; count: number }> = [];

// A browser per format, not one across all of them.
//
// Held across both passes, a single headless Chrome died between them on a real run —
// six 2MB backgrounds re-grained at 1080x1350 and then again at 1080x1920 is a lot of
// bitmap for one process. src/chrome.ts now turns that death into an error instead of an
// infinite hang, which is the actual fix; relaunching per format is the cheap half that
// stops one pass from taking the next one with it. A launch is well under a second, and
// the runs are independent folders anyway.
for (const run of RUNS) {
  const chrome = await Chrome.launch();
  try {
    const { fmt, dir } = run;
      const W = fmt.w, H = fmt.h;
      const page = (inner: string) => slidePage(inner, fmt, P);
      const made: string[] = [];

      // A target per shot: holding one across the loop intermittently wedges
      // Page.captureScreenshot — see Chrome.shootFresh.
      for (let i = 0; i < slides.length; i++) {
        const id = `${String(i + 1).padStart(2, '0')}-${slides[i]!.layout}`;
        // slides[] is shared across formats, so never mutate its bgFile — the grain tile is
        // sized to THIS canvas and writing it back would hand the next format the wrong art.
        let bg = art.get(i) ?? null;
        if (FX && bg) {
          mkdirSync(join(dir, 'art'), { recursive: true });
          const t = join(dir, 'art', `${id}.grain.png`);
          writeFileSync(join(dir, '_fx.html'), fxPage(`file://${bg}`, W, H));
          writeFileSync(t, await chrome.shootPooled(`file://${join(dir, '_fx.html')}`, W, H));
          bg = t;
        }
        const slide = bg ? { ...slides[i]!, bgFile: bg } : slides[i]!;
        const hp = join(dir, `${id}.html`); writeFileSync(hp, page(renderSlide(slide)));
        const png = join(dir, `${id}.png`); writeFileSync(png, await chrome.shootPooled(`file://${hp}`, W, H));
        made.push(png);
      }

      const TH = 300, cols = Math.min(total, 5), gap = 12, rows = Math.ceil(made.length / cols), thH = Math.round(TH * H / W);
      const bgc = theme === 'light' ? '#cfccc6' : '#141414';
      const sh = `<!doctype html><html><body style="margin:0;background:${bgc};display:grid;grid-template-columns:repeat(${cols},${TH}px);gap:${gap}px;padding:${gap}px;width:max-content">
      ${made.map(m => `<img src="file://${m}" style="width:${TH}px;height:${thH}px;display:block;border-radius:6px">`).join('')}</body></html>`;
      const shp = join(dir, 'sheet.html'); writeFileSync(shp, sh);
      const sw = cols * TH + gap * (cols + 1), shH = rows * thH + gap * (rows + 1);
      const sp = await chrome.newPage(sw, shH);
      writeFileSync(join(dir, 'contact-sheet.png'), await chrome.shoot(sp, `file://${shp}`, sw, shH));

      writeFileSync(join(dir, 'deck.json'), JSON.stringify({
        deck: run.deckName, rubric: rubricId, density: level.id, ref: ref ?? null, theme,
        product: P.id,
        // Recorded so a later reader can tell a cross-posted deck from a single-format one
        // without diffing the images: same artRatio in two folders means same pictures.
        artRatio: ART_RATIO,
        format: { id: fmt.id, w: fmt.w, h: fmt.h, ratio: fmt.ratio, safe: fmt.safe },
        slides: slides.map((sl, i) => (art.has(i) ? { ...sl, bgFile: art.get(i) } : sl)),
      }, null, 2));
    written.push({ ...run, count: made.length });
  } finally { chrome.kill(); }
}

for (const w of written) {
  console.log(`\n${w.count} slides -> ${w.dir}  (${w.fmt.name} ${w.fmt.w}x${w.fmt.h})`);
  console.log(`sheet -> ${w.dir}/contact-sheet.png`);
}
if (spent) console.log(`\n~$${spent.toFixed(2)} spent · ${ART_RATIO} art, shared by ${written.length} format(s)`);
