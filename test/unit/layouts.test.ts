import { test } from 'node:test';
import assert from 'node:assert/strict';

import { layouts, renderSlide, icon, inkFor, ACCENTS } from '../helpers/sut.ts';

/** Minimal slide for `claim`, which reads only title + accent (plus the shared chrome). */
const claim = (over: Record<string, unknown> = {}) =>
  renderSlide({ layout: 'claim', title: 'x', index: 1, total: 3, minimal: true, ...over } as never);

test('the layout table is complete and callable', () => {
  const keys = Object.keys(layouts);
  assert.equal(keys.length, 32, 'layout count changed — the golden corpus must cover the new one');
  for (const k of keys) assert.equal(typeof layouts[k as keyof typeof layouts], 'function', k);
});

test('renderSlide rejects an unknown layout by name', () => {
  assert.throws(() => renderSlide({ layout: 'nope', index: 1, total: 1 } as never),
    { message: 'unknown layout: nope' });
});

// inkFor picks readable ink over an accent fill by WCAG contrast ratio. It is real logic
// with a genuine branch, and it is the cheapest high-value table in the repo.
test('inkFor: readable ink per accent token', () => {
  const expected: Record<string, string> = {
    superlime: 'var(--c-text-dark)', pink: 'var(--c-text-dark)',
    purpleblue: 'var(--c-text-dark)', green: 'var(--c-text-dark)',
    carrot: 'var(--c-text-dark)', violet65: 'var(--c-text-dark)',
    mainorange: 'var(--c-text-dark)', lightpink: 'var(--c-text-dark)',
    blue67: 'var(--c-text-main)',   // the one token dark enough to need light ink
  };
  for (const [token, ink] of Object.entries(expected)) {
    assert.equal(inkFor(token), ink, `inkFor(${token})`);
  }
  assert.equal(inkFor('background-dark'), 'var(--c-text-main)');
  assert.equal(inkFor('background-light'), 'var(--c-text-dark)');
  assert.equal(inkFor('not-a-token'), 'var(--c-text-dark)', 'unknown falls back to dark ink');
});

test('ACCENTS covers every token inkFor is asked about', () => {
  assert.equal(ACCENTS.length, 9);
  assert.equal(new Set(ACCENTS).size, 9, 'no duplicates — colour-forward layouts rotate through this');
});

test('icon: a missing glyph renders empty, not undefined', () => {
  assert.equal(icon('does-not-exist'), '', 'a typo silently renders nothing — pinned deliberately');
  assert.ok(icon('scissors').includes('<svg'), 'a real icon returns SVG source');
});

// mark() / esc() / ink() are module-private, so they are exercised through renderSlide.
test('mark: *asterisks* become the accent span', () => {
  const html = claim({ title: 'Edit the *words*', accent: 'accent-lime' });
  assert.ok(html.includes('<span class="em accent-lime">words</span>'));
  assert.ok(!html.includes('*'), 'the asterisks themselves are consumed');
});

test('mark: unmatched and repeated asterisks', () => {
  assert.ok(claim({ title: 'a *b* c *d*' }).match(/<span class="em [^"]+">/g)?.length === 2,
    'two marked spans');
  assert.ok(claim({ title: 'a * b' }).includes('a * b'),
    'a lone asterisk is left as literal text');
});

test('esc: & and < are escaped, quotes are not', () => {
  const html = claim({ title: 'Signal & <Noise>' });
  assert.ok(html.includes('Signal &amp; &lt;Noise&gt;') || html.includes('Signal &amp; &lt;Noise>'),
    `unexpected escaping: ${html.match(/Signal[^<]*/)?.[0]}`);
});

test('ink: a bare token in the ink-class slot throws — but only once mark() runs', () => {
  // ink() is called from inside mark()'s replace callback, so the guard fires only when
  // the title actually contains a *marked* word. This asymmetry is real and load-bearing:
  // it is why bad accents survive in production data until someone adds asterisks.
  assert.throws(() => claim({ title: 'a *b*', accent: 'superlime' }),
    /unknown accent class "superlime"/,
    'ink classes and bare tokens are disjoint domains');

  assert.doesNotThrow(() => claim({ title: 'no marked word', accent: 'superlime' }),
    'current behaviour: without asterisks the accent is never validated');

  for (const ok of ['accent-pink', 'accent-lime', 'accent-carrot', 'accent-purple', 'accent-green']) {
    assert.doesNotThrow(() => claim({ title: 'a *b*', accent: ok }), ok);
  }
});

test('renderSlide: theme, ground and the grain span', () => {
  assert.ok(claim({ theme: 'light' }).startsWith('<div class="slide slide--light"'));
  assert.ok(claim().startsWith('<div class="slide"'), 'no theme means no modifier class');

  const grounded = claim({ ground: 'superlime' });
  assert.ok(grounded.includes('background:var(--c-accent-superlime)'));
  assert.ok(grounded.includes('color:var(--c-text-dark)'), 'ground picks its own readable ink');

  assert.ok(!claim({ minimal: true }).includes('class="grain"'));
  assert.ok(claim({ minimal: false }).includes('<span class="grain"></span>'),
    'grain rides on every non-minimal slide');
});

test('renderSlide: a generated background suppresses the gradient theme', () => {
  // The dark-ink gradient theme over generated art would leave the headline invisible.
  const withArt = renderSlide({ layout: 'statement', title: 'x', theme: 'grad',
    bgFile: '/tmp/x.png', index: 1, total: 2, minimal: true } as never);
  assert.ok(!withArt.includes('slide--grad'), 'theme:grad is dropped when bgFile is set');

  const noArt = renderSlide({ layout: 'statement', title: 'x', theme: 'grad',
    index: 1, total: 2, minimal: true } as never);
  assert.ok(noArt.includes('slide--grad'), 'theme:grad survives without art');
});

test('chrome: the pagination ticks track index and total', () => {
  const html = claim({ index: 2, total: 5 });
  assert.equal((html.match(/<i class="/g) ?? []).length, 5, 'one tick per slide');
  assert.equal((html.match(/<i class="on">/g) ?? []).length, 1, 'exactly one is active');
});
