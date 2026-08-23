// (cast) carousel layouts. Every layout returns the inner HTML of one slide.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, DEFAULT_PRODUCT } from './product.ts';
import type {
  AccentToken, GroundToken, InkClass, InkMap, LayoutName, Product, ProductId,
  RenderSlide, Tokens,
} from './types.ts';


const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');


/* ═══════════════════════════════════════════════════════════════════════════
   Brand — everything a product supplies to the renderer
   ═══════════════════════════════════════════════════════════════════════════
   These four assets used to be module-scope `const`s read eagerly at import, which
   meant the module WAS (cast): two products could not be rendered by one process.
   They are read per product now, and memoised, so the cost is unchanged for a run
   that only ever touches one brand — which is every run today. */

export type Brand = {
  icons: Record<string, string>;
  wordmark: string;
  tokens: Tokens;
  ink: InkMap;
  /** The product's own token names. Strings, not AccentToken — that union is the
   *  incumbent's vocabulary, and a second brand shares none of it. */
  accents: string[];
  handle: string;
};

const brands = new Map<string, Brand>();

export function brandFor(p: Product): Brand {
  const hit = brands.get(p.id);
  if (hit) return hit;
  const iconDir = p.icons ?? join(ROOT, 'assets/icons-clean');
  const built: Brand = {
    icons: Object.fromEntries(
      readdirSync(iconDir)
        .filter(f => f.endsWith('.svg'))
        .map(f => [f.slice(0, -4), readFileSync(join(iconDir, f), 'utf8')])),
    wordmark: readFileSync(p.wordmark, 'utf8'),
    tokens: JSON.parse(readFileSync(p.tokensJson, 'utf8')) as Tokens,
    ink: p.ink,
    accents: p.accents,
    handle: p.handle,
  };
  brands.set(p.id, built);
  return built;
}

/**
 * Build a renderer bound to one brand.
 *
 * The 32 layout bodies below are unchanged — not one character. They already read
 * `icon`, `wordmark`, `inkFor`, `fillOf`, `ink` and `ACCENTS` as free variables, so
 * closing over them costs no edit inside the templates. That matters more than it
 * looks: the whitespace inside those template literals IS the emitted HTML, so a
 * re-indent would move all 326 goldens. Nothing here is re-indented for exactly
 * that reason, which also keeps the diff to the two inserted blocks.
 */
