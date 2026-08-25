// UGC slideshow renderer — the SOMA stealth-marketing format, not the editorial carousel.
//
//   node tools/ugc.ts <deck.json> [outDir] [--pool <id>]
//
// --pool swaps the CHARACTER without touching a deck. Every `../avatar/<name>.jpg` in a
// deck is a SLOT — "the gym hook", "the plate of eggs" — and a pool is one person's
// answer to those slots: products/soma/ugc/pools/<id>/pool.json maps slot -> her file.
// Without the flag the decks render against products/soma/avatar/ as authored.
//
// A different animal from src/render.ts on purpose: no product chrome (no wordmark, no
// pagination), no layout system — TikTok-native "text over a phone photo" slides, built
// to the brand's own corrected example ("You're not buying a new body.", slides 6+):
//
//   * photo slide   full-bleed photo, dimmed, white DM Sans centered in the safe box,
//                   navy chevron bottom-right. NO logo — hook slides stay native.
//   * cta slide     white-washed photo, navy heading + left-set paragraph, the real app
//                   screenshot in a CSS phone frame, App Store badge + app icon.
//
// The safe box (108..894 x, 305..1617 y on a 1080x1920 canvas) is measured from the
// brand's SAFE SPACE template, right side wider for TikTok's action rail.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';
import { background } from '../src/bgen.ts';
import { PRODUCTS } from '../src/product.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1080, H = 1920;

const NAVY = '#2a1f6d';
const DM = join(ROOT, 'products/soma/fonts/dm/dm-sans.css');

/** One of three image sources:
 *  photo — a real file;
 *  bg    — a subject line the SOMA art pipeline paints (style `refs` steer the look);
 *  gen   — a persona shot: the scene is generated WITH the avatar, `identity` photos
 *          pinning her face/hair/build so the character stays consistent. */
type PhotoSlide = {
  kind: 'photo'; photo?: string; bg?: string; refs?: string[];
  gen?: string; identity?: string[];
  text: string; dim?: number; align?: 'center' | 'low'; chevron?: boolean;
};
type CtaSlide = {
  kind: 'cta'; photo: string; heading: string; body: string;
  screenshot: string; badge: string; appIcon: string; wash?: number;
};
type UgcDeck = { deck: string; caption?: string; slides: Array<PhotoSlide | CtaSlide> };

const abs = (p: string, base: string): string => (isAbsolute(p) ? p : resolve(base, p));

/* ------------------------------------------------------------------ pools */

/** A pool answers the deck's avatar SLOTS with one person's photos.
 *  `pools/<id>/pool.json` is `{ "<slot file name>": "<file in this pool>" }`. */
type Pool = { id: string; dir: string; slots: Record<string, string> };

const POOLS = join(ROOT, 'products/soma/ugc/pools');
/** A deck path is a slot when it points into the authored avatar folder. */
const SLOT_RE = /(^|\/)avatar\/([^/]+)$/;

function loadPool(id: string): Pool {
  const dir = join(POOLS, id);
  const file = join(dir, 'pool.json');
  if (!existsSync(file)) {
    throw new Error(`no pool "${id}" — expected ${file}. Run: node tools/ugc-pool.ts --new ${id}`);
  }
  return { id, dir, slots: JSON.parse(readFileSync(file, 'utf8')) as Record<string, string> };
}

