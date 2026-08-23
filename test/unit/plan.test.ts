// The money path. composePrompt's output is the cache key input for every generated
// background (assets/generated/ is content-addressed on `model | prompt + ref bytes`).
// A stray space from a formatter invalidates the cache and re-buys ~$0.07 per image.
// These digests are frozen against the pre-migration .mjs on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { composePrompt, ART_DIRECTIVE, ART_CAPABLE, RUBRICS, refAnalysisFile, layouts } from '../helpers/sut.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const KEEP = ['KEEP — the making of the image, copy exactly:', '· MEDIUM: x', '· GROUND: y'];
const LINES = ['SUBJECT: a.', 'COMPOSITION: b.', 'COLOUR: c.'];

test('composePrompt: frozen digest', () => {
  const out = composePrompt(KEEP, LINES);
  assert.equal(sha(out), 'bdf89f3a3d30f8d8', 'composePrompt output changed — every cached image would miss');
  assert.equal(out.length, 897);
});

test('composePrompt: structure', () => {
  const out = composePrompt(KEEP, LINES);
  assert.ok(out.startsWith(KEEP.join('\n')), 'KEEP is copied verbatim, first');
  for (const l of LINES) assert.ok(out.includes(`· ${l}`), `REPLACE line "${l}" is bulleted`);
  assert.ok(out.endsWith(ART_DIRECTIVE), 'ART_DIRECTIVE closes the prompt');
  assert.ok(out.indexOf('REPLACE') > out.indexOf('KEEP'), 'KEEP precedes REPLACE');
});

test('composePrompt: a format framing line rides along as a REPLACE bullet', () => {
  // How tools/compose.ts passes FORMATS.tiktok.framing through mkReplace().
  const framed = composePrompt(KEEP, [...LINES, 'FRAMING: a tall vertical 9:16 frame.']);
  assert.ok(framed.includes('· FRAMING: a tall vertical 9:16 frame.'));
  assert.notEqual(sha(framed), 'bdf89f3a3d30f8d8', '9:16 must produce a different cache key than 4:5');
});

test('ART_DIRECTIVE: frozen digest and its hard-won rules', () => {
  assert.equal(sha(ART_DIRECTIVE), '7944b8159b3e3eab');
  // These negations exist because pushing them made every output dark and dirty.
  for (const rule of ['Do NOT darken', 'NO added grain', 'NO HDR crunch', 'NO crushed shadows']) {
    assert.ok(ART_DIRECTIVE.includes(rule), `lost the "${rule}" guardrail`);
  }
});

test('refAnalysisFile: number-ish input maps to a padded filename, anything else passes through', () => {
  assert.equal(refAnalysisFile('3'), 'ref-03.json');
  assert.equal(refAnalysisFile(3 as never), 'ref-03.json');
  assert.equal(refAnalysisFile('03'), 'ref-03.json');
  assert.equal(refAnalysisFile('28'), 'ref-28.json');
  assert.equal(refAnalysisFile('ref-12'), 'ref-12.json', 'first digit run wins');
  assert.equal(refAnalysisFile('cast-ref-07.json'), 'ref-07.json', 'the old brand-prefixed name still resolves — the digits are what matter');
  assert.equal(refAnalysisFile('foo.json'), 'foo.json', 'no digits — passed through unchanged');
});

test('ART_CAPABLE: only these layouts may carry a generated background', () => {
  assert.deepEqual([...ART_CAPABLE].sort(),
    ['bento', 'photo', 'poster', 'quote', 'splash', 'stat', 'statement', 'steps', 'symbolHero', 'tags']);
  for (const l of ART_CAPABLE) {
    assert.ok(l in layouts, `ART_CAPABLE names "${l}", which is not a layout`);
  }
});

