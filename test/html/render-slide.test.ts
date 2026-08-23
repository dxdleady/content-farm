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
  // 230, not 300. Every post was deleted deliberately — they predated the hook and
  // slide-plan rules and are being rewritten from scratch — and their rubric cases went
  // with them. Coverage does NOT depend on a post existing: the catalogue contributes one
  // case per layout and the edge cases cover the branches, which is what this tier is
  // for. The floor guards against a SILENT collapse, not a chosen one.
  assert.ok(cases.length > 230, `corpus collapsed to ${cases.length} cases`);

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

test('no slide leaks the literal string "undefined" into its output', () => {
  // A cheap, table-free way to catch a missing required field across the whole corpus:
  // every unguarded `${s.foo}` on an absent property renders as the text "undefined".
  // It started with two allowlisted leaks — cover's missing gradient and the tags crash.
  // Both are fixed, so all 325 cases are clean and the list stays empty.
  const leaking = readdirSync(GOLDEN)
    .filter(f => readFileSync(join(GOLDEN, f), 'utf8').includes('undefined'))
    .map(f => f.replace(/\.html$/, ''));

  assert.deepEqual(leaking, [],
    'a required field went missing — these render the literal text "undefined"');
});

test('no case throws', () => {
  // A crash is behaviour too, so the harness captures a throw as its golden rather than
  // failing the capture. This list was ['edge--tags--object-without-accent'] until that
  // crash was fixed; it is empty now, and anything appearing here is a new one.
  const throwing = readdirSync(GOLDEN)
    .filter(f => readFileSync(join(GOLDEN, f), 'utf8').startsWith('!! THREW:'))
    .map(f => f.replace(/\.html$/, ''));

  assert.deepEqual(throwing, [],
    'a slide that used to render now crashes — the golden holds the message');
});
