// Static invariants over the repo itself. These assert nothing about behaviour — they
// assert that the code and its data still refer to things that exist.
//
// Written first, and deliberately so: the "every relative import resolves" check below
// would have caught tools/card-catalogue.mjs importing a src/cards.mjs that has never
// existed in git history, on the day it was written rather than years later.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { layouts, RUBRICS } from '../helpers/sut.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LAYOUT_KEYS = new Set(Object.keys(layouts));

/** Every place a layout name is authored, with a label for the failure message. */
function authoredLayouts(): Array<{ where: string; layout: unknown }> {
  const found: Array<{ where: string; layout: unknown }> = [];

  // 1. the authored deck JSONs consumed by src/render.mjs
  for (const f of readdirSync(join(ROOT, 'src'))) {
    if (!/^(deck-.*|content)\.json$/.test(f)) continue;
    const deck = JSON.parse(readFileSync(join(ROOT, 'src', f), 'utf8'));
    deck.slides?.forEach((s: { layout?: unknown }, i: number) =>
      found.push({ where: `src/${f} slide ${i + 1}`, layout: s.layout }));
  }

  // 2. the rubric skeletons — the source of truth for tools/compose.mjs
  for (const [id, r] of Object.entries(RUBRICS)) {
    (r as { slides: Array<{ layout: unknown }> }).slides.forEach((s, i) =>
      found.push({ where: `RUBRICS.${id} slide ${i + 1}`, layout: s.layout }));
  }

  // 3. the hand-built one-of-every-layout table, mirrored from tools/layout-catalogue.mjs
  const cat = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/catalogue-slides.json'), 'utf8'));
  cat.forEach((s: { layout: unknown }, i: number) =>
    found.push({ where: `catalogue-slides.json[${i}]`, layout: s.layout }));

  return found;
}

test('every authored layout name resolves to a real layout', () => {
  const authored = authoredLayouts();
  // guard against the corpus silently collapsing to nothing
  assert.ok(authored.length > 250, `expected 250+ authored slides, found ${authored.length}`);

  const bad = authored.filter(a => typeof a.layout !== 'string' || !LAYOUT_KEYS.has(a.layout));
  assert.deepEqual(bad, [], `unknown layout(s):\n${bad.map(b => `  ${b.where}: ${String(b.layout)}`).join('\n')}`);
});

// tools/card-catalogue.mjs imports ../src/cards.mjs and reads src/cards.css. Neither has
// ever existed — `git log --all -- src/cards.mjs` is empty — so the file has never once
// executed. It is kept on disk deliberately, so the allowlist names it explicitly rather
// than the check quietly skipping unresolvable imports. If this entry ever becomes
// unnecessary, the test fails and tells you to delete it.
const KNOWN_BROKEN_IMPORTS = new Map([
  ['tools/card-catalogue.mjs', new Set(['../src/cards.mjs'])],
]);

test('every relative import resolves to a file on disk', () => {
  const sources: string[] = [];
  for (const dir of ['src', 'tools']) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (/\.(mjs|ts)$/.test(f)) sources.push(`${dir}/${f}`);
    }
  }
  assert.ok(sources.length > 20, `expected 20+ source files, found ${sources.length}`);

  const broken: string[] = [];
  const unusedAllowlist = new Map(
    [...KNOWN_BROKEN_IMPORTS].map(([f, s]) => [f, new Set(s)]));

  for (const rel of sources) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    // `from '...'` and dynamic `import('...')`, relative specifiers only
    const specs = [...src.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)]
      .map(m => m[1]!);
    for (const spec of specs) {
      if (existsSync(resolve(ROOT, dirname(rel), spec))) continue;
      if (unusedAllowlist.get(rel)?.delete(spec)) continue;
      broken.push(`${rel} -> ${spec}`);
    }
  }

  assert.deepEqual(broken, [], `unresolvable import(s):\n  ${broken.join('\n  ')}`);

  const stale = [...unusedAllowlist].flatMap(([f, s]) => [...s].map(spec => `${f} -> ${spec}`));
  assert.deepEqual(stale, [],
    `KNOWN_BROKEN_IMPORTS is stale — these now resolve, remove them:\n  ${stale.join('\n  ')}`);
});

test('the barrel re-exports something from every source module it names', async () => {
  // Cheap guard against a Phase 2 rename silently dropping an export: if a module is
  // renamed and the barrel is not updated, the import throws and this test says so.
  const sut = await import('../helpers/sut.ts');
  for (const name of ['renderSlide', 'layouts', 'pool', 'fxPage', 'FORMATS',
                      'composePrompt', 'MODELS', 'openRun', 'treated']) {
    assert.ok(name in sut, `barrel lost its "${name}" export`);
  }
});
