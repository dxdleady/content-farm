#!/usr/bin/env python3
"""products/<id>/tokens/tokens.json -> tokens.css (custom properties + type utility classes).

    python3 tools/build_css.py            # the default product
    python3 tools/build_css.py --product x

Every product owns its tokens, so the paths are derived from the product id rather than
hardcoded. The @import at the top of the output points back at the SHARED font pool, so
its ../ depth is a function of how deep the product directory sits — computed, not
written by hand. Nothing in the render path depends on getting it right (both readers
strip that line whole), but a stylesheet you can open in a browser is worth the four
lines it costs.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

argv = sys.argv[1:]
product = argv[argv.index('--product') + 1] if '--product' in argv else 'cast'

tokens_dir = os.path.join(ROOT, 'products', product, 'tokens')
src = os.path.join(tokens_dir, 'tokens.json')
dst = os.path.join(tokens_dir, 'tokens.css')
if not os.path.isfile(src):
    have = sorted(d for d in os.listdir(os.path.join(ROOT, 'products'))
                  if os.path.isdir(os.path.join(ROOT, 'products', d)))
    sys.exit(f'no tokens.json for product "{product}" at {src} — have: {", ".join(have)}')

fonts = os.path.relpath(os.path.join(ROOT, 'assets/fonts/fonts.css'), tokens_dir)

T = json.load(open(src))

def kebab(s):
    return re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '-', s).lower()

lines = [f"/* {product} design tokens — generated from tokens.json. Do not edit by hand. */",
         f'@import url("{fonts}");', "", ":root {"]

for grp, vals in T['color'].items():
    if grp == 'alpha':
        for tone, scale in vals.items():
            for k, v in scale.items():
                lines.append(f"  --c-{tone}-{k}: {v};")
    else:
        for k, v in vals.items():
            lines.append(f"  --c-{kebab(grp)}-{kebab(k)}: {v};")
lines.append("")
for k, g in T['gradient'].items():
    stops = ", ".join(g['stops'])
    lines.append(f"  --g-{kebab(k)}: linear-gradient({g['angle']}deg, {stops});")
lines.append("")
lines.append(f"  --f-display: {T['font']['display']};")
lines.append(f"  --f-ui: {T['font']['ui']};")
lines.append("")
for k, v in T['radius'].items():
    lines.append(f"  --r-{k}: {v}px;")
for k, v in T['spacing'].items():
    lines.append(f"  --s-{k}: {v}px;")
lines.append("}")
lines.append("")
lines.append("/* Type scale. Sizes are in px at the 1440-wide web baseline; scale with --type-scale. */")
lines.append(":root { --type-scale: 1; }")

for grp, styles in T['typography'].items():
    for name, s in styles.items():
        cls = f".t-{kebab(grp)}-{kebab(name)}"
        fam = 'var(--f-display)' if s['family'] == 'display' else 'var(--f-ui)'
        d = [f"font-family: {fam}",
             f"font-size: calc({s['size']}px * var(--type-scale))",
             f"font-weight: {s['weight']}",
             f"line-height: {s['lineHeight']}",
             f"letter-spacing: calc({s['letterSpacing']}px * var(--type-scale))"]
        if s.get('transform'):
            d.append(f"text-transform: {s['transform']}")
        lines.append(f"{cls} {{ " + "; ".join(d) + "; }")

open(dst, 'w').write("\n".join(lines) + "\n")
print(f"wrote {os.path.relpath(dst, ROOT)}")
