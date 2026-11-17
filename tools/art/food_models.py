"""Placeable foods and drinks, Cookery style: few boxes, every face painted (docs/superpowers/specs/2026-11-17-placeable-food-design.md).

Usage: python tools/art/food_models.py

Art standard (as 森羅廚房 / Baking, tools/art/kit.py): a model is a handful of boxes; each visible face has its own
texture region, one texel per model pixel, painted from world coordinates with lit top edges and shaded bottoms.
Rims, glaze drips, broth with its meat and vegetables, lattice crust, stamps, labels and glass are painted, not built.

One geometry per shape and stage (the block swaps geometry by state, tools/generate.mjs), one texture per food:
  pot      food_pot_<s>       s = bites taken 0..4 (the broth drops; 4 = empty pot)
  pie      food_pie_<s>       one slice box per slice left; cut faces show crust and filling
  cakes    food_cakes_<s>     pineapple cakes on a plate
  platter  food_platter_<s>   a fruit pile per quarter
  bottle   food_bottle_<s>    s = 0 full, 1 empty (no juice, no cork)
  wine     food_wine_<s>      the same for the wine flask
  teacup   food_teacup_<c>_<t> c cups (1..4), t of them with tea (Cookery's cup_stack)
Every food of a shape shares that shape's layout, so the geometries are written once per shape and each food only
gets its own texture: packs/RP/textures/kaleidoscope_harvest/blocks/food/<item>.png.
Preview of the textures: art/previews/placed_food_textures.png.
"""
import json
import math
import os

from PIL import Image

from kit import Box, Painted, audit, count_faces, noise, painter, ramp

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GEO = os.path.join(ROOT, "packs", "RP", "models", "blocks")
TEX = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "food")
PREVIEW = os.path.join(ROOT, "art", "previews")
CLEAR = (0, 0, 0, 0)


def R(c, lo=0.66, hi=1.18):
    return ramp(c, lo=lo, hi=hi)


def wx(t):
    return int(math.floor(t.x + 64))


def wz(t):
    return int(math.floor(t.z + 64))


def wy(t):
    return int(math.floor(t.y * 2 + 64))


def nz(t, seed):
    return noise(wx(t), wy(t) * 131 + wz(t), seed)


def g(r, t, seed=1, lo=0.14, hi=0.86):
    k = nz(t, seed)
    return r[1] if k < lo else (r[3] if k > hi else r[2])


# ============================================================================================ shared materials
PORCELAIN = R((246, 244, 236), 0.82, 1.04)
BLUE = R((66, 96, 150), 0.75, 1.15)  # 青花 blue-and-white, muted
LINE = (150, 170, 200)               # a pale blue line on white
CLAY = R((96, 62, 46))              # 砂鍋 earthenware glaze
CLAY_RAW = R((186, 150, 112))       # the unglazed foot
GLASS = R((214, 236, 240), 0.8, 1.1)
CORK = R((176, 132, 84))
PAPER = R((240, 230, 206), 0.85, 1.05)
KRAFT = R((196, 160, 110), 0.6, 1.12)
RED_PAPER = R((196, 44, 40))


@painter
def plate(t):
    """Porcelain plate: a lit rim, one thin muted-blue line inside it, faint glaze speckle."""
    edge = 7.5 - max(abs(t.x), abs(t.z))
    if t.side:
        return PORCELAIN[1]
    if edge < 0.8:
        return PORCELAIN[4]
    if 0.8 <= edge < 1.6:
        return LINE
    return PORCELAIN[3] if nz(t, 21) > 0.85 else PORCELAIN[2]


# ============================================================================================ pot (砂鍋)
POT = 5  # half width
WALL = 7  # wall top


