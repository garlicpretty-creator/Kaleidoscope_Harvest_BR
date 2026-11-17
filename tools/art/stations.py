"""Juicer and pickling jar, Cookery style (tools/art/kit.py): few boxes, every face painted.

Usage: python tools/art/stations.py

Writes, under packs/RP:
  models/blocks/juicer.geo.json, pickling_jar.geo.json                (the still parts)
  models/entity/juicer_visual.geo.json, pickling_jar_visual.geo.json  (the moving parts, on the display entity;
      bone names, pivots and the 'moat' locator are what tools/generate.mjs animates)
  textures/kaleidoscope_harvest/blocks/stations/juicer.png, pickling_jar.png
  textures/kaleidoscope_harvest/blocks/stations/contents_<state>.png, juice_empty.png  (the jar's mouth per state)
  textures/kaleidoscope_harvest/entity/juicer_visual.png, pickling_jar_visual.png
The bamboo trellis is still drawn by tools/art/station_models.py.
"""
import json
import math
import os

from PIL import Image

from kit import Box, Painted, audit, count_faces, noise, painter, ramp

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
RP = os.path.join(ROOT, "packs", "RP")
BLOCK_GEO = os.path.join(RP, "models", "blocks")
ENTITY_GEO = os.path.join(RP, "models", "entity")
BLOCK_TEX = os.path.join(RP, "textures", "kaleidoscope_harvest", "blocks", "stations")
ENTITY_TEX = os.path.join(RP, "textures", "kaleidoscope_harvest", "entity")
CLEAR = (0, 0, 0, 0)


def R(c, lo=0.66, hi=1.18):
    return ramp(c, lo=lo, hi=hi)


def wx(t):
    return int(math.floor(t.x + 64))


def wz(t):
    return int(math.floor(t.z + 64))


def nz(t, seed):
    return noise(wx(t), int(math.floor(t.y * 2 + 64)) * 131 + wz(t), seed)


def g(r, t, seed=1, lo=0.14, hi=0.86):
    k = nz(t, seed)
    return r[1] if k < lo else (r[3] if k > hi else r[2])


WOOD = R((150, 104, 62))
GLASS = R((214, 234, 238), 0.8, 1.08)
STEEL = R((176, 182, 188), 0.7, 1.2)
GLAZE = R((92, 58, 40))
CLAY_RAW = R((184, 146, 106))
WATER = R((116, 150, 160), 0.8, 1.25)
JUICE = {"orange": (240, 146, 40), "grape": (104, 36, 92), "mango": (244, 184, 40)}  # = JUICER.colours[1:]


# ============================================================================================ juicer
def juicer_boxes():
    return [Box(-6, 0, -6, 6, 3, 6, {"*": "plank_side", "top": "plank_top"}),
            Box(-4, 3, -4, 4, 11, 4, {"*": "glass", "top": "glass_top"}, instance="glass", clear=True),
            Box(-1, 9, -5, 1, 10, -4, "glass", instance="glass", clear=True),            # spout
            Box(5, 3, -1, 6, 15, 1, "post"),                                             # lever post
            Box(0, 15, -1, 6, 16, 1, "post")]                                            # lever arm


@painter
def plank_side(t):
    if t.v == 0:
        return WOOD[4]
    if t.u in (1, t.w - 2) and t.v == 1:
        return STEEL[1]                                  # nail heads at the corners
    return WOOD[1] if (wx(t) + wz(t)) % 5 == 0 else g(WOOD, t, 2)


