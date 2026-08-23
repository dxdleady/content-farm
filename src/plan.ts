// The content-plan ENGINE. Product-neutral: nothing here names a brand.
//   A post = rubric × density (data/density.json) × ref (refs/analysis) × ...
//
// The copy no longer lives here, and no longer lives in products/<id>/copy/rubrics.ts
// either. It lives in products/<id>/copy/posts/*.json, one file per published thing —
// because a "rubric" used to mean both the shape of a post and one specific post's words,
// and you cannot pick a template that already has a topic inside it.
//
// rubricsFor() survives as a VIEW over those posts: it returns the same
// Record<string, Rubric> nine tools and the golden corpus were written against, built
// from the JSON. That is what let 23 352 characters of copy move out of TypeScript
// without a single golden moving.
import { PRODUCTS, DEFAULT_PRODUCT } from './product.ts';
import { asRubric, postsById } from './post.ts';
import type { LayoutName, Product, Rubric } from './types.ts';

// Layouts that can carry a full-bleed generated background (call art() internally).
export const ART_CAPABLE: Set<LayoutName> = new Set([
  'statement', 'stat', 'quote', 'splash', 'tags', 'bento', 'poster', 'photo', 'steps', 'symbolHero',
]);

// Keyed by id rather than by ProductId: a fixture brand has an id the union does not
// name, and asking for its rubrics should be a clean throw, not a type error at the
// call site of something that is allowed to fail.
/**
 * A product's posts, as rubrics.
 *
 * Read from disk on every call rather than imported once: posts are JSON that
 * tools/studio.ts writes while it runs, and a static import would have served the state
 * the process booted with. The read is a directory listing plus a few small JSON parses —
 * cheap enough that caching it would only be a way to serve something stale.
 */
export function rubricsFor(p: Product): Record<string, Rubric> {
  // No posts is a valid state, not an error. It is what a brand looks like before its
  // first one is written, and throwing here took the whole process down at import —
  // src/plan.ts binds RUBRICS at module scope, so a product with an empty posts
  // directory could not even load the tool that would have created its first post.
  // Callers asking for a SPECIFIC rubric still fail, with a message naming what exists.
  const posts = postsById(p);
  return Object.fromEntries(Object.entries(posts).map(([id, post]) => [id, asRubric(post)]));
}

/** The incumbent's, bound at import for the tools and tests that predate the product axis. */
export const RUBRICS: Record<string, Rubric> = rubricsFor(PRODUCTS[DEFAULT_PRODUCT]);


// --- global image-prompt builder (the one place that decides "art, not stock") ---
export const ART_DIRECTIVE =
  "Render it EXACTLY in the reference's medium, mood and FINISH — match its brightness, gloss, saturation and "
  + "pop. A polished editorial / campaign image: confident, graphic, a striking crop, with real negative space. "
  + "Stay faithful to the reference's colour and lighting. Do NOT darken, dull, mute, dirty, distress or grunge "
  + "it; NO added grain, NO HDR crunch, NO crushed shadows, NO torn or gritty texture, NO glitch — unless the "
  + "reference itself already looks that way. Bright, saturated, glossy, clean and high-craft. Also avoid the "
  + "opposite: no soft dreamy blur, no gradient haze, no neutral stock-studio backdrop.";

// keep = the ref's KEEP recipe; lines = [ "SUBJECT: …", "COMPOSITION: …", "COLOUR: …" ]
export function composePrompt(keep: string[], lines: string[]): string {
  return [
    keep.join('\n'), '',
    "REPLACE — the subject and composition are new, but keep the reference's MEDIUM and its bold colour energy exactly; do NOT clean it up, soften it, or make it tasteful:",
    ...lines.map(l => `· ${l}`),
    '',
    ART_DIRECTIVE,
  ].join('\n');
}

// Map a ref number/name to its analysis file name in refs/analysis/.
// The pool is shared across products — a look is not a brand — so the names carry no
// brand prefix. Zero-padded so the directory sorts the way a human numbers it, which
// bgen.refs() depends on: it samples the first five lexicographically.
export const refAnalysisFile = (ref: string | number): string => {
  const n = String(ref).match(/\d+/)?.[0];
  return n ? `ref-${String(n).padStart(2, '0')}.json` : String(ref);
};
