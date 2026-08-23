// The fifth axis: the canvas a post is composed for.
//
//   post = rubric × density × ref × theme × format
//
// Every format is 1080 wide, so the whole type scale, every measure and every
// grid carries over untouched. What actually changes is the vertical rhythm
// (a taller canvas grows the middle, since content is bottom-anchored) and the
// platform's own UI, which sits ON TOP of the image and must be designed around.
//
// `safe` is that UI, in canvas pixels. It becomes extra slide padding, so
// bottom-anchored content clears the caption block and the action rail instead
// of hiding under them. Full-bleed elements (art, bands, charts) still run to
// the edge on purpose — only type respects the safe area.
import type { Format, FormatId, Ratio } from './types.ts';

// `satisfies` rather than a plain annotation: it checks each entry against Format while
// keeping the literal key types, so FORMATS.tiktok.ratio stays '9:16' instead of widening
// to Ratio. That literalness is what lets callers switch on a format without a cast.
export const FORMATS = {
  ig: {
    id: 'ig',
    name: 'Instagram 4:5',
    w: 1080,
    h: 1350,
    ratio: '4:5',
    // The in-feed carousel draws its chrome outside the image.
    safe: { top: 0, right: 0, bottom: 0 },
    // profile-grid mockup (tools/feed.mjs)
    grid: { cols: 3, tile: 4 / 5, label: 'Instagram' },
    framing: null,
  },

  tiktok: {
    id: 'tiktok',
    name: 'TikTok 9:16',
    w: 1080,
    h: 1920,
    ratio: '9:16',
    // Photo-mode UI, measured against a 1080×1920 canvas:
    //   top    — the Following / For You nav
    //   right  — the action rail (avatar, like, comment, share, disc)
    //   bottom — username, caption, music ticker and the progress dots
    safe: { top: 110, right: 120, bottom: 400 },
    grid: { cols: 3, tile: 1 / 1.33, label: 'TikTok' },
    // 9:16 adds 570px of height at the same width, so the bottom-weighted
    // Instagram rhythm leaves half the frame empty and the fixed-height blocks
    // stop short. These re-balance it without touching the shared type scale.
    vars: {
      '--stack-mb': 'auto',   // content centres in the safe box instead of hugging its floor
      '--t-claim': '150px',   // the one 180px grotesk headline, refit to the narrower column
      '--t-figure': '620px',  // giant number, refit so the corner unit still clears it
      '--feat-row': '215px',  // feature tiles grow into the taller canvas
      // The scrim is not the 4:5 one stretched — it is a different shape for a different
      // frame, and treating it as inherited is what washed 9:16 out.
      //
      // At 4:5 one diagonal does everything: its dark end lands in the bottom-left corner,
      // which is exactly where the type is. At 9:16 --stack-mb:auto centres the copy in
      // the safe box (110..1520 of 1920), so the type sits around 29-55% of the frame and
      // the corner is empty. The band covers THAT, and the diagonal is turned down to
      // match — left at its 4:5 strength it stacked on top of the band and bleached the
      // lower half of every frame.
      '--band-top': '8%',    // ink reaches full at +22%, i.e. 30%
      '--band-bot': '62%',   // and holds to just past the copy, not to the floor
      '--scrim-far-dark': 'rgba(10,10,10,.34)',
      '--scrim-far-light': 'rgba(238,235,234,.30)',
      '--scrim-ink-light': 'rgba(238,235,234,.66)',
    },
    // Appended to every image REPLACE block.
    //
    // This line used to say "the subject sits in the upper two thirds", which was right
    // for a picture that only ever appeared at 9:16 — and wrong the moment the same
    // image also has to serve 4:5. A 9:16 frame cropped to 4:5 keeps the middle ~70% of
    // the height and throws the rest away, so a subject in the upper third is simply
    // gone from the Instagram version. Anything that must survive both crops lives in
    // the middle band; the top and bottom edges are the disposable part, which is
    // convenient, because on TikTok they are also what the platform UI covers.
    framing: 'FRAMING: a tall vertical 9:16 frame — the subject is centred in the middle band '
      + 'of the frame and stays clear of the top and bottom edges, which are cropped away '
      + 'at other aspect ratios; within that band the lower-left stays open and uncluttered for type',
  },
} satisfies Record<FormatId, Format>;

