import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FORMATS, DEFAULT_FORMAT, resolveFormat, formatFromArgv, formatCss, formatTag } from '../helpers/sut.ts';

test('resolveFormat: ids, aliases, default', () => {
  assert.equal(resolveFormat('ig').id, 'ig');
  assert.equal(resolveFormat('tiktok').id, 'tiktok');
  assert.equal(resolveFormat('TikTok').id, 'tiktok', 'lookup is case-insensitive');
  assert.equal(resolveFormat(undefined).id, DEFAULT_FORMAT);
  assert.equal(resolveFormat(null as never).id, DEFAULT_FORMAT);
  assert.equal(resolveFormat('').id, DEFAULT_FORMAT, 'empty string falls back, not throws');

  for (const [alias, id] of [['instagram', 'ig'], ['insta', 'ig'], ['4:5', 'ig'],
                             ['tt', 'tiktok'], ['9:16', 'tiktok']] as const) {
    assert.equal(resolveFormat(alias).id, id, `alias ${alias}`);
  }
});

test('resolveFormat: a typo throws with the valid ids listed', () => {
  assert.throws(() => resolveFormat('instagrm'),
    { message: 'unknown format "instagrm" — have: ig, tiktok' });
});

test('formatFromArgv reads --format, then $FORMAT, then the default', () => {
  assert.equal(formatFromArgv(['node', 'x', '--format', 'tiktok']).id, 'tiktok');
  assert.equal(formatFromArgv(['node', 'x']).id, DEFAULT_FORMAT);

  const prev = process.env.FORMAT;
  try {
    process.env.FORMAT = 'tiktok';
    assert.equal(formatFromArgv(['node', 'x']).id, 'tiktok', '$FORMAT is the fallback');
    assert.equal(formatFromArgv(['node', 'x', '--format', 'ig']).id, 'ig', '--format wins over $FORMAT');
  } finally {
    if (prev === undefined) delete process.env.FORMAT; else process.env.FORMAT = prev;
  }
  // The typo path is deliberately untested here: formatFromArgv calls process.exit(1),
  // which would kill the test runner. resolveFormat above covers the same logic.
});

// formatCss is injected verbatim into the <head> of every rendered page, so its exact
// text is load-bearing: a changed :root block silently reflows every slide. Frozen.
test('formatCss: exact output', () => {
  assert.equal(formatCss(FORMATS.ig),
    ':root{--slide-w:1080px;--slide-h:1350px;--safe-t:0px;--safe-r:0px;--safe-b:0px;}');
  assert.equal(formatCss(FORMATS.tiktok),
    ':root{--slide-w:1080px;--slide-h:1920px;--safe-t:110px;--safe-r:120px;--safe-b:400px;'
    + '--stack-mb:auto;--t-claim:150px;--t-figure:620px;--feat-row:215px;'
    + '--band-top:8%;--band-bot:62%;'
    + '--scrim-far-dark:rgba(10,10,10,.34);--scrim-far-light:rgba(238,235,234,.30);'
    + '--scrim-ink-light:rgba(238,235,234,.66);}');
});

test('formatCss: every Instagram override is an exact no-op', () => {
  // The whole byte-identity guarantee rests on this. If ig ever gains a var beyond the
  // canvas and the three zeroed safe-areas, Instagram output can move.
  const ig = formatCss(FORMATS.ig).replace(/^:root\{|\}$/g, '');
  const declared = ig.split(';').filter(Boolean).map(d => d.split(':')[0]);
  assert.deepEqual(declared, ['--slide-w', '--slide-h', '--safe-t', '--safe-r', '--safe-b']);
  assert.match(ig, /--safe-t:0px;--safe-r:0px;--safe-b:0px/);
});

test('formatTag: the default format stays unsuffixed', () => {
  assert.equal(formatTag(FORMATS.ig), '', 'ig was here first — its paths must not move');
  assert.equal(formatTag(FORMATS.tiktok), '-tiktok');
});

