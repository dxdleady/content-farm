// The three stylesheets every rendered page carries.
//
// This was copy-pasted into ten files — src/render plus nine tools — always the same
// three lines, always in the same order. The win is maintenance, not speed: each copy
// already ran once per process, so nothing gets faster. What changes is that the woff2
// inlining regex now has one definition instead of ten slightly-differently-wrapped ones.
//
// Two of the three are brand data and are therefore a function of the product; the third
// is not. carousel.css is the *system* — the grid, the safe-area maths, the layout
// classes — and every brand renders through the same one. So SHEET stays a plain const
// while FONTS and TOKENS are resolved per product and memoised.
//
// The reads are lazy per product but eager for the incumbent: FONTS and TOKENS are still
// exported as plain strings bound to the default product, because three tools import them
// directly and none of them knows about products yet.
//
// test/helpers/page.ts deliberately keeps its own copy of all this. It is the frozen
// arbiter this extraction is checked against, so it must not depend on the thing under test.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, DEFAULT_PRODUCT } from './product.ts';
import type { Format, Product, ProductId } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The slide stylesheet. Shared by every product — it is the system, not the brand. */
export const SHEET: string = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');

export type BrandAssets = {
  /** fonts.css with every woff2 inlined as a data: URI, so a render never depends on
   *  fonts being installed on the machine — or on Chrome being allowed to fetch them. */
  FONTS: string;
  /** The design tokens, minus the @import that only makes sense on the web build. */
  TOKENS: string;
  SHEET: string;
};

const cache = new Map<string, BrandAssets>();

/** Read a product's stylesheets, once. */
export function assetsFor(p: Product): BrandAssets {
  const hit = cache.get(p.id);
  if (hit) return hit;

  // woff2 paths inside fonts.css are relative to fonts.css itself, so resolve them
  // against its directory rather than a fixed root.
  const fontDir = dirname(p.fontsCss);
  const built: BrandAssets = {
    FONTS: readFileSync(p.fontsCss, 'utf8')
      .replace(/url\((woff2\/[^)]+)\)/g, (_, rel) =>
        `url(data:font/woff2;base64,${readFileSync(join(fontDir, rel)).toString('base64')})`),
    TOKENS: readFileSync(p.tokensCss, 'utf8').replace(/@import[^\n]*\n/, ''),
    SHEET,
  };
  cache.set(p.id, built);
  return built;
}

const incumbent = assetsFor(PRODUCTS[DEFAULT_PRODUCT]);

export const FONTS: string = incumbent.FONTS;
export const TOKENS: string = incumbent.TOKENS;

/* ──────────────────────────────────────────────────────── the product's own CSS */

/**
 * A product's style overrides, as one stylesheet — or the empty string.
 *
 * The empty string is the important case, not the degenerate one. The incumbent declares
 * no overrides at all, so this returns '' for (cast) and src/page.ts emits no block —
 * which is why adding this axis moves not one byte of the shell it is being added to. A
 * `<style></style>` would have been harmless to render and fatal to that guarantee.
 *
 * Order inside: custom properties first, then the escape-hatch sheet, so a product can
 * override its own variables with real rules if it has to.
 */
export function productCss(p: Product, fmt?: Format): string {
  const cache = cssCache.get(p.id) ?? new Map<string, string>();
  const key = fmt?.id ?? '-';
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const vars: string[] = [];
  for (const [k, v] of Object.entries(p.typeVars ?? {})) vars.push(`${k}:${v}`);
  // Per (product × format) refits. Merged in here rather than into formatCss because the
  // format block is product-neutral — the same 9:16 safe-areas serve every brand — and a
  // product's opinion about 9:16 is the product's, not the format's.
  if (fmt) for (const [k, v] of Object.entries(p.formatVars?.[fmt.id] ?? {})) vars.push(`${k}:${v}`);

  const built = (vars.length ? `:root{${vars.join(';')}}` : '')
    + (p.overrideCss ? readFileSync(p.overrideCss, 'utf8') : '');

  cache.set(key, built);
  cssCache.set(p.id, cache);
  return built;
}

const cssCache = new Map<string, Map<string, string>>();
