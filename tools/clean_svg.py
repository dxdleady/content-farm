#!/usr/bin/env python3
"""Strip Figma page/frame background plates from an exported SVG and recolour to currentColor."""
import re, sys, os

def clean(path, out, color='currentColor'):
    s = open(path).read()
    m = re.search(r'<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"', s)
    w, h = float(m.group(1)), float(m.group(2))
    shapes = []
    for tag in re.finditer(r'<(path|circle|rect|ellipse|polygon)\b([^>]*?)/?>', s):
        name, attrs = tag.group(1), tag.group(2)
        if name == 'rect':
            rw = re.search(r'\swidth="([\d.]+)"', attrs)
            rh = re.search(r'\sheight="([\d.]+)"', attrs)
            if rw and rh and float(rw.group(1)) >= w and float(rh.group(1)) >= h:
                continue
        a = re.sub(r'\sid="[^"]*"', '', attrs)
        a = re.sub(r'fill="(?!none)[^"]*"', f'fill="{color}"', a)
        a = re.sub(r'stroke="(?!none)[^"]*"', f'stroke="{color}"', a)
        a = re.sub(r'\s(clip-path|mask|filter)="[^"]*"', '', a)
        shapes.append(f'<{name} {a.strip()}/>')
    body = "".join(shapes)
    open(out, 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" '
        f'width="{w:g}" height="{h:g}" fill="none">{body}</svg>\n')
    return len(shapes)

if __name__ == '__main__':
    for src, dst in [("assets/images/waveform.svg", "assets/images/waveform-strip.svg"),
                     ("assets/images/wave-parts.svg", "assets/images/wave-parts-clean.svg"),
                     ("assets/images/illustration-episodes.svg", "assets/images/illustration-episodes-clean.svg")]:
        n = clean(src, dst)
        print(f"{dst}: {n} shapes, {os.path.getsize(dst)} bytes")
