# Ported from Kaleidoscope-Baking tools/art/kit.py (same author, same Cookery art standard). Keep the two in step.
"""Shared kit for the Baking block models: swatch atlases, boxes, layer meshing, face culling and the z-fight audit.

Coordinates are block pixels: x, z in -8..8, y in 0..16 (origin at the block's bottom centre, like Bedrock).
A model is a list of Box objects. Every box face is textured from a 16x16 swatch of the model's atlas with
world-projected UVs, so neighbouring boxes of the same material line up seamlessly and one model unit is one
texture pixel. Faces that sit flush against another box are dropped (not rendered), which both saves fill and
removes every hidden coplanar face. `audit()` then proves that no two visible faces share a plane and overlap,
the cause of z-fighting ("flicker").
"""
import math
import zlib

from PIL import Image

FACES = ("north", "south", "east", "west", "up", "down")
# Bedrock block geometry mirrors x: world x = -json x. So the "east" face of a cube sits on its low json-x side and
# "west" on its high side (Blockbench shows the same). z and y are not mirrored.
NORMAL = {"north": (2, -1), "south": (2, 1), "west": (0, 1), "east": (0, -1), "down": (1, -1), "up": (1, 1)}


# --------------------------------------------------------------------------------------------- pixels
def ihash(*v):
    return zlib.crc32(repr(v).encode()) & 0xFFFFFFFF


