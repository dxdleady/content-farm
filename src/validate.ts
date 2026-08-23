// Does this product actually hold together?
//
// The product axis fails quietly by construction, and every one of these is a real
// failure mode rather than a hypothetical:
//
//   * inkFor() returns var(--c-text-dark) for a token it does not recognise. On a brand
//     with a dark ground that is black on black, and no test fails.
//   * ink() throws on an unknown accent class — but only from inside mark()'s replace
//     callback, so a wrong accent survives every title without *emphasis* and detonates
//     on the first one that has it. The bug ships; the crash arrives later, elsewhere.
//   * icon() returns '' for a name it does not have. An invisible hole, not an error.
//   * An ink class with no rule in carousel.css renders inherited text — white on cream.
//   * brandFor() reads a product's assets lazily, which is what lets two brands coexist
//     in one process. The cost is that a missing wordmark now throws on the first render
//     instead of at import — after a tool has already launched Chrome and spent a second
//     of someone's attention. This module is where that goes back to being cheap.
//
// So: one pass over a product's declarations and copy, resolving every name against that
// product's own tokens, ink map and icon set. Deterministic, no Chrome, no network. Run
// it at the CLI edge and over every product as a unit test.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Product, Rubric, Slide } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export type Problem = {
  where: string;
  what: string;
  /**
   * Absent means 'error'. A warning is something the caller should SEE on every command
   * but which must not stop the work — the contrast audit below produces those, because
   * four of (cast)'s grounds cannot clear WCAG at their best and failing on a fact about
   * the palette would only teach people to ignore the check.
   */
  level?: 'error' | 'warn';
};

/* ------------------------------------------------------------------ contrast */

/** sRGB relative luminance, WCAG's definition. Same maths as inkFor() in layouts.ts. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** WCAG's floor for large text. The em accent is a 144px display word, so this is the bar. */
export const CONTRAST_FLOOR = 3.0;
/** Below this two colours of similar luminance vibrate; it is painful rather than merely dim. */
export const CONTRAST_FATAL = 2.0;

/**
 * Does every `--theme color` slide have a readable accent on its ground?
 *
 * This ran by eye for the whole life of the repo and the answer was no: the inherited map
 * paired mainorange (#FF3400) with accent-purple (#6E75FF) at 1.02:1 — luminances close
 * enough that the edges of the letters shimmer. It shipped in every colour-theme post.
 *
 * Two different findings, deliberately at two different severities:
 *
 *   error  a better ink class exists for this ground and is not the one chosen. Always
 *          fixable, so never acceptable.
 *   error  the chosen pair is under CONTRAST_FATAL. Nothing justifies that.
 *   warn   the best available is still under the WCAG floor. That is a fact about the
 *          palette — no accent token clears 3.0 against carrot, pink, green or lightpink —
 *          and the fix is a design decision (change the palette, or drop those grounds
 *          from the rotation), not something a linter should block a render over.
 */
export function auditContrast(p: Product): Problem[] {
  const tokens = JSON.parse(readFileSync(p.tokensJson, 'utf8')) as
    { color: { accent: Record<string, string> } };
  const hex = (t: string): string | undefined => tokens.color.accent[t];
  const out: Problem[] = [];

  for (const ground of p.colorTheme.rotation) {
    const gh = hex(ground);
    const chosen = (p.colorTheme.em as Record<string, string>)[ground];
    if (!gh || !chosen) continue;   // validateBrand already reports these as their own problem

    const ranked = Object.entries(p.ink)
      .map(([cls, tok]) => ({ cls, hex: hex(String(tok)) }))
      .filter((x): x is { cls: string; hex: string } => Boolean(x.hex))
      .map(x => ({ cls: x.cls, r: contrast(gh, x.hex) }))
      .sort((a, b) => b.r - a.r);

    const best = ranked[0];
    const mine = ranked.find(x => x.cls === chosen);
    if (!best || !mine) continue;
    const where = `${p.id}.colorTheme.em["${ground}"]`;

    if (mine.r < CONTRAST_FATAL) {
      out.push({ where, what: `${chosen} on "${ground}" is ${mine.r.toFixed(2)}:1 — the two `
        + 'colours vibrate against each other and the text is barely legible' });
    }
    if (best.cls !== chosen) {
      out.push({ where, what: `${chosen} gives ${mine.r.toFixed(2)}:1 on "${ground}", but `
        + `${best.cls} gives ${best.r.toFixed(2)}:1 — use the readable one` });
    } else if (mine.r < CONTRAST_FLOOR) {
      out.push({ level: 'warn', where, what: `${chosen} is the best available on "${ground}" `
        + `but only reaches ${mine.r.toFixed(2)}:1 (WCAG large-text floor is ${CONTRAST_FLOOR}) `
        + '— this palette has no accent that clears it on that ground' });
    }
  }
  return out;
}

