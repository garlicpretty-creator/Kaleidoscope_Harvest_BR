"""Hanging fruit blocks of the Harvest fruit trees: one block under a leaves block, like vanilla cocoa pods
or glow berries, with three growth stages.

Usage: python tools/art/fruit_models.py

Leaves only go bare -> blossom; the fruit is its own block hanging from the underside of a leaves block and
grows small green -> full green -> ripe. Every fruit is modelled from boxes at one texture pixel per model
unit, hanging from the top of the block on a stem:
  round fruit   three crossing boxes, so the edges are cut off and it reads round (citrus, peach, persimmon)
  pear          a round body with a smaller round neck on top
  lemon         an upright oval with a small tip
  mango         an oval tilted on its long stem
  lychee        a hanging bunch of small bumpy berries on short pedicels, a cone pointing down
  star anise    eight-point star pods (four bars turned 45 degrees apart)
  banana        a stalk with tiers of fingers that curve up and out, the purple bud at the bottom
  longan (1.1)  a loose bunch of nine small smooth tan berries, four out on pedicels
  loquat (1.1)  four small upright orange ovals round a short stalk, each with a dark blossom end
  star fruit    one fruit hanging lengthwise, a core and five ridges: a five-point star seen from below
  papaya (1.1)  two long fruits on short stalks right under the leaves, shoulder over a wider body,
                ripe skin orange with green streaks at the stalk end
Cinnamon has no fruit (its bark is the harvest), so it gets no fruit block.

Writes, under packs/RP:
  models/blocks/<tree>_fruit.geo.json   geometry.kaleidoscope_harvest.<tree>_fruit, bones stage0..stage2
  textures/kaleidoscope_harvest/blocks/fruit/<tree>_fruit.png (+ _normal, _mer)
Texture (16x16, four 8x8 swatches): top-left unripe skin, top-right ripe skin, bottom-left stem,
bottom-right calyx / leaf (banana: the purple bud). A face shows the top-left w x h pixels of its swatch,
so every swatch is lit from the top left.
Preview: art/previews/fruit_preview.geo.json + fruit_preview.png (all ripe fruit in a row, one atlas) for
Blockbench, and art/previews/fruit_models.png (the textures).
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crop_textures as ct  # noqa: E402  (palettes)

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GEO = os.path.join(ROOT, "packs", "RP", "models", "blocks")
TEX = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "fruit")
PREV = os.path.join(ROOT, "art", "previews")

SWATCH = {"unripe": (0, 0), "ripe": (8, 0), "stem": (0, 8), "leaf": (8, 8)}

# ---------------------------------------------------------------- boxes


def face(sw, w, h):
    u, v = SWATCH[sw]
    return {"uv": [u, v], "uv_size": [max(1, min(round(w), 8)), max(1, min(round(h), 8))]}


def box(x0, y0, z0, w, h, d, sw, rot=None, pivot=None):
    """Box in block pixels (x/z from the north-west corner, y from the bottom) -> Bedrock cube."""
    c = {"origin": [x0 - 8, y0, z0 - 8], "size": [w, h, d],
         "uv": {"north": face(sw, w, h), "south": face(sw, w, h), "east": face(sw, d, h), "west": face(sw, d, h),
                "up": face(sw, w, d), "down": face(sw, w, d)}}
    if rot:
        c["rotation"] = rot
        c["pivot"] = [pivot[0] - 8, pivot[1], pivot[2] - 8]
    return c


def rounded(cx, cz, top, w, h, d, sw):
    """A box with its edges cut off: three crossing boxes. (cx, cz) centre, `top` its upper face."""
    y0 = top - h
    if min(w, h, d) < 3:
        return [box(cx - w / 2, y0, cz - d / 2, w, h, d, sw)]
    return [box(cx - w / 2, y0 + 1, cz - d / 2 + 1, w, h - 2, d - 2, sw),
            box(cx - w / 2 + 1, y0, cz - d / 2 + 1, w - 2, h, d - 2, sw),
            box(cx - w / 2 + 1, y0 + 1, cz - d / 2, w - 2, h - 2, d, sw)]


def stem(cx, cz, length):
    return box(cx - 0.5, 16 - length, cz - 0.5, 1, length, 1, "stem")


def scaled(n, s):
    return max(2, round(n * s))


# ---------------------------------------------------------------- one fruit per kind
# Each builder: (cx, cz, stem length, skin, scale) -> cubes


def citrus(size, height=None, calyx=True):
    def build(cx, cz, length, skin, s):
        w, h = scaled(size, s), scaled(height or size, s)
        top = 16 - length
        out = [stem(cx, cz, length)] + rounded(cx, cz, top, w, h, w, skin)
        if calyx:
            out.append(box(cx - 1, top - 0.5, cz - 1, 2, 0.5, 2, "leaf"))
        return out
    return build


def persimmon(cx, cz, length, skin, s):
    w, h = scaled(5, s), scaled(4, s)
    top = 16 - length
    out = [stem(cx, cz, length)] + rounded(cx, cz, top, w, h, w, skin)
    # the four-leaf calyx lying on top of the fruit
    out += [box(cx - 2, top - 0.5, cz - 0.75, 4, 0.75, 1.5, "leaf"), box(cx - 0.75, top - 0.5, cz - 2, 1.5, 0.75, 4, "leaf")]
    return out


def peach(cx, cz, length, skin, s):
    w = scaled(5, s)
    top = 16 - length
    out = [stem(cx, cz, length)] + rounded(cx, cz, top, w, w, w, skin)
    # one narrow leaf on the stem, tipped down and out
    out.append(box(cx + 0.5, top + 1, cz - 0.5, 3, 0.5, 1.5, "leaf", rot=[0, 0, 30], pivot=[cx + 0.5, top + 1, cz]))
    return out


def pear(cx, cz, length, skin, s):
    w, h, n = scaled(5, s), scaled(4, s), scaled(3, s)
    top = 16 - length
    neck = rounded(cx, cz, top, n, n, n, skin)
    return [stem(cx, cz, length)] + neck + rounded(cx, cz, top - n + 1, w, h, w, skin)


def lemon(cx, cz, length, skin, s):
    w, h = scaled(3, s), scaled(5, s)
    top = 16 - length
    return [stem(cx, cz, length)] + rounded(cx, cz, top, w + 1, h, w + 1, skin) + [box(cx - 0.5, top - h - 1, cz - 0.5, 1, 1, 1, skin)]


def mango(cx, cz, length, skin, s):
    w, h, d = scaled(4, s), scaled(6, s), scaled(3, s)
    top = 16 - length
    fruit = rounded(cx, cz, top, w, h, d, skin)
    for c in fruit:  # hang slightly tilted, like a mango on its long stalk
        c["rotation"] = [0, 0, 12]
        c["pivot"] = [cx - 8, top, cz - 8]
    return [stem(cx, cz, length)] + fruit


def lychee_cluster(cx, cz, length, skin, s):
    """A tidy hanging bunch: one stalk, a short central rachis, and berries on short pedicels in tiers that
    narrow downwards (3, 3 turned 60 degrees, 1 at the tip), so the bunch reads as a cone pointing down.
    Each tier's yaws are symmetric, so the bunch looks the same whichever way the rotation sign goes."""
    top = 16 - length
    if s < 1:  # young: three small berries round the stalk and one below
        size, tiers = 2, [(0, 1.25, (0, 120, 240)), (2, 0, (0,))]
    else:
        size, tiers = 3, [(0, 2, (0, 120, 240)), (2.5, 1.5, (60, 180, 300)), (5, 0, (0,))]
    bottom = top - tiers[-1][0]
    out = [stem(cx, cz, length), box(cx - 0.5, bottom - 0.5, cz - 0.5, 1, top - bottom + 0.5, 1, "stem")]
    for drop, r, yaws in tiers:
        y = top - drop
        for yaw in yaws:
            a = math.radians(yaw)
            bx, bz = round(cx + r * math.cos(a), 2), round(cz + r * math.sin(a), 2)
            if r:  # pedicel: a short stalk out from the rachis to the top of the berry
                out.append(box(cx, y - 0.5, cz - 0.25, r, 0.5, 0.5, "stem", rot=[0, yaw, 0], pivot=[cx, y - 0.25, cz]))
            out += rounded(bx, bz, y - 0.5, size, size, size, skin)
    return out


