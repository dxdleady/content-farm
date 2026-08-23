// The image cache is the repo's economics: identical inputs must mean an identical
// filename, or every re-render re-buys generations at $0.01–$0.10 each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { cachePath, CACHE_DIR } from '../../src/cache.ts';

const refBytes = Buffer.from('a reference image');
const base = { model: 'gpt-image-2', prompt: 'P', refBytes } as const;

test('the key is stable for identical inputs', () => {
  assert.equal(cachePath({ ...base, ratio: '4:5' }), cachePath({ ...base, ratio: '4:5' }));
});

test('4:5 reproduces the pre-format-axis filename exactly', () => {
  // Every Instagram image already on disk was keyed before formats existed. If 4:5 ever
  // starts contributing to the hash, all of them miss and get re-bought.
  const legacy = 'pack-' + createHash('sha256')
    .update(`${base.model}|${base.prompt}`).update(refBytes).digest('hex').slice(0, 16) + '.png';
  assert.equal(basename(cachePath({ ...base, ratio: '4:5' })), legacy);
});

test('a different ratio is a different image, not a crop', () => {
  assert.notEqual(cachePath({ ...base, ratio: '4:5' }), cachePath({ ...base, ratio: '9:16' }));
});

test('model, prompt and reference bytes all participate', () => {
  const k = cachePath({ ...base, ratio: '4:5' });
  assert.notEqual(k, cachePath({ ...base, ratio: '4:5', model: 'qwen-edit' }), 'model ignored');
  assert.notEqual(k, cachePath({ ...base, ratio: '4:5', prompt: 'P ' }), 'prompt ignored');
  assert.notEqual(k, cachePath({ ...base, ratio: '4:5', refBytes: Buffer.from('other') }), 'ref ignored');
});

test('keys land in assets/generated', () => {
  assert.ok(cachePath({ ...base, ratio: '4:5' }).startsWith(CACHE_DIR));
  assert.match(basename(cachePath({ ...base, ratio: '4:5' })), /^pack-[0-9a-f]{16}\.png$/);
});