export function makeRenderer(brand: Brand) {
const icons = brand.icons;
const wordmark = brand.wordmark;

const icon = (n: string): string => icons[n] ?? '';

// Token accents, in the order the design system lists them. Colour-forward layouts
// walk this list so a tag row / bento grid never repeats a hue.
const ACCENTS = brand.accents;
const cvar = (a: AccentToken | GroundToken): string =>
  (a.startsWith('background-') ? `var(--c-${a})` : `var(--c-accent-${a})`);

// Accent fills carry text, so pick the readable ink for each one instead of
// assuming dark-on-colour. sRGB relative luminance, WCAG threshold.
const TOKENS = brand.tokens;
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const inkFor = (accent: AccentToken | GroundToken | string): string => {
  const hex = TOKENS.color.accent[accent]
    ?? TOKENS.color.background[String(accent).replace('background-', '')];
  if (!hex) return 'var(--c-text-dark)';
  const L = lum(hex);
  return ratio(L, lum(TOKENS.color.text.main!)) > ratio(L, lum(TOKENS.color.text.dark!))
    ? 'var(--c-text-main)' : 'var(--c-text-dark)';
};
const rotate = <T,>(list: T[], offset = 0) => (i: number): T => list[(i + offset) % list.length]!;
// A chip/row painted in the same colour as the slide ground disappears, so the
// ground is removed from the rotation before anything cycles through it.
// AccentToken[] on the way out because that is what the layouts consume; the product's
// own names arrive as strings. The cast is where the two vocabularies meet, and it is
// safe for the same reason cvar() is: these names are only ever interpolated into a
// --c-accent-<name> custom property, and validateBrand() has already resolved every one
// of them against the product's own tokens.json.
const paletteFor = (s: RenderSlide): AccentToken[] => {
  const all = ((s.palette ?? ACCENTS) as AccentToken[]).filter(a => a !== s.ground);
  if (!s.ground) return all;

  // Removing the ground is not enough. On a flooded brand ground most of the remaining
  // palette is unreadable against it — measured on (cast): seven of eight accents on
  // `carrot`, five on `purpleblue`, and mainorange-on-purpleblue lands at 1.02:1, the
  // same vibrating pair that had to be fixed in colorTheme.em. Every --theme color post
  // with an index, tags or bento row was painting rows in colours that shimmer.
  //
  // So the rotation is filtered by contrast, not just by identity. Same maths as inkFor.
  const g = String(s.ground);
  const gh = TOKENS.color.accent[g] ?? TOKENS.color.background[g.replace('background-', '')];
  if (!gh) return all;

  const scored = all
    .map(a => ({ a, r: TOKENS.color.accent[a] ? ratio(lum(gh), lum(TOKENS.color.accent[a]!)) : 0 }))
    .filter(x => x.r > 0);
  const readable = scored.filter(x => x.r >= 2).map(x => x.a);

  // Below two survivors the row colours stop reading as a rotation anyway, so take the
  // two best rather than emit nothing — a short cycle beats an unreadable one.
  return readable.length >= 2 ? readable : scored.sort((x, y) => y.r - x.r).slice(0, 2).map(x => x.a);
};
const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// One map, not three. This was INK_CLASSES (which classes exist) + FILL (class -> colour
// var) + TOKEN_OF (class -> bare token), and they were not independent: FILL[c] is always
// cvar(TOKEN_OF[c]), and both mirror the five rules at carousel.css:65-69. The map lives
// on the product because the vocabulary is a brand decision — tokens.json carries nine
// accents, only five earn a class, and calling one `accent-purple` rather than
// `accent-purpleblue` is a choice, not data. test/unit/layouts.test.ts checks it against
// the stylesheet so the two cannot drift.
const INK = brand.ink;
const INK_CLASSES = new Set(Object.keys(INK));
/** The one legitimate bridge between the two accent domains — quote() passes a bare token. */
const fillOf = (c: InkClass | AccentToken): string => cvar((INK[c as InkClass] ?? c) as AccentToken);
/** Readable ink over an accent fill; inkFor() wants 'superlime', not 'accent-lime'. */
const inkClassInk = (c: InkClass): string => inkFor(INK[c] ?? c);
const ink = (c?: InkClass): InkClass | undefined => {
  if (c && !INK_CLASSES.has(c)) throw new Error(`unknown accent class "${c}" — have: ${[...INK_CLASSES].join(', ')}`);
  return c;
};

// Highlight the word(s) wrapped in *asterisks* with an accent colour + italic display cut.
const mark = (s: unknown, cls: InkClass = 'accent-pink'): string =>
  esc(s).replace(/\*([^*]+)\*/g, (_, w) => `<span class="em ${ink(cls)}">${w}</span>`);

// One pretitle form everywhere — parenthesis style, per the design system's own
// "( Features )" / "( Problem :(( )" labels on the landing page.
const kicker = (s: { kicker?: string }): string => {
  if (!s.kicker) return '';
    return `<span class="kicker kicker--paren">( ${esc(s.kicker)} )</span>`;
};

const chrome = (s: RenderSlide): string => `
  <header class="chrome">
    <span class="chrome__logo">${wordmark}</span>
    <span class="ticks">${Array.from({ length: s.total }, (_, i) =>
      `<i class="${i + 1 === s.index ? 'on' : ''}"></i>`).join('')}</span>
  </header>`;

// Off by default — a handle on every slide is noise. Set "foot": true where it earns its place.
const foot = (s: RenderSlide): string => s.foot
  ? `<footer class="foot"><span class="foot__mark">${icon('sound')}${esc(s.handle ?? brand.handle)}</span></footer>`
  : '<span class="foot foot--empty"></span>';

const rings = (n = 4, size = 420, x = '72%', y = '18%'): string =>
  Array.from({ length: n }, (_, i) => {
    const d = size + i * size * 0.62;
    return `<span class="rings" style="width:${d}px;height:${d}px;left:${x};top:${y};margin:${-d / 2}px 0 0 ${-d / 2}px"></span>`;
  }).join('');

const art = (s: RenderSlide): string => s.bgFile
  ? `<img class="art-full" src="file://${s.bgFile}"><span class="bg-scrim" style="--scrim:${s.scrim ?? 'rgba(10,10,10,.45)'}"></span>`
  : '';

/** Unused: nothing calls panel(), and no deck sets artSide. Kept per the no-delete rule. */
const panel = (s: RenderSlide & { artSide?: 'left' }): string => s.bgFile
  ? `<img class="art-panel${s.artSide === 'left' ? ' art-panel--left' : ''}" src="file://${s.bgFile}">`
  : '';
void panel;

const bleed = (dir: string, color: string): string =>
  `<span class="bleed bleed--grad-${dir}" style="--bleed-a:${color}"></span>`;

/* ------------------------------------------------------------------ layouts */

/**
 * Each layout receives its own narrowed slide. Declaring the table as a mapped type means
 * every `s` below is contextually typed to exactly the variant its key selects — no
 * per-function annotation, and adding a layout without adding it to the Slide union is a
 * compile error rather than a silent `any`.
 */
type LayoutFn<K extends LayoutName> = (s: Extract<RenderSlide, { layout: K }>) => string;
type LayoutTable = { [K in LayoutName]: LayoutFn<K> };

const layouts: LayoutTable = {
  // Big opener: display headline over a brand gradient.
  cover(s) {
    return `
      ${s.bgFile ? art(s)
        // No art and no gradient means nothing to paint — emit no element rather than a
        // bleed whose background is the literal text "undefined".
        : s.gradient ? `<div class="bleed" style="background:${s.gradient}"></div>` : ''}
      ${rings(5, 460, '78%', '12%')}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <h1 class="h-display h-display--xl">${mark(s.title, 'accent-lime')}</h1>
        ${s.lede ? `<p class="lede lede--wide">${esc(s.lede)}</p>` : ''}
      </div>
      ${foot(s)}`;
  },

  // Editorial statement on near-black, with a waveform rule under it.
  statement(s) {
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack"><h1 class="h-display h-display--xxl">${mark(s.title, s.accent ?? 'accent-carrot')}</h1></div>
      </div>
      ${foot(s)}`;
  },

  // One number, weight thrown to the edges: caption top, figure bottom, art down one side.
  stat(s) {
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack"><div class="figure__v ${ink(s.accent) ?? ''}">${esc(s.value)}</div></div>
      </div>
      <span class="figure__corner ${ink(s.accent) ?? ''}">${esc(s.unit ?? '')}</span>
      ${foot(s)}`;
  },

  // Scannable checklist / numbered steps.
  list(s) {
    const rows = s.items.map((t, i) => `
      <div class="list__row">
        ${s.numbered
          ? `<span class="list__num">${String(i + 1).padStart(2, '0')}</span>`
          : `<span class="list__ico ${s.accent ?? 'accent-green'}">${icon(s.bullet ?? 'check')}</span>`}
        <span class="list__txt">${mark(t, s.accent ?? 'accent-green')}</span>
      </div>`).join('');
    return `
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack">
          <h2 class="h-display h-display--m">${mark(s.title, s.accent ?? 'accent-green')}</h2>
          <div class="list">${rows}</div>
        </div>
      </div>
      ${foot(s)}`;
  },

  // Pull-quote on the light paper background.
  quote(s) {
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack">
          <span class="quote__mark ${ink(s.accent) ?? ''}">“</span>
          <blockquote class="quote">${mark(s.title, s.accent ?? 'accent-purple')}</blockquote>
          <div class="byline">
            <span class="byline__dot" style="background:${s.dot ?? fillOf(s.accent ?? 'purpleblue')}"></span>
            <span>${esc(s.author)}</span>
            <span class="byline__role">${esc(s.role ?? '')}</span>
          </div>
        </div>
      </div>
      ${foot(s)}`;
  },

  // Closing card with a call to action.
  // Closing card: the mark carries it, no button — a carousel has nowhere to click.
  splash(s) {
    return `
      ${art(s) || (s.minimal ? '' : rings(6, 380, '50%', '52%'))}
      <div class="splash">
        <span class="splash__gap"></span>
        <span class="splash__mark">${wordmark}</span>
        ${s.title ? `<h2 class="splash__line">${mark(s.title, s.accent ?? 'accent-lime')}</h2>` : ''}
        <span class="splash__gap splash__gap--b"></span>
        <span class="splash__badge">${icon('link')}${esc(s.handle ?? brand.handle)}</span>
      </div>`;
  },

  cta(s) {
    return `
      ${art(s) || (s.minimal ? '' : rings(6, 380, '50%', '52%'))}
      ${chrome(s)}
      <div class="body">
        <h2 class="h-display h-display--l">${mark(s.title, s.accent ?? 'accent-purple')}</h2>
        ${s.lede ? `<p class="lede lede--wide">${esc(s.lede)}</p>` : ''}
        <span class="btn">${esc(s.button)}${icon('arrow-up-right')}</span>
      </div>
      ${foot(s)}`;
  },

  // Tag cloud — every chip takes a different token accent.
  tags(s) {
    const pick = rotate(paletteFor(s), s.paletteOffset ?? 0);
    const chips = s.items.map((t, i) => {
      // An object item may omit its accent; fall back to the rotation exactly as a
      // string item does. Before this, `a` went undefined and cvar() threw on
      // .startsWith — the whole slide, not just the chip.
      const a = (typeof t === 'object' ? t.accent : undefined) ?? pick(i);
      const label = typeof t === 'object' ? t.label : t;
      const ghost = s.style2 === 'ghost' || (typeof t === 'object' && t.ghost);
      const sm = (typeof t === 'object' && t.small) || String(label).length > 14 ? ' tag--sm' : '';
      return `<span class="tag${ghost ? ' tag--ghost' : ''}${sm}" style="--tag:${cvar(a)};--tag-ink:${inkFor(a)}">${esc(label)}</span>`;
    }).join('');
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack">
          ${s.title ? `<h2 class="h-display h-display--m">${mark(s.title, s.accent ?? 'accent-lime')}</h2>` : ''}
          <div class="tags tagwall">${chips}</div>
        </div>
      </div>
      ${foot(s)}`;
  },

  // Colour-blocked bento grid.
  // Feature grid: title band, then one full-bleed tile per tool. No descriptions —
  // six short labels read from a phone, a paragraph per card does not.
  // Feature slide. `variant` picks the treatment; the content stays identical so
  // the options can be judged against each other rather than against new copy.
  bento(s) {
    const pick = rotate(paletteFor(s), s.paletteOffset ?? 0);
    const it = s.items.map((c, i) => ({ ...c, a: cvar(c.accent ?? pick(i)), ink: inkFor(c.accent ?? pick(i)) }));
    const v = s.variant ?? 'k';
const shells = {
      a: () => `<div class="fa">${it.map(c =>
        `<div class="fa__c" style="--a:${c.a}">${icon(c.icon)}<span class="fa__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      b: () => `<div class="fb">${it.map(c =>
        `<div class="fb__r" style="--a:${c.a}">${icon(c.icon)}<span class="fb__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      c: () => `<div class="fc">${it.map(c =>
        `<div class="fc__c" style="--a:${c.a}">${icon(c.icon)}<span class="fc__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      d: () => `<div class="fd">${it.map(c =>
        `<div class="fd__c" style="--a:${c.a};--ink:${c.ink}">${icon(c.icon)}<span class="fd__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      e: () => `<div class="fe">${it.map(c =>
        `<div class="fe__c" style="--a:${c.a}">${icon(c.icon)}<span class="fe__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      f: () => `<div class="ff">${it.map(c =>
        `<div class="ff__c" style="--a:${c.a}">${icon(c.icon)}<span class="ff__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      g: () => `<div class="fg">${it.map(c =>
        `<div class="fg__r" style="--a:${c.a}">${icon(c.icon)}<span class="fg__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      h: () => `<div class="fh">${it.map(c =>
        `<div class="fh__c" style="--a:${c.a}">${icon(c.icon)}<span class="fh__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      i: () => `<div class="fi">${it.map(c =>
        `<div class="fi__r" style="--a:${c.a}">${icon(c.icon)}<span class="fi__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      k: () => `<div class="fk">${it.map(c =>
        `<div class="fk__c" style="--a:${c.a};--ink:${c.ink}">${icon(c.icon)}<span class="fk__n">${esc(c.title)}</span></div>`).join('')}</div>`,
      j: () => `<div class="fj">${it.map(c =>
        `<div class="fj__c" style="--a:${c.a}"><span class="fj__d">${icon(c.icon)}</span><span class="fj__n">${esc(c.title)}</span></div>`).join('')}</div>`,
    };

    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker({kicker: s.kicker ?? 'Features'})}
        <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, s.accent ?? 'accent-pink')}</h2>
        ${(shells[v] ?? shells.k)()}</div>
      </div>
      ${foot(s)}`;
  },

  poster(s) {
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack"><h1 class="poster__title">${mark(s.title, s.accent ?? 'accent-purple')}</h1></div>
      </div>
      ${foot(s)}`;
  },

  // Photo-hero: generated portrait carries the slide, type sits low over a scrim.
  photo(s) {
    return `
      ${art(s) || bleed('tr', s.glow ?? 'rgba(254,79,141,.3)')}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack">
          <h1 class="h-display h-display--xl">${mark(s.title, s.accent ?? 'accent-lime')}</h1>
          ${s.lede ? `<p class="lede lede--wide">${esc(s.lede)}</p>` : ''}
        </div>
      </div>
      ${foot(s)}`;
  },

  // Numbered steps as full-bleed colour bands — the numeral lives inside the band.
  steps(s) {
    const a = s.accent ?? 'accent-carrot';
    const rows = s.items.map((it, i) => {
      const title = typeof it === 'object' ? it.title : it;
      return `<div class="step"><span class="step__n ${a}">${String(i + 1).padStart(2, '0')}</span><span class="step__t">${esc(title)}</span></div>`;
    }).join('');
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, a)}</h2>
        <div class="steps">${rows}</div></div>
      </div>
      ${foot(s)}`;
  },

  // Chapter index — one accent per row.
  index(s) {
    const pick = rotate(paletteFor(s), s.paletteOffset ?? 0);
    const rows = s.items.map((it, i) => {
      // Read before the `typeof it === 'object'` narrowing below, so a string item
      // yields undefined here and falls through to the rotation. Harmless, and
      // transcribed as-is rather than reordered.
      const a = (it as { accent?: AccentToken }).accent ?? pick(i);
      const [title, meta] = typeof it === 'object' ? [it.title, it.meta] : [it, ''];
      return `<div class="index__row" style="--row:${cvar(a)}">
        <span class="index__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="index__t">${esc(title)}</span>
        <span class="index__m">${esc(meta ?? '')}</span>
      </div>`;
    }).join('');
    return `
      ${art(s)}
      ${chrome(s)}
      <div class="body body--tb">
        ${kicker(s)}
        <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, s.accent ?? 'accent-carrot')}</h2>
        <div class="index">${rows}</div></div>
      </div>
      ${foot(s)}`;
  },


  // ---- extra card archetypes, same design language (chrome + ( kicker ) + display type) ----
  claim(s) {
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack claimwrap"><span class="claim__rule" style="background:${fillOf(s.accent??'accent-lime')}"></span>
      <h2 class="claim">${mark(s.title, s.accent ?? 'accent-lime')}</h2></div></div>${foot(s)}`;
  },
  statRow(s) {
    const a = s.accent ?? 'accent-lime';
    // "7→1" renders the arrow as a stroke icon, not the font's clunky → glyph.
    const arrow = `<span class="statrow__arrow">${icon('arrow-right')}</span>`;
    const val = (v: string | number) => String(v).split(/→|->/).map(esc).join(arrow);
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title ?? '', a)}</h2>
      <div class="statrow">${s.stats.map(x=>`<div class="statrow__c"><span class="statrow__v ${a}">${val(x.v)}</span><span class="statrow__l">${esc(x.l)}</span></div>`).join('')}</div></div></div>${foot(s)}`;
  },
  bigQuestion(s) {
    const a = s.accent ?? 'accent-lime';
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h1 class="h-display h-display--xl">${mark(s.title, a)}</h1></div></div>${foot(s)}`;
  },
  fillWord(s) {
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><div class="fillword">${mark(s.title, s.accent??'accent-lime')}</div></div></div>${foot(s)}`;
  },
  callout(s) {
    const a = s.accent ?? 'accent-lime';
    return `${chrome(s)}<div class="body body--tb">
      <div class="stack"><span class="kicker kicker--paren">( ${esc(s.kicker ?? 'Rule')} )</span>
      <div class="callout"><span class="callout__t">${mark(s.title, a)}</span>
      ${s.note?`<span class="callout__n">${esc(s.note)}</span>`:''}</div></div></div>${foot(s)}`;
  },
  definition(s) {
    const a = s.accent ?? 'accent-lime';
    return `${chrome(s)}<div class="body body--tb">${kicker({kicker: s.kicker ?? 'Definition'})}
      <div class="stack"><div class="def__term ${a}">${esc(s.term)}</div>
      ${s.ipa?`<div class="def__ipa">${esc(s.ipa)}</div>`:''}
      <div class="def__body">${mark(s.body, a)}</div></div></div>${foot(s)}`;
  },
  dontList(s) {
    const a = s.accent ?? 'accent-carrot';
    const rows = s.items.map(t=>`<div class="tick"><span class="tick__i ${a}">${icon('x-mark')}</span><span class="tick__t dim">${mark(t,a)}</span></div>`).join('');
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title,a)}</h2><div class="tickrows">${rows}</div></div></div>${foot(s)}`;
  },
  checklist(s) {
    const a = s.accent ?? 'accent-green';
    const rows = s.items.map(t=>`<div class="tick"><span class="tick__i ${a}">${icon('check')}</span><span class="tick__t">${mark(t,a)}</span></div>`).join('');
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title,a)}</h2><div class="tickrows">${rows}</div></div></div>${foot(s)}`;
  },
  comparison(s) {
    const a = s.accent ?? 'accent-lime';
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack vs" style="--a:${fillOf(a)};--ink:${inkClassInk(a)}">
        <div class="vs__row"><span class="vs__h">${esc(s.aTitle)}</span>
          <div class="vs__list">${s.a.map(x=>`<span class="vs__li dim">${mark(x)}</span>`).join('')}</div></div>
        <div class="vs__row vs__row--b"><span class="vs__h">${esc(s.bTitle)}</span>
          <div class="vs__list">${s.b.map(x=>`<span class="vs__li">${mark(x)}</span>`).join('')}</div></div>
      </div></div>${foot(s)}`;
  },
  beforeAfter(s) {
    const a = s.accent ?? 'accent-lime';
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack ba">
        <div class="ba__c"><span class="ba__lab">Before</span><span class="ba__v dim">${mark(s.before)}</span></div>
        <span class="ba__arrow" style="--a:${fillOf(a)};--ink:${inkClassInk(a)}">${icon('chevron-down')}</span>
        <div class="ba__c ba__c--after" style="--a:${fillOf(a)};--ink:${inkClassInk(a)}"><span class="ba__lab">After</span><span class="ba__v">${mark(s.after)}</span></div>
      </div></div>${foot(s)}`;
  },
  priceTiers(s) {
    const rows = s.items.map(t=>{const a=t.accent??s.accent??'accent-purple';return `<div class="tier${t.hi?' tier--hi':''}" style="--a:${fillOf(a)};--ink:${inkClassInk(a)}"><span class="tier__nm">${esc(t.nm)}</span><span class="tier__ch">${esc(t.ch)}</span><span class="tier__pr">${esc(t.pr)}</span></div>`;}).join('');
    return `${chrome(s)}<div class="body body--tb">${kicker({kicker: s.kicker ?? 'Plans'})}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title,s.accent??'accent-purple')}</h2><div class="tiers">${rows}</div></div></div>${foot(s)}`;
  },
  iconRow(s) {
    const cells=s.items.map(c=>`<div class="ir__c"><span class="ir__ico ${s.accent??'accent-lime'}">${icon(c.icon)}</span><span class="ir__l">${esc(c.title)}</span></div>`).join('');
    return `${chrome(s)}<div class="body body--tb">
      <span class="feat__kick kicker kicker--paren">( ${esc(s.kicker ?? 'Features')} )</span>
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, s.accent??'accent-lime')}</h2><div class="iconrow">${cells}</div></div></div>${foot(s)}`;
  },
  meter(s) {
    const a = s.accent ?? 'accent-carrot';
    const segs = s.segments ?? [{label:s.left??'',v:s.pct??50,accent:a},{label:s.right??'',v:100-(s.pct??50),accent:'accent-purple'}];
    const total = segs.reduce((t,x)=>t+x.v,0);
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, a)}</h2>
      <div class="bar">${segs.map(x=>`<span class="bar__s" style="flex:${x.v};background:${fillOf(x.accent??a)}"></span>`).join('')}</div>
      <div class="barkey">${segs.map(x=>`<span class="barkey__i"><span class="barkey__sw" style="background:${fillOf(x.accent??a)}"></span>${esc(x.label)}<b>${Math.round(x.v/total*100)}%</b></span>`).join('')}</div>
      </div></div>${foot(s)}`;
  },
  timeline(s) {
    const a = s.accent ?? 'accent-lime';
    const rows = s.items.map((t,i)=>`<div class="vt__r"><span class="vt__dot" style="background:${fillOf(a)}"></span><span class="vt__n">${String(i+1).padStart(2,'0')}</span><span class="vt__t">${esc(t)}</span></div>`).join('');
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, a)}</h2>
      <div class="vt">${rows}</div></div></div>${foot(s)}`;
  },
  processVertical(s) {
    const a = s.accent ?? 'accent-lime';
    const rows = s.items.map((t,i)=>`<div class="pv__r"><span class="pv__n ${a}">${String(i+1).padStart(2,'0')}</span><span class="pv__t">${esc(t)}</span></div>`).join('');
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack pv"><h2 class="pv__h h-display h-display--m">${mark(s.title, a)}</h2>
      <div class="pv__list">${rows}</div></div></div>${foot(s)}`;
  },
  symbolHero(s) {
    const a = s.accent ?? 'accent-lime';
    return `${art(s)}${chrome(s)}<div class="body body--tb">${kicker({kicker: s.kicker ?? 'Feature'})}
      <div class="stack"><span class="symbol ${a}">${icon(s.icon)}</span>
      <h2 class="h-display h-display--m">${mark(s.title, a)}</h2>
      ${s.lede?`<p class="lede">${esc(s.lede)}</p>`:''}
      ${s.note?`<p class="symbol__note">${esc(s.note)}</p>`:''}</div></div>${foot(s)}`;
  },
  footnote(s) {
    const a = s.accent ?? 'accent-lime';
    return `${chrome(s)}<div class="body body--tb">${kicker({kicker: s.kicker ?? 'Small print'})}
      <div class="stack"><h1 class="h-display h-display--m">${mark(s.title, a)}</h1>
      <p class="footnote">${esc(s.note)}</p></div></div>${foot(s)}`;
  },
  lowerThird(s) {
    const a = s.accent ?? 'accent-lime';
    return `${art(s)}${chrome(s)}
      <div class="chyron">
        <span class="chyron__bar" style="background:${fillOf(a)}"></span>
        <span class="chyron__k">${esc(s.kicker ?? '')}</span>
        <h1 class="chyron__t">${mark(s.title, a)}</h1>
      </div>`;
  },
  lineChart(s) {
    const a=s.accent??'accent-lime'; const col=fillOf(a);
    const pts=s.points, W=920, H=380;
    const max=Math.max(...pts), min=0;
    const xs=pts.map((_,i)=>i*(W/(pts.length-1)));
    const ys=pts.map(v=>H-(v-min)/(max-min||1)*H);
    const line=xs.map((x,i)=>`${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');
    const gid='lg'+s.index;
    return `${chrome(s)}<div class="body body--tb">${kicker(s)}
      <div class="stack"><h2 class="h-display h-display--m">${mark(s.title, a)}</h2>
      <div class="chartwrap">
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${col}" stop-opacity=".6"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
        <polygon points="0,${H} ${line} ${W},${H}" fill="url(#${gid})"/>
        <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="chartaxis"><span>${esc(s.left??'')}</span><span>${esc(s.right??'')}</span></div>
      </div></div></div>${foot(s)}`;
  },
};

function renderSlide(s: RenderSlide): string {
  // The one dynamic index in the file. TypeScript cannot prove that layouts[s.layout]
  // accepts this particular s across the lookup, so the narrowing is asserted once here
  // rather than weakened everywhere else.
  const fn = layouts[s.layout] as ((s: RenderSlide) => string) | undefined;
  if (!fn) throw new Error(`unknown layout: ${s.layout}`);
  // A generated background replaces the light gradient field, so the dark-ink
  // gradient theme would leave the headline invisible on it.
  const theme = s.theme && !(s.bgFile && s.theme === 'grad') ? ` slide--${s.theme}` : '';
  // "ground": "<accent token>" floods the whole slide with one brand colour and
  // picks the readable ink for it, so a deck can be all-colour without new classes.
  const ground = s.ground
    ? `background:${cvar(s.ground)};color:${inkFor(s.ground)};`
    : '';
  return `<div class="slide${theme}" style="${ground}${s.style ?? ''}">${fn(s)}${s.minimal ? '' : '<span class="grain"></span>'}</div>`;
}

  return { layouts, renderSlide, icon, inkFor, ACCENTS };
}

/* ------------------------------------------------------------------ bindings */

// The incumbent, bound at module scope so every existing caller keeps working and
// renderSlide keeps its one-parameter signature. That signature is load-bearing:
// test/capture-html.ts and test/helpers/page.ts are the frozen arbiters this whole
// refactor is measured against, and they must be able to go on calling renderSlide(slide).
const CAST = makeRenderer(brandFor(PRODUCTS[DEFAULT_PRODUCT]));

export const layouts = CAST.layouts;
export const icon = CAST.icon;
export const inkFor = CAST.inkFor;
export const ACCENTS = CAST.ACCENTS;
export const renderSlide = CAST.renderSlide;

const renderers = new Map<string, ReturnType<typeof makeRenderer>>([[ 'cast', CAST ]]);

/** A renderer for any product. Tools bind this once, next to formatFromArgv(). */
export function rendererFor(p: Product) {
  const hit = renderers.get(p.id);
  if (hit) return hit;
  const built = makeRenderer(brandFor(p));
  renderers.set(p.id, built);
  return built;
}