test('format geometry', () => {
  assert.equal(FORMATS.ig.w, 1080);
  assert.equal(FORMATS.ig.h, 1350);
  assert.equal(FORMATS.ig.ratio, '4:5');
  assert.equal(FORMATS.ig.framing, null, 'ig adds no framing clause to art prompts');

  assert.equal(FORMATS.tiktok.w, 1080);
  assert.equal(FORMATS.tiktok.h, 1920);
  assert.equal(FORMATS.tiktok.ratio, '9:16');
  assert.ok(FORMATS.tiktok.framing?.startsWith('FRAMING:'));

  for (const f of Object.values(FORMATS)) {
    assert.equal(f.w, 1080, `${f.id}: every format is 1080 wide — the shared type scale depends on it`);
  }
});

// ---------------------------------------------- one picture, however many formats
//
// The bug this pins: art used to be generated per FORMAT, at that format's ratio and with
// that format's framing line. So the same post cross-posted to Instagram and TikTok
// showed two different pictures from two different prompts — the same post in name only —
// and cost two generations. `.art-full` is object-fit:cover, so a frame crops whatever it
// is handed; the fix is to generate once at the tallest ratio and let the shorter frames
// crop down. Tall→wide keeps the middle; wide→tall would crop the SIDES and lose about a
// third of the picture's width, which is where compositions put their subject.
test('artRatio picks the tallest, so every shorter frame crops rather than regenerates', async () => {
  const { artRatio, artFraming, FORMATS } = await import('../../src/formats.ts');

  assert.equal(artRatio([FORMATS.ig]), '4:5', 'a lone Instagram run is unchanged — its cache still hits');
  assert.equal(artRatio([FORMATS.tiktok]), '9:16');
  assert.equal(artRatio([FORMATS.ig, FORMATS.tiktok]), '9:16');
  assert.equal(artRatio([FORMATS.tiktok, FORMATS.ig]), '9:16', 'order must not matter');

  assert.equal(artFraming([FORMATS.ig]), null, 'the 4:5 skeletons need no extra framing line');
  assert.equal(artFraming([FORMATS.ig, FORMATS.tiktok]), FORMATS.tiktok.framing,
    'a cross-post is framed for the ratio it is GENERATED at, not the one being rendered');
});

test('the framing line survives being cropped, because that is now how the other format is served', async () => {
  const { FORMATS } = await import('../../src/formats.ts');
  const f = FORMATS.tiktok.framing!;
  // It used to say "the subject sits in the upper two thirds" — correct for a picture that
  // only ever appeared at 9:16, and fatal once the same picture also has to be a 4:5 crop,
  // which keeps the middle ~70% of the height and discards the upper third entirely.
  assert.ok(!/upper two thirds/.test(f), 'a subject in the upper third is cropped away at 4:5');
  assert.ok(/centred in the middle band/.test(f), 'the subject must live where every crop overlaps');
  assert.ok(/cropped away at other aspect ratios/.test(f), 'the model is told why, not just what');
});

test('two formats sharing an art ratio share the cache entry — one image, one payment', async () => {
  const { artRatio, FORMATS } = await import('../../src/formats.ts');
  const { cachePath } = await import('../../src/cache.ts');

  const shared = { model: 'gpt-image-2', prompt: 'a prompt', refBytes: Buffer.from('ref') };
  const ratio = artRatio([FORMATS.ig, FORMATS.tiktok]);

  // What compose computes for each of the two runs. Identical inputs, identical file.
  assert.equal(cachePath({ ...shared, ratio }), cachePath({ ...shared, ratio }));

  // …and the old behaviour, for contrast: keyed on the RENDER format, they diverged.
  assert.notEqual(cachePath({ ...shared, ratio: FORMATS.ig.ratio }),
    cachePath({ ...shared, ratio: FORMATS.tiktok.ratio }),
    'this divergence is exactly what made a cross-post two different pictures');
});
