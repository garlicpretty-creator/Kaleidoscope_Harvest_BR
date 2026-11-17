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


# The pie is round: each slice is two boxes that leave its outer corner out (a PIE_CUT x PIE_CUT notch), so the whole
# pie is a stepped disc on its square plate, as a round thing is in Minecraft. The item icon shows a round pie.
PIE_CUT = 2
PIE_SIGN = {0: (1, -1), 1: (-1, -1), 2: (-1, 1), 3: (1, 1)}


def pie_boxes(s):
    out, near, mat = [PLATE], 7 - PIE_CUT, {"*": "crust_side", "top": "pie_top"}
    for k in range(4 - s):
        sx, sz = PIE_SIGN[k]
        out.append(Box(sx * 0.5, 0.5, sz * 0.5, sx * 7, 4.5, sz * near, mat))
        out.append(Box(sx * 0.5, 0.5, sz * near, sx * near, 4.5, sz * 7, mat))
    return out


def pie_edge(t):
    """Distance from the pie's rim (the stepped disc of pie_boxes), in pixels."""
    ax, az, near = abs(t.x), abs(t.z), 7 - PIE_CUT
    d = min(7 - ax, 7 - az)
    if ax < near and az < near:
        return min(d, math.hypot(near - ax, near - az))
    if ax < near or az < near:
        return min(d, max(near - ax, near - az))
    return d


CRUST = R((214, 152, 80))
CRUST_D = R((178, 110, 52))


def lattice_top(fill):
    F = R(fill, 0.7, 1.35)

    @painter
    def p(t):
        edge = pie_edge(t)
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
        outer = max(abs(t.x), abs(t.z)) > 6.9 or min(abs(t.x), abs(t.z)) > 6.9 - PIE_CUT   # the rim, notch included
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


# ============================================================================================ 1.1 foods
# Same shapes, new textures (docs/PROPOSAL_1.1.zh-TW.md「可放置」). The painters above stay as they were, so the 21
# earlier textures do not change; the new foods get painters of their own where the old ones could not show them.
def stew(broth, pieces, specks=(), cell=3, seed=40, glint=0.78):
    """Broth seen from above, like soup(), with shaped pieces: on a cell x cell grid, each cell holds at most one
    piece drawn by shape(ramp, lx, lz, a, b) (lx, lz inside the cell, a and b the cell's own random numbers;
    None leaves broth). The pieces stay put as the broth drops; specks = [(colour, lo, hi)] of the broth's noise."""
    B = R(broth, 0.8, 1.12)

    @painter
    def p(t):
        x, z = wx(t), wz(t)
        cx, cz = x // cell, z // cell
        k, acc = noise(cx, cz, seed), 0.0
        for shape, r, chance in pieces:
            acc += chance
            if k < acc:
                c = shape(r, x % cell, z % cell, noise(cx, cz, seed + 1), noise(cx, cz, seed + 2))
                if c is not None:
                    return c
                break
        n = nz(t, seed + 3)
        for colour, lo, hi in specks:
            if lo <= n < hi:
                return colour
        return B[3] if n > glint else B[2]
    p.shade_k = 0.5
    return p


def chunk(r, lx, lz, a, b):
    """A 2 x 2 chunk somewhere in its cell: lit corner, shaded corner (as soup())."""
    lx, lz = lx - int(a * 2), lz - int(b * 2)
    if 0 <= lx < 2 and 0 <= lz < 2:
        return r[4] if (lx, lz) == (0, 0) else (r[1] if (lx, lz) == (1, 1) else r[2])
    return None


def lotus_slice(hole):
    """A lotus-root slice filling its 3 x 3 cell: a pale ring round a dark hole, one corner cut so it reads round."""
    def s(r, lx, lz, a, b):
        if (lx, lz) == (1, 1):
            return hole
        cut = [(0, 0), (2, 0), (0, 2), (2, 2)][int(a * 4)]
        if (lx, lz) == cut:
            return None
        return r[4] if lx + lz <= 1 else (r[2] if lx + lz >= 3 else r[3])
    return s


def rib(bone):
    """A spare rib across its 3 x 3 cell: a bar of meat with the bone end showing."""
    def s(r, lx, lz, a, b):
        along, across = (lx, lz) if a < 0.5 else (lz, lx)
        if across != int(b * 3):
            return None
        return bone if along == (0 if b < 0.5 else 2) else (r[3] if along == 1 else r[1])
    return s