/** Slots this pool cannot answer, so one render reports every gap instead of the first. */
function poolGaps(deck: UgcDeck, pool: Pool): string[] {
  const missing = new Set<string>();
  for (const s of deck.slides) {
    const slot = s.photo?.match(SLOT_RE)?.[2];
    if (!slot) continue;
    const mapped = pool.slots[slot];
    if (!mapped) missing.add(`${slot} — unmapped`);
    else if (!existsSync(join(pool.dir, mapped))) missing.add(`${slot} -> ${mapped} — file not in pool`);
  }
  return [...missing];
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Blank-line separated paragraphs; single newlines are hard breaks. */
const paras = (text: string, cls: string): string => text.trim().split(/\n\s*\n/)
  .map(p => `<p class="${cls}">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

const CHEVRON = `<div class="chev"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="#FFFFE8" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

const SHELL = (body: string): string => `<!doctype html><meta charset="utf-8">
<style>
@import url("file://${DM}");
* { margin: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { font-family: "DM Sans", -apple-system, sans-serif; position: relative; background: #000; }
.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.veil { position: absolute; inset: 0; }
/* the measured SAFE SPACE box */
.safe { position: absolute; left: 108px; right: 186px; top: 305px; bottom: 303px;
        display: flex; flex-direction: column; }
.safe--center { justify-content: center; }
.safe--low { justify-content: flex-end; padding-bottom: 90px; }
.t { color: #fff; font-size: 64px; font-weight: 500; line-height: 1.32; text-align: center;
     text-wrap: balance; letter-spacing: .2px;
     text-shadow: 0 2px 28px rgba(0,0,0,.55), 0 0 3px rgba(0,0,0,.35); }
.t + .t { margin-top: 56px; }
.chev { position: absolute; right: 62px; bottom: 122px; width: 92px; height: 92px;
        border-radius: 50%; background: ${NAVY}; display: flex; align-items: center; justify-content: center; }
.chev svg { width: 44px; height: 44px; margin-left: 4px; }
/* --- cta. The safe box is ignored here on purpose: the example composes the whole
   canvas — heading up top, phone centre-right, badge and icon running to the bottom. --- */
.cta { position: absolute; inset: 0; }
.cta-head { position: absolute; left: 90px; right: 90px; top: 200px;
            color: ${NAVY}; font-size: 82px; font-weight: 700; line-height: 1.22; text-align: center; text-wrap: balance; }
.cta-body { position: absolute; left: 96px; top: 620px; width: 400px;
            color: ${NAVY}; font-size: 44px; font-weight: 500; line-height: 1.42; }
.phone { position: absolute; left: 500px; top: 480px; width: 470px;
         border-radius: 66px; border: 13px solid #8f8ac2; box-shadow: 0 40px 90px rgba(20,12,60,.28);
         overflow: hidden; background: #fff; }
.phone img { width: 100%; display: block; }
.cta-foot { position: absolute; left: 0; right: 0; bottom: 96px;
            display: flex; flex-direction: column; align-items: center; gap: 36px; }
.badge { height: 104px; }
.appicon { width: 122px; height: 122px; border-radius: 28px; box-shadow: 0 18px 40px rgba(20,12,60,.25); }
</style>
${body}`;

function photoSlide(s: PhotoSlide, photoPath: string): string {
  const dim = s.dim ?? 0.45;
  return SHELL(`
<img class="bg" src="file://${photoPath}">
<span class="veil" style="background:rgba(14,14,16,${dim})"></span>
<div class="safe safe--${s.align ?? 'center'}">${paras(s.text, 't')}</div>
${s.chevron === false ? '' : CHEVRON}`);
}

/** A deck path, redirected through the active pool when it names an avatar slot. */
function photoPath(p: string, base: string, pool: Pool | null): string {
  const slot = pool && p.match(SLOT_RE)?.[2];
  return slot && pool.slots[slot] ? join(pool.dir, pool.slots[slot]) : abs(p, base);
}

/** Resolve a photo slide's image: a supplied file, or a generated one. */
async function photoFor(s: PhotoSlide, base: string, pool: Pool | null): Promise<string> {
  if (s.photo) return photoPath(s.photo, base, pool);
  if (!s.bg) throw new Error('photo slide needs "photo" or "bg"');
  const file = await background(s.bg, {
    aspect: '9:16',
    refPaths: s.refs?.map(r => abs(r, base)) ?? null,
    product: PRODUCTS.soma,
  });
  if (!file) throw new Error(`background generation failed for "${s.bg.slice(0, 60)}…"`);
  console.log(`  ~ bg generated for "${s.bg.slice(0, 46)}…"`);
  return file;
}

function ctaSlide(s: CtaSlide, base: string, pool: Pool | null): string {
  return SHELL(`
<img class="bg" src="file://${photoPath(s.photo, base, pool)}">
<span class="veil" style="background:rgba(255,255,255,${s.wash ?? 0.62})"></span>
<div class="cta">
  <h1 class="cta-head">${esc(s.heading)}</h1>
  <div class="cta-body">${esc(s.body)}</div>
  <div class="phone"><img src="file://${abs(s.screenshot, base)}"></div>
</div>
<div class="cta-foot">
  <img class="badge" src="file://${abs(s.badge, base)}">
  <img class="appicon" src="file://${abs(s.appIcon, base)}">
</div>`);
}

/* ------------------------------------------------------------------ main */
const argv = process.argv.slice(2);
const poolFlag = argv.indexOf('--pool');
const poolId = poolFlag === -1 ? null : argv[poolFlag + 1];
if (poolFlag !== -1) argv.splice(poolFlag, 2);
const [deckPath, outArg] = argv;
if (!deckPath) {
  console.error('usage: node tools/ugc.ts <deck.json> [outDir] [--pool <id>]');
  process.exit(1);
}

const deckFile = resolve(deckPath);
const base = dirname(deckFile);
const deck = JSON.parse(readFileSync(deckFile, 'utf8')) as UgcDeck;

const pool = poolId ? loadPool(poolId) : null;
if (pool) {
  const gaps = poolGaps(deck, pool);
  if (gaps.length) {
    console.error(`pool "${pool.id}" cannot render ${deck.deck} — ${gaps.length} slot(s) open:`);
    for (const g of gaps) console.error(`  ${g}`);
    console.error(`\nFill them in ${join(pool.dir, 'pool.json')}, then re-run.`);
    process.exit(2);
  }
}

const outDir = resolve(outArg ?? join(ROOT, 'out/ugc', pool ? `${pool.id}-${deck.deck}` : deck.deck));
const buildDir = join(outDir, '.html');
mkdirSync(buildDir, { recursive: true });

const chrome = await Chrome.launch();
try {
  for (const [i, s] of deck.slides.entries()) {
    const name = `${String(i + 1).padStart(2, '0')}-${s.kind}`;
    const html = s.kind === 'photo'
      ? photoSlide(s, await photoFor(s, base, pool))
      : ctaSlide(s, base, pool);
    const htmlPath = join(buildDir, `${name}.html`);
    writeFileSync(htmlPath, html);
    writeFileSync(join(outDir, `${name}.png`), await chrome.shootPooled(`file://${htmlPath}`, W, H));
    console.log(`  ✓ ${name}.png`);
  }
} finally {
  chrome.kill();
}

// The caption is authored WITH the deck, so it lives in the deck and is written out
// beside the slides — a post folder is then the whole thing, ready to upload.
if (deck.caption) writeFileSync(join(outDir, 'caption.txt'), `${deck.caption.trim()}\n`);
else console.warn('  ! no "caption" in the deck — the post is not publishable yet');

console.log(`\n${deck.slides.length} slides -> ${outDir}  (${W}x${H})`);
