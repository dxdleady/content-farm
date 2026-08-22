// Keeps src/types.ts honest against src/layouts.mjs.
//
// A type that drifts from the implementation is worse than no type: it lies with
// authority. So the union is pinned two ways — the compiler rejects a LAYOUTS map that
// misses or invents a member, and the runtime asserts that map equals the actual layout
// table. Add a layout and BOTH must be updated before anything goes green.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { layouts, ACCENTS } from '../helpers/sut.ts';
import type {
  LayoutName, InkClass, AccentToken, Slide, RenderSlide, MeterProps, Format, Ratio,
} from '../../src/types.ts';

/* ---- compile-time helpers ------------------------------------------------ */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

/**
 * Exhaustive by construction: `Record<LayoutName, true>` fails to compile if a member is
 * missing, and an unknown key is an excess-property error. This is the compile-time half.
 */
const LAYOUTS: Record<LayoutName, true> = {
  cover: true, statement: true, stat: true, list: true, quote: true, splash: true,
  cta: true, tags: true, bento: true, poster: true, photo: true, steps: true,
  index: true, claim: true, statRow: true, bigQuestion: true, fillWord: true,
  callout: true, definition: true, dontList: true, checklist: true, comparison: true,
  beforeAfter: true, priceTiers: true, iconRow: true, meter: true, timeline: true,
  processVertical: true, symbolHero: true, footnote: true, lowerThird: true,
  lineChart: true,
};

test('the Slide union names exactly the layouts that exist', () => {
  // The runtime half. Together with the Record above this is a two-way lock.
  assert.deepEqual(Object.keys(LAYOUTS).sort(), Object.keys(layouts).sort(),
    'src/types.ts and src/layouts.mjs disagree about which layouts exist');
  assert.equal(Object.keys(LAYOUTS).length, 32);
});

test('AccentToken lists exactly the tokens the rotation uses', () => {
  const declared: Record<AccentToken, true> = {
    superlime: true, pink: true, purpleblue: true, green: true, carrot: true,
    violet65: true, mainorange: true, blue67: true, lightpink: true,
  };
  assert.deepEqual(Object.keys(declared).sort(), [...ACCENTS].sort(),
    'AccentToken drifted from ACCENTS in layouts.mjs');
});

test('InkClass lists exactly the classes carousel.css ships', () => {
  const declared: Record<InkClass, true> = {
    'accent-pink': true, 'accent-lime': true, 'accent-carrot': true,
    'accent-purple': true, 'accent-green': true,
  };
  // These five are the only ones ink() accepts; anything else throws at render time.
  assert.deepEqual(Object.keys(declared).sort(),
    ['accent-carrot', 'accent-green', 'accent-lime', 'accent-pink', 'accent-purple']);
});

test('the two accent domains do not overlap', () => {
  // The whole reason they are separate types. If a name ever appeared in both, the
  // distinction would be unenforceable and the cvar()/ink() bugs would be unfindable.
  const ink = ['accent-pink', 'accent-lime', 'accent-carrot', 'accent-purple', 'accent-green'];
  const shared = ink.filter(i => (ACCENTS as string[]).includes(i));
  assert.deepEqual(shared, [], 'an accent name belongs to both domains');
});

/* ---- type-level assertions (checked by tsc, erased at runtime) ------------ */

// The discriminant is the layout name and nothing else.
type _Discriminant = Expect<Equal<Slide['layout'], LayoutName>>;

// index/total are required on what the renderer receives, and absent from what is authored.
type _RenderAdds = Expect<Equal<RenderSlide['index'], number>>;
type _AuthoredHasNoIndex = Expect<Equal<'index' extends keyof Slide ? true : false, false>>;

// Narrowing by the discriminant must reach the layout-specific props.
type _StatNarrows = Expect<Equal<Extract<Slide, { layout: 'stat' }>['value'], string | number>>;
type _CmpNarrows = Expect<Equal<Extract<Slide, { layout: 'comparison' }>['aTitle'], string>>;
type _DefNarrows = Expect<Equal<Extract<Slide, { layout: 'definition' }>['term'], string>>;

// meter's either/or actually excludes the mixed form.
type _MeterEither = Expect<Equal<Extract<MeterProps, { segments: unknown[] }>['pct'], undefined>>;

// The ratio a format asks the image models for is the same union providers.mjs maps.
type _RatioIsClosed = Expect<Equal<Format['ratio'], Ratio>>;

test('type-level assertions compiled', () => {
  // The assertions above are erased at runtime; this test exists so the file reports
  // something, and so `npm run typecheck` failing is visibly tied to this suite.
  assert.ok(true);
});
