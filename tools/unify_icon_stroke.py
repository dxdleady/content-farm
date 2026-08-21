#!/usr/bin/env python3
"""Icons were exported off different Figma canvases (16–80 px) and each carries a
`<g transform="scale(k)">` that fits it to the 24 grid. That transform scales the
stroke too, so a flat stroke-width leaves the set looking uneven. Solve for the
attribute that lands on the same *rendered* weight: attr = target / k."""
import re, os, sys

TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 1.75
DIR = 'assets/icons-clean'

rows = []
for f in sorted(os.listdir(DIR)):
    if not f.endswith('.svg'):
        continue
    p = os.path.join(DIR, f)
    s = open(p).read()
    if 'stroke=' not in s:
        continue
    m = re.search(r'<g transform="scale\(([\d.]+)\)', s)
    k = float(m.group(1)) if m else 1.0
    attr = round(TARGET / k, 3)
    s = re.sub(r'stroke-width="[\d.]+"', f'stroke-width="{attr:g}"', s)
    s = re.sub(r'(<(?:path|circle|rect|ellipse|line)(?![^>]*stroke-width)[^>]*stroke="currentColor")',
               rf'\1 stroke-width="{attr:g}"', s)
    open(p, 'w').write(s)
    rows.append((f[:-4], k, attr))

for n, k, a in rows:
    print(f'  {n:<18} scale {k:<8g} stroke {a:<7g} -> rendered {TARGET:g}')
print(f'{len(rows)} icons at a uniform rendered weight of {TARGET:g}')
