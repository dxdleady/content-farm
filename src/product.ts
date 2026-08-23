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