export const DEFAULT_FORMAT: FormatId = 'ig';

/** Resolve a --format value (or an alias) to a format object. Throws on typos. */
export function resolveFormat(id?: string | null): Format {
  if (!id) return FORMATS[DEFAULT_FORMAT];
  const key = String(id).toLowerCase();
  const alias: Record<string, FormatId> = {
    instagram: 'ig', insta: 'ig', '4:5': 'ig', tt: 'tiktok', '9:16': 'tiktok',
  };
  const f = (FORMATS as Record<string, Format | undefined>)[alias[key] ?? key];
  if (!f) throw new Error(`unknown format "${id}" — have: ${Object.keys(FORMATS).join(', ')}`);
  return f;
}

/**
 * Read `--format x` off argv, falling back to $FORMAT, then the default.
 * This is the CLI edge, so a typo exits with a message rather than a stack trace —
 * the same shape as the unknown-rubric / unknown-theme checks in compose.mjs.
 *
 * The return type is Format rather than Format | never because process.exit() is typed
 * `never`, so the catch branch does not widen it. That is also why the typo path cannot
 * be unit-tested directly — it would take the test runner down with it.
 */
export function formatFromArgv(argv: string[] = process.argv): Format {
  const i = argv.indexOf('--format');
  try {
    return resolveFormat(i > -1 ? argv[i + 1] : process.env.FORMAT);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

/**
 * The one style block that makes a slide format-aware. carousel.css reads these
 * vars and falls back to the Instagram canvas when the block is absent, so any
 * caller that hasn't been taught about formats keeps rendering 1080×1350.
 */
export const formatCss = (f: Format): string => `:root{`
  + `--slide-w:${f.w}px;--slide-h:${f.h}px;`
  + `--safe-t:${f.safe.top}px;--safe-r:${f.safe.right}px;--safe-b:${f.safe.bottom}px;`
  + Object.entries(f.vars ?? {}).map(([k, v]) => `${k}:${v};`).join('')
  + `}`;

/** Suffix for run folders / deck names — Instagram stays unsuffixed (it was here first). */
export const formatTag = (f: Format): string => (f.id === DEFAULT_FORMAT ? '' : `-${f.id}`);

/**
 * Read `--format a,b` off argv. One name is the ordinary case and behaves exactly as
 * formatFromArgv did; a list means the same post is being published to several places.
 */
export function formatsFromArgv(argv: string[] = process.argv): Format[] {
  const i = argv.indexOf('--format');
  const raw = i > -1 ? argv[i + 1] : process.env.FORMAT;
  if (!raw) return [FORMATS[DEFAULT_FORMAT]];
  try {
    const seen = new Set<string>();
    return String(raw).split(',').map(x => x.trim()).filter(Boolean)
      .map(resolveFormat)
      .filter(f => !seen.has(f.id) && seen.add(f.id));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

/**
 * The aspect ratio to GENERATE art at, given the formats it has to serve.
 *
 * The tallest one, always — and this is the whole point rather than a detail. `.art-full`
 * is `object-fit: cover`, so every frame crops whatever image it is handed; the only
 * question is which direction. Going tall→wide crops the top and bottom and keeps the
 * middle. Going wide→tall crops the SIDES, and at 4:5 → 9:16 that discards about a third
 * of the picture's width, which is where compositions actually put their subject.
 *
 * So: generate once, at the tallest, and let the shorter frames crop down. One image
 * serves every format, which is not only half the money but the only arrangement under
 * which a post cross-posted to two platforms shows the same picture in both. Generating
 * per format produced two different images from two different prompts — the same post in
 * name only.
 */
export function artRatio(formats: Format[]): Ratio {
  const tallest = formats.reduce((a, b) => (a.h / a.w >= b.h / b.w ? a : b));
  return tallest.ratio;
}

/** The framing line for a generation ratio — the tallest format's, not the renderer's. */
export function artFraming(formats: Format[]): string | null {
  const r = artRatio(formats);
  return (Object.values(FORMATS) as Format[]).find(f => f.ratio === r)?.framing ?? null;
}
