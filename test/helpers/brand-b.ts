// A second brand, built to be hostile.
//
// A friendly clone of (cast) would prove nothing: it would pass every check by having
// the same answers, and the whole question is whether the renderer still knows the
// difference between "the product" and "the only product it has ever seen". So brand-b
// disagrees on every axis it is allowed to disagree on:
//
//   * Not one accent token NAME is shared with cast. Anything that hardcoded 'superlime'
//     or 'purpleblue' — three tables used to — resolves to nothing here.
//   * The ground is near-black and `text.main` is the LIGHT ink, the opposite of cast.
//     inkFor() computes contrast rather than assuming, and this is what proves it: get it
//     wrong and brand-b renders black on black with no test failing.
//   * FOUR ink classes, not five. Nothing may assume the map is total — carousel.css
//     ships five rules and a product is entitled to use a subset.
//   * A serif display face, and an overrideCss that actually exists, so the last-resort
//     stylesheet is exercised rather than merely declared.
//
// It lives in test/fixtures rather than products/ on purpose. It is a proof, not a brand:
// putting invented copy and a made-up wordmark in products/ would make it look shippable,
// and the next real product should land in an empty directory.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Product, Rubric } from '../../src/types.ts';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'brand-b');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const BRAND_B: Product = {
  id: 'brand-b',
  name: 'Brand B',
  handle: 'example.com/brand-b',
  dir: HERE,

  tokensJson: join(HERE, 'tokens.json'),
  tokensCss: join(HERE, 'tokens.css'),
  fontsCss: join(ROOT, 'assets/fonts/fonts.css'),   // the shared pool, named not copied
  wordmark: join(HERE, 'wordmark.svg'),
  decks: HERE,

  accents: ['ember', 'sulphur', 'ice', 'moss', 'plum'],

  // Four of the five classes carousel.css ships. `accent-carrot` is deliberately absent.
  ink: {
    'accent-pink': 'ember',
    'accent-lime': 'sulphur',
    'accent-purple': 'plum',
    'accent-green': 'moss',
  },

  colorTheme: {
    rotation: ['ember', 'plum', 'moss', 'ice', 'sulphur'],
    // Measured, not guessed — and the audit caught two of these when it was first wired
    // in, which is the point of a fixture: it gets the same scrutiny the shipped brand
    // does. Unlike cast, brand-b's palette clears WCAG comfortably on every ground, so
    // there are no warnings here to normalise.
    em: {
      ember: 'accent-purple',   // 4.89  (was accent-lime at 2.20)
      plum: 'accent-lime',      // 10.77
      moss: 'accent-lime',      // 3.75  (was accent-pink)
      ice: 'accent-purple',     // 10.89
      sulphur: 'accent-purple', // 10.77
    },
    hue: {
      ember: 'burnt orange', plum: 'deep aubergine', moss: 'forest green',
      ice: 'pale glacier blue', sulphur: 'sulphur yellow',
    },
  },

  art: {
    subject: 'Brand B — a fixture, not a product',
    palette: 'Palette is muted and cold: near-black #07070A grounds it.',
    base: [],
    hard: [],
  },

  typeVars: { '--t-display-1': '96px' },
  overrideCss: join(HERE, 'override.css'),
};

/** One rubric, honouring the same envelope every real rubric does. */
export const BRAND_B_RUBRICS: Record<string, Rubric> = {
  'b-basics': {
    name: 'B Basics', bucket: 'bright',
    promise: 'A minimal rubric that exists to be rendered, not read.',
    slides: [
      { layout: 'statement', kicker: 'Hook', accent: 'accent-lime', title: 'A second *brand*' },
      { layout: 'claim', accent: 'accent-pink', title: 'Different *tokens*' },
      { layout: 'bigQuestion', accent: 'accent-purple', title: 'Does the renderer *notice*?' },
      { layout: 'tags', kicker: 'Its palette', items: ['ember', 'sulphur', 'ice', 'moss', 'plum'] },
      { layout: 'claim', accent: 'accent-green', title: 'On a dark *ground*', ground: 'background-dark' },
      { layout: 'quote', accent: 'accent-lime', title: 'Four ink classes, not five' },
      { layout: 'callout', accent: 'accent-pink', title: 'And a serif *face*' },
      { layout: 'splash', accent: 'accent-lime', title: 'Not a product.' },
    ],
  } as Rubric,
};
