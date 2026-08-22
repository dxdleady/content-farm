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
    + '--band-top:20%;--band-bot:80%;}');
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