def star_anise(cx, cz, length, skin, s):
    """Eight separate boat-shaped pods around a small centre, so the points read as a star."""
    top = 16 - length
    out = [stem(cx, cz, length), box(cx - 1, top - 1.5, cz - 1, 2, 1.5, 2, skin)]
    reach = 2 if s == 1 else 1.5
    for yaw in range(0, 360, 45):
        out.append(box(cx + 1, top - 1.25, cz - 0.5, reach, 1, 1, skin, rot=[0, yaw, 0], pivot=[cx, top, cz]))
    return out


def banana(cx, cz, length, skin, s):
    """Stalk from the top; each tier is eight fingers, two per side, tilted up and outwards."""
    tiers = (12, 8, 4) if s == 1 else (12,)
    flen = 4 if s == 1 else 3
    out = [box(7, tiers[-1] - 1, 7, 2, 17 - tiers[-1], 2, "stem")]
    for y in tiers:
        for a in (6.5, 8.5):  # fingers on the north and south sides lean out along z
            out.append(box(a, y - 1, 6, 1, flen, 1, skin, rot=[40, 0, 0], pivot=[a, y - 1, 7]))
            out.append(box(a, y - 1, 9, 1, flen, 1, skin, rot=[-40, 0, 0], pivot=[a, y - 1, 10]))
            out.append(box(6, y - 1, a, 1, flen, 1, skin, rot=[0, 0, -40], pivot=[7, y - 1, a]))
            out.append(box(9, y - 1, a, 1, flen, 1, skin, rot=[0, 0, 40], pivot=[10, y - 1, a]))
    out.append(rounded(8, 8, tiers[-1] - 1, 2, 3, 2, "leaf")[0])  # the purple bud under the last tier
    return out


