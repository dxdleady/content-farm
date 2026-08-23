// Types only — this file has no runtime output and nothing imports it yet.
//
// Phase 1 of the TypeScript migration: getting the shapes right BEFORE any file is
// renamed, so that when layouts.mjs becomes layouts.ts the type is already settled and the
// only thing under review is the transcription. Nothing here can move a golden, because
// nothing here executes.
//
// Transcribed from src/layouts.mjs line by line. Where the runtime is laxer than the type
// (a missing `title` renders the literal text "undefined" rather than throwing), the type
// is deliberately the stricter of the two.

/* ═══════════════════════════════════════════════════════════════════════════
   Colour: two disjoint domains that share one field name
   ═══════════════════════════════════════════════════════════════════════════
   This is the highest-value distinction in the whole port. The codebase has two
   different vocabularies for "accent" and conflates them, which is why three layouts
   emit `var(--c-accent-accent-lime)` — invalid CSS that silently drops the declaration.

     InkClass     a CSS class shipped by carousel.css. Guarded by ink(), which THROWS.
     AccentToken  a bare token name. Fed to cvar() to build `var(--c-accent-<token>)`.

   Slide-level `accent` is always an InkClass. Item-level `accent` is an AccentToken —
   except on priceTiers, where it is an InkClass. That outlier is real; see below. */

export type InkClass =
  | 'accent-pink' | 'accent-lime' | 'accent-carrot' | 'accent-purple' | 'accent-green';

export type AccentToken =
  | 'superlime' | 'pink' | 'purpleblue' | 'green' | 'carrot'
  | 'violet65' | 'mainorange' | 'blue67' | 'lightpink';

/** `ground` also accepts background tokens, which cvar() routes to --c-background-*. */
export type GroundToken = AccentToken | `background-${string}`;

/** A raw CSS value spliced into a style attribute. No safety available; named for intent. */
export type CssValue = string;

/** Copy that may carry *asterisks* around the accent word — see mark() in layouts. */
export type EmphasisMarkup = string;

/* ═══════════════════════════════════════════════════════════════════════════
   Slides
   ═══════════════════════════════════════════════════════════════════════════ */

/** Properties the shared frame (chrome / kicker / foot / art / ground) reads. */
export type SlideBase = {
  kicker?: string;
  /** Slide-level accent is an ink class. A bare token here throws inside mark(). */
  accent?: InkClass;
  /** Off by default — a handle on every slide is noise. */
  foot?: boolean;
  handle?: string;
  /** 'light' | 'dark' | 'color' | 'grad' | 'photo' | 'lime' — a CSS modifier suffix. */
  theme?: string;
  /** Floods the slide with one brand colour and picks readable ink for it. */
  ground?: GroundToken;
  /** Raw CSS appended to the slide's style attribute. */
  style?: CssValue;
  /** Suppresses the grain span and the decorative rings. */
  minimal?: boolean;

  /* --- background art --- */
  /** Absolute path to a generated PNG. Set by the pipeline, not usually authored. */
  bgFile?: string;
  /** Scrim colour over the art; defaults to rgba(10,10,10,.45). */
  scrim?: CssValue;

  /* --- the colour rotation used by tags / bento / index --- */
  palette?: AccentToken[];
  paletteOffset?: number;

  /* --- authored inputs to the image stage; consumed before render --- */
  /** Natural-language background prompt (content.json style decks). */
  bg?: string;
  /** Key into src/styles.json treatments. */
  bgStyle?: string;
  bgColors?: string[] | null;
  bgVariant?: number;
  /** REPLACE lines for the image prompt. compose.mjs deletes this once art exists. */
  replace?: string[];
};

/** One layout variant: the discriminant plus whatever that layout actually reads. */
type L<K extends string, P> = SlideBase & { layout: K } & P;

export type TagItem = {
  label: string;
  /** Item accents are bare tokens — they go to cvar(), not to ink(). */
  accent?: AccentToken;
  ghost?: boolean;
  small?: boolean;
};
export type BentoItem = { title: string; icon: string; accent?: AccentToken; sub?: string; wide?: boolean; dark?: boolean };
export type IndexItem = { title: string; meta?: string; accent?: AccentToken };
export type StepItem = { title: string };
export type Stat = { v: string | number; l: string };
export type Segment = { label: string; v: number; accent?: AccentToken };
/** priceTiers is the outlier: its item accent reaches fillOf/inkClassInk, so InkClass. */
export type Tier = { nm: string; ch: string; pr: string; hi?: boolean; accent?: InkClass };

/** 11 bento shells. An unrecognised value silently falls back to 'k'. */
export type BentoVariant = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k';

/**
 * meter is a genuine either/or: an explicit breakdown, or a two-way split synthesised
 * from left/right/pct. Modelling it as a union documents the two modes — and it is one of
 * the three layouts whose accent handling is currently wrong.
 */