def pot_boxes(s):
    """Base, four walls, two handles, broth: 8 boxes. s bites taken."""
    b = [Box(-POT, 0, -POT, POT, 1, POT, {"*": "pot_out", "top": "pot_floor"}),
         Box(-POT, 1, -POT, POT, WALL, -POT + 1, {"*": "pot_out", "top": "rim", "south": "pot_in"}),
         Box(-POT, 1, POT - 1, POT, WALL, POT, {"*": "pot_out", "top": "rim", "north": "pot_in"}),
         Box(-POT, 1, -POT + 1, -POT + 1, WALL, POT - 1, {"*": "pot_out", "top": "rim", "west": "pot_in"}),
         Box(POT - 1, 1, -POT + 1, POT, WALL, POT - 1, {"*": "pot_out", "top": "rim", "east": "pot_in"}),
         Box(-POT - 1.5, 5, -1, -POT, 6, 1, "handle"),
         Box(POT, 5, -1, POT + 1.5, 6, 1, "handle")]
    left = 4 - s
    if left:
        b.append(Box(-POT + 1, 1, -POT + 1, POT - 1, 1.5 + left * 1.125, POT - 1, {"*": "broth", "top": "soup"}))
    return b


@painter
def pot_out(t):
    if t.y < 1.2:
        return g(CLAY_RAW, t, 2)                        # unglazed sandy foot
    col = wx(t) + wz(t)
    drip = 1.4 + (1.2 if noise(col, 0, 3) > 0.55 else 0) + (0.8 if noise(col, 1, 3) > 0.8 else 0)
    if t.y > WALL - drip:
        return CLAY[4] if t.y > WALL - 0.6 else CLAY[3]  # light glaze pooled at the rim, running down
    if 3.5 <= t.y < 4:
        return CLAY[3]                                   # a raised line round the belly
    return g(CLAY, t, 4, 0.2, 0.9)


@painter
def pot_in(t):
    return CLAY[1] if nz(t, 5) < 0.3 else CLAY[2]


@painter
def rim(t):
    return CLAY[4] if (wx(t) + wz(t)) % 3 else CLAY[3]


@painter
def handle(t):
    return CLAY[3] if t.v == 0 else CLAY[2]


@painter
def pot_floor(t):
    k = nz(t, 6)
    return CLAY[0] if k < 0.25 else (CLAY[3] if k > 0.92 else CLAY[1])  # bare floor with a little residue


def soup(broth, pieces, oil=(255, 228, 140), herb=(86, 150, 60)):
    """Broth seen from above: pieces on a 3 x 3 grid (each a 2 x 2 chunk with a lit corner and a shaded one),
    oil drops and herbs between them. pieces = [(ramp, chance)]."""
    B = R(broth, 0.8, 1.12)

    @painter
    def p(t):
        x, z = wx(t), wz(t)
        cx, cz = x // 3, z // 3
        k = noise(cx, cz, 7)
        acc = 0.0
        for r, chance in pieces:
            acc += chance
            if k < acc:
                ox, oz = int(noise(cx, cz, 8) * 2), int(noise(cx, cz, 9) * 2)
                lx, lz = x % 3 - ox, z % 3 - oz
                if 0 <= lx < 2 and 0 <= lz < 2:
                    return r[4] if (lx, lz) == (0, 0) else (r[1] if (lx, lz) == (1, 1) else r[2])
                break
        n = nz(t, 10)
        if n > 0.93:
            return oil
        if n < 0.05:
            return herb
        return B[3] if n > 0.75 else B[2]
    p.shade_k = 0.5
    return p


def broth(c):
    return painter(lambda t: R(c)[2])


POTS = {
    "cabbage_pork_stew": ((228, 204, 158), [(R((206, 228, 160)), 0.35), (R((214, 154, 124)), 0.3)]),
    "daikon_beef_brisket": ((156, 96, 54), [(R((240, 232, 210), 0.8, 1.06), 0.35), (R((122, 62, 40)), 0.35)]),
    "braised_pork": ((150, 50, 24), [(R((178, 74, 40)), 0.45), (R((244, 210, 164), 0.8, 1.05), 0.15)]),
    "corn_chowder": ((244, 228, 172), [(R((252, 206, 64)), 0.4), (R((232, 208, 146)), 0.2)]),
    "taro_spare_ribs": ((210, 192, 178), [(R((184, 158, 198)), 0.35), (R((176, 104, 72)), 0.3)]),
    "tofu_vegetable_soup": ((228, 216, 168), [(R((250, 246, 230), 0.86, 1.03), 0.35), (R((236, 132, 52)), 0.15)]),
}


