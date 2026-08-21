#!/usr/bin/env python3
"""Clean Figma icon exports: strip page/frame background rects and clip artifacts,
scale to a 24x24 grid, and swap hard-coded colours for currentColor."""
import re, os, sys, math

SRC = "assets/icons"
DST = "assets/icons"
JUNK_D = ("M-12 -24.5H964", "M964 40.5V39.5")

def parse(path):
    s = open(path).read()
    m = re.search(r'<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"', s)
    w, h = float(m.group(1)), float(m.group(2))
    shapes = []
    for tag in re.finditer(r'<(path|circle|rect|ellipse)\b([^>]*?)/?>', s):
        name, attrs = tag.group(1), tag.group(2)
        d = re.search(r'\sd="([^"]*)"', attrs)
        if name == 'path':
            if not d or any(d.group(1).startswith(j) for j in JUNK_D):
                continue
        if name == 'rect':
            # background plates: full-canvas or page-sized rects
            rw = re.search(r'\swidth="([\d.]+)"', attrs)
            rh = re.search(r'\sheight="([\d.]+)"', attrs)
            if not rw or not rh:
                continue
            if float(rw.group(1)) >= w and float(rh.group(1)) >= h:
                continue
        shapes.append((name, attrs))
    return w, h, shapes

def recolor(attrs):
    attrs = re.sub(r'\sid="[^"]*"', '', attrs)
    attrs = re.sub(r'stroke="(?!none)[^"]*"', 'stroke="currentColor"', attrs)
    attrs = re.sub(r'fill="(?!none)[^"]*"', 'fill="currentColor"', attrs)
    attrs = re.sub(r'\smask="[^"]*"', '', attrs)
    attrs = re.sub(r'\sclip-path="[^"]*"', '', attrs)
    attrs = re.sub(r'\sfilter="[^"]*"', '', attrs)
    attrs = re.sub(r'\sstroke-opacity="[^"]*"', '', attrs)
    attrs = re.sub(r'\sfill-opacity="[^"]*"', '', attrs)
    return attrs.strip()

def build(name, w, h, shapes, grid=24.0):
    k = grid / max(w, h)
    body = []
    for tag, attrs in shapes:
        a = recolor(attrs)
        if 'stroke=' in a and 'stroke-width' not in a:
            a += ' stroke-width="1"'
        # normalise stroke weight to the 24-grid
        def sw(m):
            return 'stroke-width="%s"' % round(float(m.group(1)) * k, 3)
        a = re.sub(r'stroke-width="([\d.]+)"', sw, a)
        if 'fill=' not in a and 'stroke=' in a:
            a = 'fill="none" ' + a
        body.append(f'  <{tag} {a}/>')
    inner = "\n".join(body)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {grid:g} {grid:g}" '
            f'width="{grid:g}" height="{grid:g}" fill="none">\n'
            f'<g transform="scale({round(k,6)}) translate({round((max(w,h)-w)/2,3)} {round((max(w,h)-h)/2,3)})">\n'
            f'{inner}\n</g>\n</svg>\n')

if __name__ == '__main__':
    os.makedirs("assets/icons-clean", exist_ok=True)
    manifest = []
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.svg'):
            continue
        w, h, shapes = parse(os.path.join(SRC, f))
        if not shapes:
            print("SKIP (empty):", f); continue
        out = build(f[:-4], w, h, shapes)
        open(os.path.join("assets/icons-clean", f), 'w').write(out)
        manifest.append((f[:-4], len(shapes)))
    for n, c in manifest:
        print(f"{n:<18} {c} shape(s)")