# ---- 1.1 fruit
def axis_pedicel(cx, cz, y, dx, dz):
    """A short horizontal stalk from the rachis towards (dx, dz), built axis-aligned (no yaw sign to get wrong)."""
    if abs(dx) >= abs(dz):
        return box(cx if dx > 0 else cx + dx, y - 0.5, cz - 0.25, abs(dx), 0.5, 0.5, "stem")
    return box(cx - 0.25, y - 0.5, cz if dz > 0 else cz + dz, 0.5, 0.5, abs(dz), "stem")


def hanging_bunch(cx, cz, length, berries, make):
    """A rachis from the stalk down to the lowest fruit; each fruit (dx, dz, drop) hangs on a pedicel when it
    sits two or more pixels out, else straight on the rachis."""
    top = 16 - length
    bottom = top - max(b[2] for b in berries)
    out = [stem(cx, cz, length), box(cx - 0.5, bottom - 0.5, cz - 0.5, 1, top - bottom + 0.5, 1, "stem")]
    for dx, dz, drop in berries:
        y = top - drop
        if max(abs(dx), abs(dz)) >= 2:
            out.append(axis_pedicel(cx, cz, y, dx, dz))
        out += make(cx + dx, cz + dz, y - 0.5)
    return out


def longan_cluster(cx, cz, length, skin, s):
    """A loose bunch of small smooth round fruits: four out on pedicels, four tucked round the rachis, one below."""
    if s < 1:
        size, berries = 2, [(2, 0, 0), (-2, 0, 0.5), (0, 2, 1), (0, -2, 0.5), (0, 0, 2.5)]
    else:
        size, berries = 3, [(3, 0, 0), (-3, 0, 0.5), (0, 3, 1), (0, -3, 0),
                            (1.5, 1.5, 3), (-1.5, -1.5, 3.5), (1.5, -1.5, 4), (-1.5, 1.5, 3), (0, 0, 6.5)]
    return hanging_bunch(cx, cz, length, berries, lambda x, z, t: rounded(x, z, t, size, size, size, skin))


def loquat_cluster(cx, cz, length, skin, s):
    """Four small upright ovals at different heights round a short stalk, each with a dark blossom end."""
    w, h = (2, 3) if s < 1 else (3, 4)
    r = 2 if s < 1 else 2.5

    def fruit(x, z, t):
        return rounded(x, z, t, w, h, w, skin) + [box(x - 0.5, t - h - 0.5, z - 0.5, 1, 0.5, 1, "leaf")]
    return hanging_bunch(cx, cz, length, [(r, 0, 0.5), (-r, 0, 1.5), (0, r, 2.5), (0, -r, 0)], fruit)


