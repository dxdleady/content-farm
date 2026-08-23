// FROZEN COPIES of the two page wrappers, transcribed byte-for-byte from the sources.
//
// These are deliberately NOT imported. Both live as module-scope consts inside scripts
// with top-level await, so importing either would execute a render. More importantly, a
// frozen copy is what makes the Phase 4 dedup provable: the acceptance test for extracting
// a shared page() is "it returns a string strictly equal to what this file returns".
//
// The two wrappers are NOT the same, and that difference is the whole reason both are
// here: src/render.mjs:39 appends `:root{--grain:…}`, and the seven tool copies do not.
// A naive "extract the common wrapper" would hand grain texture to seven tools that do
// not have it today. That regression is only visible on a slide with `minimal: false`,
// which is why the PNG corpus captures one through each wrapper.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatCss } from './sut.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ---- verbatim from src/render.mjs:15-20 ---- */
function fontCss() {
  const dir = join(ROOT, 'assets/fonts');
  return readFileSync(join(dir, 'fonts.css'), 'utf8')
    .replace(/url\((woff2\/[^)]+)\)/g, (_, rel) =>
      `url(data:font/woff2;base64,${readFileSync(join(dir, rel)).toString('base64')})`);
}

/* ---- verbatim from src/render.mjs:23-30 ---- */
function grainDataUri(seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const dots = Array.from({ length: 900 }, () =>
    `<rect x="${(rnd() * 240).toFixed(1)}" y="${(rnd() * 240).toFixed(1)}" width="1.5" height="1.5" opacity="${(rnd() * .5 + .15).toFixed(2)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" fill="#fff">${dots}</svg>`;
  return `url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}")`;
}

const FONTS = fontCss();
// The one sanctioned edit to this file during the product move: tokens.css changed
// address. Byte-neutral because the @import line it carries is stripped whole — newline
// included — by the same regex here and in src/assets.ts, so the ../ depth inside it
// never reaches a rendered page.
const TOKENS = readFileSync(join(ROOT, 'products/cast/tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const SHEET = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
export const GRAIN = grainDataUri();

type Format = { id: string; w: number; h: number };

/** src/render.mjs:39-43 — the only wrapper that defines --grain. */
export const renderPage = (body: string, fmt: Format): string =>
  `<!doctype html><html><head><meta charset="utf-8">
<style>${FONTS}</style><style>${TOKENS}</style><style>${SHEET}</style>
<style>${formatCss(fmt as never)}</style>
<style>html,body{margin:0;background:#000}:root{--grain:${GRAIN}}</style>
</head><body>${body}</body></html>`;

/** tools/compose.ts:143 — the shape shared by feed, fx, ref-slides and rubric-sets. */
export const composePage = (inner: string, fmt: Format): string =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style><style>${TOKENS}</style><style>${SHEET}</style><style>${formatCss(fmt as never)}</style><style>html,body{margin:0;background:#000}</style></head><body>${inner}</body></html>`;

/** Fingerprint inputs: a change to any of these legitimately moves every pixel. */
export const assetHashInputs = () => ({
  fonts: FONTS,
  css: TOKENS + SHEET,
});
