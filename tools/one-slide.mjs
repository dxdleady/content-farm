#!/usr/bin/env node
// Render a single slide by layout name — fast loop for design work, no generation.
//   node tools/one-slide.mjs <deck.json> <layout> [out.png]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { renderSlide } from '../src/layouts.mjs';
import { Chrome } from '../src/chrome.mjs';
import { resolveFormat, formatCss } from '../src/formats.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [deckPath, layout, outPath = join(ROOT, 'out/preview.png')] = process.argv.slice(2);
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));
// the deck already records what it was composed for — preview it in the same canvas
const FMT = resolveFormat(deck.format?.id);
const W = FMT.w, H = FMT.h;
const i = deck.slides.findIndex(s => s.layout === layout);
if (i < 0) throw new Error(`no slide with layout "${layout}"`);

const fonts = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8')
  .replace(/url\((woff2\/[^)]+)\)/g, (_, r) =>
    `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'assets/fonts', r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT, 'tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const sheet = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');

const s = { handle: deck.handle, ...deck.slides[i], index: i + 1, total: deck.slides.length };
const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${fonts}</style><style>${tokens}</style><style>${sheet}</style>
<style>${formatCss(FMT)}</style>
<style>html,body{margin:0;background:#000}</style></head><body>${renderSlide(s)}</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'oneslide-'));
const p = join(dir, 'slide.html');
writeFileSync(p, html);
const chrome = await Chrome.launch();
try {
  const page = await chrome.newPage(W, H);
  writeFileSync(outPath, await chrome.shoot(page, `file://${p}`, W, H));
} finally { chrome.kill(); }
console.log(outPath);
