// Print/grime treatment applied in the render layer, not asked of the model.
// Generic models regress to clean output whatever the prompt says; the artefacts
// that make the reference board look like itself are deterministic and cheap to
// apply here — and cost nothing per render.
//
// Nothing in src/ or tools/ imports this module today.

/** A #RRGGBB literal. duotone() slices it by index and will produce NaN on anything else. */
export type HexColor = string;

/** Duotone: crush to luminance, then map black->a, white->b. */
export const duotone = (a: HexColor, b: HexColor, id: string): string => {
  const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  return `<filter id="${id}" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="
      .33 .5 .17 0 0
      .33 .5 .17 0 0
      .33 .5 .17 0 0
      0 0 0 1 0"/>
    <feComponentTransfer>
      <feFuncR type="table" tableValues="${ar} ${br}"/>
      <feFuncG type="table" tableValues="${ag} ${bg}"/>
      <feFuncB type="table" tableValues="${ab} ${bb}"/>
    </feComponentTransfer>
  </filter>`;
};

/** Offset colour channels, the way a misregistered print does. */
export const misprint = (px: number, id: string): string => `<filter id="${id}" color-interpolation-filters="sRGB">
  <feOffset in="SourceGraphic" dx="${px}" dy="0" result="r"/>
  <feOffset in="SourceGraphic" dx="${-px}" dy="${px * .6}" result="b"/>
  <feColorMatrix in="r" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rc"/>
  <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gc"/>
  <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bc"/>
  <feBlend in="rc" in2="gc" mode="screen" result="rg"/>
  <feBlend in="rg" in2="bc" mode="screen"/>
</filter>`;

/** Coarse film grain. */
export const grain = (id: string, seed = 3): string => `<filter id="${id}">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0"/>
</filter>`;

/** CSS for a halftone dot screen laid over an image. */
export const halftoneCss = (dot = 3.5): string => `
  background-image: radial-gradient(circle at 50% 50%, #000 ${dot * .42}px, transparent ${dot * .45}px);
  background-size: ${dot}px ${dot}px;
  mix-blend-mode: color-burn;`;

export type TreatedOptions = {
  /** Required in practice: there is no default, so omitting these emits `width:undefinedpx`. */
  w: number;
  h: number;
  dark?: HexColor;
  light?: HexColor;
  dot?: number;
  shift?: number;
  seed?: number;
  contrast?: number;
  id?: string;
};

/**
 * Wraps an image in the full print stack: duotone -> misregistration -> halftone
 * -> grain -> contrast crush. Returns HTML for a fixed-size tile.
 *
 * The `{}` default does not satisfy TreatedOptions — `w` and `h` have no defaults, so
 * treated(src) silently produces `width:undefinedpx`. The cast preserves that behaviour
 * verbatim while still requiring w/h from anyone who does pass options; removing the
 * default would turn a silent leak into a throw, which is a Phase 4 decision, not a port.
 */
export function treated(src: string, opts: TreatedOptions = {} as TreatedOptions): string {
  const { w, h, dark = '#0A0A0A', light = '#EEFF04', dot = 3.5, shift = 2, seed = 3, contrast = 1.35, id = 't' } = opts;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${dark}">
    <svg width="0" height="0" style="position:absolute">
      ${duotone(dark, light, `duo-${id}`)}
      ${misprint(shift, `mis-${id}`)}
      ${grain(`grn-${id}`, seed)}
    </svg>
    <img src="file://${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
      filter:url(#duo-${id}) contrast(${contrast}) brightness(1.05)">
    <div style="position:absolute;inset:0;filter:url(#mis-${id});mix-blend-mode:screen;opacity:.5">
      <img src="file://${src}" style="width:100%;height:100%;object-fit:cover;filter:url(#duo-${id})">
    </div>
    <div style="position:absolute;inset:0;opacity:.55;${halftoneCss(dot)}"></div>
    <div style="position:absolute;inset:-20%;filter:url(#grn-${id});opacity:.30;mix-blend-mode:overlay"></div>
  </div>`;
}