def bean(r, lx, lz, a, b):
    """One bean per 2 x 2 cell, with a lit pixel and the shadow it sits in."""
    ox, oz = int(a * 2), int(b * 2)
    if (lx, lz) == (ox, oz):
        return r[1]
    other = (1 - ox, oz) if (a * 7) % 1 < 0.5 else (ox, 1 - oz)  # the bean lies across two pixels, either way
    if (lx, lz) == other:
        return r[4] if b > 0.5 else r[2]                         # one of them catching the light
    return None


def cube(r, lx, lz, a, b):
    """A tofu cube: 2 x 2, lit edge towards the light, the cut edge in shadow."""
    lx, lz = lx - int(a * 2), lz - int(b * 2)
    if 0 <= lx < 2 and 0 <= lz < 2:
        return r[4] if lz == 0 and lx == 0 else (r[2] if lz == 1 and lx == 1 else r[3])
    return None


def luffa_slice(r, lx, lz, a, b):
    """A luffa round filling its 3 x 3 cell: dark green skin round soft pale flesh, the seedy heart a shade deeper."""
    if (lx, lz) == (1, 1):
        return r[2]
    if lx != 1 and lz != 1:
        return None if (lx, lz) == [(0, 0), (2, 0), (0, 2), (2, 2)][int(a * 4)] else r[1]
    return r[4] if lx + lz <= 1 else r[3]


def egg_ribbon(r, lx, lz, a, b):
    """Egg drop: a thin curl of yellow and white across the cell."""
    if (lx + (lz if a < 0.5 else 2 - lz)) == 2:
        return r[4] if (lx + lz) % 2 else r[3]
    return None


POTS_1_1 = {  # item: (broth colour, the broth seen from above)
    # 蓮藕排骨湯: clear amber broth, pale lotus slices with their holes, ribs with the bone end, oil beads
    "lotus_root_rib_soup": ((214, 178, 112), dict(pieces=[
        (lotus_slice((140, 104, 64)), R((244, 236, 214), 0.8, 1.05), 0.5),
        (rib((242, 234, 214)), R((166, 96, 64), 0.7, 1.25), 0.45)],
        specks=[((255, 230, 140), 0.92, 1.0)], seed=41)),
    # 絲瓜湯: pale green broth with soft luffa rounds and egg drop
    "luffa_soup": ((226, 220, 164), dict(pieces=[
        (luffa_slice, R((160, 204, 112), 0.5, 1.32), 0.55),
        (egg_ribbon, R((248, 214, 96), 0.8, 1.15), 0.35)],
        specks=[((250, 246, 228), 0.93, 1.0)], seed=50)),
    # 紅豆湯: red-brown soup full of glossy adzuki beans
    "red_bean_soup": ((150, 62, 52), dict(pieces=[(bean, R((92, 22, 28), 0.7, 2.0), 0.85)],
                                          specks=[((184, 96, 80), 0.92, 1.0)], cell=2, seed=43, glint=0.75)),
    # 綠豆湯: olive-green soup, green beans and a few split yellow ones
    "mung_bean_soup": ((180, 180, 112), dict(pieces=[(bean, R((80, 124, 48), 0.7, 1.45), 0.55),
                                                     (bean, R((232, 214, 112), 0.8, 1.1), 0.14)],
                                             specks=[((218, 214, 156), 0.92, 1.0)], cell=2, seed=50, glint=0.75)),
    # 麻婆豆腐: red chili oil, white tofu cubes, minced beef, spring onion, Sichuan pepper
    "mapo_tofu": ((176, 44, 26), dict(pieces=[(cube, R((250, 244, 226), 0.8, 1.03), 0.9)],
                                      specks=[((236, 118, 46), 0.88, 1.0), ((104, 50, 32), 0.0, 0.13),
                                              ((104, 168, 64), 0.13, 0.19), ((64, 30, 24), 0.19, 0.22)], seed=45, glint=0.8)),
}


def pot_1_1_painters(item):
    c, kw = POTS_1_1[item]
    return {"pot_out": pot_out, "pot_in": pot_in, "rim": rim, "handle": handle, "pot_floor": pot_floor,
            "soup": stew(c, **kw), "broth": broth(c)}


# 紅豆餅 (wheel cake): a round golden-brown top, the iron's darker ring round it, the seam where the two halves meet
WHEEL = R((222, 162, 82), 0.62, 1.2)


@painter
def wheel_side(t):
    if 1 <= t.y - 0.5 < 1.5:
        return WHEEL[1]                                          # the seam between the two halves
    if t.v == 0:
        return WHEEL[3]
    return WHEEL[2] if nz(t, 46) > 0.2 else WHEEL[1]


