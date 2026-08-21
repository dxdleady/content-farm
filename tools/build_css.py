#!/usr/bin/env python3
"""tokens/tokens.json -> tokens/tokens.css (custom properties + type utility classes)."""
import json, re

T = json.load(open('tokens/tokens.json'))

def kebab(s):
    return re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '-', s).lower()

lines = ["/* (cast) design tokens — generated from tokens/tokens.json. Do not edit by hand. */",
         '@import url("../assets/fonts/fonts.css");', "", ":root {"]

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

open('tokens/tokens.css', 'w').write("\n".join(lines) + "\n")
print("wrote tokens/tokens.css")