def pot_painters(item):
    c, pieces = POTS[item]
    return {"pot_out": pot_out, "pot_in": pot_in, "rim": rim, "handle": handle, "pot_floor": pot_floor,
            "soup": soup(c, pieces), "broth": broth(c)}


# ============================================================================================ pie, cakes, platter
PLATE = Box(-7.5, 0, -7.5, 7.5, 0.5, 7.5, "plate")
SLICE = {0: (0.5, -7, 7, -0.5), 1: (-7, -7, -0.5, -0.5), 2: (-7, 0.5, -0.5, 7), 3: (0.5, 0.5, 7, 7)}


def pie_boxes(s):
    return [PLATE] + [Box(SLICE[k][0], 0.5, SLICE[k][1], SLICE[k][2], 4.5, SLICE[k][3],
                          {"*": "crust_side", "top": "pie_top"}) for k in range(4 - s)]


CRUST = R((214, 152, 80))
CRUST_D = R((178, 110, 52))


def lattice_top(fill):
    F = R(fill, 0.7, 1.35)

    @painter
    def p(t):
        edge = 7 - max(abs(t.x), abs(t.z))
        x, z = wx(t), wz(t)
        if edge < 1.3:
            return CRUST[4] if (x + z) % 2 == 0 else CRUST[1]   # crimped rim
        on_x, on_z = z % 4 in (1, 2), x % 4 in (1, 2)
        if on_x and on_z:
            over = (x // 4 + z // 4) % 2 == 0
            return CRUST[4] if over == (z % 4 == 1) else CRUST[1]
        if on_x or on_z:
            return CRUST[3] if (z % 4 == 1 if on_x else x % 4 == 1) else CRUST[2]
        k = nz(t, 11)
        return F[0] if k < 0.2 else (F[4] if k > 0.85 else F[2])  # glossy berries
    return p


def crust_side(fill):
    """Outer rim: fluted crust. Faces that look into the pie (where a slice was cut) show the layers."""
    F = R(fill, 0.6, 1.3)

    @painter
    def p(t):
        outer = max(abs(t.x), abs(t.z)) > 6.9
        if outer:
            return CRUST[3] if (wx(t) + wz(t)) % 2 == 0 else (CRUST[1] if t.v > 0 else CRUST[2])  # fluted
        if t.y < 1.5:
            return g(CRUST_D, t, 12)
        if t.y >= 4:
            return g(CRUST, t, 13)
        return F[4] if nz(t, 14) > 0.88 else F[2]
    return p


def cake_boxes(s):
    spots = [(0.5, -6.5), (-6.5, -6.5), (-6.5, 1), (0.5, 1)]
    return [PLATE] + [Box(x, 0.5, z, x + 6, 3, z + 5, {"*": "cake_side", "top": "cake_top"}) for x, z in spots[:4 - s]]


PASTRY = R((226, 170, 88))


@painter
def cake_side(t):
    if t.v == 0:
        return PASTRY[4]
    return PASTRY[1] if nz(t, 15) < 0.18 else PASTRY[2]


@painter
def cake_top(t):
    """Baked top with a stamped mark: a square frame with a dot, the pastry shop's seal."""
    u, v = t.u, t.v
    if u in (0, t.w - 1) or v in (0, t.h - 1):
        return PASTRY[3]
    if (u in (1, t.w - 2) and 1 <= v <= t.h - 2) or (v in (1, t.h - 2) and 1 <= u <= t.w - 2):
        return PASTRY[1]
    if (u, v) == (t.w // 2, t.h // 2):
        return CRUST_D[1]
    return PASTRY[4] if nz(t, 16) > 0.8 else PASTRY[3]


def platter_boxes(s):
    dish = [Box(-7, 0, -7, 7, 1, 7, {"*": "dish", "top": "dish_top"}),
            Box(-7, 1, -7, 7, 2, -6, "dish"), Box(-7, 1, 6, 7, 2, 7, "dish"),
            Box(-7, 1, -6, -6, 2, 6, "dish"), Box(6, 1, -6, 7, 2, 6, "dish")]
    piles = {0: (0.5, -5.5, 5.5, -0.5), 1: (-5.5, -5.5, -0.5, -0.5), 2: (-5.5, 0.5, -0.5, 5.5), 3: (0.5, 0.5, 5.5, 5.5)}
    return dish + [Box(piles[k][0], 1, piles[k][1], piles[k][2], 3, piles[k][3], f"fruit{k}") for k in range(4 - s)]


@painter
def dish(t):
    if t.face == "up":
        return PORCELAIN[4]
    if 0.4 < t.y < 0.8 and (wx(t) + wz(t)) % 2 == 0:
        return LINE                                    # a dotted blue line round the foot
    return PORCELAIN[2]


@painter
def dish_top(t):
    return PORCELAIN[2] if nz(t, 17) > 0.1 else BLUE[3]


def segments(c):
    """Orange segments: wedges with white pith lines."""
    r = R(c)

    @painter
    def p(t):
        if (wx(t) + 2 * wz(t) + int(t.y)) % 4 == 0:
            return (252, 236, 200)
        return r[4] if (wx(t) + wz(t)) % 3 == 0 else r[2]
    return p


def grapes(c):
    r = R(c, 0.65, 1.3)

    @painter
    def p(t):
        a, b = wx(t) % 2, (wz(t) + (1 if t.side else 0) + int(t.y * 2)) % 2
        return r[4] if (a, b) == (0, 0) else (r[0] if (a, b) == (1, 1) else r[2])
    return p


def cubes(c):
    """Mango cut hedgehog-style: a grid of cubes, lit tops."""
    r = R(c)

    @painter
    def p(t):
        if wx(t) % 2 == 1 or wz(t) % 2 == 1:
            return r[1]
        return r[4] if nz(t, 18) > 0.5 else r[3]
    return p


def lychee():
    flesh = R((246, 244, 232), 0.8, 1.05)
    shell = R((196, 52, 60))

    @painter
    def p(t):
        k = nz(t, 19)
        if (wx(t) + wz(t)) % 3 == 0 and t.face == "up":
            return flesh[1]                            # where one peeled lychee meets the next
        return shell[2] if k < 0.06 else (flesh[4] if k > 0.7 else flesh[3])
    return p


def platter_painters(item):
    return {"dish": dish, "dish_top": dish_top, "fruit0": segments((244, 150, 40)), "fruit1": grapes((92, 48, 96)),
            "fruit2": cubes((248, 192, 52)), "fruit3": lychee()}


# ============================================================================================ bottles
# A bottle is painted, not built from glass: the body box shows the juice seen through the glass (a highlight
# streak, a pale headspace at the top, a paper label), as vanilla potion bottles do. Empty: pale glass all through.
def bottle_boxes(s, wine=False):
    full = s == 0
    body = "body" if full else "empty"
    if wine:
        b = [Box(-3.5, 0, -3.5, 3.5, 6, 3.5, {"*": body, "top": body + "_top"}),
             Box(-1.5, 6, -1.5, 1.5, 9, 1.5, {"*": "neck", "top": "neck_top"})]
        return b + ([Box(-2, 9, -2, 2, 10.5, 2, "seal")] if full else [])
    b = [Box(-3, 0, -3, 3, 8, 3, {"*": body, "top": body + "_top"}),
         Box(-1.5, 8, -1.5, 1.5, 10, 1.5, {"*": "neck", "top": "neck_top"})]
    return b + ([Box(-1, 10, -1, 1, 11.5, 1, "cork")] if full else [])


def bottle_body(c, mark, fill_to, label, wine):
    J = R(c, 0.72, 1.18)

    @painter
    def p(t):
        lo, hi = label
        if t.side and lo <= t.y < hi:
            mid_u, mid_y = (t.w - 1) / 2, (lo + hi) / 2
            front = t.face in ("north", "south")
            if wine:
                if front and abs(t.u - mid_u) + abs(t.y - mid_y) <= 1.6:   # a red diamond paper with a gold mark
                    return (232, 196, 96) if abs(t.u - mid_u) + abs(t.y - mid_y) < 0.6 else RED_PAPER[2]
            else:
                # a kraft-paper band all the way round, dark-edged so it reads against glass and juice,
                # with a small fruit-coloured stamp on the front
                if abs(t.y - lo) < 0.5:
                    return KRAFT[1]                                   # the label's lower edge, in its own shadow
                if front and abs(t.u - mid_u) <= 0.5:
                    return mark[2]
                return KRAFT[4] if t.u % 3 == 0 else KRAFT[3]
        if t.side and t.u == 1:
            return GLASS[4]                                          # highlight streak
        if t.y >= fill_to:
            return GLASS[2] if t.side else GLASS[3]                  # headspace: empty glass
        if t.side and t.y >= fill_to - 0.5:
            return J[4]                                              # the juice surface line
        return J[3] if nz(t, 22) > 0.9 else J[2]
    return p


def bottle_top(c, fill_to):
    @painter
    def p(t):
        return GLASS[4] if t.u in (0, t.w - 1) or t.v in (0, t.h - 1) else GLASS[2]
    return p


@painter
def empty_glass(t):
    if t.side and t.u == 1:
        return GLASS[4]
    return GLASS[3] if nz(t, 24) > 0.9 else GLASS[2]


@painter
def neck(t):
    return GLASS[4] if t.side and t.u == 0 else GLASS[2]


@painter
def neck_top(t):
    return GLASS[1] if 0 < t.u < t.w - 1 and 0 < t.v < t.h - 1 else GLASS[3]   # the open mouth


@painter
def cork(t):
    return CORK[3] if (t.u + t.v) % 3 == 0 else (CORK[1] if nz(t, 20) < 0.2 else CORK[2])


@painter
def seal(t):
    if t.side and t.v == t.h - 1:
        return (230, 190, 90)  # gold string
    return RED_PAPER[3] if (t.u + t.v) % 4 == 0 else RED_PAPER[2]


BOTTLES = {
    "mandarin_juice": (236, 140, 40), "orange_juice": (244, 164, 44), "grape_juice": (104, 40, 88),
    "mango_juice": (244, 190, 52), "mixed_juice": (226, 118, 70), "passion_fruit_juice": (232, 182, 64),
    "lychee_wine": (234, 226, 196), "peach_wine": (240, 172, 152),
}
MARKS = {"mixed_juice": (190, 70, 86), "passion_fruit_juice": (112, 60, 100)}
GLASS = R((206, 226, 228), 0.82, 1.08)


def bottle_painters(item, wine):
    c = BOTTLES[item]
    fill_to, label = (5, (1.5, 4)) if wine else (6.5, (3, 5))
    return {"body": bottle_body(c, R(MARKS.get(item, c)), fill_to, label, wine), "body_top": bottle_top(c, fill_to),
            "empty": empty_glass, "empty_top": bottle_top(c, fill_to), "neck": neck, "neck_top": neck_top,
            "cork": cork, "seal": seal}


# ============================================================================================ teacups (cup_stack)
CUP_AT = [(-4, -4), (4, -4), (-4, 4), (4, 4)]


def teacup_boxes(c, t):
    out = []
    for i, (cx, cz) in enumerate(CUP_AT[:c]):
        out.append(Box(cx - 3, 0, cz - 3, cx + 3, 0.5, cz + 3, "saucer"))
        out.append(Box(cx - 2, 0.5, cz - 2, cx + 2, 3.5, cz + 2, {"*": "cup", "top": "tea" if i < t else "empty"}))
    return out


@painter
def cup(t):
    if t.v == 0:
        return PORCELAIN[4]                                    # lip
    if t.v == 1 and t.u % 2 == 1:
        return BLUE[3]                                         # a dotted blue band
    return PORCELAIN[2] if nz(t, 23) > 0.12 else PORCELAIN[1]


@painter
def saucer(t):
    if not t.side and 1 <= t.u < t.w - 1 and 1 <= t.v < t.h - 1:
        return BLUE[3] if (t.u, t.v) in ((1, 1), (t.w - 2, t.h - 2)) else PORCELAIN[3]
    return PORCELAIN[2]


def tea_top(c):
    r = R(c, 0.7, 1.3)

    @painter
    def p(t):
        if t.u in (0, t.w - 1) or t.v in (0, t.h - 1):
            return PORCELAIN[4]
        return r[4] if (t.u, t.v) == (1, 1) else r[2]
    p.shade = False
    return p


@painter
def empty_top(t):
    if t.u in (0, t.w - 1) or t.v in (0, t.h - 1):
        return PORCELAIN[4]
    return PORCELAIN[1] if (t.u, t.v) == (2, 2) else PORCELAIN[2]


TEAS = {"cinnamon_tea": (150, 80, 40), "ginger_tea": (212, 160, 70), "lemon_tea": (240, 216, 92), "passion_fruit_tea": (232, 160, 50)}


def teacup_painters(item):
    return {"cup": cup, "saucer": saucer, "tea": tea_top(TEAS[item]), "empty": empty_top}


# ============================================================================================ shapes and foods
def variants(shape):
    """{geometry suffix: boxes} for every state the block can show."""
    if shape == "pot":
        return {str(s): pot_boxes(s) for s in range(5)}
    if shape == "pie":
        return {str(s): pie_boxes(s) for s in range(5)}
    if shape == "cakes":
        return {str(s): cake_boxes(s) for s in range(5)}
    if shape == "platter":
        return {str(s): platter_boxes(s) for s in range(5)}
    if shape in ("bottle", "wine"):
        return {str(s): bottle_boxes(s, shape == "wine") for s in range(2)}
    return {f"{c}_{t}": teacup_boxes(c, t) for c in range(1, 5) for t in range(1, c + 1)}


def pie_painters(item):
    fill = (58, 48, 92)  # blueberries: deep indigo
    return {"plate": plate, "crust_side": crust_side(fill), "pie_top": lattice_top(fill)}


def cake_painters(item):
    return {"plate": plate, "cake_side": cake_side, "cake_top": cake_top}


FOODS = {  # = packs/BP/scripts/data/placedFood.js (a test checks every item has its texture)
    **{i: ("pot", pot_painters) for i in POTS},
    "blueberry_pie": ("pie", pie_painters),
    "pineapple_cake": ("cakes", cake_painters),
    "fruit_platter": ("platter", platter_painters),
    **{i: ("wine" if i.endswith("_wine") else "bottle", lambda i: bottle_painters(i, i.endswith("_wine"))) for i in BOTTLES},
    **{i: ("teacup", teacup_painters) for i in TEAS},
}


def main():
    os.makedirs(GEO, exist_ok=True)
    os.makedirs(TEX, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)
    for old in os.listdir(GEO):
        if old.startswith("food_"):
            os.remove(os.path.join(GEO, old))
    for old in os.listdir(TEX):
        os.remove(os.path.join(TEX, old))
    problems, report, layouts = [], [], {}
    for shape in ("pot", "pie", "cakes", "platter", "bottle", "wine", "teacup"):
        vs = variants(shape)
        painted = Painted(list(vs.values()))
        layouts[shape] = painted
        for suffix, boxes in vs.items():
            gid = f"geometry.kaleidoscope_harvest.food_{shape}_{suffix}"
            with open(os.path.join(GEO, f"food_{shape}_{suffix}.geo.json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(painted.geometry(gid, boxes), f, indent=1)
            problems += audit(boxes, f"food_{shape}_{suffix}")
        fullest = max(vs.values(), key=len)
        n_boxes, n_faces = count_faces(fullest)
        report.append(f"{shape}: {len(vs)} states, fullest {n_boxes} boxes / {n_faces} faces, texture {painted.width}x{painted.height}")
    sheet = Image.new("RGBA", (len(FOODS) * 68 + 4, 136), (58, 58, 64, 255))
    for n, (item, (shape, make)) in enumerate(FOODS.items()):
        im = layouts[shape].image(make(item))
        im.save(os.path.join(TEX, f"{item}.png"))
        big = im.resize((64, im.height * 64 // im.width), Image.NEAREST)
        sheet.paste(big, (4 + n * 68, 4), big)
    sheet.save(os.path.join(PREVIEW, "placed_food_textures.png"))
    print("\n".join(report))
    if problems:
        print("\n".join(problems))
        raise SystemExit(1)
    print("wrote", sum(len(variants(s)) for s in layouts), "food geometries and", len(FOODS), "textures; audit clean")


if __name__ == "__main__":
    main()
