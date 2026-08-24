// The sixth axis: which brand a post is composed for.
//
//   post = product × rubric × density × ref × theme × format
//
// The engine is shared — layouts, carousel.css, the format system, the generation
// pipeline. A product owns its assets, its colour vocabulary and its voice.
//
// Structurally this is src/formats.ts with the nouns changed, on purpose: registry,
// resolver, CLI edge, tag. Two properties are load-bearing and worth stating:
//
//   * The incumbent has NO override keys. `cast` declares no typeVars, formatVars,
//     overrideCss, refs or icons — exactly as FORMATS.ig declares no `vars`. That is
//     what makes "add a product" a purely additive change.
//
//   * productTag('cast') is the empty string, so every path it is concatenated into
//     stays byte-identical. Existing out/runs folders, and anything that greps them,
//     keep working.
//
// Asset paths are routed through here so moving a file into products/cast/ costs one
// line. tokens/ and the wordmark have moved; fonts and icons deliberately have not —
// they are shared pools that a product names into, not brand-private files.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBrand } from './validate.ts';
import type { AccentToken, InkClass, Product, ProductId } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAST_DIR = join(ROOT, 'products/cast');

/** The design-system order. Colour-forward layouts walk this so a row never repeats a hue. */
const CAST_ACCENTS: AccentToken[] = [
  'superlime', 'pink', 'purpleblue', 'green', 'carrot',
  'violet65', 'mainorange', 'blue67', 'lightpink',
];

/** The five ink classes carousel.css ships, and the token each one paints with. */
const CAST_INK: Record<InkClass, AccentToken> = {
  'accent-pink': 'pink',
  'accent-lime': 'superlime',
  'accent-carrot': 'carrot',
  'accent-purple': 'purpleblue',
  'accent-green': 'green',
};

const SOMA_DIR = join(ROOT, 'products/soma');

/** SOMA's design order — Kinetic v7 blues first, the warm vapor accents between them. */
const SOMA_ACCENTS = [
  'sky', 'terracotta', 'mint', 'indigo', 'clay',
  'periwinkle', 'sage', 'skydeep', 'mist',
];

/** The shared ink classes, painted with SOMA tokens. All five are used. */
const SOMA_INK = {
  'accent-pink': 'terracotta',
  'accent-lime': 'mint',
  'accent-purple': 'indigo',
  'accent-green': 'sky',
  'accent-carrot': 'clay',
};

