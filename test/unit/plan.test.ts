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
  // How tools/compose.mjs passes FORMATS.tiktok.framing through mkReplace().
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
  assert.equal(refAnalysisFile('3'), 'cast-ref-03.json');
  assert.equal(refAnalysisFile(3 as never), 'cast-ref-03.json');
  assert.equal(refAnalysisFile('03'), 'cast-ref-03.json');
  assert.equal(refAnalysisFile('28'), 'cast-ref-28.json');
  assert.equal(refAnalysisFile('ref-12'), 'cast-ref-12.json', 'first digit run wins');
  assert.equal(refAnalysisFile('cast-ref-07.json'), 'cast-ref-07.json');
  assert.equal(refAnalysisFile('foo.json'), 'foo.json', 'no digits — passed through unchanged');
});

test('ART_CAPABLE: only these layouts may carry a generated background', () => {
  assert.deepEqual([...ART_CAPABLE].sort(),
    ['bento', 'photo', 'poster', 'quote', 'splash', 'stat', 'statement', 'steps', 'symbolHero', 'tags']);
  for (const l of ART_CAPABLE) {
    assert.ok(l in layouts, `ART_CAPABLE names "${l}", which is not a layout`);
  }
});

test('RUBRICS: the ten rubric skeletons are structurally sound', () => {
  const ids = Object.keys(RUBRICS);
  assert.deepEqual(ids.sort(), [
    'before-after', 'feature-drop', 'hot-takes', 'how-to', 'inspiration', 'mistakes',
    'myth-vs-fact', 'one-workflow', 'plan-picker', 'unnecessary-censorship',
  ]);

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
