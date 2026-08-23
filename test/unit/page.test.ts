// The HTML shell — the one thing in the render path with no golden coverage.
//
// The 326 HTML goldens all start at `<div class="slide">`: they capture renderSlide's
// output, not the document it is served in. So everything ABOVE that div — five style
// blocks, their ORDER, and therefore the entire cascade — has been protected only by the
// 29 PNG hashes, which skip themselves the moment Chrome or a font moves. That is a gate
// that disarms exactly when you most want it.
//
// This file closes that hole before the product axis reaches slidePage. Two kinds of
// assertion, doing different jobs:
//
//   * The digests catch ANY byte moving, including one nobody thought to name. They are
//     meant to be re-baselined when a change is intended — a failure here is a question,
//     not a verdict.
//   * The ordering assertions say WHY the order is what it is. A digest tells you the
//     shell changed; these tell you that format geometry stopped beating carousel.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { slidePage } from '../../src/page.ts';
import { FONTS, TOKENS, SHEET } from '../../src/assets.ts';
import { FORMATS, formatCss } from '../../src/formats.ts';
import { PRODUCTS } from '../../src/product.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// Deliberately trivial: this file is testing the shell, and a real slide would drown the
// signal in layout bytes that the HTML goldens already cover.
const INNER = '<div class="slide"></div>';

test('the shell is byte-frozen, per format', () => {
  assert.equal(sha(slidePage(INNER, FORMATS.ig)), '3cc92064a060df2b', 'the ig shell moved');
  assert.equal(sha(slidePage(INNER, FORMATS.tiktok)), 'bdc4d3d787c63a43', 'the tiktok shell moved');
  assert.notEqual(sha(slidePage(INNER, FORMATS.ig)), sha(slidePage(INNER, FORMATS.tiktok)),
    'the two formats must not collapse to the same document');
});

test('extraCss is the only tail, and only render.ts uses it', () => {
  // src/render.ts appends `:root{--grain:…}`; the eight tool callers pass nothing. That
  // asymmetry is load-bearing — see the comment at the top of src/page.ts — so the two
  // forms are pinned separately rather than assumed equal.
  const plain = slidePage(INNER, FORMATS.ig);
  const grained = slidePage(INNER, FORMATS.ig, PRODUCTS.cast, ':root{--grain:GRAIN}');
  assert.notEqual(sha(plain), sha(grained));
  assert.equal(grained.replace(':root{--grain:GRAIN}', ''), plain,
    'extraCss is appended, not interleaved — removing it must yield the plain shell exactly');
});

test('the cascade order is the contract, not an accident', () => {
  const html = slidePage(INNER, FORMATS.tiktok);
  const at = (needle: string, what: string) => {
    const i = html.indexOf(needle);
    assert.notEqual(i, -1, `${what} is missing from the shell`);
    return i;
  };

  const fonts = at(FONTS.slice(0, 60), 'fonts.css');
  const tokens = at(TOKENS.slice(0, 60), 'tokens.css');
  const sheet = at(SHEET.slice(0, 60), 'carousel.css');
  const format = at(formatCss(FORMATS.tiktok).slice(0, 60), 'the format block');
  const reset = at('html,body{margin:0;background:#000}', 'the reset');

  // @font-face before the custom properties that name the families.
  assert.ok(fonts < tokens, 'fonts must precede tokens');
  // Tokens before the stylesheet that reads them via var().
  assert.ok(tokens < sheet, 'tokens must precede carousel.css');
  // The one that bites: carousel.css sets slide geometry at the 4:5 baseline, and the
  // format block overrides it for 9:16. Equal specificity, so the LATER one wins — put
  // the format first and every TikTok render silently comes out at Instagram metrics.
  assert.ok(sheet < format, 'carousel.css must precede the format block, or format geometry loses');
  assert.ok(format < reset, 'the reset closes the head');

  assert.ok(html.startsWith('<!doctype html>'), 'no leading whitespace — quirks mode would change layout');
  assert.ok(html.includes('<meta charset="utf-8">'), 'the wordmark and copy carry non-ASCII');
  assert.equal(html.match(/<style>/g)?.length, 5, 'five style blocks, one per concern');
});

test('the shell carries no absolute paths — a rendered page must not depend on this machine', () => {
  const html = slidePage(INNER, FORMATS.ig);
  assert.ok(!html.includes('/Users/'), 'a home directory leaked into the document');
  // Fonts are inlined as data: URIs precisely so Chrome never fetches anything.
  assert.ok(!/url\(\s*['"]?woff2\//.test(html), 'a woff2 survived un-inlined');
  assert.ok(html.includes('data:font/woff2;base64,'), 'the fonts are not inlined at all');
});
