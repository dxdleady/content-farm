// Tier 3 — pixels. Catches what Tier 2 structurally cannot: carousel.css, fonts, wrapping,
// overflow, and every layout decision Chrome makes.
//
// Byte-identity is a SAME-MACHINE gate. Chrome version, font hinting and the software
// rasteriser all move bytes, so a fingerprint mismatch SKIPS with a re-baseline hint
// rather than failing. Pretending this tier is portable is what gets it deleted after the
// third false red.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pngCases } from '../helpers/png-cases.ts';
import { shootAll, hashPng, fingerprint, fingerprintDrift, pageFor, type Fingerprint } from '../helpers/shoot.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = join(ROOT, 'test/golden/png/manifest.json');
const WORK = join(ROOT, 'out/test-png');
const FAILURES = join(ROOT, 'out/test-failures');

type Manifest = { env: Fingerprint; cases: Record<string, string> };

const cases = pngCases();
let golden: Manifest | null = null;
let drift: string[] = [];
let shots = new Map<string, Buffer>();

before(async () => {
  if (!existsSync(MANIFEST)) return;
  golden = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  drift = fingerprintDrift(golden!.env, fingerprint());
  if (drift.length) return;   // don't spend 20s of Chrome on a comparison we won't make

  mkdirSync(WORK, { recursive: true });
  shots = await shootAll(cases, (id, html) => {
    const p = join(WORK, `${id}.html`);
    writeFileSync(p, html);
    return p;
  });
  rmSync(WORK, { recursive: true, force: true });
});

test('a golden manifest exists', () => {
  assert.ok(golden, 'no manifest — run `npm run goldens:capture:png` first');
});

test('every case renders to its golden hash', (t) => {
  if (!golden) return;
  if (drift.length) {
    t.skip(`goldens were captured on a different environment, so byte-comparison is not `
      + `meaningful here:\n    ${drift.join('\n    ')}\n  `
      + `Re-baseline with: npm run goldens:capture:png`);
    return;
  }

  assert.deepEqual(Object.keys(golden.cases).sort(), cases.map(c => c.id).sort(),
    'the PNG case list changed — re-capture');

  const differing: string[] = [];
  for (const c of cases) {
    const actual = hashPng(shots.get(c.id)!);
    if (actual === golden.cases[c.id]) continue;
    differing.push(c.id);

    // Hashes are committed, PNGs are not — so on failure write the image out where it can
    // actually be looked at. out/ is gitignored.
    mkdirSync(FAILURES, { recursive: true });
    writeFileSync(join(FAILURES, `${c.id}.actual.png`), shots.get(c.id)!);
  }

  assert.deepEqual(differing, [],
    `${differing.length} of ${cases.length} case(s) differ.\n`
    + `  Actual images written to out/test-failures/ — compare them by eye before deciding.\n`
    + `  If the change is deliberate: npm run goldens:capture:png`);
});

test('the grain tripwire is armed', () => {
  if (!golden) return;
  // src/render.mjs's page wrapper defines --grain; the seven tool copies do not, so the
  // same non-minimal slide MUST rasterise differently through each. If these two hashes
  // ever match, a Phase 4 "extract the common page()" could hand grain texture to seven
  // tools with this whole tier still green.
  const a = golden.cases['wrapper--grain--render'];
  const b = golden.cases['wrapper--grain--compose'];
  assert.ok(a && b, 'the wrapper tripwire cases are missing from the manifest');
  assert.notEqual(a, b,
    'the two page wrappers now produce identical pixels — the dedup tripwire is disarmed');
});

test('the two page wrappers differ as strings, and only in the grain declaration', () => {
  // The cheap, deterministic half of the same guard: no Chrome, runs even when the pixel
  // tier skips. This is also the literal acceptance test for Phase 4's shared page():
  // it must return a string strictly equal to the frozen copy for its caller.
  const c = cases.find(x => x.id === 'wrapper--grain--render')!;
  const rendered = pageFor(c);
  const composed = pageFor(cases.find(x => x.id === 'wrapper--grain--compose')!);

  assert.notEqual(rendered, composed, 'the wrappers are supposed to differ');
  assert.match(rendered, /:root\{--grain:url\("data:image\/svg\+xml;base64,/,
    'render.mjs\'s wrapper defines --grain');
  assert.doesNotMatch(composed, /--grain:/,
    'the tool wrapper does not — extracting a "common" wrapper would change 7 tools');
});
