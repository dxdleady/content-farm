#!/usr/bin/env node
// content.json -> standalone HTML slides -> PNGs, rendered by one headless Chrome.
//   node src/render.mjs [content.json] [outDir] [--format ig|tiktok]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, symlinkSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSlide } from './layouts.ts';
import { Chrome } from './chrome.ts';
import { background, status } from './bgen.ts';
import { formatFromArgv, formatCss } from './formats.ts';
import type { Deck, RenderSlide } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FMT = formatFromArgv();
const W = FMT.w, H = FMT.h;

/* ---- inline every webfont so a render never depends on installed system fonts ---- */
function fontCss(): string {
  const dir = join(ROOT, 'assets/fonts');
  return readFileSync(join(dir, 'fonts.css'), 'utf8')
    .replace(/url\((woff2\/[^)]+)\)/g, (_: string, rel: string) =>
      `url(data:font/woff2;base64,${readFileSync(join(dir, rel)).toString('base64')})`);
}

/* ---- deterministic grain tile, so flat fills don't band ---- */
function grainDataUri(seed = 7): string {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const dots = Array.from({ length: 900 }, () =>
    `<rect x="${(rnd() * 240).toFixed(1)}" y="${(rnd() * 240).toFixed(1)}" width="1.5" height="1.5" opacity="${(rnd() * .5 + .15).toFixed(2)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" fill="#fff">${dots}</svg>`;
  return `url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}")`;
}

const FONTS = fontCss();
const TOKENS = readFileSync(join(ROOT, 'tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const SHEET = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
const GRAIN = grainDataUri();

const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8">
<style>${FONTS}</style><style>${TOKENS}</style><style>${SHEET}</style>
<style>${formatCss(FMT)}</style>
<style>html,body{margin:0;background:#000}:root{--grain:${GRAIN}}</style>
</head><body>${body}</body></html>`;

/* ------------------------------------------------------------------ main */
const argv = process.argv.slice(2).filter(a => !a.startsWith('--'));
const styleArg = process.argv.slice(2).find(a => a.startsWith('--style='))?.split('=')[1] ?? null;

const contentPath = resolve(argv[0] ?? join(ROOT, 'src/content.json'));
const baseDir = resolve(argv[1] ?? join(ROOT, 'out'));
// The deck is read straight off disk with no validation, exactly as before. A checked
// parseDeck() would turn a later TypeError into an earlier, clearer one — which is a
// behaviour change, so it belongs to Phase 4, not to the port.
const content = JSON.parse(readFileSync(contentPath, 'utf8')) as Deck;

// Every run lands in its own immutable version folder; `out/<deck>/latest` points at
// the newest one. Nothing is ever overwritten, so decks can be compared side by side.
if (styleArg) {
  for (const s of content.slides) if (s.bg) s.bgStyle = styleArg;
  content.deck = `${content.deck ?? 'deck'}-${styleArg}`;
}

const deckDir = join(baseDir, content.deck ?? 'deck');
mkdirSync(deckDir, { recursive: true });
const prev = readdirSync(deckDir).filter(d => /^v\d{3}$/.test(d)).sort();
const version = `v${String(prev.length ? Number(prev.at(-1)!.slice(1)) + 1 : 1).padStart(3, '0')}`;
const outDir = join(deckDir, version);
const buildDir = join(outDir, '.html');
mkdirSync(buildDir, { recursive: true });

console.log(status());

// --- background stage: resolve every slide that asks for generated art ---
for (const s of content.slides) {
  if (s.bgFile) { process.stdout.write(`  ~ bg supplied for slide\n`); continue; }
  if (!s.bg) continue;
  const file = await background(s.bg, { aspect: FMT.ratio, preset: s.bgStyle, colors: s.bgColors, variant: s.bgVariant ?? 0 });
  if (file) { s.bgFile = file; process.stdout.write(`  ~ bg ready for "${s.bg.slice(0, 46)}…"\n`); }
}

const chrome = await Chrome.launch();
const made = [];
try {
  const slide = await chrome.newPage(W, H);
  const total = content.slides.length;

  for (const [i, raw] of content.slides.entries()) {
    const s = { meta: content.meta, handle: content.handle, ...raw, index: i + 1, total } as RenderSlide;
    const name = `${String(i + 1).padStart(2, '0')}-${s.layout}`;
    const htmlPath = join(buildDir, `${name}.html`);
    writeFileSync(htmlPath, page(renderSlide(s)));
    writeFileSync(join(outDir, `${name}.png`), await chrome.shoot(slide, `file://${htmlPath}`, W, H));
    made.push(name);
    process.stdout.write(`  ✓ ${name}.png\n`);
  }
  await chrome.close(slide);

  // contact sheet of the whole deck
  const cols = 5, thumb = 340, gap = 16;
  const sheetPath = join(buildDir, 'sheet.html');
  writeFileSync(sheetPath, `<!doctype html><html><body style="margin:0;background:#141414;display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:${gap}px;padding:${gap}px;width:max-content">
${made.map(n => `<img src="file://${join(outDir, n)}.png" style="width:${thumb}px;display:block">`).join('\n')}
</body></html>`);
  const sw = cols * thumb + gap * (cols + 1);
  const sh = Math.ceil(made.length / cols) * (thumb * H / W) + gap * (Math.ceil(made.length / cols) + 1);
  const sheetPage = await chrome.newPage(sw, Math.round(sh));
  writeFileSync(join(outDir, 'contact-sheet.png'),
    await chrome.shoot(sheetPage, `file://${sheetPath}`, sw, Math.round(sh)));
  await chrome.close(sheetPage);
} finally {
  chrome.kill();
}

// version manifest: exactly what produced these files
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
  deck: content.deck ?? 'deck',
  version,
  renderedAt: new Date().toISOString(),
  canvas: { width: W, height: H, format: FMT.id, ratio: FMT.ratio },
  slides: made,
  backgroundStage: status(),
  content,
}, null, 2));

// out/<deck>/latest -> newest version
const latest = join(deckDir, 'latest');
try { rmSync(latest, { recursive: true, force: true }); } catch {}
try { symlinkSync(version, latest, 'dir'); } catch {}

console.log(`\n${made.length} slides -> ${outDir}  (${W}x${H})`);
console.log(`latest -> ${latest}`);