@painter
def plank_top(t):
    board = (wz(t) - 58) // 4
    if (wz(t) - 58) % 4 == 0:
        return WOOD[0]                                   # seam between boards
    if abs(t.x) > 4.8 and (wz(t) - 58) % 4 == 2:
        return STEEL[1]                                  # nails at the board ends
    k = noise(wx(t) // 3, board, 3)
    return WOOD[3] if k > 0.7 else (WOOD[1] if k < 0.15 else WOOD[2])


@painter
def post(t):
    return WOOD[3] if t.v == 0 or t.u == 0 else (WOOD[1] if (int(t.y) % 4 == 0) else WOOD[2])


@painter
def glass(t):
    """Clear glass: an opaque frame on the edges, a highlight streak and measuring ticks; the rest see-through."""
    if t.u in (0, t.w - 1) or t.v in (0, t.h - 1):
        return GLASS[3]
    if t.face in ("north", "south", "east", "west") and t.u == 1 and 1 <= t.v <= t.h - 3:
        return GLASS[4]                                  # highlight
    if t.face == "north" and t.u == t.w - 2 and t.v % 2 == 0:
        return GLASS[2]                                  # scale ticks
    return CLEAR


glass.shade_k = 0.3


@painter
def glass_top(t):
    return GLASS[4] if t.u in (0, t.w - 1) or t.v in (0, t.h - 1) else CLEAR


def reamer_boxes():
    return [Box(-3, 11, -3, 3, 12, 3, "steel", bone="reamer"),
            Box(-2, 12, -2, 2, 13.5, 2, "steel", bone="reamer"),
            Box(-1, 13.5, -1, 1, 15, 1, "steel_tip", bone="reamer")]


@painter
def steel(t):
    if not t.side:
        return STEEL[4] if (wx(t) + wz(t)) % 2 else STEEL[2]   # the ribs of the cone, seen from above
    return STEEL[4] if t.u == 1 else (STEEL[3] if t.u % 2 else STEEL[1])


@painter
def steel_tip(t):
    return STEEL[4] if t.v == 0 or t.u == 0 else STEEL[2]


def juice_boxes():
    return [Box(-3.5, 3.5, -3.5, 3.5, 10, 3.5, f"juice_{c}", bone=f"juice_{c}") for c in JUICE]


def juice(c):
    r = R(c, 0.72, 1.2)

    @painter
    def p(t):
        if not t.side:
            return r[4] if (t.u + 2 * t.v) % 5 == 0 else r[3]       # surface glints
        if nz(t, 4) > 0.92:
            return r[4]                                           # pulp and bubbles
        return r[2] if t.v < t.h * 0.6 else r[1]
    p.shade_k = 0.3
    return p


# ============================================================================================ pickling jar (泡菜罈)
def jar_boxes():
    return [Box(-4, 0, -4, 4, 1, 4, "foot"),
            Box(-6, 1, -6, 6, 9, 6, {"*": "belly", "top": "shoulder"}),
            Box(-5, 9, -5, 5, 10.5, 5, {"*": "belly", "top": "moat"}),
            Box(-3, 10.5, -3, 3, 12, -2, {"*": "rim", "top": "rim_top"}),
            Box(-3, 10.5, 2, 3, 12, 3, {"*": "rim", "top": "rim_top"}),
            Box(-3, 10.5, -2, -2, 12, 2, {"*": "rim", "top": "rim_top"}),
            Box(2, 10.5, -2, 3, 12, 2, {"*": "rim", "top": "rim_top"}),
            Box(-2, 10.5, -2, 2, 11.75, 2, "contents", instance="contents", full_uv=True)]


@painter
def foot(t):
    return g(CLAY_RAW, t, 5)


@painter
def belly(t):
    """Dark-brown glaze: pooled light under the shoulder, drips running down, an incised line, iron speckles,
    the glaze stopping short of the foot."""
    if t.y < 1.6:
        return g(CLAY_RAW, t, 6)
    col = wx(t) + wz(t)
    reach = 1.2 + (1.5 if noise(col, 0, 7) > 0.55 else 0) + (1.0 if noise(col, 1, 7) > 0.8 else 0)
    if t.y > 9 - reach and t.y < 9.0:
        return GLAZE[3]
    if t.y >= 9:
        return GLAZE[4] if t.v == 0 else GLAZE[3]
    if 5 <= t.y < 5.5:
        return GLAZE[1]
    k = nz(t, 8)
    return GLAZE[0] if k < 0.07 else (GLAZE[3] if k > 0.9 else GLAZE[2])


@painter
def shoulder(t):
    return GLAZE[3] if nz(t, 9) > 0.2 else GLAZE[4]


@painter
def moat(t):
    """The water seal round the neck: a glazed lip, then the ring of water the lid stands in."""
    d = max(abs(t.x), abs(t.z))
    if d > 4.3:
        return GLAZE[4]
    if d > 3.2:
        return WATER[4] if (wx(t) + wz(t)) % 4 == 0 else WATER[2]
    return GLAZE[2]


@painter
def rim(t):
    return GLAZE[4] if t.v == 0 else GLAZE[3]


@painter
def rim_top(t):
    return GLAZE[4]


def lid_boxes():
    return [Box(-3.5, 12, -3.5, 3.5, 13, 3.5, "lid", bone="lid"),
            Box(-2.5, 13, -2.5, 2.5, 14, 2.5, "lid", bone="lid"),
            Box(-1, 14, -1, 1, 14.75, 1, "knob", bone="lid")]


LID = R((178, 112, 72))


@painter
def lid(t):
    if t.side and t.v == 0:
        return LID[4]
    if not t.side and t.face == "up":
        return LID[3] if nz(t, 10) > 0.15 else LID[2]
    return LID[1] if nz(t, 11) < 0.15 else LID[2]


@painter
def knob(t):
    return LID[4] if t.face == "up" else LID[3]


def contents(kind):
    """16 x 16 mouth texture per state (block material instance 'contents')."""
    img = Image.new("RGBA", (16, 16), CLEAR)
    if kind == "empty":
        return img
    for y in range(16):
        for x in range(16):
            n = noise(x, y, 30)
            if kind == "fresh":     # napa leaves: green edges, white ribs
                c = (110, 170, 80) if (x + y) % 5 < 2 else ((236, 240, 214) if (x - y) % 4 == 0 else (184, 214, 130))
            elif kind == "fermenting":  # cloudy brine with bubbles
                c = (238, 230, 190) if n > 0.9 else ((196, 184, 110) if n < 0.25 else (214, 202, 128))
            else:                   # done: red kimchi with pale cabbage showing
                c = (240, 226, 196) if n > 0.85 else ((150, 36, 26) if n < 0.25 else (196, 62, 40))
            img.putpixel((x, y), c + (255,))
    return img


# ============================================================================================ write
def save_geo(path, geo, locators=None):
    if locators:
        bones = geo["minecraft:geometry"][0]["bones"]
        for bone, locs in locators.items():
            bones.append({"name": bone, "pivot": [0, 0, 0], "locators": locs})
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo, f, indent=1)


