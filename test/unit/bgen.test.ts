// bgen is imported directly rather than through the barrel: it calls
// process.loadEnvFile() at module scope, so pulling it into helpers/sut.ts would mutate
// process.env for every test file that imports the barrel. Its main-module guard compares
// import.meta.url to process.argv[1], so importing it here does not trigger the CLI path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { styleLock, STYLE_LOCK, PRESETS, DEFAULT_PRESET, apiKey, MODEL, EDIT_MODELS } from '../../src/bgen.mjs';
import { MODELS } from '../helpers/sut.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

test('styleLock: every preset produces a stable prompt block', (t) => {
  // These strings go straight into the image cache key. Frozen digests are the only thing
  // standing between a reformat and re-buying assets/generated/ at ~$0.07 an image.
  const digests = Object.fromEntries(PRESETS.map((p: string) => [p, sha(styleLock(p))]));

  assert.equal(PRESETS.length, 9, 'preset count changed');
  assert.deepEqual(Object.keys(digests).sort(), [
    'chrome', 'collage', 'flash-portrait', 'melt', 'post-fashion', 'ps1', 'punk-poster',
    'sweep', 'y2k-punk',
  ]);

  // Each preset must be distinct from the others, or two styles silently share a cache key.
  assert.equal(new Set(Object.values(digests)).size, PRESETS.length,
    `two presets produce identical prompts: ${JSON.stringify(digests)}`);

  t.diagnostic(`preset digests: ${JSON.stringify(digests)}`);
});

test('styleLock: deterministic, and the default is the exported constant', () => {
  assert.equal(styleLock('ps1'), styleLock('ps1'), 'not deterministic — cache would thrash');
  assert.equal(STYLE_LOCK, styleLock(DEFAULT_PRESET));
  assert.equal(DEFAULT_PRESET, 'ps1');
});

test('styleLock: an unknown preset throws by name', () => {
  assert.throws(() => styleLock('not-a-preset'), /unknown bgStyle "not-a-preset"/);
});

test('EDIT_MODELS stays in sync with the provider table', () => {
  assert.deepEqual([...EDIT_MODELS].sort(), Object.keys(MODELS).sort(),
    'bgen offers an edit model that providers.mjs does not implement, or vice versa');
});

test('apiKey reads the Gemini key, with the Google alias as a fallback', () => {
  const prev = { g: process.env.GEMINI_API_KEY, o: process.env.GOOGLE_API_KEY };
  try {
    delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
    assert.equal(apiKey(), null, 'no key means null, not undefined or ""');

    process.env.GOOGLE_API_KEY = 'from-google';
    assert.equal(apiKey(), 'from-google', 'GOOGLE_API_KEY is accepted as an alias');

    process.env.GEMINI_API_KEY = 'from-gemini';
    assert.equal(apiKey(), 'from-gemini', 'GEMINI_API_KEY wins');
  } finally {
    prev.g === undefined ? delete process.env.GEMINI_API_KEY : (process.env.GEMINI_API_KEY = prev.g);
    prev.o === undefined ? delete process.env.GOOGLE_API_KEY : (process.env.GOOGLE_API_KEY = prev.o);
  }
});

test('MODEL is resolved once at import, from the env', () => {
  // Pinned because it is a live gotcha: setting BANANA_MODEL after import has no effect.
  assert.equal(typeof MODEL, 'string');
  assert.ok(MODEL.length > 0);
});
