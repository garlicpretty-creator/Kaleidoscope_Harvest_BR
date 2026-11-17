"""Paints every crop stage, sapling, fruit-tree leaves and fruitwood texture as 16x16 pixel art.

Usage: python tools/art/crop_textures.py

Everything is drawn from code: shape helpers (leaf blades, ellipses, lines, small stamps) put pixels of a
named colour ramp (5 shades, dark -> light) into a canvas; a final pass shades each pixel like vanilla
crops (lighter where nothing is above, darker on the lower edge of every leaf, a little hashed noise).
No anti-aliasing, no randomness that changes between runs.

Writes, under packs/RP/textures/kaleidoscope_harvest/blocks/:
  crops/<crop>_stage_<0..3>.png, crops/corn_upper_stage_<2|3>.png
  saplings/<tree>_sapling.png
  trees/<tree>_leaves_<bare|blossom>.png, trees/fruitwood_log(_top).png, trees/banana_trunk.png
and for each one <name>_normal.png and <name>_mer.png (flat normal with a bevel from height + brightness;
MER = metalness 0, emissive 0, roughness by material). Also art/previews/crop_textures.png (4x contact sheet).
Block states 0..7 map to the visual stage floor(state/2).
"""
import math, os, random, zlib
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'packs', 'RP', 'textures', 'kaleidoscope_harvest', 'blocks')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'crop_textures.png')

# ---------------------------------------------------------------- palettes (dark -> light)
G      = [(33, 62, 26), (50, 94, 44), (73, 124, 54), (98, 153, 60), (128, 184, 78)]
GD     = [(20, 46, 26), (30, 68, 34), (44, 92, 42), (62, 118, 52), (90, 146, 66)]
GL     = [(50, 94, 30), (74, 130, 40), (106, 164, 52), (142, 194, 70), (180, 220, 100)]
PALE   = [(96, 132, 60), (134, 170, 80), (176, 206, 112), (210, 228, 158), (236, 242, 210)]
WHITE  = [(150, 166, 128), (190, 204, 168), (220, 228, 204), (238, 242, 228), (250, 252, 244)]
BLUEG  = [(36, 70, 52), (54, 98, 70), (78, 128, 88), (108, 156, 108), (146, 186, 138)]
YG     = [(62, 82, 30), (92, 114, 42), (126, 146, 58), (162, 176, 78), (198, 204, 112)]
YEL    = [(100, 90, 26), (140, 124, 36), (178, 160, 52), (208, 192, 80), (232, 220, 124)]
BROWN  = [(56, 38, 24), (82, 56, 34), (108, 76, 46), (136, 100, 62), (166, 130, 86)]
TAN    = [(90, 72, 42), (124, 102, 60), (158, 134, 82), (190, 166, 108), (220, 202, 146)]
PURPLE = [(34, 14, 42), (56, 24, 68), (84, 40, 100), (116, 64, 132), (160, 110, 176)]
VIOLET = [(70, 50, 110), (100, 74, 150), (134, 108, 186), (170, 146, 214), (210, 196, 238)]
SPP    = [(54, 28, 52), (82, 44, 76), (110, 66, 96), (136, 96, 108), (162, 128, 124)]
RED    = [(88, 12, 18), (138, 22, 28), (184, 38, 40), (220, 70, 62), (246, 132, 112)]
BLUE   = [(26, 30, 64), (40, 50, 96), (60, 76, 130), (96, 112, 166), (150, 164, 204)]
ONION  = [(92, 52, 22), (134, 82, 34), (172, 116, 52), (204, 156, 84), (230, 196, 132)]
FLW    = [(176, 176, 166), (208, 208, 198), (230, 230, 222), (246, 246, 240), (255, 255, 252)]
PINK   = [(150, 64, 96), (196, 100, 138), (226, 144, 176), (242, 188, 210), (252, 224, 236)]
YFLW   = [(156, 112, 10), (200, 156, 20), (232, 194, 40), (248, 222, 90), (255, 244, 160)]
ORANGE = [(138, 56, 10), (188, 86, 16), (226, 122, 26), (244, 158, 50), (252, 200, 110)]
LEMON  = [(146, 126, 22), (194, 170, 32), (226, 204, 52), (244, 228, 98), (252, 244, 164)]
PINE   = [(104, 64, 18), (152, 100, 26), (194, 138, 40), (222, 176, 70), (244, 212, 122)]
SAGE   = [(46, 70, 58), (64, 96, 74), (90, 122, 88), (118, 148, 104), (156, 180, 134)]
GG     = [(42, 66, 46), (60, 92, 60), (84, 118, 74), (110, 144, 92), (144, 170, 118)]
PODS   = [(84, 90, 40), (118, 126, 56), (152, 158, 78), (186, 188, 110), (218, 216, 158)]
CUKE   = [(14, 40, 26), (22, 58, 34), (32, 80, 42), (64, 118, 60), (170, 204, 130)]
GRAPE  = [(30, 16, 42), (52, 28, 72), (78, 46, 106), (112, 80, 142), (164, 134, 194)]
UNRIPE = [(92, 132, 40), (128, 168, 52), (162, 200, 72), (196, 226, 104), (226, 244, 156)]
PERSL  = [(34, 64, 26), (52, 94, 36), (78, 126, 46), (108, 156, 58), (142, 184, 80)]
BANL   = [(40, 80, 30), (60, 110, 40), (84, 142, 50), (114, 172, 64), (150, 200, 90)]
BRONZE = [(72, 28, 22), (112, 44, 30), (152, 64, 40), (188, 94, 60), (216, 136, 96)]
PEACH  = [(156, 72, 52), (206, 104, 70), (236, 150, 96), (248, 190, 128), (254, 226, 180)]
PEAR   = [(132, 118, 36), (176, 160, 52), (208, 194, 76), (230, 220, 112), (246, 240, 170)]
PERS   = [(140, 44, 10), (192, 72, 16), (228, 104, 24), (244, 140, 46), (252, 186, 100)]
MANGO  = [(170, 92, 14), (214, 132, 22), (238, 170, 40), (250, 204, 80), (254, 232, 140)]
BANY   = [(150, 124, 24), (196, 168, 34), (228, 204, 60), (244, 228, 104), (252, 244, 168)]
BARK   = [(50, 34, 28), (72, 50, 40), (96, 70, 56), (122, 92, 74), (148, 118, 96)]
WOOD   = [(118, 78, 48), (148, 102, 64), (176, 130, 86), (202, 162, 116), (224, 194, 148)]
BANT   = [(58, 68, 36), (84, 96, 48), (112, 122, 60), (140, 148, 78), (170, 174, 106)]
SILK   = [(70, 36, 20), (100, 56, 28), (132, 80, 40), (200, 190, 120), (230, 222, 160)]

# material -> (metalness, emissive, roughness, height for the normal map)
MAT = {'leaf': (0, 0, 185, 2.0), 'stem': (0, 0, 200, 1.5), 'fruit': (0, 0, 150, 2.6), 'flower': (0, 0, 200, 2.0),
       'root': (0, 0, 190, 2.2), 'dry': (0, 0, 215, 1.6), 'bark': (0, 0, 235, 2.0), 'wood': (0, 0, 225, 1.4)}


def ihash(*v):
    h = 2166136261
    for n in v:
        h = ((h ^ (n & 0xffffffff)) * 16777619) & 0xffffffff
    h ^= h >> 13
    h = (h * 1274126177) & 0xffffffff
    return h ^ (h >> 16)


class Canvas:
    """(x, y) -> [ramp, level, material, object id, fixed]. Tile canvases wrap at the edges."""

    def __init__(self, tile=False, seed=0, noise=True):
        self.p = {}
        self.obj = 0
        self.tile = tile
        self.seed = seed
        self.noise = noise

    def new(self):
        self.obj += 1
        return self.obj

    def put(self, x, y, ramp, lvl=2, mat='leaf', obj=None, fixed=False):
        x, y = int(math.floor(x)), int(math.floor(y))
        if self.tile:
            x, y = x % 16, y % 16
        elif not (0 <= x < 16 and 0 <= y < 16):
            return
        self.p[(x, y)] = (ramp, lvl, mat, self.obj if obj is None else obj, fixed)

    def get(self, x, y):
        if self.tile:
            return self.p.get((x % 16, y % 16))
        return self.p.get((x, y))

    def erase(self, x, y):
        self.p.pop((x % 16, y % 16) if self.tile else (x, y), None)

    def shaded(self):
        out = {}
        for (x, y), (ramp, lvl, mat, o, fixed) in self.p.items():
            if not fixed:
                up, dn, rt = self.get(x, y - 1), self.get(x, y + 1), self.get(x + 1, y)
                if up is None:
                    lvl += 1
                if dn is None or dn[3] != o:
                    lvl -= 1
                if mat == 'fruit' and (rt is None or rt[3] != o) and up is not None:
                    lvl -= 1
                if self.noise and mat in ('leaf', 'bark', 'wood', 'dry'):
                    h = ihash(x, y, self.seed) % 100
                    lvl += -1 if h < 11 else (1 if h > 92 else 0)
            out[(x, y)] = (ramp[max(0, min(4, lvl))], mat)
        return out