export type MeterProps =
  | { title: EmphasisMarkup; segments: Segment[]; left?: never; right?: never; pct?: never }
  | { title: EmphasisMarkup; segments?: never; left?: string; right?: string; pct?: number };

export type Slide =
  // Opener: art if bgFile is set, otherwise a flat `background:${gradient}` bleed. Both
  // are optional here because that is what the code accepts — but note that no authored
  // deck sets `gradient`, so the no-art branch emits `background:undefined` today. Left
  // as-is rather than tightened to a bgFile-XOR-gradient union: that is a Phase 4 fix,
  // and its golden (edge--cover--plain) is pinned meanwhile.
  | L<'cover', { title: EmphasisMarkup; lede?: string; gradient?: CssValue }>
  | L<'statement', { title: EmphasisMarkup }>
  | L<'stat', { value: string | number; unit?: string }>
  | L<'list', { title: EmphasisMarkup; items: EmphasisMarkup[]; numbered?: boolean; bullet?: string }>
  | L<'quote', { title: EmphasisMarkup; author: string; role?: string; dot?: CssValue }>
  // splash and lowerThird render no chrome/foot, so index/total are unused by them
  | L<'splash', { title?: EmphasisMarkup }>
  | L<'cta', { title: EmphasisMarkup; button: string; lede?: string }>
  | L<'tags', { title?: EmphasisMarkup; items: Array<string | TagItem>; style2?: 'ghost' }>
  | L<'bento', { title: EmphasisMarkup; items: BentoItem[]; variant?: BentoVariant }>
  | L<'poster', { title: EmphasisMarkup }>
  | L<'photo', { title: EmphasisMarkup; lede?: string; glow?: CssValue }>
  | L<'steps', { title: EmphasisMarkup; items: Array<string | StepItem> }>
  | L<'index', { title: EmphasisMarkup; items: Array<string | IndexItem> }>
  | L<'claim', { title: EmphasisMarkup }>
  | L<'statRow', { title?: EmphasisMarkup; stats: Stat[] }>
  | L<'bigQuestion', { title: EmphasisMarkup }>
  | L<'fillWord', { title: EmphasisMarkup }>
  | L<'callout', { title: EmphasisMarkup; note?: string }>
  | L<'definition', { term: string; body: EmphasisMarkup; ipa?: string }>
  | L<'dontList', { title: EmphasisMarkup; items: EmphasisMarkup[] }>
  | L<'checklist', { title: EmphasisMarkup; items: EmphasisMarkup[] }>
  | L<'comparison', { aTitle: string; a: EmphasisMarkup[]; bTitle: string; b: EmphasisMarkup[] }>
  | L<'beforeAfter', { before: EmphasisMarkup; after: EmphasisMarkup }>
  | L<'priceTiers', { title: EmphasisMarkup; items: Tier[] }>
  | L<'iconRow', { title: EmphasisMarkup; items: Array<{ icon: string; title: string }> }>
  | L<'meter', MeterProps>
  | L<'timeline', { title: EmphasisMarkup; items: string[] }>
  | L<'processVertical', { title: EmphasisMarkup; items: string[] }>
  | L<'symbolHero', { title: EmphasisMarkup; icon: string; lede?: string; note?: string }>
  // note is dereferenced unguarded here, unlike on callout/symbolHero
  | L<'footnote', { title: EmphasisMarkup; note: string }>
  | L<'lowerThird', { title: EmphasisMarkup }>
  | L<'lineChart', { title: EmphasisMarkup; points: number[]; left?: string; right?: string }>;

export type LayoutName = Slide['layout'];

/**
 * What renderSlide actually receives. The split is load-bearing rather than cosmetic:
 * lineChart builds its SVG gradient id from `index` (layouts.mjs:482), and chrome() sizes
 * the pagination from `total`. Both are injected by the renderer and never authored, so
 * without this split a hand-built slide silently produces `id="lgundefined"`.
 */
export type RenderSlide = Slide & {
  index: number;
  total: number;
  /** Deck-level metadata flattened onto the slide by render.mjs. */
  meta?: unknown;
};

/* ═══════════════════════════════════════════════════════════════════════════
   Formats — the fifth axis
   ═══════════════════════════════════════════════════════════════════════════ */

export type Ratio = '4:5' | '9:16';
export type FormatId = 'ig' | 'tiktok';

export type SafeArea = { top: number; right: number; bottom: number };

