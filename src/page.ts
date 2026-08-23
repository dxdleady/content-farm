// The one HTML shell a rendered slide lives in.
//
// There were eight copies of this, and they had already drifted: src/render.ts appends
// `:root{--grain:…}` and the seven tool copies do not. That difference is load-bearing —
// renderSlide only emits `<span class="grain">` when a slide is NOT minimal, so a naive
// "extract the common wrapper" would have handed grain texture to seven tools and the
// only visible symptom would have been on slides nobody was looking at.
//
// So the tail is a parameter, not an assumption. Callers pass exactly what they had.
//
// The cascade order below is a contract, asserted in test/unit/page.test.ts:
//
//   fonts → tokens → carousel.css → product → format → reset
//
// Two of those placements are load-bearing. The format block sits AFTER carousel.css
// because both set slide geometry at equal specificity, so the later one wins — swap
// them and every TikTok render silently comes out at Instagram metrics. The product
// block sits BEFORE the format block for the same reason, read the other way: a brand
// may refit type, but it does not get to overrule the canvas it was asked for. When it
// genuinely needs to, Product.formatVars rides in the product block keyed by format.
import { FONTS, TOKENS, SHEET, assetsFor, productCss } from './assets.ts';
import { formatCss } from './formats.ts';
import { PRODUCTS, DEFAULT_PRODUCT } from './product.ts';
import type { Format, Product } from './types.ts';

/**
 * @param product whose fonts, tokens and overrides the page carries. Defaults to the
 *   incumbent so the eight existing callers keep working while they are converted.
 * @param extraCss appended inside the last <style>, after the html/body reset. This is
 *   where src/render.ts puts its --grain tile; every other caller passes nothing.
 */
export const slidePage = (
  inner: string,
  fmt: Format,
  product: Product = PRODUCTS[DEFAULT_PRODUCT],
  extraCss = '',
): string => {
  // The incumbent's assets are the module-level FONTS/TOKENS bindings; going through
  // assetsFor() for it too would be equivalent but would make that equivalence a thing
  // to trust rather than to read.
  const a = product.id === DEFAULT_PRODUCT ? { FONTS, TOKENS, SHEET } : assetsFor(product);
  const own = productCss(product, fmt);
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${a.FONTS}</style><style>${a.TOKENS}</style><style>${a.SHEET}</style>
${own ? `<style>${own}</style>\n` : ''}<style>${formatCss(fmt)}</style>
<style>html,body{margin:0;background:#000}${extraCss}</style>
</head><body>${inner}</body></html>`;
};
