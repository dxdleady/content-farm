// src/treatment.ts has zero importers today. It is kept per the no-delete decision, so
// it gets covered like anything else — these are pure string builders with no I/O.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { duotone, misprint, grain, halftoneCss, treated } from '../helpers/sut.ts';

test('duotone: builds a filter with the given id and both colours', () => {
  const f = duotone('#0A0A0A', '#EEFF04', 'dt');
  assert.ok(f.includes('<filter id="dt"'), 'the id is what callers reference');
  assert.ok(f.includes('feColorMatrix') || f.includes('feComponentTransfer'));
});

test('misprint and grain are deterministic for the same inputs', () => {
  assert.equal(misprint(2, 'mp'), misprint(2, 'mp'));
  assert.equal(grain('g', 3), grain('g', 3));
  assert.notEqual(grain('g', 3), grain('g', 4), 'the seed actually varies the output');
});

test('halftoneCss returns declarations, not a rule', () => {
  const css = halftoneCss(3.5);
  assert.ok(!css.includes('{'), 'callers splice this into their own rule');
});

test('treated: width and height are effectively required', () => {
  // `w` and `h` sit in an options destructure with NO defaults, so treated(src) silently
  // emits `width:undefinedpx`. Pinned so the port makes them required rather than
  // "fixing" it by inventing a default.
  //
  // The cast is the point, not an escape: TypeScript infers the options type from the
  // defaulted keys alone, so `w`/`h` are not in it at all. That inference is exactly the
  // signal that Phase 2 must declare them explicitly.
  assert.ok(treated('/tmp/a.png').includes('undefined'),
    'current behaviour: missing w/h leaks "undefined" into the style attribute');

  const ok = treated('/tmp/a.png', { w: 100, h: 200 } as never);
  assert.ok(ok.includes('100') && ok.includes('200'));
  assert.ok(!ok.includes('undefined'));
});