def star_fruit(cx, cz, length, skin, s):
    """One fruit hanging lengthwise: a core and five ridges 72 degrees apart, the outer part of each ridge
    shorter so the ends taper; from below the cross-section is a five-point star (the same set of yaws
    whichever way the rotation sign goes)."""
    h = scaled(6, s)
    reach = 3 if s == 1 else 2
    top = 16 - length
    y0 = top - h
    out = [stem(cx, cz, length), box(cx - 1, y0, cz - 1, 2, h, 2, skin)]
    for yaw in range(0, 360, 72):
        out.append(box(cx, y0 + 0.5, cz - 0.5, reach - 1, h - 1, 1, skin, rot=[0, yaw, 0], pivot=[cx, top, cz]))
        out.append(box(cx + reach - 1, y0 + 1.5, cz - 0.5, 1, h - 3, 1, skin, rot=[0, yaw, 0], pivot=[cx, top, cz]))
    out.append(box(cx - 0.5, y0 - 0.5, cz - 0.5, 1, 0.5, 1, "leaf"))  # dried blossom end
    return out


def papaya(cx, cz, length, skin, s):
    """An elongated fruit hanging close under the leaves: a narrow shoulder over a longer, wider body."""
    n, w, h = scaled(3, s), scaled(4, s), scaled(5, s)
    top = 16 - length
    out = [stem(cx, cz, length)] + rounded(cx, cz, top, n, n, n, skin) + rounded(cx, cz, top - n + 1, w, h, w, skin)
    out.append(box(cx - 0.5, top - n + 1 - h - 0.5, cz - 0.5, 1, 0.5, 1, skin))  # the tip
    return out


# 1.1 ripe palettes (dark -> light)
LONGAN = [(92, 64, 34), (128, 92, 50), (162, 124, 74), (194, 160, 104), (224, 196, 146)]
LOQUAT = [(150, 80, 14), (204, 118, 24), (236, 156, 40), (248, 190, 80), (254, 224, 140)]
STARF = [(132, 118, 18), (188, 168, 28), (226, 204, 48), (244, 230, 98), (252, 246, 168)]
PAPAYA = [(160, 70, 16), (212, 108, 28), (240, 146, 44), (250, 182, 84), (254, 216, 140)]


def papaya_streaks(im):
    """Green streaks running down from the stalk end of the ripe skin: orange-green, as papayas ripen."""
    for x in (1, 4, 6):
        for y in range(0, 4 if x != 4 else 2):
            im.putpixel((8 + x, y), ct.UNRIPE[2 if y else 3] + (255,))


# tree -> (ripe palette, leaf palette, builder, [(x, z, stem length), ...], lychee-style bumpy skin)
TREES = {
    "mandarin": (ct.ORANGE, ct.G, citrus(4, 3), [(5, 5, 2), (11, 7, 4), (7, 11, 3)], False),
    "sweet_orange": (ct.ORANGE, ct.G, citrus(5), [(5, 6, 2), (11, 10, 4)], False),
    "lemon": (ct.LEMON, ct.G, lemon, [(5, 6, 2), (11, 10, 3)], False),
    "peach": (ct.PEACH, ct.GL, peach, [(5, 6, 2), (10, 11, 4)], False),
    "pear": (ct.PEAR, ct.G, pear, [(5, 6, 2), (11, 10, 3)], False),
    "persimmon": (ct.PERS, ct.GD, persimmon, [(5, 6, 2), (11, 10, 4)], False),
    "lychee": (ct.RED, ct.G, lychee_cluster, [(8, 8, 5)], True),
    "mango": (ct.MANGO, ct.G, mango, [(5, 6, 5), (11, 10, 6)], False),
    "star_anise": (ct.BRONZE, ct.G, star_anise, [(5, 5, 3), (11, 7, 5), (8, 12, 4)], False),
    "banana": (ct.BANY, ct.PURPLE, banana, [(8, 8, 0)], False),
    # --- 1.1
    "longan": (LONGAN, ct.BROWN, longan_cluster, [(8, 8, 2)], False),
    "loquat": (LOQUAT, ct.BARK, loquat_cluster, [(8, 8, 2)], False),
    "star_fruit": (STARF, ct.BROWN, star_fruit, [(8, 8, 2)], False),
    "papaya": (PAPAYA, ct.G, papaya, [(5, 8, 1), (11, 8, 1)], False),
}
SKIN_EXTRA = {"papaya": papaya_streaks}  # touch-ups on a fruit's texture after the swatches

# ---------------------------------------------------------------- textures


def swatch(im, u, v, ramp, bumpy=False):
    """8x8 skin lit from the top left: highlight in the corner, darker towards the bottom right."""
    for y in range(8):
        for x in range(8):
            d = x + y
            i = 4 if d == 1 else (3 if d <= 3 else (2 if d <= 8 else 1))
            if bumpy and (x + y) % 2 == 0:
                i = max(0, i - 1)
            elif (x * 5 + y * 3) % 11 == 0:
                i = max(0, i - 1)
            im.putpixel((u + x, v + y), ramp[i] + (255,))


