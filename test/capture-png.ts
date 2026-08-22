#!/usr/bin/env node
// Capture the PNG golden manifest from whatever the renderer currently is.
//
// Hashes are committed, PNGs are not: ~35 slides at 1080×1350/1920 is ~12MB, and every
// re-baseline would compound it. On a failure the test writes both images to
// out/test-failures/ (already gitignored) so you can still look at them.
//
//   node test/capture-png.ts
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pngCases } from './helpers/png-cases.ts';
import { shootAll, hashPng, fingerprint } from './helpers/shoot.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'test/golden/png/manifest.json');
const WORK = join(ROOT, 'out/test-capture');

mkdirSync(dirname(MANIFEST), { recursive: true });
mkdirSync(WORK, { recursive: true });

const cases = pngCases();
console.log(`capturing ${cases.length} PNG goldens…`);

const shots = await shootAll(
  cases,
  (id, html) => { const p = join(WORK, `${id}.html`); writeFileSync(p, html); return p; },
  (id, i, ms) => console.log(`  ${String(i + 1).padStart(2)}/${cases.length} ${id} (${ms}ms)`),
);

const manifest = {
  $note: 'Byte-identity is a SAME-MACHINE gate. A fingerprint mismatch skips the tier '
    + 'with a re-baseline hint rather than failing — see test/png/golden.test.ts.',
  env: fingerprint(),
  cases: Object.fromEntries([...shots].map(([id, buf]) => [id, hashPng(buf)])),
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
rmSync(WORK, { recursive: true, force: true });

console.log(`wrote ${Object.keys(manifest.cases).length} hashes -> test/golden/png/manifest.json`);
console.log(`  ${manifest.env.chrome} · node ${manifest.env.node} · ${manifest.env.platform}`);

// The tripwire is only useful if the two wrappers actually produce different pixels.
const a = manifest.cases['wrapper--grain--render'];
const b = manifest.cases['wrapper--grain--compose'];
if (a && b) {
  console.log(a === b
    ? '  ! WARNING: the render and compose wrappers produced identical pixels — the '
      + 'grain tripwire is not arming. Check that the case has minimal:false.'
    : '  ✓ grain tripwire armed: the two page wrappers differ, as they should');
}