test('RUBRICS: the rubric skeletons are structurally sound', () => {
  // Spelled out rather than counted, so that adding a rubric is a deliberate one-line
  // edit here and deleting one cannot pass silently.
  // None yet. Every post was deleted rather than kept as a bad example: they predated the
  // hook rules and the slide plan, and leaving them around as things to copy from was
  // worse than the gap. This list is the record of what has been written SINCE — add an
  // id here when a post is written, and this test is what makes that deliberate.
  const ids = Object.keys(RUBRICS);
  assert.deepEqual(ids.sort(), ['edit-evening']);

  // No casts needed here any more: RUBRICS is Record<string, Rubric> since the port, so
  // `s.layout` is a LayoutName and `s.art` is an ArtPrompt. The runtime checks below now
  // guard the data rather than the shape — the compiler owns the shape.
  for (const [id, rubric] of Object.entries(RUBRICS)) {
    assert.ok(rubric.name && rubric.bucket && rubric.promise, `${id}: missing metadata`);
    assert.ok(rubric.slides.length > 0, `${id}: no slides`);
    for (const [i, s] of rubric.slides.entries()) {
      // An `art` prompt on a slide whose layout cannot carry art is dead weight: density
      // only ever picks art slides from ART_CAPABLE, so the prompt would never be used.
      if (s.art) {
        assert.ok(ART_CAPABLE.has(s.layout),
          `${id} slide ${i + 1}: layout "${s.layout}" carries an art prompt but is not art-capable`);
        for (const k of ['s', 'c', 'k'] as const) {
          assert.equal(typeof s.art[k], 'string', `${id} slide ${i + 1}: art.${k} must be a string`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------- the envelope
//
// This is what the shape layer would have been, had the data supported one. It does not:
// the ten (cast) rubrics were diffed pairwise and no two share a beat sequence — the
// closest pair, feature-drop and how-to, agrees on 4 of 9-10 beats and then splits. So
// there is no SHAPES table and no resolveRubric(); ten shapes with one user each would
// be a rename wearing an abstraction's clothes.
//
// What every rubric of every product genuinely shares is the envelope: open on a hook,
// close on the handle. That is a real cross-product contract, it is what a second brand
// has to honour, and it costs four assertions instead of a module.
test('every rubric of every product honours the hook → body → close envelope', async () => {
  const { PRODUCTS } = await import('../../src/product.ts');
  const { rubricsFor } = await import('../../src/plan.ts');

  // The two layouts that can carry a cold open. Both put one line on an empty ground;
  // anything else buries the hook under structure the reader has not earned yet.
  const HOOKS = new Set(['statement', 'bigQuestion']);

  for (const p of Object.values(PRODUCTS)) {
    // No posts is the starting state for a brand, not a failure. What this test asserts
    // is that every post which DOES exist honours the envelope.
    const rubrics = Object.entries(rubricsFor(p));

    for (const [id, r] of rubrics) {
      const seq = r.slides.map(s => s.layout);
      const where = `${p.id}/${id}`;

      assert.ok(HOOKS.has(seq[0]!), `${where}: opens on "${seq[0]}", not a hook (${[...HOOKS].join(' | ')})`);
      assert.equal(seq.at(-1), 'splash', `${where}: does not close on splash`);
      // 5 is the floor: hook, at least two beats of substance, payoff, close. Below that
      // there is no room to teach anything and the post is a single slide with padding.
      // 10 is Instagram's hard cap on a carousel. Between them, the count follows the
      // topic — a small idea told in six slides beats the same idea padded to nine.
      assert.ok(seq.length >= 5, `${where}: ${seq.length} slides — under 5 there is no room for a body`);
      assert.ok(seq.length <= 10, `${where}: ${seq.length} slides — Instagram caps a carousel at 10`);
      assert.equal(seq.filter(l => l === 'splash').length, 1, `${where}: more than one splash`);
    }
  }
});

test('every art prompt sits on a layout that can actually render one', async () => {
  // plan.test.ts used to be able to check this only for cast, because RUBRICS was cast.
  // Now that rubrics are per product, the same check covers every brand that ships copy —
  // an `art` block on a layout outside ART_CAPABLE is silently paid for and never drawn.
  const { PRODUCTS } = await import('../../src/product.ts');
  const { rubricsFor } = await import('../../src/plan.ts');

  for (const p of Object.values(PRODUCTS)) {
    for (const [id, r] of Object.entries(rubricsFor(p))) {
      r.slides.forEach((s, i) => {
        if (!(s as { art?: unknown }).art) return;
        assert.ok(ART_CAPABLE.has(s.layout),
          `${p.id}/${id}[${i}]: "${s.layout}" carries an art prompt but is not art-capable`);
      });
    }
  }
});