def noise(x, y, seed=0):
    return (ihash(x, y, seed) % 1000) / 1000.0


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def shade(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def ramp(c, n=5, lo=0.62, hi=1.22):
    """n shades of colour c, dark -> light."""
    return [shade(c, lo + (hi - lo) * i / (n - 1)) for i in range(n)]


class Swatch:
    """A 16x16 tile: painter(x, y) -> (r, g, b) or (r, g, b, a)."""

    def __init__(self, painter):
        self.painter = painter

    def image(self):
        img = Image.new("RGBA", (16, 16))
        for y in range(16):
            for x in range(16):
                p = self.painter(x, y)
                img.putpixel((x, y), tuple(p) + (255,) if len(p) == 3 else tuple(p))
        return img


# Reusable painters ---------------------------------------------------------------------------------
def flat(r, seed=1, speck=0.12):
    """Even material with a little hashed grain (r = ramp dark->light, middle used)."""
    def p(x, y):
        n = noise(x, y, seed)
        return r[1] if n < speck else (r[3] if n > 1 - speck * 0.6 else r[2])
    return p


def brushed(r, seed=2):
    """Brushed metal: horizontal streaks."""
    def p(x, y):
        row = noise(0, y, seed)
        n = noise(x // 3, y, seed + 1)
        base = 2 if row < 0.55 else (3 if row < 0.85 else 1)
        if n > 0.93:
            base = min(4, base + 1)
        return r[base]
    return p


def wood(r, seed=3, vertical=False):
    def p(x, y):
        a, b = (y, x) if vertical else (x, y)
        grain = (b * 5 + int(3 * math.sin(a * 0.7 + b))) % 7
        k = noise(a // 4, b, seed)
        v = 1 if grain == 0 else (2 if grain < 4 else 3)
        if k > 0.9:
            v = max(0, v - 1)
        return r[v]
    return p


def weave(r, seed=4):
    """Rattan coil: horizontal bands two pixels high with stitch marks."""
    def p(x, y):
        band = y % 2
        stitch = (x + (y // 2) * 3) % 5 == 0
        if stitch:
            return r[1]
        return r[3] if band == 0 else r[2]
    return p


def tiles(r, size=4, seed=5):
    def p(x, y):
        if x % size == 0 or y % size == 0:
            return r[1]
        return r[3] if noise(x // size, y // size, seed) > 0.5 else r[2]
    return p


def glass(r):
    """Mostly clear glass: frame pixels opaque, a highlight streak, the rest transparent."""
    def p(x, y):
        if (x - y) % 16 in (3, 4) and 2 <= y <= 9:
            return r[4] + (255,)
        if y in (0,):
            return r[3] + (255,)
        return (0, 0, 0, 0)
    return p


def solid(c):
    return lambda x, y: tuple(c)


# --------------------------------------------------------------------------------------------- atlas
class Atlas:
    """Packs named swatches into a 64-wide texture, 4 slots per row."""

    def __init__(self, swatches):
        self.names = list(swatches)
        self.swatches = swatches
        self.rows = (len(self.names) + 3) // 4
        self.width, self.height = 64, 16 * self.rows

    def slot(self, name):
        i = self.names.index(name)
        return (i % 4) * 16, (i // 4) * 16

    def image(self):
        img = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        for n in self.names:
            img.paste(self.swatches[n].image(), self.slot(n))
        return img


# --------------------------------------------------------------------------------------------- boxes
class Box:
    """Axis-aligned box from (x0, y0, z0) to (x1, y1, z1) in block pixels.

    mat: swatch name (all faces) or dict face->swatch ('*' default, 'side' for the 4 sides, 'top', 'bottom').
    decal: dict face->(swatch, u, v) to place a specific 16x16 region instead of world-projected UVs.
    keep: faces never culled. skip: faces never drawn.
    rot/pivot: optional rotation (rotated boxes are not culled and only audited against equally rotated ones).
    instance: material instance name for every face (for per-state texture swaps).
    """

    def __init__(self, x0, y0, z0, x1, y1, z1, mat, decal=None, keep=(), skip=(), rot=None, pivot=None, instance=None,
                 bone="root", tag=None, clear=False, full_uv=False, mirror=()):
        lo = (min(x0, x1), min(y0, y1), min(z0, z1))
        hi = (max(x0, x1), max(y0, y1), max(z0, z1))
        self.lo, self.hi = lo, hi
        self.mat = mat
        self.decal = decal or {}
        self.keep, self.skip = set(keep), set(skip)
        self.rot, self.pivot = rot, pivot
        self.instance = instance
        self.bone = bone
        self.tag = tag
        self.clear = clear        # see-through material: never hides the faces behind it
        self.full_uv = full_uv    # faces span the whole texture of their material instance
        self.mirror = set(mirror) # faces whose u is flipped (back side of a plant plane)

    def material(self, face):
        m = self.mat
        if isinstance(m, str):
            return m
        if face in m:
            return m[face]
        if "cut" in m and face in ("north", "south", "east", "west"):
            axis, plane, *_ = self.face_rect(face)
            if abs(plane) < 1e-6 and axis in (0, 2):
                return m["cut"]  # faces on the x=0 / z=0 planes are where a slice was cut away
        if face in ("north", "south", "east", "west") and "side" in m:
            return m["side"]
        if face == "up" and "top" in m:
            return m["top"]
        if face == "down" and "bottom" in m:
            return m["bottom"]
        return m["*"]

    def size(self):
        return tuple(self.hi[i] - self.lo[i] for i in range(3))

    def face_rect(self, face):
        """(axis, plane, sign, (a0, a1), (b0, b1)) with a/b the two other axes in order."""
        axis, sign = NORMAL[face]
        plane = self.hi[axis] if sign > 0 else self.lo[axis]
        others = [i for i in range(3) if i != axis]
        return axis, plane, sign, (self.lo[others[0]], self.hi[others[0]]), (self.lo[others[1]], self.hi[others[1]])

    def is_flat(self, face):
        s = self.size()
        axis, _ = NORMAL[face]
        others = [i for i in range(3) if i != axis]
        return s[others[0]] <= 0 or s[others[1]] <= 0


def plane_box(x0, y0, z0, x1, y1, z1, mat, **kw):
    return Box(x0, y0, z0, x1, y1, z1, mat, **kw)


# --------------------------------------------------------------------------------------------- layers
def disc_mask(diameter, cx=0.0, cz=0.0, quadrants=None, hole=0.0):
    """Set of 1x1 cells (x, z) inside a circle of `diameter` centred on (cx, cz).

    quadrants: subset of {0,1,2,3} (0: +x -z, 1: -x -z, 2: -x +z, 3: +x +z) to keep. hole: inner diameter removed."""
    r = diameter / 2.0
    # snap the centre so the cell disc is symmetric: odd diameters centre on .5, even ones on whole pixels
    odd = int(round(diameter)) % 2 == 1
    cx = (math.floor(cx) + 0.5) if odd else round(cx)
    cz = (math.floor(cz) + 0.5) if odd else round(cz)
    cells = set()
    for x in range(-8, 8):
        for z in range(-8, 8):
            px, pz = x + 0.5 - cx, z + 0.5 - cz
            d = math.hypot(px, pz)
            if d > r + 0.2 or (hole and d < hole / 2.0 - 0.2):
                continue
            if quadrants is not None:
                q = (0 if px >= 0 else 1) if pz < 0 else (3 if px >= 0 else 2)
                if q not in quadrants:
                    continue
            cells.add((x, z))
    return cells


def square_mask(x0, z0, x1, z1):
    return {(x, z) for x in range(int(x0), int(x1)) for z in range(int(z0), int(z1))}


def ring_mask(outer, inner, **kw):
    return disc_mask(outer, **kw) - disc_mask(inner, **{k: v for k, v in kw.items() if k in ("cx", "cz")})


def rect_cover(cells):
    """Greedy decomposition of a cell set into non-overlapping rectangles (x0, z0, x1, z1)."""
    cells = set(cells)
    rects = []
    while cells:
        x, z = min(cells, key=lambda c: (c[1], c[0]))
        x1 = x
        while (x1 + 1, z) in cells:
            x1 += 1
        z1 = z
        while all((xx, z1 + 1) in cells for xx in range(x, x1 + 1)):
            z1 += 1
        for xx in range(x, x1 + 1):
            for zz in range(z, z1 + 1):
                cells.discard((xx, zz))
        rects.append((x, z, x1 + 1, z1 + 1))
    return rects


def layer(cells, y0, y1, mat, scale=1.0, **kw):
    """Boxes filling `cells` from y0 to y1 (cells are 1x1, optionally scaled about the centre)."""
    return [Box(a * scale, y0, b * scale, c * scale, y1, d * scale, mat, **kw) for a, b, c, d in rect_cover(cells)]


# --------------------------------------------------------------------------------------------- culling
def _covered(face_box, face, others, step=0.25):
    """True when the area just outside `face` is filled by other (unrotated, solid) boxes everywhere."""
    axis, plane, sign, (a0, a1), (b0, b1) = face_box.face_rect(face)
    if a1 - a0 <= 0 or b1 - b0 <= 0:
        return False
    oth = [i for i in range(3) if i != axis]
    cand = []
    for o in others:
        if o is face_box or o.rot or o.clear or o.instance != face_box.instance:
            continue
        if min(o.size()) <= 0:
            continue
        if o.lo[axis] - 1e-6 <= plane + sign * 0.01 <= o.hi[axis] + 1e-6 and \
                o.lo[axis] < plane + sign * 0.01 < o.hi[axis]:
            cand.append(o)
    if not cand:
        return False
    a = a0 + step / 2
    while a < a1:
        b = b0 + step / 2
        while b < b1:
            if not any(o.lo[oth[0]] <= a <= o.hi[oth[0]] and o.lo[oth[1]] <= b <= o.hi[oth[1]] for o in cand):
                return False
            b += step
        a += step
    return True


def visible_faces(boxes):
    """{id(box): [faces]} after culling faces covered by touching boxes."""
    out = {}
    for b in boxes:
        faces = []
        s = b.size()
        for f in FACES:
            if f in b.skip:
                continue
            axis, _ = NORMAL[f]
            others = [i for i in range(3) if i != axis]
            if s[others[0]] <= 0 or s[others[1]] <= 0:
                continue  # degenerate face of a flat plane
            if not b.rot and f not in b.keep and _covered(b, f, boxes):
                continue
            faces.append(f)
        out[id(b)] = faces
    return out


# --------------------------------------------------------------------------------------------- audit
def audit(boxes, name="model", eps=0.002, near=0.06):
    """Z-fight audit. Returns a list of problems (empty = clean).

    error: two visible faces with the same normal on the same plane overlap in area (classic z-fighting).
    near:  same, but planes closer than `near` pixels (depth-precision flicker at distance)."""
    vis = visible_faces(boxes)
    faces = []
    for b in boxes:
        for f in vis[id(b)]:
            faces.append((b, f) + b.face_rect(f))
    problems = []
    for i in range(len(faces)):
        bi, fi, axi, pli, sgi, ai, bi_ = faces[i]
        for j in range(i + 1, len(faces)):
            bj, fj, axj, plj, sgj, aj, bj_ = faces[j]
            if fi != fj or bi is bj:
                continue
            if (bi.rot or bj.rot) and (bi.rot != bj.rot or bi.pivot != bj.pivot):
                continue
            d = abs(pli - plj)
            if d > near:
                continue
            ov_a = min(ai[1], aj[1]) - max(ai[0], aj[0])
            ov_b = min(bi_[1], bj_[1]) - max(bi_[0], bj_[0])
            if ov_a > eps and ov_b > eps:
                kind = "zfight" if d <= eps else "near"
                problems.append(f"{name}: {kind} {fi} plane {pli:g}/{plj:g} boxes {bi.lo}-{bi.hi} & {bj.lo}-{bj.hi}")
    for b in boxes:
        for k in range(3):
            if b.lo[k] < -8 - 1e-6 or b.hi[k] > (24 if k == 1 else 8) + 1e-6:
                problems.append(f"{name}: box {b.lo}-{b.hi} leaves the block bounds")
    return problems


# --------------------------------------------------------------------------------------------- export
def _uv(b, face, atlas):
    sw = b.material(face)
    if face in b.decal:
        sw, u, v = b.decal[face]
        axis, plane, sign, (a0, a1), (c0, c1) = b.face_rect(face)
        w, h = _face_wh(b, face)
        su, sv = atlas.slot(sw)
        return [su + u, sv + v], [w, h]
    su, sv = atlas.slot(sw)
    x0, y0, z0 = b.lo
    x1, y1, z1 = b.hi
    # world projected u/v inside the 16x16 swatch
    # u runs left to right as seen from outside the face, in world space (world x = -json x)
    if face in ("north", "south"):
        u0 = x0 + 8 if face == "north" else 8 - x1
        w, h = x1 - x0, y1 - y0
        v0 = 16 - y1
    elif face in ("east", "west"):
        u0 = z0 + 8 if face == "west" else 8 - z1
        w, h = z1 - z0, y1 - y0
        v0 = 16 - y1
    else:
        u0, v0 = 8 - x1, z0 + 8
        w, h = x1 - x0, z1 - z0
    u0 = max(0.0, min(16 - w, u0))
    v0 = max(0.0, min(16 - h, v0))
    return [su + u0, sv + v0], [w, h]


def _face_wh(b, face):
    s = b.size()
    if face in ("north", "south"):
        return s[0], s[1]
    if face in ("east", "west"):
        return s[2], s[1]
    return s[0], s[2]


def _num(v):
    v = round(v, 4)
    return int(v) if v == int(v) else v


def geometry(gid, boxes, atlas, bounds=(2, 2.5, 0.75)):
    """Bedrock geometry JSON for `boxes`, textured from `atlas`."""
    vis = visible_faces(boxes)
    bones = {}
    order = []
    for b in boxes:
        if b.bone not in bones:
            bones[b.bone] = []
            order.append(b.bone)
        uv = {}
        for f in vis[id(b)]:
            if b.full_uv:
                pos, size = ([atlas.width, 0], [-atlas.width, atlas.height]) if f in b.mirror else ([0, 0], [atlas.width, atlas.height])
            else:
                pos, size = _uv(b, f, atlas)
            face = {"uv": [_num(pos[0]), _num(pos[1])], "uv_size": [_num(size[0]), _num(size[1])]}
            if b.instance:
                face["material_instance"] = b.instance
            uv[f] = face
        if not uv:
            continue
        cube = {"origin": [_num(b.lo[0]), _num(b.lo[1]), _num(b.lo[2])],
                "size": [_num(v) for v in b.size()], "uv": uv}
        if b.rot:
            cube["rotation"] = list(b.rot)
            cube["pivot"] = list(b.pivot or (0, 0, 0))
        bones[b.bone].append(cube)
    return {"format_version": "1.21.60", "minecraft:geometry": [{
        "description": {"identifier": gid, "texture_width": atlas.width, "texture_height": atlas.height,
                        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                        "visible_bounds_offset": [0, bounds[2], 0]},
        "bones": [{"name": n, "pivot": [0, 0, 0], "cubes": bones[n]} for n in order if bones[n]]}]}


def bounds_of(boxes):
    lo = [min(b.lo[i] for b in boxes) for i in range(3)]
    hi = [max(b.hi[i] for b in boxes) for i in range(3)]
    lo = [max(-8, lo[0]), max(0, lo[1]), max(-8, lo[2])]
    hi = [min(8, hi[0]), min(16, hi[1]), min(8, hi[2])]
    return {"origin": [_num(v) for v in lo], "size": [_num(hi[i] - lo[i]) for i in range(3)]}


# ============================================================================================= painted (unique-UV) models
# Cookery-style: few boxes, every visible face gets its own region of the texture (one texel per model pixel) and is
# painted from world coordinates, so detail lives in the texture instead of in extra geometry.
class Texel:
    """What a painter sees for one texel: the face, its texel (u, v) in a w x h face, and the json position."""
    __slots__ = ("box", "face", "u", "v", "w", "h", "x", "y", "z")

    def __init__(self, box, face, u, v, w, h, x, y, z):
        self.box, self.face, self.u, self.v, self.w, self.h, self.x, self.y, self.z = box, face, u, v, w, h, x, y, z

    @property
    def side(self):
        return self.face in ("north", "south", "east", "west")


def _texel_pos(b, face, u, v, w, h):
    (x0, y0, z0), (x1, y1, z1) = b.lo, b.hi
    fu = (u + 0.5) / w
    fv = (v + 0.5) / h
    if face == "south":
        return x1 - fu * (x1 - x0), y1 - fv * (y1 - y0), z1
    if face == "north":
        return x0 + fu * (x1 - x0), y1 - fv * (y1 - y0), z0
    if face == "east":   # json low-x side
        return x0, y1 - fv * (y1 - y0), z1 - fu * (z1 - z0)
    if face == "west":
        return x1, y1 - fv * (y1 - y0), z0 + fu * (z1 - z0)
    x = x1 - fu * (x1 - x0)
    z = z0 + fv * (z1 - z0)
    return x, (y1 if face == "up" else y0), z


def edge_shade(c, t, k=1.0):
    """Hand-painted look: lit top edge, shaded bottom edge and darker vertical edges on sides; a soft rim on tops."""
    r = 1.0
    if t.side and t.h >= 2:
        if t.v == 0:
            r *= 1.12
        elif t.v == t.h - 1:
            r *= 0.82
    if t.side and t.w >= 3 and t.u in (0, t.w - 1):
        r *= 0.9
    if not t.side and t.w >= 3 and t.h >= 3 and (t.u in (0, t.w - 1) or t.v in (0, t.h - 1)):
        r *= 0.92 if t.face == "up" else 0.8
    r = 1 + (r - 1) * k
    a = c[3] if len(c) > 3 else 255
    return tuple(max(0, min(255, int(round(ch * r)))) for ch in c[:3]) + (a,)


def _sig(b, f):
    return (tuple(round(v, 3) for v in b.lo), tuple(round(v, 3) for v in b.hi), f, b.mat if isinstance(b.mat, str) else b.material(f))


class Painted:
    """Packs every visible face of one or more models (variants sharing one texture, e.g. the 4 slice states of a cake)
    into a texture, one region per distinct face, painted with `painters[material](texel)`."""

    def __init__(self, variants, width=64, shade=True):
        if variants and isinstance(variants[0], Box):
            variants = [variants]
        self.shade = shade
        self.faces, self.index = [], {}
        for boxes in variants:
            vis = visible_faces(boxes)
            for b in boxes:
                if b.full_uv:
                    continue
                for f in vis[id(b)]:
                    k = _sig(b, f)
                    if k in self.index:
                        continue
                    fw, fh = _face_wh(b, f)
                    self.index[k] = len(self.faces)
                    self.faces.append((b, f, max(1, math.ceil(fw - 1e-6)), max(1, math.ceil(fh - 1e-6))))
        order = sorted(range(len(self.faces)), key=lambda i: (-self.faces[i][3], -self.faces[i][2]))
        self.pos = {}
        x = y = row = 0
        self.width = width
        for i in order:
            _, _, w, h = self.faces[i]
            if x + w > width:
                x, y, row = 0, y + row, 0
            self.pos[i] = (x, y)
            x += w
            row = max(row, h)
        used = y + row
        self.height = 16
        while self.height < used:
            self.height *= 2

    def image(self, painters):
        img = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        for i, (b, f, w, h) in enumerate(self.faces):
            px, py = self.pos[i]
            paint = painters[b.material(f)]
            for v in range(h):
                for u in range(w):
                    t = Texel(b, f, u, v, w, h, *_texel_pos(b, f, u, v, w, h))
                    c = tuple(paint(t))
                    if len(c) == 3:
                        c = c + (255,)
                    if self.shade and c[3] and getattr(paint, "shade", True):
                        c = edge_shade(c, t, getattr(paint, "shade_k", 1.0))
                    img.putpixel((px + u, py + v), c)
        return img

    def geometry(self, gid, boxes, bounds=(2, 2.5, 0.75), pivots=None, parents=None):
        pivots, parents = pivots or {}, parents or {}
        vis = visible_faces(boxes)
        bones, order = {}, []
        for b in boxes:
            if b.bone not in bones:
                bones[b.bone] = []
                order.append(b.bone)
            uv = {}
            for f in vis[id(b)]:
                if b.full_uv:
                    pos, size = ([self.width, 0], [-self.width, self.height]) if f in b.mirror else ([0, 0], [self.width, self.height])
                else:
                    i = self.index[_sig(b, f)]
                    pos, size = list(self.pos[i]), [self.faces[i][2], self.faces[i][3]]
                face = {"uv": [_num(pos[0]), _num(pos[1])], "uv_size": [_num(size[0]), _num(size[1])]}
                if b.instance:
                    face["material_instance"] = b.instance
                uv[f] = face
            if not uv:
                continue
            cube = {"origin": [_num(v) for v in b.lo], "size": [_num(v) for v in b.size()], "uv": uv}
            if b.rot:
                cube["rotation"] = list(b.rot)
                cube["pivot"] = list(b.pivot or (0, 0, 0))
            bones[b.bone].append(cube)
        return {"format_version": "1.21.60", "minecraft:geometry": [{
            "description": {"identifier": gid, "texture_width": self.width, "texture_height": self.height,
                            "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                            "visible_bounds_offset": [0, bounds[2], 0]},
            "bones": [dict({"name": n, "pivot": list(pivots.get(n, (0, 0, 0))), "cubes": bones[n]},
                           **({"parent": parents[n]} if n in parents else {})) for n in order if bones[n]]}]}


def painter(fn, shade=True, shade_k=1.0):
    fn.shade, fn.shade_k = shade, shade_k
    return fn


def count_faces(boxes):
    vis = visible_faces(boxes)
    return len([b for b in boxes if vis[id(b)]]), sum(len(v) for v in vis.values())
