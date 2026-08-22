// The house photo treatment — film grain only. Applied to a generated background
// BEFORE the slide is composed, so the type sits clean on top.
export const FX_FILTER = `
<filter id="castfx" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0" result="ng"/>
  <feComponentTransfer in="ng" result="grain">
    <feFuncR type="linear" slope="0.5" intercept="0.25"/>
    <feFuncG type="linear" slope="0.5" intercept="0.25"/>
    <feFuncB type="linear" slope="0.5" intercept="0.25"/>
  </feComponentTransfer>
  <feBlend in="grain" in2="SourceGraphic" mode="overlay" result="out"/>
</filter>`;

// A standalone page that grains one photo and can be screenshot at slide size.
// The defaults are the Instagram canvas; callers on another format must pass W/H.
export const fxPage = (imgUrl: string, W = 1080, H = 1350): string => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
  .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:url(#castfx)}
</style></head><body>
  <svg width="0" height="0" style="position:absolute"><defs>${FX_FILTER}</defs></svg>
  <img class="ph" src="${imgUrl}">
</body></html>`;