# ---------------------------------------------------------------- shape helpers
def hw_of(shape, width, u):
    u = max(0.0, min(1.0, u))
    if shape == 'lance':
        return width / 2 * math.sin(math.pi * u) ** 0.7
    if shape == 'oval':
        return width / 2 * math.sin(math.pi * u) ** 0.4
    if shape == 'oblong':
        return width / 2 * min(1.0, math.sin(math.pi * u) ** 0.25 * 1.05)
    if shape == 'strap':
        return width / 2 * (1 - u ** 3)
    if shape == 'petiole':
        return 0.0 if u < 0.3 else width / 2 * math.sin(math.pi * (u - 0.3) / 0.7) ** 0.6
    if shape == 'tube':
        return width / 2
    raise ValueError(shape)


def leaf(c, x0, y0, ang, length, width, ramp, droop=0.0, lvl=2, mat='leaf', rib=None, shape='lance', obj=None,
         spine=True):
    """A blade from (x0, y0) at `ang` degrees (90 = up). `droop` bends the tip down by that many pixels."""
    o = c.new() if obj is None else obj
    a = math.radians(ang)
    ux, uy = math.cos(a), -math.sin(a)
    n = max(6, int(length * 5))
    pts = []
    for i in range(n + 1):
        u = i / n
        t = u * length
        pts.append((x0 + ux * t, y0 + uy * t + droop * u * u, u))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for py in range(int(min(ys) - width) - 1, int(max(ys) + width) + 2):
        for px in range(int(min(xs) - width) - 1, int(max(xs) + width) + 2):
            cx, cy = px + .5, py + .5
            best, bu = 99, 0
            for x, y, u in pts:
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d < best:
                    best, bu = d, u
            if math.sqrt(best) <= hw_of(shape, width, bu) + 0.08:
                c.put(px, py, ramp, lvl, mat, o)
    if spine:
        for x, y, u in pts[:-1] if shape not in ('strap', 'tube') else pts:
            c.put(x, y, ramp, lvl, mat, o)
    if rib:
        for x, y, u in pts:
            if 0.12 < u < 0.8:
                c.put(x, y, rib[0], rib[1], mat, o, True)
    return pts[-1][0], pts[-1][1]


def line(c, x0, y0, x1, y1, ramp, lvl=2, mat='stem', obj=None, fixed=False):
    o = c.new() if obj is None else obj
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        c.put(x0, y0, ramp, lvl, mat, o, fixed)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return o


def path(c, pts, ramp, lvl=2, mat='stem', fixed=False):
    o = c.new()
    for a, b in zip(pts, pts[1:]):
        line(c, a[0], a[1], b[0], b[1], ramp, lvl, mat, o, fixed)
    return o


def ellipse(c, cx, cy, rx, ry, ramp, lvl=2, mat='fruit', obj=None):
    o = c.new() if obj is None else obj
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1.0:
                c.put(x, y, ramp, lvl, mat, o)
    return o


def stamp(c, x, y, rows, key):
    """key: char -> (ramp, level, material, fixed). One object per stamp."""
    o = c.new()
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in key:
                r, l, m, f = key[ch]
                c.put(x + i, y + j, r, l, m, o, f)
    return o


def fruit_key(ramp, calyx=GD, extra=None):
    k = {'x': (ramp, 2, 'fruit', False), 'h': (ramp, 4, 'fruit', True), 'd': (ramp, 1, 'fruit', True),
         'D': (ramp, 0, 'fruit', True), 'l': (ramp, 3, 'fruit', True),
         'c': (calyx, 2, 'leaf', True), 'C': (calyx, 1, 'leaf', True), 's': (BROWN, 2, 'stem', True)}
    if extra:
        k.update(extra)
    return k


B = 7.5, 15.9  # plant base


def yellow_tips(c, after, x0, y0, r1, r2, mid=YG, far=YEL):
    """Ripening: leaf pixels of objects drawn after object `after` turn `mid` from r1 and `far` from r2 pixels
    away from (x0, y0), so only the tips and outer parts of those leaves yellow."""
    for (x, y), (ramp, lvl, mat, o, fixed) in list(c.p.items()):
        if o <= after or mat != 'leaf':
            continue
        d = math.hypot(x + .5 - x0, y + .5 - y0)
        if d >= r1:
            c.p[(x, y)] = (far if d >= r2 else mid, lvl, mat, o, fixed)


def sprout(c, ramp, size=3.0, h=2, width=2.2, shape='oval'):
    line(c, 7, 15, 7, 16 - h, ramp, 2, 'stem')
    leaf(c, 7.5, 16 - h + .5, 160, size, width, ramp, shape=shape)
    leaf(c, 7.5, 16 - h + .5, 20, size, width, ramp, shape=shape)


def grass_sprout(c, ramp, n=2, h=4.0, width=1.6):
    for a, l in ((100, h), (78, h * .8), (120, h * .6))[:n]:
        leaf(c, 7.5, 15.9, a, l, width, ramp, shape='strap', droop=.5)


# ---------------------------------------------------------------- leafy vegetables
def napa_cabbage(c, s):
    if s == 0:
        return sprout(c, GL, 3)
    if s == 1:
        for a, l, w in ((128, 5.5, 4), (52, 5.5, 4), (97, 7, 4.5), (83, 7, 4.5)):
            leaf(c, *B, a, l, w, GL, shape='oval', rib=(WHITE, 3))
        return
    if s == 2:
        for a in (162, 18):
            leaf(c, *B, a, 6, 4, GL, droop=1, shape='oval', rib=(WHITE, 2))
        for a, l, w in ((98, 10, 6), (82, 10, 6), (90, 9.5, 5)):
            leaf(c, *B, a, l, w, PALE, shape='oblong', rib=(WHITE, 4))
        return
    for a, l in ((168, 7), (12, 7), (142, 6.5), (38, 6.5)):
        leaf(c, *B, a, l, 4.6, G, droop=1.6, shape='oval', rib=(WHITE, 2))
    for a, l, w in ((97, 15, 8), (83, 15, 8), (90, 14.2, 6.4)):
        leaf(c, *B, a, l, w, PALE, shape='oblong', rib=(WHITE, 4))


def spoon(c, a, pl, bl, bw):
    ex, ey = leaf(c, *B, a, pl, 2.4, WHITE, shape='strap', mat='stem')
    leaf(c, ex, ey + .3, a, bl, bw, GD, shape='oval', rib=(WHITE, 3))


def bok_choy(c, s):
    if s == 0:
        return sprout(c, GD, 3)
    spec = {1: [(110, 2, 4, 3), (70, 2, 4, 3), (90, 2.5, 4.5, 3)],
            2: [(120, 3.5, 5, 4), (60, 3.5, 5, 4), (100, 4.5, 5.5, 4), (80, 4.5, 5.5, 4)],
            3: [(122, 5, 6.5, 5), (58, 5, 6.5, 5), (103, 6.5, 7, 5), (77, 6.5, 7, 5), (90, 6, 7.5, 4.6)]}[s]
    for a, pl, bl, bw in spec:
        spoon(c, a, pl, bl, bw)


def spinach(c, s):
    if s == 0:
        return sprout(c, GD, 3, h=1)
    spec = {1: [(150, 4, 3), (30, 4, 3), (95, 4.5, 3)],
            2: [(168, 5.5, 3.6), (12, 5.5, 3.6), (138, 5.5, 3.6), (42, 5.5, 3.6), (105, 5.5, 3.6), (75, 5.5, 3.6)],
            3: [(172, 8, 4.6), (8, 8, 4.6), (150, 8.5, 4.8), (30, 8.5, 4.8), (126, 9, 4.8), (54, 9, 4.8),
                (104, 9, 4.6), (76, 9, 4.6), (90, 7.5, 4.4)]}[s]
    for i, (a, l, w) in enumerate(spec):
        leaf(c, 7.5, 15.6, a, l, w, GD, lvl=2 + i % 2, droop=1.0 if s > 1 else 0, shape='petiole',
             rib=(GD, 4) if s > 1 else None)


LOBE = ['x.x', 'xxx', '.x.']
FEATHER = ['x.x', '.x.']


