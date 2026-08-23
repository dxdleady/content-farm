// The product axis, checked against a brand that was built to break it.
//
// Everything here would have passed trivially with one product in the repo, which is the
// whole reason test/helpers/brand-b.ts exists: it shares no accent token name with
// (cast), inverts light and dark, uses four ink classes instead of five, and ships an
// overrideCss. If the renderer had absorbed anything about (cast) into itself over the
// life of this repo, this is where it shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRODUCTS, DEFAULT_PRODUCT, resolveProduct, productFromArgv, productTag } from '../../src/product.ts';
import { rendererFor, brandFor } from '../../src/layouts.ts';
import { rubricsFor } from '../../src/plan.ts';
import { validateBrand, validateCopy, validateProduct } from '../../src/validate.ts';
import { slidePage } from '../../src/page.ts';
import { productCss } from '../../src/assets.ts';
import { FORMATS } from '../../src/formats.ts';
import { composeDeckName, composeRunDir } from '../../src/run.ts';
import { BRAND_B, BRAND_B_RUBRICS } from '../helpers/brand-b.ts';

const CAST = PRODUCTS[DEFAULT_PRODUCT];

/* ------------------------------------------------------------------ the registry */

test('the registry resolves, and rejects a typo by listing what it has', () => {
  assert.equal(resolveProduct(), CAST, 'no argument means the default');
  assert.equal(resolveProduct('cast'), CAST);
  assert.equal(resolveProduct('CAST'), CAST, 'case-insensitive, like formatFromArgv');
  assert.throws(() => resolveProduct('nope'), /unknown product "nope" — have: cast/);
});

test('productTag is empty for the incumbent, so no existing path moves', () => {
  // This is the property that let the whole axis land without renaming a single
  // out/runs directory. If it ever stops holding, every tool that greps those names
  // breaks at once, silently, on a rename nobody announced.
  assert.equal(productTag(CAST), '');
  assert.equal(productTag(BRAND_B), '-brand-b');
});

test('--product beats $PRODUCT beats the default', () => {
  const prev = process.env.PRODUCT;
  try {
    process.env.PRODUCT = 'cast';
    assert.equal(productFromArgv(['node', 'x', '--product', 'cast']), CAST);
    assert.equal(productFromArgv(['node', 'x']), CAST, 'falls back to $PRODUCT');
    delete process.env.PRODUCT;
    assert.equal(productFromArgv(['node', 'x']), CAST, 'falls back to the default');
  } finally {
    if (prev === undefined) delete process.env.PRODUCT; else process.env.PRODUCT = prev;
  }
});

/* ------------------------------------------------------------------ validation */

test('both shipped and fixture brands hold together', () => {
  // Errors only. Warnings are a separate severity on purpose: (cast)'s palette cannot
  // clear WCAG against four of its own grounds, and that is a design ceiling rather than
  // a mistake — see auditContrast() in src/validate.ts. Asserting no warnings would make
  // this test unpassable without changing the brand's colours.
  const errors = (ps: ReturnType<typeof validateProduct>) => ps.filter(x => x.level !== 'warn');

  for (const p of Object.values(PRODUCTS)) {
    assert.deepEqual(errors(validateProduct(p, rubricsFor(p))), [], `${p.id} has problems`);
  }
  assert.deepEqual(errors(validateProduct(BRAND_B, BRAND_B_RUBRICS)), [],
    'the hostile fixture is hostile, not broken — it must still be a VALID product');
});

test('a contrast regression is an error, and a palette ceiling is only a warning', async () => {
  // The distinction is what keeps the check alive. A linter that fails on something
  // unfixable gets muted, and then it stops catching the fixable things too.
  const { auditContrast } = await import('../../src/validate.ts');

  const clean = auditContrast(CAST);
  assert.deepEqual(clean.filter(x => x.level !== 'warn'), [],
    'cast\'s em map is at its measured optimum');
  assert.ok(clean.some(x => x.level === 'warn'),
    'and its four sub-WCAG grounds are surfaced rather than hidden');

  // Put the pair that hurt back and it must be an error, twice over: too low to read,
  // and a better class was available.
  const regressed = {
    ...CAST,
    colorTheme: { ...CAST.colorTheme, em: { ...CAST.colorTheme.em, mainorange: 'accent-purple' as const } },
  };
  const bad = auditContrast(regressed).filter(x => x.level !== 'warn');
  assert.equal(bad.length, 2);
  assert.ok(bad.some(x => /vibrate/.test(x.what)), 'the 1.02:1 pair is named as unreadable');
  assert.ok(bad.some(x => /use the readable one/.test(x.what)), 'and the better option is named');
});

