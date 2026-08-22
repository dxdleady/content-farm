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
import type { Format, FormatId } from './types.ts';

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
      // the diagonal scrim darkens the bottom corner; on 9:16 the copy sits mid-frame,
      // so switch on carousel.css's second, vertical scrim across that band
      '--band-top': '20%',
      '--band-bot': '80%',
    },
    // Appended to every image REPLACE block: the art prompts were written for
    // 4:5, where "the lower-left third stays open" is enough. A 9:16 frame needs
    // the whole bottom third and the right edge kept quiet.
    framing: 'FRAMING: a tall vertical 9:16 frame — the subject sits in the upper two thirds; '
      + 'the bottom third and the right edge stay open and uncluttered for type',
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