def coriander(c, s):
    k = {'x': (GL, 2, 'leaf', False)}
    if s == 0:
        line(c, 7, 15, 7, 14, GL)
        stamp(c, 5, 12, LOBE, k)
        stamp(c, 8, 12, LOBE, k)
        return
    stems = {1: [(120, 4), (60, 4), (92, 5.5)],
             2: [(132, 7), (48, 7), (106, 9), (74, 9), (160, 5), (20, 5)],
             3: [(126, 12), (54, 12), (102, 14.5), (78, 14.5), (148, 8), (32, 8)]}[s]
    tips = []
    for a, l in stems:
        ex, ey = leaf(c, *B, a, l, 1, GL, shape='tube', mat='stem')
        tips.append((ex, ey, l))
        ux, uy = math.cos(math.radians(a)), -math.sin(math.radians(a))
        if s < 3 or l < 10:
            stamp(c, int(ex) - 1, int(ey) - 2, LOBE, k)
        for j, t in enumerate(range(4, int(l) - 1, 4)):
            x, y = 7.5 + ux * t, 15.9 + uy * t
            stamp(c, int(x) + (1 if j % 2 else -3), int(y) - 1, FEATHER if s == 3 else LOBE[:2], k)
    if s == 3:
        for x in (2, 6, 10):
            stamp(c, x, 13, LOBE, k)
        fk = {'w': (FLW, 3, 'flower', True), 'p': (PINK, 4, 'flower', True)}
        for ex, ey, l in tips:
            if l >= 10:
                stamp(c, int(ex) - 1, int(ey) - 1, ['wpw', '.w.'], fk)


