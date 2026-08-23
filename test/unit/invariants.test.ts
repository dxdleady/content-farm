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
// Spelled out rather than read off the product registry: this side of the harness is the
// arbiter, and it must not be able to follow the thing under test to a new address.
const DECKS = join(ROOT, 'products/cast/copy/decks');
const LAYOUT_KEYS = new Set(Object.keys(layouts));

/** Every place a layout name is authored, with a label for the failure message. */
function authoredLayouts(): Array<{ where: string; layout: unknown }> {
  const found: Array<{ where: string; layout: unknown }> = [];

  // 1. the authored deck JSONs consumed by src/render.mjs
  for (const f of readdirSync(DECKS)) {
    if (!/^(deck-.*|content)\.json$/.test(f)) continue;
    const deck = JSON.parse(readFileSync(join(DECKS, f), 'utf8'));
    deck.slides?.forEach((s: { layout?: unknown }, i: number) =>
      found.push({ where: `src/${f} slide ${i + 1}`, layout: s.layout }));
  }

  // 2. the rubric skeletons — the source of truth for tools/compose.ts
  for (const [id, r] of Object.entries(RUBRICS)) {
    (r as { slides: Array<{ layout: unknown }> }).slides.forEach((s, i) =>
      found.push({ where: `RUBRICS.${id} slide ${i + 1}`, layout: s.layout }));
  }

  // 3. the hand-built one-of-every-layout table, mirrored from tools/layout-catalogue.ts
  const cat = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/catalogue-slides.json'), 'utf8'));
  cat.forEach((s: { layout: unknown }, i: number) =>
    found.push({ where: `catalogue-slides.json[${i}]`, layout: s.layout }));

  return found;
}

test('every authored layout name resolves to a real layout', () => {
  const authored = authoredLayouts();
  // guard against the corpus silently collapsing to nothing
  assert.ok(authored.length > 180, `expected 180+ authored slides, found ${authored.length}` /* was 250 — ten posts were deliberately deleted, taking 102 slides with them */);

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

test('no tool builds an image cache key by hand', () => {
  // The formula lives in src/cache.ts now. It was inlined in five tools and drifted once,
  // with real consequences — pack-from-ref omitted the ratio, so its key was correct only
  // because every adapter defaults to 4:5. This keeps it from creeping back.
  const offenders: string[] = [];
  for (const f of readdirSync(join(ROOT, 'tools'))) {
    if (!f.endsWith('.ts')) continue;
    for (const line of readFileSync(join(ROOT, 'tools', f), 'utf8').split('\n')) {
      if (line.includes('createHash') && line.includes('pack-')) {
        offenders.push(`tools/${f}: ${line.trim().slice(0, 70)}…`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    `these hand-roll the cache key instead of calling cachePath():\n  ${offenders.join('\n  ')}`);
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

// An element that carries an accent class must not ALSO be dimmed.
//
// Written after the third report of the same defect. The accent palette sits at modest
// contrast against the brand grounds by construction — several pairs cannot clear WCAG's
// 3.0 at all — so an opacity multiplied on top is what takes something from "quiet" to
// "gone". It bit `.callout__n` (.55), the `dim` column on `comparison` (.5), and finally
// `.step__n` (.4), where the 01/02/03 markers simply vanished over art.
//
// Dimming is for elements that inherit their colour. An accent is already the
// differentiation; hierarchy on top of it should come from size, face or weight — none of
// which cost contrast.
test('no accent-carrying element is also dimmed by carousel.css', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const layouts = readFileSync(join(root, 'src/layouts.ts'), 'utf8');
  const css = readFileSync(join(root, 'src/carousel.css'), 'utf8');

  // `<span class="step__n ${a}">` — a static class list followed by an interpolated accent.
  const accented = new Set<string>();
  for (const m of layouts.matchAll(/class="([a-z][a-z0-9_ -]*?)\s+\$\{(?:a|s\.accent[^}]*)\}"/g)) {
    for (const c of m[1]!.trim().split(/\s+/)) accented.add(c);
  }
  assert.ok(accented.size >= 5, `only found ${accented.size} accent-carrying classes — the pattern moved`);

  const offenders: string[] = [];
  for (const cls of accented) {
    const rule = new RegExp(`\\.${cls.replace(/[-_]/g, m => `\\${m}`)}\\b[^{]*\\{[^}]*opacity:\\s*([0-9.]+)`, 'g');
    for (const m of css.matchAll(rule)) offenders.push(`.${cls} { opacity: ${m[1]} }`);
  }

  assert.deepEqual(offenders, [],
    'these carry an accent colour AND are dimmed, which is what makes them unreadable:\n  '
    + offenders.join('\n  '));
});

// Every reference file must be reachable from SKILL.md.
//
// Written because two of them were not, and nobody noticed: hooks.md and scoring.md were
// created, filled, and linked from nowhere — the edits that were supposed to add the
// pointers silently failed to match their anchor, and the failure was invisible because a
// skill file cannot complain about being an orphan.
//
// A reference nothing points at is a reference nobody reads.
test('every skill reference is linked from SKILL.md', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = join(root, '.claude/skills/cast-content/references');
  const skill = readFileSync(join(root, '.claude/skills/cast-content/SKILL.md'), 'utf8');

  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  assert.ok(files.length >= 5, `only ${files.length} reference files — did the directory move?`);

  const orphans = files.filter(f => !skill.includes(`references/${f}`));
  assert.deepEqual(orphans, [], 'these reference files are linked from nowhere in SKILL.md');
});
