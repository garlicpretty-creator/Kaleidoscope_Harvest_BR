"""Quick 3/4-view renders of kit models (tools/art/kit.py), for checking art without the game or Blockbench.

render(boxes, painters, scale) -> RGBA image. Faces are flat-shaded like Minecraft (top 1.0, north/south 0.8,
east/west 0.6), single-sided (back faces skipped, as in game), drawn far to near, one quad per texel.
"""
import math

from PIL import Image, ImageDraw

from kit import NORMAL, Texel, _face_wh, _texel_pos, edge_shade, visible_faces

LIGHT = {"up": 1.0, "down": 0.5, "north": 0.8, "south": 0.8, "east": 0.6, "west": 0.6}
YAW, PITCH = math.radians(35), math.radians(32)


def _project(p):
    x, y, z = -p[0], p[1], p[2]  # Bedrock block geometry mirrors x
    sx = x * math.cos(YAW) - z * math.sin(YAW)
    d = x * math.sin(YAW) + z * math.cos(YAW)
    sy = -y * math.cos(PITCH) + d * math.sin(PITCH)
    depth = d * math.cos(PITCH) + y * math.sin(PITCH)
    return sx, sy, depth


def _facing_viewer(face):
    axis, sign = NORMAL[face]
    n = [0, 0, 0]
    n[axis] = sign
    _, _, d1 = _project((0, 0, 0))
    _, _, d2 = _project(tuple(n))
    return d2 > d1 + 1e-6


def render(boxes, painters, scale=14, size=20):
    quads = []
    vis = visible_faces(boxes)
    for b in boxes:
        for f in vis[id(b)]:
            if not _facing_viewer(f):
                continue
            w, h = _face_wh(b, f)
            iw, ih = max(1, math.ceil(w - 1e-6)), max(1, math.ceil(h - 1e-6))
            paint = painters[b.material(f)]
            for v in range(ih):
                for u in range(iw):
                    t = Texel(b, f, u, v, iw, ih, *_texel_pos(b, f, u, v, iw, ih))
                    c = tuple(paint(t))
                    if len(c) == 3:
                        c += (255,)
                    if c[3] == 0:
                        continue
                    if getattr(paint, "shade", True):
                        c = edge_shade(c, t, getattr(paint, "shade_k", 1.0))
                    corners = [_texel_pos(b, f, u + du - 0.5, v + dv - 0.5, iw, ih) for du, dv in ((0, 0), (1, 0), (1, 1), (0, 1))]
                    pts = [_project(p) for p in corners]
                    depth = sum(p[2] for p in pts) / 4
                    k = LIGHT[f]
                    quads.append((depth, [(p[0], p[1]) for p in pts], tuple(min(255, int(ch * k)) for ch in c[:3])))
    quads.sort(key=lambda q: q[0])
    img = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    ox, oy = size * scale / 2, size * scale * 0.62
    for _, pts, col in quads:
        draw.polygon([(ox + x * scale, oy + y * scale) for x, y in pts], fill=col + (255,))
    return img


def sheet(items, scale=14, size=20, bg=(118, 150, 92)):
    """items: [(boxes, painters)] -> one row image on a grass-coloured background."""
    tile = size * scale
    out = Image.new("RGBA", (tile * len(items), tile), bg + (255,))
    for i, (boxes, painters) in enumerate(items):
        im = render(boxes, painters, scale, size)
        out.paste(im, (i * tile, 0), im)
    return out
