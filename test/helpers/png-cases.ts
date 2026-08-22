// Which corpus cases get screenshotted, in which format, through which page wrapper.
//
// Tier 3 is expensive (Chrome, seconds not milliseconds) and environment-sensitive, so it
// is a deliberate ~35-case selection rather than the whole 325-case corpus. It exists to
// catch what Tier 2 structurally cannot: carousel.css, fonts, wrapping, overflow — every
// pixel decision that lives outside renderSlide.
import { corpus, type Case } from './corpus.ts';
import { resolveFormat } from './sut.ts';

export type PngCase = {
  id: string;
  slide: Record<string, unknown>;
  format: ReturnType<typeof resolveFormat>;
  wrapper: 'render' | 'compose';
};

/** Layouts whose geometry is most likely to move when CSS or the canvas changes. */
const RISKY = ['bento', 'tags', 'lineChart', 'meter', 'priceTiers'];

export function pngCases(): PngCase[] {
  const byName = new Map(corpus().map(c => [c.name, c] as const));
  const pick = (name: string): Case => {
    const c = byName.get(name);
    if (!c) throw new Error(`png case "${name}" is not in the corpus`);
    return c;
  };

  const out: PngCase[] = [];
  const ig = resolveFormat('ig');
  const tiktok = resolveFormat('tiktok');

  // 1. The 20 catalogue cards at Instagram size — the exact set already proven
  //    byte-stable by hand with `cmp` before the format axis shipped.
  for (const c of corpus().filter(c => c.name.startsWith('catalogue--'))) {
    out.push({ id: `${c.name}--ig`, slide: c.slide, format: ig, wrapper: 'render' });
  }

  // 2. The riskiest layouts in BOTH formats, so a safe-area or vertical-rhythm change
  //    cannot land unnoticed.
  for (const name of RISKY) {
    const c = corpus().find(x => x.name.startsWith('catalogue--') && x.slide.layout === name)
      ?? corpus().find(x => x.slide.layout === name);
    if (!c) throw new Error(`no corpus case renders the risky layout "${name}"`);
    out.push({ id: `risky--${name}--tiktok`, slide: c.slide, format: tiktok, wrapper: 'render' });
  }

  // 3. THE DEDUP TRIPWIRE. src/render.mjs's wrapper defines --grain; the seven tool copies
  //    do not. The difference is invisible unless the slide is non-minimal, because
  //    renderSlide only emits <span class="grain"> when minimal is false. Capturing the
  //    same slide through both wrappers means a Phase 4 "extract the common page()" that
  //    quietly hands grain to the tools shows up as a failing hash instead of passing.
  const grainy = pick('edge--not-minimal-grain');
  out.push({ id: 'wrapper--grain--render', slide: grainy.slide, format: ig, wrapper: 'render' });
  out.push({ id: 'wrapper--grain--compose', slide: grainy.slide, format: ig, wrapper: 'compose' });

  // 4. One ordinary slide through the compose wrapper in each format, so the tool path is
  //    covered beyond the tripwire alone.
  const statement = pick('catalogue--01-statement');
  out.push({ id: 'compose--statement--ig', slide: statement.slide, format: ig, wrapper: 'compose' });
  out.push({ id: 'compose--statement--tiktok', slide: statement.slide, format: tiktok, wrapper: 'compose' });

  const seen = new Set<string>();
  for (const c of out) {
    if (seen.has(c.id)) throw new Error(`duplicate png case id: ${c.id}`);
    seen.add(c.id);
  }
  return out;
}