test('validateBrand catches the five ways a brand goes quietly wrong', () => {
  const find = (probs: ReturnType<typeof validateBrand>, needle: string) =>
    probs.some(p => p.what.includes(needle));

  // 1. a missing asset — the failure brandFor() made lazy, and therefore late
  const noLogo = { ...BRAND_B, wordmark: '/nope/wordmark.svg' };
  assert.ok(find(validateBrand(noLogo), 'no such file'), 'a missing wordmark must be caught before Chrome starts');

  // 2. an accent that is not in this product's tokens — inkFor would return dark ink,
  //    which on brand-b's near-black ground is black on black.
  const ghostAccent = { ...BRAND_B, accents: [...BRAND_B.accents, 'chartreuse'] };
  assert.ok(find(validateBrand(ghostAccent), 'inkFor would fall back to dark ink'));

  // 3. an ink class carousel.css has no rule for — the text inherits, white on cream
  const ghostClass = { ...BRAND_B, ink: { ...BRAND_B.ink, 'accent-teal': 'ice' } as typeof BRAND_B.ink };
  assert.ok(find(validateBrand(ghostClass), 'has no rule in carousel.css'));

  // 4. an ink class pointing at a token the product does not own
  const badToken = { ...BRAND_B, ink: { ...BRAND_B.ink, 'accent-pink': 'superlime' } };
  assert.ok(find(validateBrand(badToken), 'which is not in tokens.json'));

  // 5. a ground with no prose hue — the image prompt would literally say "undefined"
  const noHue = { ...BRAND_B, colorTheme: { ...BRAND_B.colorTheme, hue: { ember: 'burnt orange' } } };
  assert.ok(find(validateBrand(noHue), 'the image prompt would say "undefined"'));
});

test('validateCopy resolves every name against the RIGHT product', () => {
  // Copy is valid for the brand it was written for and invalid for one that shares none
  // of its token names. Nothing in the render path would say so: accents are strings all
  // the way down, and a wrong one paints with an undefined custom property.
  //
  // brand-b's own copy is used as the subject rather than a shipped (cast) post, because
  // (cast) legitimately has zero posts between rewrites and this check must not depend on
  // one existing.
  assert.deepEqual(validateCopy(BRAND_B, BRAND_B_RUBRICS), []);
  assert.deepEqual(validateCopy(CAST, rubricsFor(CAST)), [], 'whatever cast ships must resolve');

  // An explicit cross-brand case rather than the fixture's own slides. brand-b's copy
  // happens to be portable — it uses only ink CLASSES, which both brands define, and
  // string list items, which carry no colour — so asserting on it would be testing a
  // coincidence. What is genuinely brand-bound is a bare TOKEN in a checked field.
  const brandBGround = { b: { name: 'x', bucket: 'product' as const, promise: 'x', slides: [
    { layout: 'claim', title: 'On brand-b ground', ground: 'plum' },
  ] } } as unknown as Record<string, ReturnType<typeof rubricsFor>[string]>;

  assert.deepEqual(validateCopy(BRAND_B, brandBGround), [], 'plum is brand-b\'s own token');
  const crossed = validateCopy(CAST, brandBGround);
  assert.equal(crossed.length, 1, "brand-b's palette must not validate against cast");
  assert.match(crossed[0]!.what, /ground "plum" is neither an accent token nor a background token/);
});

test('validateCopy catches the crash-later cases the type system cannot', () => {
  // An object item with no accent: cvar(undefined) calls .startsWith on undefined and
  // throws mid-render. Pinned as a golden edge case today; caught up front now.
  const bad = { x: { name: 'x', bucket: 'bright', promise: 'x', slides: [
    { layout: 'tags', title: 'boom', items: [{ label: 'no accent' }, { label: 'wrong', accent: 'nope' }] },
    { layout: 'symbolHero', title: 'ghost', icon: 'does-not-exist' },
  ] } } as unknown as Record<string, ReturnType<typeof rubricsFor>[string]>;

  const probs = validateCopy(CAST, bad);
  assert.ok(probs.some(p => p.what.includes('items[1].accent "nope"')));
  assert.ok(probs.some(p => p.what.includes('icon "does-not-exist"')));
});

/* ------------------------------------------------------------------ rendering */

test('two brands render in one process, and differ', () => {
  // The blocker this whole migration existed to remove. layouts.ts used to read the
  // wordmark, the icon set and tokens.json at module scope, so the module WAS (cast) and
  // a second brand could not be rendered without a second process.
  const a = rendererFor(CAST);
  const b = rendererFor(BRAND_B);
  const slide = { layout: 'claim', title: 'Same *copy*', index: 1, total: 2, minimal: true,
                  accent: 'accent-lime', foot: true } as never;

  const ha = a.renderSlide(slide);
  const hb = b.renderSlide(slide);

  assert.notEqual(ha, hb, 'identical copy through two brands must not produce identical HTML');
  assert.ok(ha.includes('var(--c-accent-superlime)'), 'cast paints accent-lime with superlime');
  assert.ok(hb.includes('var(--c-accent-sulphur)'), 'brand-b paints the same class with sulphur');
  assert.ok(ha.includes('mubert.com/tools/cast'), 'each brand signs with its own handle');
  assert.ok(hb.includes('example.com/brand-b'));
  assert.ok(!hb.includes('superlime'), 'not one cast token name survives into brand-b output');
});

