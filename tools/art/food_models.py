"""Block models and textures of the placeable foods and drinks (docs/superpowers/specs/2026-11-17-placeable-food-design.md).

Usage: python tools/art/food_models.py

One model per shape, shared by every food of that shape; one 32x32 texture per food, four 16x16 swatches:
  slot 0  the container (clay pot, plate, glass, teacup)
  slot 1  the food's main colour (the soup, the crust, the juice, the tea)
  slot 2  an accent (chunks, filling, pulp)
  slot 3  a second accent (more chunks, a cork)
A face takes the top-left w x h pixels of its swatch (one texture pixel per model unit), like the stations.
Bones per shape (the block shows them by food_stage / cup_count, tools/generate.mjs):
  pot       pot, soup_1..4 and bits_1..4 (the level after 4 - k bites)
  pie, cakes, platter   plate, piece_1..4 (piece i goes with bite 5 - i)
  bottle, wine          bottle (glass, material instance "glass"), cork, liquid
  teacup    cup_1..4, tea_1..4 (Cookery's cup_stack: cup_count / tea_count)
Writes, under packs/RP: models/blocks/food_<shape>.geo.json (geometry.kaleidoscope_harvest.food_<shape>) and
textures/kaleidoscope_harvest/blocks/food/<item>.png (+ _normal, _mer). Preview: art/previews/placed_food.png.
"""
import json
import os

from PIL import Image

from station_models import normal_from

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GEO = os.path.join(ROOT, "packs", "RP", "models", "blocks")
TEX = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "food")
PREVIEW = os.path.join(ROOT, "art", "previews")
SIZE = 32

# --- colours: item -> shape and four swatch colours (container, main, accent, accent 2) -----------------------

CLAY = (98, 68, 54)  # dark earthenware, so the soups stand out against it
PLATE = (236, 232, 222)
GLASS = (200, 230, 236)
CORK = (176, 132, 84)
CUP = (232, 236, 240)
BOWL = (220, 228, 236)

FOODS = {
    # = packs/BP/scripts/data/placedFood.js (a test checks they match)
    "cabbage_pork_stew": ("pot", [CLAY, (226, 200, 150), (150, 196, 100), (204, 142, 110)]),
    "daikon_beef_brisket": ("pot", [CLAY, (156, 96, 54), (236, 230, 208), (118, 62, 40)]),
    "braised_pork": ("pot", [CLAY, (164, 54, 28), (196, 86, 44), (236, 200, 150)]),
    "corn_chowder": ("pot", [CLAY, (240, 222, 156), (250, 202, 60), (110, 160, 70)]),
    "taro_spare_ribs": ("pot", [CLAY, (204, 184, 170), (172, 140, 186), (172, 102, 70)]),
    "tofu_vegetable_soup": ("pot", [CLAY, (222, 210, 160), (246, 240, 224), (100, 160, 70)]),
    "blueberry_pie": ("pie", [PLATE, (212, 160, 92), (74, 60, 140), (232, 196, 130)]),
    "pineapple_cake": ("cakes", [PLATE, (222, 170, 92), (242, 202, 70), (190, 130, 60)]),
    "fruit_platter": ("platter", [BOWL, (242, 150, 40), (112, 50, 112), (246, 192, 52)]),
    "mandarin_juice": ("bottle", [GLASS, (244, 150, 40), (250, 190, 90), CORK]),
    "orange_juice": ("bottle", [GLASS, (250, 172, 40), (252, 206, 110), CORK]),
    "grape_juice": ("bottle", [GLASS, (110, 40, 100), (150, 70, 140), CORK]),
    "mango_juice": ("bottle", [GLASS, (250, 196, 50), (252, 222, 120), CORK]),
    "mixed_juice": ("bottle", [GLASS, (232, 122, 70), (246, 170, 90), CORK]),
    "passion_fruit_juice": ("bottle", [GLASS, (240, 190, 60), (60, 40, 30), CORK]),
    "lychee_wine": ("wine", [GLASS, (242, 236, 214), (250, 248, 236), CORK]),
    "peach_wine": ("wine", [GLASS, (246, 182, 162), (252, 214, 196), CORK]),
    "cinnamon_tea": ("teacup", [CUP, (150, 80, 40), (110, 56, 30), CUP]),
    "ginger_tea": ("teacup", [CUP, (212, 160, 70), (180, 126, 50), CUP]),
    "lemon_tea": ("teacup", [CUP, (240, 220, 92), (250, 240, 160), CUP]),
    "passion_fruit_tea": ("teacup", [CUP, (232, 160, 50), (70, 44, 30), CUP]),
}
SEE_THROUGH = {0: 90}  # glass swatch alpha for bottles; everything else opaque