export type Format = {
  id: FormatId;
  name: string;
  w: number;
  h: number;
  ratio: Ratio;
  /** The platform's own UI, in canvas pixels. Becomes extra slide padding. */
  safe: SafeArea;
  /** Profile-grid mockup geometry (tools/feed.mjs). */
  grid: { cols: number; tile: number; label: string };
  /** Appended to every image REPLACE block; null when the art skeletons already fit. */
  framing: string | null;
  /** CSS custom properties injected at render time. Absent on the default format. */
  vars?: Record<string, string>;
};

/** What compose.mjs serialises into deck.json — a projection, not the whole Format. */
export type FormatSnapshot = Pick<Format, 'id' | 'w' | 'h' | 'ratio' | 'safe'>;

/* ═══════════════════════════════════════════════════════════════════════════
   Products — the sixth axis
   ═══════════════════════════════════════════════════════════════════════════
   Everything a brand owns, in one object. The engine (layouts, carousel.css,
   formats, the generation pipeline) is shared; a Product supplies the assets,
   the colour vocabulary and the voice.

   Modelled on Format deliberately: a registry keyed by id, the incumbent as the
   entry with NO override keys, and a tag that is empty for the default so its
   paths never move. */

export type ProductId = 'cast';

/**
 * Which bare token each ink class paints with.
 *
 * Replaces the three parallel tables in layouts.ts. FILL is derivable —
 * `FILL[c] === cvar(ink[c])` — so one map is enough. Declared per product rather
 * than derived from tokens.json: tokens carries nine accents but only five earn a
 * CSS class, and calling that class `accent-purple` rather than `accent-purpleblue`
 * is a design decision. Deriving it would invent class names carousel.css has no
 * rules for, and the failure mode is inherited white text on cream.
 *
 * PARTIAL, and the values are strings rather than AccentToken. Both widenings were forced
 * by the first product that was not (cast), and both were hiding a real assumption:
 * carousel.css ships five classes but a brand is entitled to use four, and AccentToken
 * names the INCUMBENT's nine tokens — a second brand shares none of them. What keeps this
 * honest is not the type but validateBrand(), which resolves every name against that
 * product's own tokens.json and its own stylesheet rules.
 */
export type InkMap = Partial<Record<InkClass, string>>;

/** The `--theme color` rotation: one brand ground per slide, plus a readable accent. */
export type ColorTheme = {
  /** Ground tokens in rotation order — slide i gets rotation[i % length]. */
  rotation: string[];
  /** Ground token → the em accent that pops against it. */
  em: Record<string, InkClass>;
  /** Ground token → prose hue, fed to the image model in the REPLACE block. */
  hue: Record<string, string>;
};

/**
 * The brand half of the image-generation prompt. The craft half stays in styles.json.
 *
 * The split was made by reading the lines rather than the section names. Of the eight in
 * styles.json's base + hard, exactly two named a brand or a canvas; the other six — no
 * readable text, invented people, keep the lower-left third calm — are true for every
 * product and would have to be copy-pasted into each one if they moved here. So `base`
 * and `hard` below ADD to the shared frame instead of replacing it, and are empty on the
 * incumbent, like every other override key on a Product.
 */
export type ArtVoice = {
  /** Names the product to the model, e.g. "(cast) — an audio/podcast editing brand". */
  subject: string;
  /** The brand's colour rule, in prose. A treatment preset may still override it. */
  palette: string;
  /** Extra craft lines, appended to styles.json's base. */
  base: string[];
  /** Extra non-negotiables, appended to styles.json's hard. */
  hard: string[];
};

