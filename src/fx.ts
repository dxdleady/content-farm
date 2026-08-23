// The house photo treatment — film grain only. Applied to a generated background
// BEFORE the slide is composed, so the type sits clean on top.
/**
 * The house film grain.
 *
 * It used to be a live `filter: url(#castfx)` on the photo — feTurbulence evaluated across
 * the whole element, every frame, in software, because headless runs with --disable-gpu.
 * At the Instagram canvas that was merely wasteful. At TikTok's 1080x1920 it killed the
 * renderer outright, and a dead renderer used to be an infinite hang rather than an error
 * (see src/chrome.ts). Bounding the filter region to the element was not enough — the
 * cost is proportional to canvas area either way, so the next canvas would have hit it
 * again.
 *
 * So the noise is rasterised ONCE into a 256px tile and repeated. Cost is now independent
 * of canvas size, which is the property that actually matters: this has to survive
 * whatever format gets added next. The turbulence parameters are unchanged, so the grain
 * has the same character; what changes is that it repeats every 256px, which for
 * fractal noise at this frequency is not something an eye finds.
 */
const TILE = 240;

export const FX_FILTER = `
<filter id="castfx" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0" result="ng"/>
  <feComponentTransfer in="ng" result="grain">
    <feFuncR type="linear" slope="0.5" intercept="0.25"/>
    <feFuncG type="linear" slope="0.5" intercept="0.25"/>
    <feFuncB type="linear" slope="0.5" intercept="0.25"/>
  </feComponentTransfer>
  <feBlend in="grain" in2="SourceGraphic" mode="overlay" result="out"/>
</filter>`;

/**
 * The grain tile: explicit dots, no SVG filter anywhere.
 *
 * Three approaches were measured against a real 1080x1920 shot. `filter: url(#castfx)` on
 * the photo killed the renderer. Bounding that filter's region to the element did not save
 * it. Rasterising the SAME turbulence into a tiled background killed it too — and that one
 * is the instructive failure: Chrome re-rasterises an SVG background per tile, so a filter
 * inside it is evaluated 8x8 times a frame rather than once. The common factor was never
 * the canvas size; it was feTurbulence being evaluated in software, because headless runs
 * with --disable-gpu.
 *
 * So there is no filter. 900 seeded dots, drawn once, tiled — the same construction
 * src/render.ts has used for its own grain all along, which is the strongest evidence
 * available that it survives a real render. Deterministic from `seed`, so a re-run of the
 * same deck produces the same tile and the same bytes.
 */
export const grainTile = (seed = 7): string => {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const dots = Array.from({ length: 900 }, () =>
    `<rect x="${(rnd() * TILE).toFixed(1)}" y="${(rnd() * TILE).toFixed(1)}" width="1.5" height="1.5" opacity="${(rnd() * .5 + .15).toFixed(2)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" fill="#fff">${dots}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

export const fxPage = (imgUrl: string, W = 1080, H = 1350): string => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
  .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .gr{position:absolute;inset:0;background:url("${grainTile()}") repeat;
      background-size:${TILE}px ${TILE}px;mix-blend-mode:overlay;pointer-events:none}
</style></head><body>
  <img class="ph" src="${imgUrl}">
  <span class="gr"></span>
</body></html>`;