def slot_uv(i):
    return [(i % 2) * 16, (i // 2) * 16]


# --- geometry ---------------------------------------------------------------------------------------------------


def box(x0, y0, z0, x1, y1, z1, side, top=None, instance=None):
    """Box in block pixels (0..16, origin at the block corner) -> Bedrock cube (origin at bottom centre)."""
    w, h, d = x1 - x0, y1 - y0, z1 - z0
    t = side if top is None else top

    def f(s, a, b):
        out = {"uv": slot_uv(s), "uv_size": [max(min(a, 16), 0.5), max(min(b, 16), 0.5)]}
        if instance:
            out["material_instance"] = instance
        return out

    faces = {"north": f(side, w, h), "south": f(side, w, h), "east": f(side, d, h), "west": f(side, d, h),
             "up": f(t, w, d), "down": f(side, w, d)}
    return {"origin": [x0 - 8, y0, z0 - 8], "size": [w, h, d], "uv": faces}


def ring(x0, z0, x1, z1, y0, y1, t, side, instance=None):
    """Four walls of thickness t inside the rectangle."""
    return [box(x0, y0, z0, x1, y1, z0 + t, side, instance=instance), box(x0, y0, z1 - t, x1, y1, z1, side, instance=instance),
            box(x0, y0, z0 + t, x0 + t, y1, z1 - t, side, instance=instance), box(x1 - t, y0, z0 + t, x1, y1, z1 - t, side, instance=instance)]


QUADS = [(3, 3), (8.5, 3), (3, 8.5), (8.5, 8.5)]  # corner of each quarter, piece_1..4


def pot():
    bones = [("pot", [box(3, 0, 3, 13, 1, 13, 0)] + ring(3, 3, 13, 13, 1, 8, 1, 0)
              + [box(1.5, 5.5, 7, 3, 6.5, 9, 0), box(13, 5.5, 7, 14.5, 6.5, 9, 0)])]
    for k in range(1, 5):
        top = 1 + 1.5 * k
        bits = [box(5, top, 5, 6.5, top + 0.75, 6.5, 2), box(9, top, 6, 10.5, top + 0.75, 7.5, 3),
                box(6.5, top, 9, 8, top + 0.75, 10.5, 2), box(9.5, top, 9.5, 10.5, top + 0.5, 10.5, 3)]
        bones += [(f"soup_{k}", [box(4, 1, 4, 12, top, 12, 1)]), (f"bits_{k}", bits)]
    return bones


def pie():
    plate = [box(2, 0, 2, 14, 0.5, 14, 0)]
    pieces = [(f"piece_{i + 1}", [box(x, 0.5, z, x + 4.5, 3, z + 4.5, 1, top=2)]) for i, (x, z) in enumerate(QUADS)]
    return [("plate", plate)] + pieces


def cakes():
    plate = [box(2, 0, 2, 14, 0.5, 14, 0)]
    pieces = []
    for i, (x, z) in enumerate(QUADS):
        pieces.append((f"piece_{i + 1}", [box(x + 0.5, 0.5, z + 0.5, x + 4, 2.5, z + 4, 1, top=3),
                                          box(x + 1.25, 2.5, z + 1.25, x + 3.25, 2.75, z + 3.25, 2)]))
    return [("plate", plate)] + pieces


def platter():
    bowl = [box(3, 0, 3, 13, 1, 13, 0)] + ring(2, 2, 14, 14, 1, 3, 1, 0)
    pieces = []
    for i, (x, z) in enumerate(QUADS):
        s = [1, 2, 3, 1][i]
        pieces.append((f"piece_{i + 1}", [box(x + 0.5, 1, z + 0.5, x + 4, 3, z + 4, s), box(x + 1.25, 3, z + 1.25, x + 3.25, 4, z + 3.25, s)]))
    return [("plate", bowl)] + pieces


def bottle():
    glass = [box(5, 0, 5, 11, 8, 11, 0, instance="glass"), box(6.5, 8, 6.5, 9.5, 10, 9.5, 0, instance="glass")]
    return [("bottle", glass), ("cork", [box(6.75, 10, 6.75, 9.25, 11.5, 9.25, 3)]),
            ("liquid", [box(5.5, 0.5, 5.5, 10.5, 6.5, 10.5, 1, top=2)])]


def wine():
    glass = [box(4.5, 0, 4.5, 11.5, 5.5, 11.5, 0, instance="glass"), box(6.5, 5.5, 6.5, 9.5, 9, 9.5, 0, instance="glass")]
    return [("bottle", glass), ("cork", [box(6.75, 9, 6.75, 9.25, 10.5, 9.25, 3)]),
            ("liquid", [box(5, 0.5, 5, 11, 4.5, 11, 1, top=2)])]


def teacup():
    bones = []
    for i, (cx, cz) in enumerate([(5, 5), (11, 5), (5, 11), (11, 11)]):
        x0, z0, x1, z1 = cx - 2.25, cz - 2.25, cx + 2.25, cz + 2.25
        bones.append((f"cup_{i + 1}", [box(x0, 0, z0, x1, 0.5, z1, 0)] + ring(x0, z0, x1, z1, 0.5, 3, 0.5, 0)))
        bones.append((f"tea_{i + 1}", [box(x0 + 0.5, 0.5, z0 + 0.5, x1 - 0.5, 2.5, z1 - 0.5, 1, top=1)]))
    return bones


SHAPES = {"pot": pot, "pie": pie, "cakes": cakes, "platter": platter, "bottle": bottle, "wine": wine, "teacup": teacup}


def write_geo(shape, bones):
    geo = {"format_version": "1.21.110", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.kaleidoscope_harvest.food_{shape}", "texture_width": SIZE, "texture_height": SIZE,
                        "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.75, 0]},
        "bones": [{"name": n, "pivot": [0, 0, 0], "cubes": c} for n, c in bones]}]}
    with open(os.path.join(GEO, f"food_{shape}.geo.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo, f, indent=1)


# --- textures ---------------------------------------------------------------------------------------------------


def shade(c, k):
    return tuple(max(0, min(255, round(v * k))) for v in c)


def paint(colours, shape):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for i, c in enumerate(colours):
        u, v = slot_uv(i)
        for y in range(16):
            for x in range(16):
                if i == 0 and shape in ("pot",):
                    k = 0.82 if y % 5 == 4 else (1.06 if (x * 7 + y * 3) % 13 == 0 else 1.0)  # clay bands
                elif i == 0 and shape in ("pie", "cakes", "platter", "teacup"):
                    k = 0.9 if x in (0, 15) or y in (0, 15) else 1.0  # glazed rim
                elif i == 0:
                    k = 1.15 if (x - y) in (4, 5) else 1.0  # glass highlight
                elif i == 2 and shape == "pie":
                    # lattice: crust strips (the crust colour) over the filling
                    if x % 5 in (0, 1) or y % 5 in (0, 1):
                        im.putpixel((u + x, v + y), shade(colours[1], 1.08 if (x + y) % 2 else 1.0) + (255,))
                        continue
                    k = 0.9 if (x * 3 + y) % 4 == 0 else 1.0
                else:
                    n = (x * 5 + y * 7) % 11
                    k = 0.84 if n == 0 else (1.1 if n == 5 else 1.0)
                    if y < 2:
                        k *= 1.08  # a lighter top edge, where a surface shows
                alpha = SEE_THROUGH.get(i, 255) if shape in ("bottle", "wine") and i == 0 else 255
                im.putpixel((u + x, v + y), shade(c, k) + (alpha,))
    return im


def main():
    os.makedirs(GEO, exist_ok=True)
    os.makedirs(TEX, exist_ok=True)
    for shape, build in SHAPES.items():
        write_geo(shape, build())
    sheet = Image.new("RGB", (len(FOODS) * 68 + 4, 72), (58, 58, 64))
    for n, (item, (shape, colours)) in enumerate(FOODS.items()):
        im = paint(colours, shape)
        im.save(os.path.join(TEX, f"{item}.png"))
        normal_from(im).save(os.path.join(TEX, f"{item}_normal.png"))
        rough = 60 if shape in ("bottle", "wine", "teacup") else 200
        Image.new("RGBA", (SIZE, SIZE), (0, 0, rough, 255)).save(os.path.join(TEX, f"{item}_mer.png"))
        big = im.resize((64, 64), Image.NEAREST)
        sheet.paste(big, (4 + n * 68, 4), big)
    os.makedirs(PREVIEW, exist_ok=True)
    sheet.save(os.path.join(PREVIEW, "placed_food_textures.png"))
    print("wrote", len(SHAPES), "food models and", len(FOODS), "textures")


if __name__ == "__main__":
    main()
