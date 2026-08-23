#!/usr/bin/env node
// Render a single slide by layout name — fast loop for design work, no generation.
//   node tools/one-slide.mjs <deck.json> <layout> [out.png]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { rendererFor } from '../src/layouts.ts';
import { Chrome } from '../src/chrome.ts';
import { resolveFormat, formatCss } from '../src/formats.ts';
import type { Deck, RenderSlide } from '../src/types.ts';
import { slidePage } from '../src/page.ts';
import { resolveProduct } from '../src/product.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [deckPath, layout, outPath = join(ROOT, 'out/preview.png')] = process.argv.slice(2);
if (!deckPath || !layout) throw new Error('usage: node tools/one-slide.ts <deck.json> <layout> [out.png]');
const deck = JSON.parse(readFileSync(deckPath, 'utf8')) as Deck;
// the deck already records what it was composed for — preview it in the same canvas,
// and in the same brand. A deck written before the product axis has no `product` field;
// resolveProduct treats that the same as absent and hands back the default, which is
// correct, because every such deck is (cast).
const FMT = resolveFormat(deck.format?.id);
const P = resolveProduct(deck.product);
const { renderSlide } = rendererFor(P);
const W = FMT.w, H = FMT.h;
const i = deck.slides.findIndex((s) => s.layout === layout);
if (i < 0) throw new Error(`no slide with layout "${layout}"`);

const s = { handle: deck.handle, ...deck.slides[i], index: i + 1, total: deck.slides.length } as RenderSlide;
const html = slidePage(renderSlide(s), FMT, P);

const dir = mkdtempSync(join(tmpdir(), 'oneslide-'));
const p = join(dir, 'slide.html');
writeFileSync(p, html);
const chrome = await Chrome.launch();
try {
  const page = await chrome.newPage(W, H);
  writeFileSync(outPath, await chrome.shoot(page, `file://${p}`, W, H));
} finally { chrome.kill(); }
console.log(outPath);