// The check is in two halves, and the seam is not arbitrary.
//
//   validateBrand — assets, colour vocabulary, ink map, colour theme. Needs nothing but
//     the product itself, so it can run at the CLI edge inside productFromArgv().
//   validateCopy  — every accent, ground and icon a rubric names. Needs the rubrics, and
//     the rubrics live in plan.ts, which reads the product registry. Importing that from
//     here would close an import cycle through productFromArgv and deadlock on the first
//     top-level await. So the caller passes the rubrics in.
//
// validateProduct() is both, for callers that already have the rubrics to hand.

/** Slide fields that name a colour or a glyph, and the domain each one lives in. */
type Named = { accent?: unknown; ground?: unknown; icon?: unknown; palette?: unknown;
               items?: unknown; stats?: unknown; segments?: unknown };

export function validateBrand(p: Product): Problem[] {
  const out: Problem[] = [];
  const bad = (where: string, what: string) => out.push({ where, what });

  /* ---- 1. the assets exist, before anything launches a browser ---- */
  for (const [field, path] of [
    ['tokensJson', p.tokensJson], ['tokensCss', p.tokensCss],
    ['fontsCss', p.fontsCss], ['wordmark', p.wordmark], ['decks', p.decks],
  ] as const) {
    if (!existsSync(path)) bad(`${p.id}.${field}`, `no such file: ${path}`);
  }
  if (p.overrideCss && !existsSync(p.overrideCss)) bad(`${p.id}.overrideCss`, `no such file: ${p.overrideCss}`);
  if (p.icons && !existsSync(p.icons)) bad(`${p.id}.icons`, `no such directory: ${p.icons}`);

  // Everything below reads the tokens, so stop here if they are missing rather than
  // reporting forty consequences of one cause.
  if (out.length) return out;

  /* ---- 2. the colour vocabulary is closed ---- */
  const tokens = JSON.parse(readFileSync(p.tokensJson, 'utf8')) as
    { color: { accent: Record<string, string>; background: Record<string, string> } };
  const accents = new Set(Object.keys(tokens.color.accent));
  const grounds = new Set(Object.keys(tokens.color.background).map(k => `background-${k}`));

  for (const a of p.accents) {
    if (!accents.has(a)) bad(`${p.id}.accents`, `"${a}" is not in tokens.json — inkFor would fall back to dark ink`);
  }
  if (new Set(p.accents).size !== p.accents.length) {
    bad(`${p.id}.accents`, 'contains a duplicate — colour-forward layouts rotate through this');
  }

  // The ink classes must exist in the stylesheet, or the text inherits its colour. This
  // is the check that catches a brand inventing `accent-teal` and getting white on cream.
  const css = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
  const inCss = new Set([...css.matchAll(/^\.(accent-[a-z]+)\s*\{/gm)].map(m => m[1]!));
  for (const [cls, token] of Object.entries(p.ink)) {
    if (!inCss.has(cls)) bad(`${p.id}.ink`, `class "${cls}" has no rule in carousel.css — its text would inherit`);
    if (!accents.has(token)) bad(`${p.id}.ink`, `class "${cls}" paints with "${token}", which is not in tokens.json`);
  }

  /* ---- 3a. and is readable. Runs on every CLI command, because every one of them
     resolves a product through productFromArgv() -> assertBrand(). ---- */
  out.push(...auditContrast(p));

  /* ---- 3. the colour theme covers what it rotates through ---- */
  const ct = p.colorTheme;
  for (const g of ct.rotation) {
    if (!accents.has(g)) bad(`${p.id}.colorTheme.rotation`, `"${g}" is not in tokens.json`);
    if (!ct.em[g]) bad(`${p.id}.colorTheme.em`, `no em accent for ground "${g}" — the marked word would be unstyled`);
    else if (!(ct.em[g] in p.ink)) bad(`${p.id}.colorTheme.em`, `ground "${g}" maps to "${ct.em[g]}", which is not an ink class`);
    if (!ct.hue[g]) bad(`${p.id}.colorTheme.hue`, `no prose hue for ground "${g}" — the image prompt would say "undefined"`);
  }

  return out;
}

/**
 * The name sets a product resolves its copy against, read once per product.
 *
 * These used to be read inside every validate call — tokens.json parsed, carousel.css
 * parsed, the icon directory listed. Fine for a CLI that validates once before spending
 * money; not fine for tools/studio.ts, which validates a draft on every edit. Memoised on
 * the product id, so a long-lived process pays for each brand exactly once.
 */
export type NameSets = {
  accents: Set<string>;
  grounds: Set<string>;
  icons: Set<string>;
  inkClasses: Set<string>;
  iconDir: string;
};

const setsCache = new Map<string, NameSets>();

export function nameSets(p: Product): NameSets {
  const hit = setsCache.get(p.id);
  if (hit) return hit;

  const tokens = JSON.parse(readFileSync(p.tokensJson, 'utf8')) as
    { color: { accent: Record<string, string>; background: Record<string, string> } };
  const iconDir = p.icons ?? join(ROOT, 'assets/icons-clean');
  const built: NameSets = {
    accents: new Set(Object.keys(tokens.color.accent)),
    grounds: new Set(Object.keys(tokens.color.background).map(k => `background-${k}`)),
    icons: new Set(readdirSync(iconDir).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4))),
    inkClasses: new Set(Object.keys(p.ink)),
    iconDir,
  };
  setsCache.set(p.id, built);
  return built;
}

