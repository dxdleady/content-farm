// Tier 2 — the tier that actually validates the port.
//
// renderSlide is a pure function of (slide) plus committed assets: no Math.random, no
// Date, no env reads. So its output is byte-comparable on every machine, needs no Chrome,
// and runs in milliseconds. If a golden here changes during Phases 1-3, the port is wrong;
// there is no "but this change was intended" escape hatch, by design.
//
// Re-baseline deliberately with:  UPDATE_GOLDENS=1 npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { corpus } from '../helpers/corpus.ts';
import { renderCase } from '../capture-html.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOLDEN = join(ROOT, 'test/golden/html');
const UPDATE = !!process.env.UPDATE_GOLDENS;

const cases = corpus();

test('the corpus covers every layout', async () => {
  assert.ok(cases.length > 300, `corpus collapsed to ${cases.length} cases`);

  const { layouts } = await import('../helpers/sut.ts');
  const covered = new Set(cases.map(c => c.slide.layout));
  const uncovered = Object.keys(layouts).filter(l => !covered.has(l));
  assert.deepEqual(uncovered, [],
    'these layouts have no corpus case, so the port could break them undetected');
});

test('every slide renders byte-identically to its golden', () => {
  assert.ok(existsSync(GOLDEN), 'no goldens — run `npm run goldens:capture` first');

  const missing: string[] = [];
  const differing: string[] = [];

  for (const c of cases) {
    const file = join(GOLDEN, `${c.name}.html`);
    const actual = renderCase(c.slide);

    if (UPDATE) { writeFileSync(file, actual); continue; }
    if (!existsSync(file)) { missing.push(c.name); continue; }
    if (readFileSync(file, 'utf8') !== actual) differing.push(c.name);
  }
  if (UPDATE) return;

  assert.deepEqual(missing, [], `${missing.length} case(s) have no golden — run npm run goldens:capture`);

  // Report the whole set at once. A systemic break should read as "247 cases differ",
  // not as 247 separate failures scrolling past.
  const shown = differing.slice(0, 15).join('\n  ');
  assert.equal(differing.length, 0,
    `${differing.length} of ${cases.length} cases differ from their golden:\n  ${shown}`
    + (differing.length > 15 ? `\n  …and ${differing.length - 15} more` : '')
    + '\n\nIf this is a port, it is a regression. If the change is deliberate, re-baseline'
    + ' with UPDATE_GOLDENS=1 npm test and review the diff.');
});

test('no golden is orphaned', () => {
  const expected = new Set(cases.map(c => `${c.name}.html`));
  const orphans = readdirSync(GOLDEN).filter(f => !expected.has(f));
  assert.deepEqual(orphans, [], 'goldens with no corpus case — nothing asserts against these');
});

test('cases that throw today keep throwing, with the same message', () => {
  // A crash is behaviour too. tags with an accent-less object item is a known latent bug
  // (cvar(undefined)); pinning it means Phase 4's fix shows up as an intentional diff.
  const throwing = readdirSync(GOLDEN)
    .filter(f => readFileSync(join(GOLDEN, f), 'utf8').startsWith('!! THREW:'))
    .map(f => f.replace(/\.html$/, ''));

  assert.deepEqual(throwing, ['edge--tags--object-without-accent'],
    'the set of throwing cases changed — a crash was introduced or silently fixed');
});