def cumin(c, s):
    if s == 0:
        grass_sprout(c, BLUEG, 2, 3.5, 1.2)
        return
    stems = {1: [(100, 5), (80, 5.5)],
             2: [(110, 9), (72, 10), (92, 11)],
             3: [(115, 11), (68, 12), (92, 14), (138, 8), (42, 8)]}[s]
    for a, l in stems:
        ex, ey = leaf(c, *B, a, l, 1, BLUEG, shape='tube', mat='stem')
        for t in range(2, int(l), 2):
            x = 7.5 + math.cos(math.radians(a)) * t
            y = 15.9 - math.sin(math.radians(a)) * t
            d = 1 if (t // 2) % 2 else -1
            line(c, x + d, y - 1, x + 2 * d, y - 2, BLUEG, 3, 'leaf')
        if s >= 2 and l >= 9:
            if s == 2:
                fk = {'w': (FLW, 3, 'flower', True), 'p': (PINK, 3, 'flower', True), 's': (BLUEG, 2, 'stem', True)}
                stamp(c, int(ex) - 2, int(ey) - 2, ['w.p.w', '.sss.', '..s..'], fk)
            else:
                fk = {'t': (TAN, 3, 'dry', True), 'T': (TAN, 1, 'dry', True), 's': (BLUEG, 1, 'stem', True)}
                stamp(c, int(ex) - 2, int(ey) - 3, ['t.T.t', 'TtTtT', '.sss.', '..s..'], fk)


def sesame(c, s):
    if s == 0:
        return sprout(c, G, 3)
    top = {1: 9, 2: 4, 3: 1}[s]
    line(c, 7, 15, 7, top, G, 2, 'stem')
    ys = list(range(13, top + 1, -3))
    for i, y in enumerate(ys):
        ramp = YG if s == 3 and y > 10 else G
        l = 4.5 if y > top + 3 else 3
        leaf(c, 7.5, y + .5, 32 + (i % 2) * 6, l, 2.2, ramp, droop=.6)
        leaf(c, 7.5, y + .5, 148 - (i % 2) * 6, l, 2.2, ramp, droop=.6)
    leaf(c, 7.5, top + .5, 90, 2, 1.6, G)
    if s == 2:
        fk = {'w': (FLW, 3, 'flower', True), 'p': (PINK, 3, 'flower', True)}
        for y in ys[1:]:
            stamp(c, 8, y - 2, ['w', 'p'], fk)
            stamp(c, 6, y - 1, ['w', 'p'], fk)
    if s == 3:
        pk = {'x': (PODS, 2, 'fruit', False), 'h': (PODS, 4, 'fruit', True), 'd': (BROWN, 1, 'dry', True)}
        for i, y in enumerate(range(12, top + 2, -3)):
            stamp(c, 8, y - 3, ['d.', 'hx', 'xx', 'xx'], pk)
            stamp(c, 5, y - 2, ['.d', 'hx', 'xx', 'xx'], pk)


def trifol(c, x, y, a, size, ramp):
    leaf(c, x, y, a + 45, size * .8, size * .75, ramp, shape='oval')
    leaf(c, x, y, a - 45, size * .8, size * .75, ramp, shape='oval')
    leaf(c, x, y, a, size, size * .8, ramp, shape='oval')


def soybean(c, s):
    if s == 0:
        return sprout(c, G, 3, width=2.6)
    if s == 3:
        return soybean_ripe(c)
    stems = {1: [(110, 4), (70, 4.5)],
             2: [(125, 6), (55, 6), (95, 8), (150, 4), (30, 4)]}[s]
    for a, l in stems:
        ex, ey = leaf(c, *B, a, l, 1, G, shape='tube', mat='stem')
        trifol(c, ex, ey, a, 3.2 if s > 1 else 2.6, G)
    if s == 2:
        for x, y in ((5, 11), (10, 10), (7, 8)):
            c.put(x, y, VIOLET, 3, 'flower', c.new(), True)
            c.put(x, y + 1, VIOLET, 1, 'flower', c.obj, True)


# three pods hanging side by side from one node: two in front, the middle one in their shade
SOY_PODS = ['.s.', 'hsh', 'xDx', 'xdx', 'd.d']


def soybean_ripe(c):
    """A bushy plant, leaves just starting to yellow, with clusters of plump green-tan pods at the nodes."""
    for a, l in ((158, 5.5), (22, 5.5), (132, 8), (48, 8), (104, 10.5), (76, 10.5), (90, 12)):
        ex, ey = leaf(c, *B, a, l, 1, G, shape='tube', mat='stem')
        trifol(c, ex, ey, a, 3.4, G)
    yellow_tips(c, 0, *B, 12, 99)  # the leaf tips are just starting to turn
    pk = {'s': (YG, 1, 'stem', True), 'h': (PODS, 3, 'fruit', True), 'x': (PODS, 2, 'fruit', True),
          'd': (PODS, 1, 'fruit', True), 'D': (PODS, 0, 'fruit', True)}
    for x, y in ((1, 9), (12, 8), (5, 6), (9, 11)):
        stamp(c, x, y, SOY_PODS, pk)


# ---------------------------------------------------------------- bulbs and tubes
def onion(c, s):
    if s == 0:
        grass_sprout(c, BLUEG, 2, 4, 1.4)
        return
    if s == 1:
        for a, l in ((100, 8), (84, 9), (114, 6)):
            leaf(c, *B, a, l, 1.6, BLUEG, shape='strap', droop=.6)
        return
    if s == 2:
        for a, l, d in ((104, 11, 1), (86, 12, 0.5), (120, 8, 2), (68, 8, 2)):
            leaf(c, 7.5, 14.5, a, l, 1.8, BLUEG, droop=d, shape='strap')
        ellipse(c, 7.5, 14.8, 2.2, 1.6, WHITE, 2, 'root')
        return
    for a, l, d, r in ((100, 10, 1, BLUEG), (82, 10, .5, BLUEG), (128, 9, 5, YG), (50, 9, 5, YEL), (112, 7, 3, YG)):
        leaf(c, 7.5, 10.8, a, l, 1.8, r, droop=d, shape='strap')
    ellipse(c, 7.5, 13.4, 3.7, 3.0, ONION, 2, 'root')
    c.put(5, 11, ONION, 4, 'root', c.obj, True)
    c.put(5, 12, ONION, 3, 'root', c.obj, True)
    for x in (6, 8):
        c.put(x, 13, ONION, 1, 'root', c.obj, True)
        c.put(x, 14, ONION, 1, 'root', c.obj, True)


def scallion(c, s):
    if s == 0:
        grass_sprout(c, GL, 2, 4, 1.2)
        return
    tubes = {1: [(7, 8), (8, 7), (6, 6)],
             2: [(7, 4), (9, 6), (5, 6), (11, 8), (3, 9)],
             3: [(7, 0), (9, 1), (5, 2), (11, 4), (3, 5), (13, 8), (1, 9)]}[s]
    wh = {1: 13, 2: 13, 3: 12}[s]
    for x, top in tubes:
        o = line(c, 7 + (x - 7) // 2, 15, x, top + 5, GL, 2, 'leaf')
        line(c, x, top + 5, x, top, GL, 2, 'leaf', o)
        for y in range(wh, 16):
            c.put(7 + (x - 7) // 2 if y > top + 5 else x, y, WHITE, 3 if y < 15 else 2, 'stem', o)
        c.put(x, top, GL, 3, 'leaf', o, True)


def garlic(c, s):
    if s == 0:
        grass_sprout(c, BLUEG, 2, 4, 2)
        return
    neck = {1: 14, 2: 12, 3: 11}[s]
    line(c, 7, 15, 7, neck, WHITE, 3, 'stem')
    line(c, 8, 15, 8, neck, WHITE, 2, 'stem')
    sz = {1: .6, 2: .9, 3: 1.15}[s]
    for y, a, l, d in ((14, 42, 8, 3), (13, 138, 8, 3), (12, 70, 11, 1.5), (11, 110, 11, 1.5), (10, 90, 12, 0)):
        y = neck + (y - 11) * sz
        first = c.obj
        leaf(c, 8, y, a, l * sz, 2.0, BLUEG, droop=d * sz, shape='strap')
        if s == 3:  # ripe: the outer leaves yellow from the tip, the inner ones only at the very tip
            outer = a in (42, 138)
            yellow_tips(c, first, 8, y, l * sz * (.45 if outer else .75), l * sz * (.8 if outer else 2))
            if outer:
                ex = 8 + math.cos(math.radians(a)) * l * sz
                ey = y - math.sin(math.radians(a)) * l * sz + d * sz
                c.put(ex, ey, TAN, 2, 'dry', c.obj, True)


# ---------------------------------------------------------------- underground crops
def peanut_leaf(c, a, l, size, ramp, lvl=2):
    """A peanut leaf: a petiole from the base ending in two pairs of oval leaflets (pinnate, no end leaflet)."""
    ux, uy = math.cos(math.radians(a)), -math.sin(math.radians(a))
    ex, ey = leaf(c, *B, a, l, 1, G, lvl=1, shape='tube', mat='stem')
    mx, my = B[0] + ux * (l - size * .7), B[1] + uy * (l - size * .7)
    for x, y, spread, lv in ((mx, my, 80, lvl), (ex, ey, 30, lvl + 1)):
        for side in (1, -1):
            leaf(c, x, y, a + side * spread, size, size * .7, ramp, lvl=lv, shape='oval')


def peanut(c, s):
    if s == 0:
        sprout(c, G, 2.6, h=2, width=2)
        return
    spec = {1: [(135, 3.5), (45, 3.5), (90, 5)],
            2: [(162, 5.5), (18, 5.5), (124, 7.5), (56, 7.5), (90, 10)],
            3: [(164, 6.5), (16, 6.5), (124, 8.5), (56, 8.5), (90, 10.5)]}[s]
    size = {1: 2.3, 2: 2.7, 3: 3.0}[s]
    first = None
    for i, (a, l) in enumerate(spec):
        if s == 3 and i == 2:
            first = c.obj
        peanut_leaf(c, a, l, size, G)
    if s == 2:  # small yellow pea flowers tucked low between the leaves
        fk = {'y': (YFLW, 4, 'flower', True), 'Y': (YFLW, 2, 'flower', True), 'o': (ORANGE, 2, 'flower', True)}
        for x, y in ((4, 13), (10, 13), (7, 11)):
            stamp(c, x, y, ['yy', 'oY'], fk)
    if s == 3:  # ripe: the low, older leaves turn yellow-green, their tips a little yellow
        for (x, y), (ramp, lvl, mat, o, fixed) in list(c.p.items()):
            if mat == 'leaf' and o <= first:
                tip = math.hypot(x + .5 - B[0], y + .5 - B[1]) > 7.6
                c.p[(x, y)] = (YEL if tip else YG, lvl, mat, o, fixed)


HEART_UP = ['..x..', '.xxx.', 'xxvxx', 'xxvxx', '.x.x.']
HEART_UP_S = ['.x.', 'xvx', 'x.x']
HEART_DN = ['.xx.xx.', 'xxxxxxx', 'xxxvxxx', '.xxvxx.', '..xvx..', '...x...']  # hanging, notch at the top
HEART_DN_S = ['x.x', 'xxx', '.x.']


def sweet_potato(c, s):
    if s == 0:
        line(c, 7, 15, 7, 14, SPP)
        stamp(c, 5, 11, HEART_UP_S, {'x': (G, 2, 'leaf', False), 'v': (SPP, 3, 'leaf', True)})
        stamp(c, 8, 12, HEART_UP_S, {'x': (SPP, 3, 'leaf', False), 'v': (SPP, 2, 'leaf', True)})
        return
    if s == 3:
        return sweet_potato_ripe(c)
    kg = {'x': (G, 2, 'leaf', False), 'v': (SPP, 3, 'leaf', True)}
    kp = {'x': (SPP, 3, 'leaf', False), 'v': (SPP, 1, 'leaf', True)}
    vines = {1: [[(7, 15), (5, 13), (4, 12)], [(8, 15), (10, 13)]],
             2: [[(7, 15), (4, 14), (2, 12)], [(8, 15), (11, 14), (13, 12)], [(7, 15), (7, 11)]],
             3: [[(7, 15), (4, 14), (1, 13)], [(8, 15), (11, 14), (14, 13)], [(7, 15), (6, 10), (5, 8)],
                 [(8, 15), (10, 11), (11, 8)]]}[s]
    leaves = {1: [(2, 9, 0), (9, 10, 1)],
              2: [(0, 8, 0), (11, 8, 0), (5, 6, 1), (8, 10, 0), (2, 12, 1)],
              3: [(0, 9, 0), (12, 9, 0), (3, 3, 0), (9, 3, 1), (6, 7, 0), (1, 5, 0), (12, 5, 1), (9, 10, 0), (4, 10, 0)]}[s]
    for v in vines:
        path(c, v, SPP, 2)
    for x, y, young in leaves:
        stamp(c, x, y, HEART_UP if s > 1 or not young else HEART_UP_S, kp if young else kg)


def sweet_potato_ripe(c):
    """Purple vines arching up and trailing out; separate heart-shaped leaves hang from them by the notch."""
    for v in ([(7, 15), (6, 9), (5, 5), (4, 4), (3, 4)], [(8, 15), (9, 9), (10, 4), (11, 3), (12, 3)],
              [(7, 15), (4, 12), (1, 12)], [(8, 15), (11, 12), (14, 12)]):
        path(c, v, SPP, 2)
    kg = {'x': (G, 2, 'leaf', False), 'v': (G, 1, 'leaf', True)}
    ky = {'x': (YG, 2, 'leaf', False), 'v': (YG, 1, 'leaf', True)}
    stamp(c, 0, 5, HEART_DN, ky)
    stamp(c, 9, 4, HEART_DN, kg)
    for x, y in ((0, 13), (13, 13)):
        stamp(c, x, y, HEART_DN_S, kg)



def ginger(c, s):
    if s == 0:
        grass_sprout(c, GL, 2, 4, 1.4)
        return
    stalks = {1: [(7, 8), (9, 10)], 2: [(5, 6), (7, 3), (10, 5)], 3: [(4, 4), (6, 1), (9, 0), (12, 3)]}[s]
    for i, (x, top) in enumerate(stalks):
        o = line(c, x, 15, x, top, G, 2, 'stem')
        for j, y in enumerate(range(top + 1, 13, 2)):
            right = (j + i) % 2 == 0
            ramp = GL if s < 3 else (YG if (j + i) % 3 else YEL)
            leaf(c, x + (1 if right else 0), y + .5, 58 if right else 122, 5, 1.7, ramp, droop=1.2)
        c.put(x, top, GL if s < 3 else YG, 3, 'leaf', o, True)


def daikon(c, s):
    if s == 0:
        return sprout(c, G, 3, width=2.6)
    ramp = G
    spec = {1: [(120, 5), (60, 5), (92, 6)],
            2: [(140, 8), (40, 8), (110, 9), (70, 9), (92, 7)],
            3: [(150, 9), (30, 9), (118, 11), (62, 11), (92, 12)]}[s]
    base_y = {1: 15.9, 2: 13.6, 3: 12.6}[s]
    for i, (a, l) in enumerate(spec):
        first = c.obj
        leaf(c, 7.5, base_y, a, l, 1.4, ramp, shape='tube', droop=1.5 if s > 1 else .5)
        ux, uy = math.cos(math.radians(a)), -math.sin(math.radians(a))
        for j, t in enumerate(range(3, int(l) + 1, 3)):
            x, y = 7.5 + ux * t, base_y + uy * t + (1.5 if s > 1 else .5) * (t / l) ** 2
            leaf(c, x, y, a + (55 if j % 2 else -55), 2.6, 2.2, ramp, shape='oval')
        if s == 3:  # ripe: the outer leaves yellow towards their tips, the inner ones only at the very end
            yellow_tips(c, first, 7.5, base_y, l * (.5 if i < 2 else .85), l * (.85 if i < 2 else 9))
    if s >= 2:
        w = 2 if s == 2 else 4
        x0 = 8 - w // 2
        o = c.new()
        for y in range(int(base_y), 16):
            for x in range(x0, x0 + w):
                top = y == int(base_y)
                c.put(x, y, GL if top else WHITE, 3 if top else (4 if x == x0 else 2), 'root', o, True)


TARO_L = ['xx...xx', 'xxx.xxx', 'xxxvxxx', 'xxxvxxx', '.xxvxx.', '..xxx..', '...x...']
TARO_M = ['xx.xx', 'xxvxx', 'xxvxx', '.xvx.', '..x..']
TARO_S = ['x.x', 'xvx', '.x.']


def taro(c, s):
    if s == 0:
        line(c, 7, 15, 7, 13, SPP)
        stamp(c, 6, 10, TARO_S, {'x': (GD, 2, 'leaf', False), 'v': (GD, 4, 'leaf', True)})
        return
    k = {'x': (GD, 2, 'leaf', False), 'v': (GD, 4, 'leaf', True)}
    if s == 1:
        for (ex, ey), st in (((4, 8), TARO_S), ((10, 7), TARO_M)):
            line(c, 7, 15, ex, ey + 1, SPP, 3)
        stamp(c, 3, 8, TARO_S, k)
        stamp(c, 8, 6, TARO_M, k)
        return
    if s == 2:
        for ex, ey in ((3, 5), (11, 4), (7, 9)):
            line(c, 7, 15, ex, ey, SPP, 3)
        stamp(c, 1, 4, TARO_M, k)
        stamp(c, 9, 3, TARO_M, k)
        stamp(c, 5, 8, TARO_M, k)
        return
    for ex, ey in ((4, 3), (11, 2), (8, 8)):
        line(c, 7, 15, ex, ey, SPP, 3)
    # ripe: the oldest (left) leaf turns yellow-green with yellow lobe tips; the newer ones stay green
    old = {'x': (YG, 2, 'leaf', False), 'v': (YG, 4, 'leaf', True), 'y': (YEL, 2, 'leaf', False)}
    stamp(c, 0, 2, ['yy...yy', 'yxx.xxx', 'xxxvxxx', 'xxxvxxy', '.xxvxx.', '..xxx..', '...x...'], old)
    stamp(c, 8, 1, ['yy...yy'] + TARO_L[1:], dict(k, y=(YG, 3, 'leaf', False)))
    stamp(c, 5, 8, TARO_M, k)


# ---------------------------------------------------------------- fruiting bushes and shrubs
def eggplant(c, s):
    if s == 0:
        return sprout(c, GG, 3, width=2.8)
    top = {1: 9, 2: 5, 3: 3}[s]
    line(c, 7, 15, 7, top, PURPLE, 2, 'stem')
    lv = {1: [(13, 150, 4.5), (12, 30, 4.5), (9, 95, 3.5)],
          2: [(13, 160, 6), (12, 20, 6), (9, 145, 5), (8, 35, 5), (6, 100, 4)],
          3: [(13, 165, 7), (12, 15, 7), (9, 150, 6), (8, 30, 6), (5, 130, 5), (4, 55, 5), (3, 95, 4)]}[s]
    for y, a, l in lv:
        leaf(c, 7.5, y + .5, a, l, l * .8, GG, droop=1.2, shape='oval', rib=(GG, 3))
    if s == 2:
        fk = {'p': (VIOLET, 3, 'flower', True), 'y': (YFLW, 3, 'flower', True), 'P': (VIOLET, 1, 'flower', True)}
        stamp(c, 3, 9, ['.p.', 'pyp', '.P.'], fk)
        stamp(c, 10, 7, ['.p.', 'pyp', '.P.'], fk)
    if s == 3:
        fk = fruit_key(PURPLE, GG)
        egg = ['.c..', 'cCc.', 'hxx.', 'hxxx', 'xlxx', 'xxxx', 'xxxd', '.xd.']
        stamp(c, 2, 7, egg, fk)
        stamp(c, 10, 8, egg, fk)
        stamp(c, 6, 10, ['.c.', 'cCc', 'hxx', 'xlx', 'xxd', '.d.'], fk)


TRI_S = ['x.x', 'xxx', '.x.']


def strawberry(c, s):
    if s == 0:
        return sprout(c, G, 2.5, h=1)
    spec = {1: [(130, 3), (50, 3), (90, 4)],
            2: [(150, 5), (30, 5), (115, 6), (65, 6), (90, 5)],
            3: [(160, 6), (20, 6), (125, 7), (55, 7), (95, 8)]}[s]
    for a, l in spec:
        ex, ey = leaf(c, *B, a, l, 1, G, shape='tube', mat='stem')
        trifol(c, ex, ey, a, 3 if s > 1 else 2.4, G)
    if s == 2:
        fk = {'w': (FLW, 3, 'flower', True), 'y': (YFLW, 3, 'flower', True), 'W': (FLW, 1, 'flower', True)}
        for x, y in ((2, 11), (10, 12), (6, 9)):
            stamp(c, x, y, ['.w.', 'wyw', '.W.'], fk)
    if s == 3:
        fk = fruit_key(RED, G, {'y': (YFLW, 3, 'fruit', True)})
        berry = ['ccc', 'hyx', 'xxy', 'yxd', '.d.']
        stamp(c, 1, 10, berry, fk)
        stamp(c, 11, 11, berry, fk)
        stamp(c, 6, 11, ['ccc', 'hxy', 'yxd', '.d.'], fk)


def blueberry(c, s):
    if s == 0:
        line(c, 7, 15, 7, 13, BROWN)
        leaf(c, 7.5, 13.5, 150, 2.5, 2, G, shape='oval')
        leaf(c, 7.5, 13.5, 30, 2.5, 2, G, shape='oval')
        return
    br = {1: [[(7, 15), (7, 9)], [(7, 12), (4, 10)], [(7, 11), (10, 9)]],
          2: [[(7, 15), (7, 4)], [(7, 13), (3, 9), (2, 7)], [(7, 12), (11, 8), (12, 5)], [(7, 9), (5, 5)]],
          3: [[(7, 15), (7, 1)], [(7, 14), (3, 10), (1, 6)], [(7, 13), (11, 9), (13, 5)], [(7, 9), (4, 4)],
              [(7, 8), (10, 3)], [(7, 15), (12, 12), (14, 10)]]}[s]
    for b in br:
        path(c, b, BROWN, 2)
    pts = []
    for b in br:
        for (x0, y0), (x1, y1) in zip(b, b[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(1, n + 1, 2):
                pts.append((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))
    for i, (x, y) in enumerate(pts):
        a = 35 if i % 2 else 145
        leaf(c, x + .5, y + .5, a, 2.6, 2, G, shape='oval')
    if s == 2:
        fk = {'w': (FLW, 3, 'flower', True), 'p': (PINK, 3, 'flower', True)}
        for x, y in ((3, 10), (10, 8), (6, 6), (12, 11)):
            stamp(c, x, y, ['w', 'p'], fk)
    if s == 3:
        fk = fruit_key(BLUE, G)
        cl = ['hx.', 'xdhx', '.xxd']
        for x, y in ((1, 9), (9, 6), (4, 5), (10, 11), (5, 11)):
            stamp(c, x, y, cl, fk)


def pineapple(c, s):
    n = {0: [(55, 4), (125, 4), (90, 4.5)],
         1: [(20, 6), (160, 6), (50, 7), (130, 7), (90, 7)],
         2: [(20, 7), (160, 7), (42, 9), (138, 9), (64, 11), (116, 11), (82, 10), (98, 10)],
         3: [(18, 8), (162, 8), (38, 10.5), (142, 10.5), (58, 13), (122, 13), (76, 14), (104, 14)]}[s]
    for a, l in n:
        d = 3 * math.cos(math.radians(a)) ** 2 if s > 1 else .5
        leaf(c, *B, a, l, 2.4 if s else 2, SAGE, droop=d)
        if s >= 2:
            ux, uy = math.cos(math.radians(a)), -math.sin(math.radians(a))
            c.put(7.5 + ux * l, 15.9 + uy * l + d, BRONZE, 3, 'leaf', c.obj, True)
    if s == 2:
        line(c, 7, 15, 7, 11, SAGE, 2)
        ellipse(c, 7.5, 9, 1.6, 2.2, RED, 3, 'flower')
        for x, y in ((7, 8), (8, 9), (7, 10)):
            c.put(x, y, PINK, 3, 'flower', c.obj, True)
    if s == 3:
        line(c, 7, 15, 7, 10, SAGE, 2)
        o = ellipse(c, 7.5, 7, 3.2, 4.0, PINE, 2, 'fruit')
        for (x, y), v in list(c.p.items()):
            if v[3] == o:
                if (x + y) % 3 == 0:
                    c.put(x, y, PINE, 1, 'fruit', o, True)
                elif (x - y) % 3 == 0:
                    c.put(x, y, PINE, 3, 'fruit', o, True)
        c.put(5, 5, PINE, 4, 'fruit', o, True)
        for a, l in ((62, 3), (118, 3), (90, 4), (40, 2.2), (140, 2.2)):
            leaf(c, 7.5, 3.6, a, l, 1.5, SAGE, lvl=3)


# ---------------------------------------------------------------- corn (two blocks tall)
STALK = YG


def corn_stalk(c, y0, y1):
    o = c.new()
    for y in range(y0, y1 + 1):
        c.put(7, y, STALK, 3, 'stem', o)
        c.put(8, y, STALK, 1, 'stem', o)


def corn(c, s):
    if s == 0:
        grass_sprout(c, G, 2, 4, 1.8)
        return
    if s == 1:
        for a, l, d in ((62, 8, 2.5), (118, 7, 2.5), (82, 11, 1.5), (100, 10, 2)):
            leaf(c, *B, a, l, 2.2, G, droop=d, shape='strap')
        return
    corn_stalk(c, 0, 15)
    for x, y, a, d in ((8.5, 13, 30, 4), (7, 10, 150, 4), (8.5, 6, 35, 4), (7, 2, 145, 3.5)):
        leaf(c, x, y, a, 8, 2.2, G if s == 2 or y > 8 else YG, droop=d, shape='strap')
    if s == 2:
        k = {'x': (YG, 2, 'leaf', False), 'l': (YG, 4, 'leaf', True), 'w': (SILK, 4, 'dry', True)}
        stamp(c, 9, 4, ['.w', 'w.', 'lx', 'lx', 'xx', '.x'], k)
    if s == 3:
        k = {'x': (YG, 2, 'leaf', False), 'l': (YG, 3, 'leaf', True), 'k': (YFLW, 3, 'fruit', True),
             'K': (YFLW, 1, 'fruit', True), 'h': (YFLW, 4, 'fruit', True), 'w': (SILK, 1, 'dry', True),
             'W': (SILK, 2, 'dry', True)}
        ear = ['w.W', '.wW', 'lhx', 'lkx', 'lKx', 'lkx', 'xKx', '.x.']
        stamp(c, 4, 4, ear, k)
        stamp(c, 9, 8, ear, k)


def corn_upper(c, s):
    corn_stalk(c, 6, 15)
    leaf(c, 8.5, 14, 32, 7, 2.2, G if s == 2 else YG, droop=3.5, shape='strap')
    leaf(c, 7, 10, 150, 6, 2, G, droop=3, shape='strap')
    r = YG if s == 2 else TAN
    o = c.new()
    for y in range(0, 7):
        c.put(7, y, r, 3, 'flower', o)
    for pts in (((7, 4), (4, 2), (3, 3)), ((8, 4), (11, 2), (12, 3)), ((7, 6), (3, 5), (2, 7)), ((8, 6), (12, 5), (13, 7)),
                ((7, 2), (5, 0)), ((8, 2), (10, 0))):
        path(c, pts, r, 2, 'flower')
    dots = ((4, 2), (11, 2), (3, 5), (12, 5), (7, 1), (7, 3))
    for x, y in dots:
        c.put(x, y, r if s == 2 else SILK, 4 if s == 2 else 2, 'flower', c.obj, True)


# ---------------------------------------------------------------- vines (drawn alone; the trellis is its own model)
VINE_PATHS = {0: [[(7, 15), (8, 13), (7, 11)]],
              1: [[(7, 15), (8, 13), (7, 11), (6, 9), (7, 7), (8, 6)], [(7, 11), (4, 10), (3, 9)]],
              2: [[(7, 15), (8, 13), (7, 11), (6, 9), (7, 7), (8, 5), (8, 3), (7, 1)],
                  [(7, 11), (4, 10), (3, 8), (2, 5)], [(7, 7), (10, 6), (12, 4), (13, 2)]],
              3: [[(7, 15), (8, 13), (7, 11), (6, 9), (7, 7), (8, 5), (8, 3), (7, 0)],
                  [(7, 11), (4, 10), (3, 8), (2, 5), (1, 2)], [(7, 7), (10, 6), (12, 4), (13, 1)],
                  [(8, 13), (11, 12), (13, 10), (14, 8)], [(8, 3), (5, 2), (3, 0)]]}
VINE_LEAVES = {0: [(4, 11), (8, 9)],
               1: [(4, 11), (8, 9), (3, 6), (8, 3), (1, 8)],
               2: [(4, 11), (8, 9), (3, 6), (9, 3), (0, 3), (11, 1), (10, 6), (5, 0), (0, 8)],
               3: [(4, 11), (8, 9), (3, 6), (9, 3), (0, 3), (11, 1), (10, 6), (5, 0), (0, 8), (12, 8), (11, 11), (2, 0),
                   (5, 4)]}


def vine(c, s, stem, leafrows, ramp, rib):
    for p in VINE_PATHS[s]:
        path(c, p, stem, 2)
    for x, y in VINE_LEAVES[s]:
        stamp(c, x, y, leafrows, {'x': (ramp, 2, 'leaf', False), 'v': (rib, 3, 'leaf', True)})
    for x, y in ((9, 12), (4, 8), (11, 4))[:s + 1]:
        o = c.new()
        for dx, dy in ((1, 0), (2, -1), (2, -2), (1, -2)):
            c.put(x + dx, y + dy, GL, 3, 'stem', o, True)


CUKE_LEAF = ['.xxx.', 'xxvxx', 'xxvxx', '.xvx.', '..x..']
PEPPER_LEAF = ['xx.xx', 'xxvxx', '.xvx.', '..x..']
GRAPE_LEAF = ['x.x.x', 'xxvxx', '.xvx.', 'xxvxx', '..x..']
PASSION_LEAF = ['x.x.x', 'xxvxx', '.xvx.', '..x..']


def cucumber(c, s):
    vine(c, s, GL, CUKE_LEAF, GL, GL)
    if s == 2:
        fk = {'y': (YFLW, 3, 'flower', True), 'Y': (YFLW, 1, 'flower', True)}
        for x, y in ((2, 12), (12, 9), (6, 5), (13, 3)):
            stamp(c, x, y, ['y.y', '.Y.', 'y.y'], fk)
    if s == 3:
        fk = fruit_key(CUKE, GL, {'y': (YFLW, 3, 'flower', True)})
        cuke = ['.c.', 'hxd', 'lxd', 'xld', 'lxd', 'xld', '.xd', '.y.']
        for x, y in ((2, 9), (12, 3), (6, 6), (10, 9)):
            stamp(c, x, y, cuke, fk)


def black_pepper(c, s):
    vine(c, s, BROWN if s == 3 else G, PEPPER_LEAF, GD, GD)
    if s >= 2:
        ramp = UNRIPE if s == 2 else RED
        fk = {'a': (ramp, 3, 'fruit', True), 'b': (ramp, 1, 'fruit', True), 'o': (ORANGE, 3, 'fruit', True),
              's': (GD, 3, 'stem', True)}
        spike = ['s', 'a', 'b', 'a', 'b', 'a'] if s == 2 else ['s', 'a', 'b', 'o', 'a', 'b', 'a']
        for x, y in ((3, 10), (12, 6), (7, 4), (2, 3), (10, 11))[:4 if s == 2 else 5]:
            stamp(c, x, y, spike, fk)
            stamp(c, x + 1, y + 1, spike[:-1], fk)


def grape(c, s):
    vine(c, s, BROWN, GRAPE_LEAF, G, G)
    if s == 2:
        fk = {'x': (UNRIPE, 3, 'fruit', True), 'd': (UNRIPE, 1, 'fruit', True), 's': (BROWN, 2, 'stem', True)}
        for x, y in ((3, 11), (11, 7), (6, 4)):
            stamp(c, x, y, ['.s.', 'xdx', 'dxd', '.x.'], fk)
    if s == 3:
        fk = fruit_key(GRAPE, G)
        bunch = ['..s..', 'hxdhx', 'xdhxd', '.xdx.', '.dhx.', '..x..']
        for x, y in ((1, 10), (10, 5), (5, 3), (10, 11)):
            stamp(c, x, y, bunch, fk)


def passion_fruit(c, s):
    vine(c, s, G, PASSION_LEAF, GD, GL)
    if s == 2:
        fk = {'w': (FLW, 3, 'flower', True), 'p': (PURPLE, 3, 'flower', True), 'P': (VIOLET, 2, 'flower', True),
              'y': (GL, 4, 'flower', True)}
        for x, y in ((1, 10), (10, 5), (6, 1)):
            stamp(c, x, y, ['.w.w.', 'wPpPw', '.pyp.', 'wPpPw', '.w.w.'], fk)
    if s == 3:
        fk = fruit_key(PURPLE, GD, {'p': (PURPLE, 4, 'fruit', True)})
        fr = ['.s..', '.hx.', 'hxxx', 'xxlx', 'xxxd', '.dd.']
        for x, y in ((1, 9), (11, 5), (6, 3), (10, 10)):
            stamp(c, x, y, fr, fk)


CROPS = {'napa_cabbage': napa_cabbage, 'bok_choy': bok_choy, 'spinach': spinach, 'coriander': coriander, 'cumin': cumin,
         'sesame': sesame, 'soybean': soybean, 'onion': onion, 'scallion': scallion, 'garlic': garlic, 'peanut': peanut,
         'sweet_potato': sweet_potato, 'ginger': ginger, 'daikon': daikon, 'taro': taro, 'eggplant': eggplant,
         'strawberry': strawberry, 'blueberry': blueberry, 'pineapple': pineapple, 'corn': corn, 'cucumber': cucumber,
         'black_pepper': black_pepper, 'grape': grape, 'passion_fruit': passion_fruit}


# ---------------------------------------------------------------- trees
# tree -> sapling look: (leaf length, width, ramp, droop, shape, stem ramp, young-leaf ramp or None)
TREES = {
    'mandarin':     dict(sap=(2.4, 2.0, GD, .2, 'oval', BROWN, None), leaf=(3, 2.4, GD, 'oval')),
    'sweet_orange': dict(sap=(4.6, 3.0, G, .8, 'oval', BROWN, None), leaf=(4, 2.8, G, 'oval')),
    'lemon':        dict(sap=(4, 2.4, GL, .5, 'lance', BROWN, SPP), leaf=(4, 2.4, GL, 'lance')),
    'peach':        dict(sap=(5.5, 1.6, GL, 2.0, 'lance', BRONZE, None), leaf=(5, 1.7, GL, 'lance')),
    'pear':         dict(sap=(3, 2.8, G, .2, 'oval', BARK, None), leaf=(3, 2.8, G, 'oval')),
    'persimmon':    dict(sap=(4, 3.4, PERSL, .6, 'oval', BROWN, None), leaf=(4, 3.4, PERSL, 'oval')),
    'lychee':       dict(sap=(4, 1.8, GD, .8, 'lance', BROWN, BRONZE), leaf=(4, 1.9, GD, 'lance')),
    'mango':        dict(sap=(6, 1.9, GD, 3.0, 'lance', BROWN, BRONZE), leaf=(6, 2.0, GD, 'lance')),
    'banana':       dict(sap=None, leaf=None),
    'star_anise':   dict(sap=(4, 2.2, GD, .4, 'lance', BRONZE, None), leaf=(4, 2.2, GD, 'lance')),
    'cinnamon':     dict(sap=(4, 2.6, G, .5, 'oval', BRONZE, BRONZE), leaf=(4, 2.6, G, 'oval')),
}
SAP_LEAVES = [(7.5, 8.5, 165), (7.5, 8.5, 15), (5.5, 8, 180), (9.5, 7.5, 0), (5.5, 8, 135), (9.5, 7.5, 45),
              (7.5, 6, 160), (7.5, 6, 20), (7.5, 5.5, 120), (7.5, 5.5, 60), (7.5, 5, 90)]


def sapling(c, tree):
    if tree == 'banana':
        o = c.new()
        for y in range(9, 16):
            c.put(7, y, BANT, 3, 'stem', o)
            c.put(8, y, BANT, 1, 'stem', o)
        for a, l, d in ((150, 7, 3), (30, 7, 3), (120, 7, 1.5), (65, 7, 1.5)):
            leaf(c, 7.5, 9.5, a, l, 4, GL, droop=d, shape='oval', rib=(GL, 4))
        leaf(c, 7.5, 9.5, 92, 8, 1.8, GL, lvl=3, shape='strap')
        return
    l, w, ramp, droop, shape, stem, young = TREES[tree]['sap']
    if tree in ('mandarin', 'sweet_orange'):
        return citrus_sapling(c, tree, l, w, ramp, droop, stem)
    line(c, 7, 15, 7, 6, stem, 2, 'stem')
    line(c, 7, 10, 5, 8, stem, 2, 'stem')
    line(c, 7, 9, 9, 7, stem, 2, 'stem')
    if tree == 'star_anise':
        for x, y, n in ((5.5, 8.5, 4), (9.5, 7.5, 4), (7.5, 5.5, 5)):
            for i in range(n):
                leaf(c, x, y, 90 + 360 * i / n + 20, l, w, ramp, droop=droop, shape=shape, rib=(ramp, 3))
        return
    for x, y, a in SAP_LEAVES:
        r = young if young is not None and y <= 5.5 else ramp
        leaf(c, x, y, a, l, w, r, droop=droop, shape=shape, rib=(r, 3) if w >= 2.4 else None)


# mandarin: short trunk, a dense round head of small dark glossy leaves
MANDARIN_LEAVES = [(5, 9, 160), (10, 9, 20), (4, 7, 140), (11, 7, 40), (6, 7, 175), (9, 7, 5), (5, 5, 120),
                   (10, 5, 60), (7.5, 5.5, 150), (7.5, 5.5, 30), (6.5, 3.5, 110), (8.5, 3.5, 70), (7.5, 3, 90),
                   (7.5, 8, 200), (7.5, 8, 340), (6.5, 6.5, 250), (8.5, 6.5, 290)]
# sweet orange: taller and more open, fewer but larger, lighter leaves
ORANGE_LEAVES = [(7.5, 9, 175), (7.5, 9, 5), (5, 6.5, 150), (10, 5.5, 30), (7.5, 4, 140), (7.5, 4, 40),
                 (7.5, 3, 90)]


def citrus_sapling(c, tree, l, w, ramp, droop, stem):
    if tree == 'mandarin':
        line(c, 7, 15, 7, 7, stem, 2, 'stem')
        line(c, 7, 11, 5, 9, stem, 2, 'stem')
        line(c, 7, 10, 10, 8, stem, 2, 'stem')
        spots = MANDARIN_LEAVES
    else:
        line(c, 7, 15, 7, 2, stem, 3, 'stem')
        line(c, 7, 9, 5, 7, stem, 2, 'stem')
        line(c, 7, 7, 10, 5, stem, 2, 'stem')
        spots = ORANGE_LEAVES
    for x, y, a in spots:
        leaf(c, x, y, a, l, w, ramp, lvl=3 if tree == 'sweet_orange' else 2, droop=droop, shape='oval',
             rib=(ramp, 2) if tree == 'sweet_orange' else None)
    if tree == 'mandarin':  # glossy: a bright glint on the upper leaves
        for x, y in ((4, 6), (10, 4), (7, 2), (11, 8), (6, 9), (8, 6)):
            c.put(x, y, GD, 4, 'leaf', c.new(), True)


def leaves_base(c, tree):
    rng = random.Random(zlib.crc32(tree.encode()))
    if tree == 'banana':
        for y in range(16):
            for x in range(16):
                c.put(x, y, BANL, 1, 'leaf', 0)
        for x0 in (-2, 4, 10):
            leaf(c, x0, 18, 62, 22, 5.5, BANL, shape='tube', rib=(BANL, 4), spine=False)
        for x, y in ((1, 3), (12, 11), (6, 14), (14, 2)):
            c.put(x, y, TAN, 2, 'dry', c.new(), True)
            c.put(x + 1, y, TAN, 1, 'dry', c.obj, True)
        return rng
    l, w, ramp, shape = TREES[tree]['leaf']
    for y in range(16):
        for x in range(16):
            c.put(x, y, ramp, 1, 'leaf', 0)
    for i in range(30):
        leaf(c, rng.uniform(0, 16), rng.uniform(0, 16), rng.choice((20, 50, 130, 160, 200, 250, 290, 340)),
             l * rng.uniform(.8, 1.1), w, ramp, lvl=rng.choice((2, 2, 3)), shape=shape)
    holes = 0
    while holes < 9:
        x, y = rng.randrange(16), rng.randrange(16)
        if c.get(x, y) and c.get(x, y)[1] <= 2:
            c.erase(x, y)
            holes += 1
    return rng


SLOTS = [(1, 1), (9, 2), (4, 8), (11, 10), (1, 12), (13, 0)]
FL5 = ['.w.', 'wyw', '.w.']
FRUIT = {  # tree -> (stamp, ripe ramp, number of fruit)
    'mandarin': (['.c..', 'hxxx', 'xxxx', '.xd.'], ORANGE, 5),
    'sweet_orange': (['.c..', '.hx.', 'hxxx', 'xxxd', '.xd.'], ORANGE, 4),
    'lemon': (['.c.', '.x.', 'hxx', 'xxx', 'xxd', '.x.'], LEMON, 4),
    'peach': (['.c..', 'hxDx', 'xxDx', 'xxxd', '.xd.'], PEACH, 4),
    'pear': (['.s.', '.x.', '.hx', 'hxx', 'xxx', 'xxd', '.d.'], PEAR, 4),
    'persimmon': (['cCcc', 'hxxx', 'xxxx', 'xxxd', '.dd.'], PERS, 4),
    'lychee': (['.s.s.', 'hxd.s', 'xdx.h', '.dhxd', '..xdx'], RED, 4),
    'mango': (['s..', 'hx.', 'xxx', 'xxx', 'xxx', '.xd'], MANGO, 3),
    'star_anise': (['x.x.x', '.xhx.', 'xxDxx', '.xxx.', 'x.x.x'], BRONZE, 4),
}
BLOSSOM = {  # tree -> (ramp, center ramp)
    'mandarin': (FLW, YFLW), 'sweet_orange': (FLW, YFLW), 'lemon': (FLW, PINK), 'peach': (PINK, RED),
    'pear': (FLW, RED), 'persimmon': (YFLW, FLW), 'lychee': (YFLW, YFLW), 'mango': (YFLW, RED), 'star_anise': (RED, YFLW)}


def leaves_block(c, tree, stage):
    rng = leaves_base(c, tree)
    if stage == 'bare':
        return
    if tree == 'banana':
        stalk = {'s': (BANT, 2, 'stem', True)}
        line(c, 7, 0, 7, 4, BANT, 2)
        if stage == 'blossom':
            k = fruit_key(PURPLE, BANT, {'r': (RED, 2, 'fruit', True)})
            stamp(c, 5, 4, ['..s..', '.rhr.', 'rxxxr', 'xxxxx', 'xxxxd', '.xxd.', '..d..'], k)
            return
        ramp = UNRIPE if stage == 'unripe' else BANY
        k = fruit_key(ramp, BANT)
        k.update(stalk)
        hand = ['h.h.h.h.h', 'xxxxsxxxx', 'dxxxsxxxd', '.dd.s.dd.']
        for y in (3, 6, 9):
            stamp(c, 3, y, hand, k)
        line(c, 7, 13, 7, 13, BANT, 2)
        stamp(c, 6, 14, ['xhx', '.d.'], fruit_key(PURPLE, BANT))
        return
    if tree == 'cinnamon':
        n = {'blossom': 3, 'unripe': 6, 'ripe': 10}[stage]
        lv = {'blossom': 3, 'unripe': 2, 'ripe': 2}[stage]
        for i in range(n):
            leaf(c, rng.uniform(0, 16), rng.uniform(0, 16), rng.choice((40, 140, 220, 320)), 4, 2.6,
                 BRONZE if stage != 'blossom' else PEACH, lvl=lv if i % 3 else lv - 1, shape='oval')
        if stage == 'blossom':
            for x, y in ((3, 4), (11, 9), (6, 13)):
                c.put(x, y, YFLW, 4, 'flower', c.new(), True)
                c.put(x + 1, y + 1, YFLW, 3, 'flower', c.obj, True)
        return
    if stage == 'blossom':
        petal, mid = BLOSSOM[tree]
        k = {'w': (petal, 3, 'flower', True), 'y': (mid, 2, 'flower', True)}
        if tree in ('lychee', 'mango'):
            for x, y in ((2, 2), (10, 1), (5, 9), (12, 10)):
                line(c, x + 1, y, x + 1, y + 4, BROWN if tree == 'lychee' else RED, 2, 'stem')
                stamp(c, x, y, ['w.w', '.y.', 'w.w', '.w.', 'w.w'], k)
            return
        rows = ['.w.', 'wyw', '.w.'] if tree != 'star_anise' else ['w.w', '.y.', 'www']
        if tree == 'peach':
            rows = ['.w.w.', 'wwyww', '.wyw.', 'ww.ww']
        for x, y in SLOTS:
            stamp(c, x, y, rows, k)
        return
    rows, ramp, n = FRUIT[tree]
    if stage == 'unripe':
        ramp = UNRIPE
    k = fruit_key(ramp, GD)
    if tree == 'peach' and stage == 'ripe':
        k['D'] = (RED, 2, 'fruit', True)
        k['h'] = (PEACH, 4, 'fruit', True)
    if tree == 'mango' and stage == 'ripe':
        k['h'] = (RED, 3, 'fruit', True)
    if tree == 'pear' and stage == 'ripe':
        k['d'] = (BROWN, 3, 'fruit', True)
    for x, y in SLOTS[:n]:
        stamp(c, x, y, rows, k)


def fruitwood_log(c):
    for y in range(16):
        for x in range(16):
            groove = x in (2, 6, 7, 11, 14) and ihash(x, y // 3, 7) % 4 != 0
            c.put(x, y, BARK, 1 if groove else 2 + (ihash(x, y, 3) % 3 == 0), 'bark', 0)
    for x, y in ((3, 2), (9, 5), (12, 12), (4, 10), (8, 14)):
        for dx in range(2):
            c.put(x + dx, y, BARK, 4, 'bark', 1, True)


def fruitwood_log_top(c):
    for y in range(16):
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            if edge == 0:
                c.put(x, y, BARK, 1 + ihash(x, y, 5) % 2, 'bark', 0, True)
                continue
            d = math.hypot(x - 7.5, y - 7.5)
            lvl = 1 if int(d) % 3 == 0 else 3 - (int(d) % 3 == 2)
            if d < 1.2:
                lvl = 0
            c.put(x, y, WOOD, lvl, 'wood', 1, True)


def banana_trunk(c):
    for y in range(16):
        for x in range(16):
            lvl = (1, 2, 3, 2)[x % 4]
            if ihash(x, y // 2, 11) % 9 == 0:
                lvl -= 1
            c.put(x, y, BANT, lvl, 'bark', 0, True)
    for y0, x0 in ((2, 0), (9, 8)):
        for i in range(8):
            for t in range(3):
                c.put(x0 + i, y0 + t + i // 3, TAN if t else BROWN, 2 if t == 1 else 1, 'dry', 1, True)


# ---------------------------------------------------------------- output
def maps(px, tile):
    h = [[0.0] * 16 for _ in range(16)]
    mer = Image.new('RGBA', (16, 16), (0, 0, 255, 255))
    for (x, y), (rgb, mat) in px.items():
        m, e, r, hh = MAT[mat]
        h[y][x] = hh + (rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11) / 255 * .6
        mer.putpixel((x, y), (m, e, r, 255))
    nrm = Image.new('RGBA', (16, 16), (128, 128, 255, 255))

    def at(x, y):
        if tile:
            return h[y % 16][x % 16]
        return h[min(15, max(0, y))][min(15, max(0, x))]

    for (x, y) in px:
        dx = (at(x + 1, y) - at(x - 1, y)) * .18
        dy = (at(x, y + 1) - at(x, y - 1)) * .18
        n = (-dx, dy, 1.0)
        ln = sum(v * v for v in n) ** .5
        nrm.putpixel((x, y), tuple(round((v / ln * .5 + .5) * 255) for v in n) + (255,))
    return nrm, mer


def save(rel, c, written):
    px = c.shaded()
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for (x, y), (rgb, _) in px.items():
        img.putpixel((x, y), rgb + (255,))
    nrm, mer = maps(px, c.tile)
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path + '.png')
    nrm.save(path + '_normal.png')
    mer.save(path + '_mer.png')
    written.append(rel)
    return img


def build():
    written = []
    rows = []  # (label, [image or None, ...], [image above or None, ...])
    for name, fn in CROPS.items():
        imgs = []
        for s in range(4):
            c = Canvas(seed=zlib.crc32(name.encode()) + s)
            fn(c, s)
            imgs.append(save('crops/%s_stage_%d' % (name, s), c, written))
        above = [None] * 4
        if name == 'corn':
            for s in (2, 3):
                c = Canvas(seed=99 + s)
                corn_upper(c, s)
                above[s] = save('crops/corn_upper_stage_%d' % s, c, written)
        rows.append((name, imgs, above))
    for tree in TREES:
        c = Canvas(seed=zlib.crc32(tree.encode()))
        sapling(c, tree)
        imgs = [save('saplings/%s_sapling' % tree, c, written)]
        for st in ('bare', 'blossom'):  # fruit hangs below the leaves as its own block (tools/art/fruit_models.py)
            c = Canvas(tile=True, seed=zlib.crc32(tree.encode()))
            leaves_block(c, tree, st)
            imgs.append(save('trees/%s_leaves_%s' % (tree, st), c, written))
        rows.append((tree, imgs, [None] * 3))
    logs = []
    for name, fn in (('fruitwood_log', fruitwood_log), ('fruitwood_log_top', fruitwood_log_top),
                     ('banana_trunk', banana_trunk)):
        c = Canvas(tile=True, seed=17)
        fn(c)
        logs.append(save('trees/' + name, c, written))
    rows.append(('wood: log / top / banana', logs, [None] * 3))
    sheet(rows)
    return written


def sheet(rows):
    S, GAP, LAB = 64, 10, 190
    heights = [S * (2 if any(a is not None for a in above) else 1) + GAP + 14 for _, _, above in rows]
    W = LAB + 5 * (S + GAP) + GAP
    H = sum(heights) + 40
    im = Image.new('RGBA', (W, H), (104, 118, 100, 255))
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.load_default(size=15)
    except TypeError:
        font = ImageFont.load_default()
    d.text((10, 10), 'crops: stage 0-3   trees: sapling, bare, blossom', fill=(240, 240, 230), font=font)
    y = 40
    for (label, imgs, above), hgt in zip(rows, heights):
        d.text((10, y + hgt // 2 - 14), label, fill=(245, 245, 235), font=font)
        tall = any(a is not None for a in above)
        for i, img in enumerate(imgs):
            x = LAB + GAP + i * (S + GAP)
            yy = y + (S if tall else 0)
            d.rectangle((x - 1, y - 1 if tall else yy - 1, x + S, yy + S), outline=(88, 100, 86))
            im.alpha_composite(img.resize((S, S), Image.NEAREST), (x, yy))
            if above[i] is not None:
                im.alpha_composite(above[i].resize((S, S), Image.NEAREST), (x, y))
        y += hgt
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    im.save(PREVIEW)


if __name__ == '__main__':
    files = build()
    print('%d textures (+ normal + mer = %d files) under %s' % (len(files), len(files) * 3, OUT))
    print('preview:', PREVIEW)