@painter
def wheel_top(t):
    du, dv = (t.u + 0.5) - t.w / 2, (t.v + 0.5) - t.h / 2
    d = math.hypot(du / (t.w / 2), dv / (t.h / 2))
    if d > 1.05:
        return WHEEL[0]                                          # outside the round: the crisp brown edge
    if d > 0.72:
        return WHEEL[2]                                          # the ring the iron browns
    if (t.u, t.v) == (t.w // 2 - 1, t.h // 2 - 1):
        return WHEEL[4]                                          # shine
    return (132, 40, 40) if (t.u, t.v) == (t.w // 2, t.h // 2) else WHEEL[3]   # a touch of red bean showing


# 綠豆糕: pale green, powdery, with a pressed flower from the mould
MUNG = R((214, 224, 158), 0.7, 1.12)


@painter
def mung_side(t):
    if t.v == 0:
        return MUNG[4]
    return MUNG[3] if nz(t, 47) > 0.85 else MUNG[2]


@painter
def mung_top(t):
    u, v, w, h = t.u, t.v, t.w, t.h
    if u in (0, w - 1) or v in (0, h - 1):
        return MUNG[3]                                           # the mould's raised border
    cu, cv = (w - 1) / 2, (h - 1) / 2
    du, dv = abs(u - cu), abs(v - cv)
    if du + dv <= 0.6:
        return MUNG[0]                                           # the flower's heart, pressed deep
    if (du < 0.6 and dv <= 1.6) or (dv < 0.6 and du <= 1.6):
        return MUNG[1]                                           # four petals
    return MUNG[4] if nz(t, 48) > 0.8 else MUNG[3]


def cake_1_1_painters(item):
    if item == "red_bean_cake":
        return {"plate": plate, "cake_side": wheel_side, "cake_top": wheel_top}
    return {"plate": plate, "cake_side": mung_side, "cake_top": mung_top}


BOTTLES_1_1 = {
    "loquat_juice": (248, 184, 82),        # 枇杷汁: apricot
    "star_fruit_juice": (236, 222, 98),    # 楊桃汁: pale yellow
    "papaya_milk": (255, 192, 120),        # 木瓜牛奶: creamy orange
    "longan_wine": (226, 184, 110),        # 龍眼酒: pale amber
}
MARKS_1_1 = {"loquat_juice": (214, 120, 34), "star_fruit_juice": (150, 176, 56), "papaya_milk": (232, 108, 52)}


def bottle_1_1_painters(item, wine):
    c = BOTTLES_1_1[item]
    fill_to, label = (5, (1.5, 4)) if wine else (6.5, (3, 5))
    return {"body": bottle_body(c, R(MARKS_1_1.get(item, c)), fill_to, label, wine), "body_top": bottle_top(c, fill_to),
            "empty": empty_glass, "empty_top": bottle_top(c, fill_to), "neck": neck, "neck_top": neck_top,
            "cork": cork, "seal": seal}


def tea_top_with(c, floats):
    """tea_top() with something floating in the cup: floats = {(u, v): colour}."""
    base = tea_top(c)

    @painter
    def p(t):
        if (t.u, t.v) in floats and 0 < t.u < t.w - 1 and 0 < t.v < t.h - 1:
            return floats[(t.u, t.v)]
        return base(t)
    p.shade = False
    return p


TEAS_1_1 = {
    "lemongrass_tea": ((204, 206, 112), {(2, 2): (122, 172, 70)}),                        # a ring of lemongrass stalk
    "longan_tea": ((182, 110, 50), {(2, 1): (176, 44, 38), (2, 2): (108, 58, 30)}),     # a red date and a dried longan
}


def teacup_1_1_painters(item):
    c, floats = TEAS_1_1[item]
    return {"cup": cup, "saucer": saucer, "tea": tea_top_with(c, floats), "empty": empty_top}


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
    # 1.1
    **{i: ("pot", pot_1_1_painters) for i in POTS_1_1},
    "red_bean_cake": ("cakes", cake_1_1_painters),
    "mung_bean_cake": ("cakes", cake_1_1_painters),
    **{i: ("wine" if i.endswith("_wine") else "bottle", lambda i: bottle_1_1_painters(i, i.endswith("_wine"))) for i in BOTTLES_1_1},
    **{i: ("teacup", teacup_1_1_painters) for i in TEAS_1_1},
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