export type Product = {
  /**
   * Widened to string on purpose. The registry's keys are still a closed union — that is
   * what `PRODUCTS satisfies Record<ProductId, Product>` enforces, and it is what makes a
   * typo there a compile error. But a Product is also a plain value, and test fixtures
   * build hostile ones that must never appear in the registry: a second brand that only
   * exists to prove the first one is not hardcoded should not become a shippable id.
   */
  id: string;
  name: string;
  /** The one true handle. It was declared eleven times before this. */
  handle: string;
  /** Absolute path to products/<id>. */
  dir: string;

  /* --- brand assets, as paths. The registry is the single place these move. --- */
  tokensJson: string;
  tokensCss: string;
  fontsCss: string;
  wordmark: string;
  /** Authored decks + content.json + topics.json — this product's written copy. */
  decks: string;

  /* --- colour vocabulary --- */
  /** The rotation colour-forward layouts walk so a tag row never repeats a hue. */
  accents: string[];
  ink: InkMap;
  colorTheme: ColorTheme;

  art: ArtVoice;

  /* --- overrides. Absent on the incumbent, exactly as FORMATS.ig has no `vars`. --- */
  /** The eight --t-* headline sizes; a brand with other faces refits them here. */
  typeVars?: Record<string, string>;
  /** Per (product × format) refits, merged into the format block so geometry still wins. */
  formatVars?: Partial<Record<FormatId, Record<string, string>>>;
  /**
   * Path to a last-resort stylesheet. The escape hatch for the type metrics carousel.css
   * hard-codes — 34 literal font-sizes and ~50 optical letter-spacing corrections, all
   * hand-tuned to Playfair and Inter. A brand with different faces gets correct colour
   * and geometry for free and APPROXIMATE headline fitting; this is where the last mile
   * goes. Do not try to make carousel.css font-agnostic instead.
   */
  overrideCss?: string;
  /** Extra refs and icons layered on top of the shared pools. */
  refs?: string;
  icons?: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
   Decks — three producers, two consumers
   ═══════════════════════════════════════════════════════════════════════════ */

export type DeckCommon = { deck: string; handle?: string; slides: Slide[] };

/** tools/build-decks.mjs */
export type BuiltDeck = DeckCommon & { refAnalysis: string; model: string; minimal?: boolean };
/** tools/compose.mjs */
export type ComposedDeck = DeckCommon & {
  rubric: string; density: string; ref: string | null; theme: string; format: FormatSnapshot;
  /** Which brand this was composed for. Optional: decks written before the product axis
   *  existed have no such field, and they are all (cast). */
  product?: ProductId;
};
/** A product's content.json */
export type ContentDeck = DeckCommon & { meta?: string };

/**
 * What the two consumers (render.mjs, one-slide.mjs) accept. They are already written
 * with `?.` and `??` throughout, so a permissive union is honest rather than lazy —
 * making them generic over the producer would buy nothing.
 */
export type Deck = DeckCommon & Partial<BuiltDeck & ComposedDeck & ContentDeck>;

/* ═══════════════════════════════════════════════════════════════════════════
   On-disk JSON
   ═══════════════════════════════════════════════════════════════════════════ */

/** refs/analysis/*.json — 36 files. `note` is present on only 4 of them. */
export type RefAnalysis = {
  /** Source image filename, e.g. "ref-03.jpg". */
  ref: string;
  /** Slug, e.g. "icy-chrome-beauty". */
  name: string;
  /** Prose prompt lines, copied verbatim into every prompt for this ref. */
  keep: string[];
  note?: string;
};

export type TypeStyle = {
  family: 'display' | 'ui';
  size: number; weight: number; lineHeight: number; letterSpacing: number;
  transform?: string;
};

export type Tokens = {
  color: {
    accent: Record<string, string>;
    text: Record<string, string>;
    background: Record<string, string>;
    alpha: { black: Record<string, string>; white: Record<string, string> };
    misc: Record<string, string>;
  };
  gradient: Record<string, { angle: number; stops: string[] }>;
  font: { display: string; ui: string };
  typography: Record<'display' | 'heading' | 'body' | 'ui', Record<string, TypeStyle>>;
  radius: Record<string, number>;
  spacing: Record<string, number>;
};

export type Treatment = { lines: string[]; palette?: string };

export type Styles = {
  default: string;
  /** The craft frame — true for every brand. A product appends via ArtVoice.base. */
  base: string[];
  treatments: Record<string, Treatment>;
  topicHints: Record<string, string>;
  /** The non-negotiables. A product appends via ArtVoice.hard. */
  hard: string[];
  /** Mixes a `$note` string in with the string[] pools; bgen skips $-prefixed keys. */
  wildcards: Record<string, string[] | string>;
  misbehave: string;
};

/** data/density.json — `art` is boolean on levels 1 and 4, prose on 2 and 3. */
export type DensityLevel = {
  level: number;
  id: 'minimal' | 'light' | 'half' | 'full';
  name: string;
  imagesPerPost: string;
  art: boolean | string;
  ground: string;
  tone: string;
  rubrics: string[];
};

/** A product's topics.json — the input to tools/build-decks.ts. */
export type Topic = {
  deck: string;
  /** A refs/analysis FILENAME including .json — unlike compose's numeric ref. */
  ref: string;
  variant: BentoVariant;
  hookKicker: string; hook: EmphasisMarkup;
  statKicker: string; stat: [string, string];
  trapKicker: string; trap: EmphasisMarkup;
  tagsKicker: string; tags: string[];
  fixTitle: EmphasisMarkup; steps: string[];
  rule: EmphasisMarkup;
  splashLine: EmphasisMarkup;
  subjects: string[];
};

/* ═══════════════════════════════════════════════════════════════════════════
   Rubrics
   ═══════════════════════════════════════════════════════════════════════════ */

/** The per-slide image prompt: subject, composition, colour. */
export type ArtPrompt = { s: string; c: string; k: string };

/** A rubric slide is an authored slide that may carry an art prompt. */
export type RubricSlide = Slide & { art?: ArtPrompt };

export type Rubric = {
  name: string;
  bucket: 'bright' | 'product' | 'guide';
  promise: string;
  slides: RubricSlide[];
};