/**
 * One slide, against one product's vocabulary.
 *
 * Exported because the studio attaches problems to individual slides — "this accent is
 * wrong" belongs next to the slide it is wrong on, not in a list at the bottom of a page.
 * The smallest unit used to be a whole Record<string, Rubric>, which is why
 * test/unit/product.test.ts had to build a synthetic one-rubric object to check a slide.
 */
export function validateSlide(p: Product, slide: Slide, where: string, sets = nameSets(p)): Problem[] {
  const out: Problem[] = [];
  const bad = (what: string) => out.push({ where, what });
  const { accents, grounds, icons, inkClasses, iconDir } = sets;
  const s = slide as Slide & Named;

  // `accent` is an ink CLASS. `ground` and item accents are bare TOKENS. The two
  // domains are disjoint on purpose and mixing them is the single most common way
  // to get this wrong — see the ink() guard in layouts.ts.
  if (s.accent != null && !inkClasses.has(String(s.accent))) {
    bad(`accent "${s.accent}" is not an ink class — have: ${[...inkClasses].join(', ')}`);
  }
  if (s.ground != null && !accents.has(String(s.ground)) && !grounds.has(String(s.ground))) {
    bad(`ground "${s.ground}" is neither an accent token nor a background token`);
  }
  if (Array.isArray(s.palette)) {
    for (const a of s.palette) if (!accents.has(String(a))) bad(`palette token "${a}" is not in tokens.json`);
  }
  if (typeof s.icon === 'string' && !icons.has(s.icon)) {
    bad(`icon "${s.icon}" is not in ${iconDir.replace(ROOT + '/', '')} — it would render as nothing`);
  }
  // Object items carry their own accent as a bare token, and a MISSING one is worse
  // than a wrong one: cvar(undefined) calls .startsWith on undefined and throws.
  if (Array.isArray(s.items)) {
    s.items.forEach((it, k) => {
      if (it == null || typeof it !== 'object') return;
      const o = it as { accent?: unknown; icon?: unknown };
      if (o.accent != null && !accents.has(String(o.accent))) {
        bad(`items[${k}].accent "${o.accent}" is not in tokens.json`);
      }
      if (typeof o.icon === 'string' && !icons.has(o.icon)) {
        bad(`items[${k}].icon "${o.icon}" does not exist — it would render as nothing`);
      }
    });
  }
  return out;
}

/** Every accent, ground and icon name a product's copy uses must resolve for THAT product. */
export function validateCopy(p: Product, rubrics: Record<string, Rubric>): Problem[] {
  const sets = nameSets(p);
  const out: Problem[] = [];
  for (const [id, r] of Object.entries(rubrics)) {
    r.slides.forEach((slide, i) => {
      out.push(...validateSlide(p, slide, `${p.id}/${id}[${i}] ${slide.layout}`, sets));
    });
  }
  return out;
}

/** Both halves, for a caller that has the rubrics already. */
export function validateProduct(p: Product, rubrics: Record<string, Rubric>): Problem[] {
  const brand = validateBrand(p);
  // A broken brand makes every copy complaint a consequence rather than a cause.
  return brand.length ? brand : validateCopy(p, rubrics);
}

/** Format a product's problems the way a CLI should print them. */
export function formatProblems(problems: Problem[]): string {
  const w = Math.max(...problems.map(p => p.where.length));
  return problems.map(p => `  ${p.where.padEnd(w)}  ${p.what}`).join('\n');
}

/**
 * The CLI edge. Exits rather than throwing, because a stack trace here tells the reader
 * nothing they need — the message is the whole content.
 */
export function assertBrand(p: Product): void {
  const problems = validateBrand(p);
  const errors = problems.filter(x => x.level !== 'warn');
  const warnings = problems.filter(x => x.level === 'warn');

  // Warnings are printed on every command and stop nothing. They exist so a known-weak
  // pair stays visible instead of quietly becoming normal.
  if (warnings.length) {
    console.error(`product "${p.id}" — ${warnings.length} warning(s):\n` + formatProblems(warnings));
  }
  if (!errors.length) return;
  console.error(`product "${p.id}" does not hold together — ${errors.length} problem(s):\n`
    + formatProblems(errors));
  process.exit(1);
}