test('rendererFor and brandFor are memoised per product, not per call', () => {
  assert.equal(rendererFor(CAST), rendererFor(CAST));
  assert.equal(brandFor(BRAND_B), brandFor(BRAND_B));
  assert.notEqual(rendererFor(CAST), rendererFor(BRAND_B));
});

test('inkFor computes contrast rather than assuming a light brand', () => {
  // brand-b inverts the palette: text.main is near-white, text.dark is near-black, and
  // the accents are darker than cast's. If inkFor had been tuned to cast's numbers this
  // is where it would put dark ink on a dark fill.
  const b = rendererFor(BRAND_B);
  assert.equal(b.inkFor('plum'), 'var(--c-text-main)', 'deep aubergine needs light ink');
  assert.equal(b.inkFor('sulphur'), 'var(--c-text-dark)', 'sulphur yellow needs dark ink');
  assert.equal(b.inkFor('ice'), 'var(--c-text-dark)');
  assert.equal(b.inkFor('superlime'), 'var(--c-text-dark)', "a cast token is unknown here — the documented fallback");
});

test('a four-class ink map is not treated as a broken five-class one', () => {
  const b = rendererFor(BRAND_B);
  const claim = (accent: string) => b.renderSlide(
    { layout: 'claim', title: 'a *b*', index: 1, total: 1, minimal: true, accent } as never);

  for (const ok of ['accent-pink', 'accent-lime', 'accent-purple', 'accent-green']) {
    assert.doesNotThrow(() => claim(ok), ok);
  }
  // The class carousel.css ships but this brand chose not to use. It must throw HERE,
  // naming the four it has — not render an undefined custom property.
  assert.throws(() => claim('accent-carrot'),
    /unknown accent class "accent-carrot" — have: accent-pink, accent-lime, accent-purple, accent-green/);
});

/* ------------------------------------------------------------------ the shell */

test('productCss is empty for a product with no overrides, and the shell shows it', () => {
  assert.equal(productCss(CAST, FORMATS.ig), '',
    'the incumbent declares no overrides — this is what kept the shell byte-identical');
  assert.equal(slidePage('<i></i>', FORMATS.ig, CAST).match(/<style>/g)?.length, 5,
    'no product block is emitted when there is nothing to put in it');

  const own = productCss(BRAND_B, FORMATS.ig);
  assert.ok(own.includes('--t-display-1:96px'), 'typeVars reach the page');
  assert.ok(own.includes('letter-spacing: 0'), 'overrideCss is read from disk and appended');
  assert.equal(slidePage('<i></i>', FORMATS.ig, BRAND_B).match(/<style>/g)?.length, 6,
    'a product with overrides gets its own block');
});

test('the product block loses to the format block, and beats carousel.css', () => {
  const html = slidePage('<i></i>', FORMATS.tiktok, BRAND_B);
  const sheet = html.indexOf('/* Carousel slide styles');
  const own = html.indexOf('--t-display-1:96px');
  const fmt = html.indexOf('/* tiktok');
  assert.ok(sheet !== -1 && own !== -1);
  assert.ok(sheet < own, 'a brand may refit what carousel.css set');
  if (fmt !== -1) assert.ok(own < fmt, 'a brand may not overrule the canvas it was asked for');
});

/* ------------------------------------------------------------------ run naming */

test('the compose run name is derived once, and the incumbent keeps its paths', () => {
  const key = { rubric: 'hot-takes', density: 'minimal', theme: 'dark', ref: null, format: FORMATS.ig };
  assert.equal(composeDeckName({ ...key, product: CAST }), 'hot-takes-minimal-dark');
  assert.ok(composeRunDir({ ...key, product: CAST }).endsWith('/out/runs/compose-hot-takes-minimal-dark'),
    'the pre-product path, byte for byte');
  assert.ok(composeRunDir({ ...key, product: BRAND_B }).endsWith('/out/runs/compose-brand-b-hot-takes-minimal-dark'),
    'a second brand sorts its runs together');

  // The divergence that used to be latent: compose pulled the digits out of --ref while
  // matrix interpolated its value raw, so a non-numeric ref would have produced a
  // directory matrix could not find and a silent row of zero slides.
  assert.equal(composeDeckName({ ...key, product: CAST, ref: 'ref-12' }), 'hot-takes-minimal-dark-r12');
  assert.equal(composeDeckName({ ...key, product: CAST, ref: 12 }), 'hot-takes-minimal-dark-r12');
  assert.equal(composeDeckName({ ...key, product: CAST, format: FORMATS.tiktok }),
    'hot-takes-minimal-dark-tiktok');
});