def build(name, boxes, painters, geo_dir, tex_dir, pivots=None, locators=None, audit_sets=None):
    """audit_sets: lists of boxes shown together (alternatives such as the three juice colours never are)."""
    painted = Painted(boxes)
    problems = []
    for shown in audit_sets or [boxes]:
        problems += audit([b for b in shown if not b.clear], name)
    save_geo(os.path.join(geo_dir, f"{name}.geo.json"), painted.geometry(f"geometry.kaleidoscope_harvest.{name}", boxes, pivots=pivots), locators)
    painted.image(painters).save(os.path.join(tex_dir, f"{name}.png"))
    n_boxes, n_faces = count_faces(boxes)
    print(f"{name}: {n_boxes} boxes / {n_faces} faces, texture {painted.width}x{painted.height}")
    return problems


def main():
    for d in (BLOCK_GEO, ENTITY_GEO, BLOCK_TEX, ENTITY_TEX):
        os.makedirs(d, exist_ok=True)
    for stale in [f"{n}_{m}.png" for n in ("juicer", "pickling_jar", "juice_empty", "contents_fresh", "contents_fermenting", "contents_done") for m in ("mer", "normal")]:
        p = os.path.join(BLOCK_TEX, stale)
        if os.path.exists(p):
            os.remove(p)
    problems = []
    problems += build("juicer", juicer_boxes(), {"plank_side": plank_side, "plank_top": plank_top, "post": post,
                                                 "glass": glass, "glass_top": glass_top}, BLOCK_GEO, BLOCK_TEX)
    problems += build("juicer_visual", reamer_boxes() + juice_boxes(),
                      {"steel": steel, "steel_tip": steel_tip, **{f"juice_{c}": juice(v) for c, v in JUICE.items()}},
                      ENTITY_GEO, ENTITY_TEX, pivots={"reamer": (0, 11, 0), **{f"juice_{c}": (0, 3.5, 0) for c in JUICE}},
                      audit_sets=[reamer_boxes() + [j] for j in juice_boxes()])
    problems += build("pickling_jar", jar_boxes(), {"foot": foot, "belly": belly, "shoulder": shoulder, "moat": moat,
                                                    "rim": rim, "rim_top": rim_top, "contents": foot}, BLOCK_GEO, BLOCK_TEX)
    problems += build("pickling_jar_visual", lid_boxes(), {"lid": lid, "knob": knob}, ENTITY_GEO, ENTITY_TEX,
                      pivots={"lid": (0, 12, 3.5)}, locators={"seal": {"moat": [0, 10.75, 0]}})
    for kind in ("fresh", "fermenting", "done"):
        contents(kind).save(os.path.join(BLOCK_TEX, f"contents_{kind}.png"))
    contents("empty").save(os.path.join(BLOCK_TEX, "juice_empty.png"))
    if problems:
        print("\n".join(problems))
        raise SystemExit(1)
    print("audit clean")


if __name__ == "__main__":
    main()