def texture(tree):
    ripe, leaf, _, _, bumpy = TREES[tree]
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    swatch(im, 0, 0, ct.UNRIPE, bumpy)
    swatch(im, 8, 0, ripe, bumpy)
    swatch(im, 0, 8, ct.BROWN)
    swatch(im, 8, 8, leaf)
    if tree in SKIN_EXTRA:
        SKIN_EXTRA[tree](im)
    return im


def normal_mer(im):
    w, h = im.size
    lum = [[sum(im.getpixel((x, y))[:3]) / 765 for x in range(w)] for y in range(h)]
    nor = Image.new("RGBA", (w, h), (128, 128, 255, 255))
    for y in range(h):
        for x in range(w):
            dx = lum[y][min(x + 1, w - 1)] - lum[y][max(x - 1, 0)]
            dy = lum[min(y + 1, h - 1)][x] - lum[max(y - 1, 0)][x]
            nor.putpixel((x, y), (round(128 - dx * 80), round(128 - dy * 80), 255, 255))
    mer = Image.new("RGBA", (w, h), (0, 0, 150, 255))
    for y in range(8, 16):  # stem and leaf are rougher than the skin
        for x in range(16):
            mer.putpixel((x, y), (0, 0, 205, 255))
    return nor, mer


# ---------------------------------------------------------------- output


def build(tree, stage):
    _, _, builder, spots, _ = TREES[tree]
    skin, s = ("unripe", 0.6) if stage == 0 else (("unripe", 1) if stage == 1 else ("ripe", 1))
    out = []
    for x, z, length in spots:
        out += builder(x, z, length, skin, s)
    return out


def geometry(name, bones, width=16):
    return {"format_version": "1.21.110", "minecraft:geometry": [{
        "description": {"identifier": "geometry.kaleidoscope_harvest." + name, "texture_width": width, "texture_height": 16,
                        "visible_bounds_width": 1.5 if width == 16 else 12, "visible_bounds_height": 1.5, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": [{"name": b, "pivot": [0, 16, 0], "cubes": c} for b, c in bones]}]}


def save_json(path, obj):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, separators=(",", ":"))


def main():
    os.makedirs(TEX, exist_ok=True)
    os.makedirs(PREV, exist_ok=True)
    atlas = Image.new("RGBA", (16 * len(TREES), 16), (0, 0, 0, 0))
    preview_bones = []
    for i, tree in enumerate(TREES):
        im = texture(tree)
        im.save(os.path.join(TEX, tree + "_fruit.png"))
        nor, mer = normal_mer(im)
        nor.save(os.path.join(TEX, tree + "_fruit_normal.png"))
        mer.save(os.path.join(TEX, tree + "_fruit_mer.png"))
        save_json(os.path.join(GEO, tree + "_fruit.geo.json"), geometry(tree + "_fruit", [("stage%d" % n, build(tree, n)) for n in range(3)]))
        atlas.paste(im, (16 * i, 0))
        # preview: the ripe stage of every fruit in a row, 20 units apart, UVs moved into the atlas
        cubes = json.loads(json.dumps(build(tree, 2)))
        for c in cubes:
            c["origin"][0] += 20 * i
            if "pivot" in c:
                c["pivot"][0] += 20 * i
            for f in c["uv"].values():
                f["uv"][0] += 16 * i
        preview_bones.append((tree, cubes))
    save_json(os.path.join(PREV, "fruit_preview.geo.json"), geometry("fruit_preview", preview_bones, 16 * len(TREES)))
    atlas.save(os.path.join(PREV, "fruit_preview.png"))
    sheet = Image.new("RGB", (len(TREES) * 72 + 8, 92), (104, 120, 96))
    draw = ImageDraw.Draw(sheet)
    for i, tree in enumerate(TREES):
        big = atlas.crop((16 * i, 0, 16 * i + 16, 16)).resize((64, 64), Image.NEAREST)
        sheet.paste(big, (8 + i * 72, 4), big)
        draw.text((8 + i * 72, 72), tree[:11], fill=(240, 240, 230))
    sheet.save(os.path.join(PREV, "fruit_models.png"))
    print("wrote", len(TREES), "fruit models")


if __name__ == "__main__":
    main()