export const PRODUCTS = {
  cast: {
    id: 'cast',
    name: '(cast)',
    handle: 'mubert.com/tools/cast',
    dir: CAST_DIR,

    tokensJson: join(CAST_DIR, 'tokens/tokens.json'),
    tokensCss: join(CAST_DIR, 'tokens/tokens.css'),
    fontsCss: join(ROOT, 'assets/fonts/fonts.css'),
    wordmark: join(CAST_DIR, 'logos/wordmark.svg'),
    decks: join(CAST_DIR, 'copy/decks'),

    accents: CAST_ACCENTS,
    ink: CAST_INK,

    // Lifted verbatim from tools/compose.ts. The rotation order is deliberately not
    // the design-system order above — it is tuned so consecutive slides contrast.
    colorTheme: {
      rotation: ['carrot', 'purpleblue', 'pink', 'green', 'violet65',
                 'mainorange', 'blue67', 'superlime', 'lightpink'],
      // Chosen by measured contrast, not by eye. The inherited map paired mainorange
      // (#FF3400) with accent-purple (#6E75FF) at a ratio of 1.02 — luminances so close
      // the two colours vibrate against each other, which is painful to look at and
      // barely legible. carrot/purple was 1.47. Both had shipped in every --theme color
      // post since the tables were written.
      //
      // Each entry below is now the highest-contrast ink class available for that ground,
      // and test/unit/product.test.ts enforces exactly that — a better option existing and
      // not being used is the bug, and it is checkable, unlike "looks fine to me".
      //
      // Four grounds still fall short of WCAG's 3.0 large-text floor at their best, which
      // is a fact about this palette rather than about this map: no accent token in
      // tokens.json clears 3.0 against carrot, pink, green or lightpink. Fixing that means
      // changing the palette or dropping those grounds from the rotation — a design call,
      // not one to make silently here.
      em: {
        carrot: 'accent-lime',        // 2.29 — best available; the palette caps it here
        purpleblue: 'accent-lime',    // 3.35
        pink: 'accent-lime',          // 2.82 — best available
        green: 'accent-purple',       // 2.40 — best available
        violet65: 'accent-lime',      // 3.71
        mainorange: 'accent-lime',    // 3.30 — was 1.02
        blue67: 'accent-lime',        // 4.31
        superlime: 'accent-purple',   // 3.35
        lightpink: 'accent-purple',   // 2.63 — best available
      },
      hue: {
        carrot: 'carrot orange', purpleblue: 'blue-violet', pink: 'hot pink',
        green: 'bright grass green', violet65: 'electric violet', mainorange: 'bright orange',
        blue67: 'cobalt blue', superlime: 'acid lime-green', lightpink: 'soft candy pink',
      },
    },

    // Lifted out of src/styles.json. Only two of its eight lines named a brand, and
    // those two are here; the other six were craft, true for any product, and stayed.
    art: {
      subject: '(cast) — an audio/podcast editing brand',
      palette: 'Palette is loud and pushed: matte black #0A0A0A grounds it, and the image commits hard to accents from #6E75FF #FE4F8D #FE7A7C #EEFF04 #23EE78 #FF3400 #995CED #555DFF. Two or three of them, at full saturation. No muddy mid-tones, no pastel wash, no beige.',
      // Nothing to add to the craft frame, and nothing to forbid beyond it. A brand that
      // needs more — "never show a physical microphone", say — puts it here.
      base: [],
      hard: [],
    },
  },
  soma: {
    id: 'soma',
    name: 'SOMA',
    handle: 'soma4health.com',
    dir: SOMA_DIR,

    tokensJson: join(SOMA_DIR, 'tokens/tokens.json'),
    tokensCss: join(SOMA_DIR, 'tokens/tokens.css'),
    // Its own pool, not the shared one: the brand faces are Newsreader + Manrope,
    // and neither lives in assets/fonts.
    fontsCss: join(SOMA_DIR, 'fonts/fonts.css'),
    wordmark: join(SOMA_DIR, 'logos/wordmark.svg'),
    decks: join(SOMA_DIR, 'copy/decks'),

    accents: SOMA_ACCENTS,
    ink: SOMA_INK,

    colorTheme: {
      // Alternates dark/light and cool/warm so consecutive slides contrast.
      rotation: ['sky', 'mist', 'clay', 'mint', 'skydeep', 'indigo', 'periwinkle'],
      // Measured, like cast's — each entry is the highest-contrast ink class available
      // for that ground (test/unit/product.test.ts enforces it). Two grounds fall short
      // of WCAG's 3.0 large-text floor at their best — indigo (2.14) and periwinkle
      // (2.87) — which is a fact about this palette; the audit surfaces both as warnings.
      em: {
        sky: 'accent-lime',           // 3.33
        mist: 'accent-carrot',        // 4.33
        clay: 'accent-lime',          // 3.65
        mint: 'accent-carrot',        // 3.65
        skydeep: 'accent-lime',       // 5.37
        indigo: 'accent-lime',        // 2.14 — best available
        periwinkle: 'accent-carrot',  // 2.87 — best available
      },
      hue: {
        sky: 'muted steel blue', mist: 'pale ice blue', clay: 'burnt clay red',
        mint: 'cool mint green', skydeep: 'deep slate blue',
        indigo: 'electric periwinkle indigo', periwinkle: 'soft periwinkle blue',
      },
    },

    art: {
      subject: 'SOMA — an AI health agent that reads across all your wearables (Oura, Whoop, CGM, Apple Health) and answers with one next best action',
      palette: 'Palette is calm, airy and editorial: deep indigo-navy #0c0a16 or warm off-white #f6f7f7 grounds it, with accents from #8faef8 #5a7df5 #c6d6fd #8fd3b4 #3e6a8c #c97f55. Muted premium-wellness tones in soft natural daylight. No neon, no acid brights, no clinical blue-white, no HDR gym-ad grit.',
      base: [],
      hard: ['Never show a specific real wearable brand, logo or readable UI — devices stay generic.'],
    },

    // Product-private style refs: 27 real lifestyle photos (gym, food, recovery)
    // supplied by the brand, sitting alongside the shared refs/ pool.
    refs: join(SOMA_DIR, 'refs'),
  },
} satisfies Record<ProductId, Product>;

export const DEFAULT_PRODUCT: ProductId = 'cast';

/** Resolve a --product value to a product object. Throws on typos. */
export function resolveProduct(id?: string | null): Product {
  if (!id) return PRODUCTS[DEFAULT_PRODUCT];
  const key = String(id).toLowerCase();
  const p = (PRODUCTS as Record<string, Product | undefined>)[key];
  if (!p) throw new Error(`unknown product "${id}" — have: ${Object.keys(PRODUCTS).join(', ')}`);
  return p;
}

/**
 * Read `--product x` off argv, falling back to $PRODUCT, then the default.
 * A typo exits with a message rather than a stack trace, matching formatFromArgv.
 */
export function productFromArgv(argv: string[] = process.argv): Product {
  const i = argv.indexOf('--product');
  let p: Product;
  try {
    p = resolveProduct(i > -1 ? argv[i + 1] : process.env.PRODUCT);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  // Checked at the one edge every tool goes through, rather than in eleven mains. Only
  // the half that needs no rubrics runs here — see the split at the top of validate.ts.
  assertBrand(p);
  return p;
}

/** Suffix for run folders — the incumbent stays unsuffixed so its paths never move. */
export const productTag = (p: Product): string => (p.id === DEFAULT_PRODUCT ? '' : `-${p.id}`);