/* ------------------------------------------------------------------ run naming: hook */

test('the run folder is named for the hook, not just the rubric', async () => {
  const { slugHook, hookOf, composeDeckName } = await import('../../src/run.ts');
  const { rubricsFor } = await import('../../src/plan.ts');
  const key = { product: CAST, rubric: 'edit-time', density: 'full', theme: 'color',
                ref: 9, format: FORMATS.ig };

  // A rubric id says what SHAPE a post is; two posts from one rubric were two folders you
  // had to open to tell apart. The opening line is what someone scanning out/runs wants.
  // A literal rather than a shipped post's hook: this asserts the NAMING, and tying it to
  // whatever happens to be written today made it fail every time a post was rewritten.
  const hook = hookOf([{ title: 'Edit your whole episode *without* a waveform' }]);
  assert.equal(hook, 'Edit your whole episode *without* a waveform');
  assert.equal(composeDeckName({ ...key, hook }),
    'edit-time--edit-your-whole-episode-without-a-waveform-full-color-r9');

  // Optional, and its absence must leave the name exactly as it was — matrix and compose
  // both build this key, and a name they disagree on is a directory matrix cannot find.
  assert.equal(composeDeckName(key), 'edit-time-full-color-r9');
});

test('slugHook is filesystem-safe and cuts on a word', async () => {
  const { slugHook } = await import('../../src/run.ts');

  assert.equal(slugHook('How long an episode *actually* takes'),
    'how-long-an-episode-actually-takes', 'emphasis asterisks are not filename material');
  assert.equal(slugHook('Same voice. *Finished*.'), 'same-voice-finished',
    'punctuation collapses, and no trailing dash survives');
  assert.equal(slugHook(''), '');
  assert.equal(slugHook(undefined), '');
  assert.equal(slugHook('Ы — non-ASCII'), 'non-ascii', 'anything outside a-z0-9 folds away');

  // Truncation ends on a word: a cut name is going to be read by a person.
  const long = slugHook('The talking was the work and the rest of it is administration', 30);
  assert.ok(long.length <= 30);
  assert.ok(!long.endsWith('-'));
  assert.equal(long, 'the-talking-was-the-work-and');
});

/* ------------------------------------------------------------------ contrast */

test('every colour-theme accent is the most readable one available on its ground', async () => {
  // The bug this exists to prevent shipped for months: the em accent for `mainorange`
  // (#FF3400) was accent-purple (#6E75FF), a contrast ratio of 1.02 — near-identical
  // luminance, which vibrates and is painful to read. It was chosen by eye, and by eye is
  // exactly the thing nobody re-checks.
  //
  // "Above some threshold" would be the obvious assertion and it is the wrong one: this
  // palette cannot clear WCAG's 3.0 against four of its own grounds, so a 3.0 floor would
  // fail forever and get deleted. What IS always achievable is picking the best option
  // there is — so that is what is checked. A better class existing and not being used is
  // a defect; the palette's ceiling is a design constraint.
  const { readFileSync } = await import('node:fs');

  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  for (const p of Object.values(PRODUCTS)) {
    const tokens = JSON.parse(readFileSync(p.tokensJson, 'utf8')) as
      { color: { accent: Record<string, string> } };
    const hex = (t: string) => tokens.color.accent[t]!;

    for (const ground of p.colorTheme.rotation) {
      const chosen = (p.colorTheme.em as Record<string, string>)[ground]!;
      const ranked = Object.entries(p.ink)
        .map(([cls, tok]) => ({ cls, r: ratio(hex(ground), hex(tok!)) }))
        .sort((a, b) => b.r - a.r);
      const best = ranked[0]!;
      const mine = ranked.find(x => x.cls === chosen)!;

      assert.equal(chosen, best.cls,
        `${p.id}: on "${ground}" the em accent is ${chosen} (${mine.r.toFixed(2)}:1) but `
        + `${best.cls} reaches ${best.r.toFixed(2)}:1 — use the readable one`);

      // A hard floor anyway, well under WCAG but far above the vibrating pairs this
      // caught. Nothing should ever sit near 1.0 again.
      assert.ok(mine.r >= 2.0,
        `${p.id}: "${ground}" + ${chosen} is ${mine.r.toFixed(2)}:1 — too close to read`);
    }
  }
});
