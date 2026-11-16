"""Block models of the three Harvest stations: bamboo trellis, juicer, pickling jar.

Usage: python tools/art/station_models.py

Each model is built from boxes in model units (16 = one block, origin at the block's bottom centre) and
textured from one 64x64 atlas of 16x16 tileable swatches (bamboo, wood, glaze, ...). A face takes the
top-left w x h pixels of its swatch, so every face shows the material at one texture pixel per model unit.
Writes, under packs/RP:
  models/blocks/<name>.geo.json                      geometry.kaleidoscope_harvest.<name>
  textures/kaleidoscope_harvest/blocks/stations/<name>.png (+ _normal, _mer)
  textures/kaleidoscope_harvest/blocks/stations/<part>_<state>.png for the parts that change with block state
Bones whose texture changes with state use their own material instance (named in the bone list below);
the block file swaps that instance's texture per permutation. Previews go to art/previews/stations.png.
"""
import json
import os

from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GEO = os.path.join(ROOT, "packs", "RP", "models", "blocks")
TEX = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "stations")
PREVIEW = os.path.join(ROOT, "art", "previews")

# --- swatches --------------------------------------------------------------------------------------
# Each swatch: (palette dark->light, painter). Painters return a 16x16 grid of palette indices.


def bamboo(x, y):
    node = y % 8 == 0
    if node:
        return 0
    edge = x % 4
    return [1, 2, 3, 2][edge]


def bamboo_end(x, y):
    d = max(abs(x - 7.5), abs(y - 7.5))
    return 0 if d > 6 else (3 if d < 3 else 2)


def wood(x, y):
    grain = (x * 7 + (y // 4) * 3) % 11
    return 0 if grain == 0 else (1 if grain < 4 else (2 if grain < 9 else 3))


def plank_end(x, y):
    return 0 if y % 4 == 3 else (2 if (x + y) % 5 else 1)


def glaze(x, y):
    # even dark-brown glaze: a lighter band where the glaze pooled at the top edge, sparse speckles
    if y == 0:
        return 3
    if y == 1:
        return 2
    return 0 if (x * 7 + y * 5) % 19 == 0 else 1


def glaze_rim(x, y):
    return 3 if (x + y) % 6 == 0 else 2


def clay(x, y):
    return 1 if (x * 5 + y * 3) % 7 else 0


def glass(x, y):
    # mostly clear; a light frame and two short highlight streaks (index 3 = opaque, others see-through)
    if x in (0, 15) or y in (0, 15):
        return 2
    if (x - y) in (5, 6) and 2 <= y <= 7 or (x - y) == 9 and 1 <= y <= 4:
        return 3
    return 1


def steel(x, y):
    return 3 if x in (2, 3) else (1 if (x + y) % 5 else 2)


SWATCHES = {
    # name: (palette dark -> light, painter, material for MER: roughness, metalness)
    "bamboo": ([(70, 96, 38), (112, 146, 56), (146, 178, 74), (182, 206, 104)], bamboo, (200, 0)),
    "bamboo_end": ([(96, 118, 52), (150, 168, 90), (196, 190, 128), (222, 214, 160)], bamboo_end, (210, 0)),
    "wood": ([(78, 52, 30), (112, 76, 44), (138, 96, 58), (164, 118, 74)], wood, (215, 0)),
    "plank_end": ([(84, 58, 34), (120, 84, 50), (150, 108, 66), (176, 130, 84)], plank_end, (215, 0)),
    "glaze": ([(64, 38, 26), (104, 62, 38), (140, 88, 54), (186, 136, 92)], glaze, (90, 0)),
    "glaze_rim": ([(52, 32, 22), (88, 54, 34), (122, 78, 50), (160, 112, 76)], glaze_rim, (100, 0)),
    "clay": ([(150, 92, 60), (176, 112, 76), (196, 130, 92), (214, 150, 110)], clay, (230, 0)),
    "glass": ([(150, 196, 204), (178, 216, 222), (206, 234, 238), (240, 252, 252)], glass, (40, 0)),
    "steel": ([(110, 116, 122), (150, 156, 162), (184, 190, 196), (222, 226, 230)], steel, (70, 180)),
}
ORDER = list(SWATCHES)  # atlas slots, 4 per row
ATLAS = 64


def slot(name):
    i = ORDER.index(name)
    return (i % 4) * 16, (i // 4) * 16


# --- geometry --------------------------------------------------------------------------------------


def face(sw, w, h, material=None):
    u, v = slot(sw) if sw in SWATCHES else (0, 0)
    out = {"uv": [u, v], "uv_size": [max(w, 1), max(h, 1)]}
    if material:
        out["material_instance"] = material
    return out


def box(x0, y0, z0, x1, y1, z1, sw, top=None, material=None, uv_whole=False, instance=None):
    """Box from block-pixel coords (0..16, origin at block corner) -> Bedrock cube (origin at bottom centre).

    `top` swatch for up/down faces; `material` names a separate material instance (whole 16x16 texture, used
    for parts whose texture is swapped per block state)."""
    w, h, d = x1 - x0, y1 - y0, z1 - z0
    t = top or sw
    if material:
        def f(a, b):
            return {"uv": [0, 0], "uv_size": [16, 16] if uv_whole else [max(a, 1), max(b, 1)], "material_instance": material}
        faces = {k: f(*s) for k, s in {"north": (w, h), "south": (w, h), "east": (d, h), "west": (d, h), "up": (w, d), "down": (w, d)}.items()}
    else:
        faces = {"north": face(sw, w, h), "south": face(sw, w, h), "east": face(sw, d, h), "west": face(sw, d, h),
                 "up": face(t, w, d), "down": face(t, w, d)}
        if instance:  # same atlas, own material instance (e.g. glass rendered with blending)
            for f in faces.values():
                f["material_instance"] = instance
    return {"origin": [x0 - 8, y0, z0 - 8], "size": [w, h, d], "uv": faces}


def ring(cx, y0, y1, r_out, r_in, sw, top=None):
    """Square ring (four boxes) around (cx, cx) -- a jar wall seen at block scale."""
    a, b = cx - r_out, cx + r_out
    c, e = cx - r_in, cx + r_in
    return [box(a, y0, a, b, y1, c, sw, top), box(a, y0, e, b, y1, b, sw, top),
            box(a, y0, c, c, y1, e, sw, top), box(e, y0, c, b, y1, e, sw, top)]


def trellis():
    cubes = []
    # two bamboo posts, three cross rails and two diagonal-free ties, all on the block's back half
    for x in (1, 13):
        cubes.append(box(x, 0, 7, x + 2, 16, 9, "bamboo", "bamboo_end"))
    for y in (3, 8, 13):
        cubes.append(box(3, y, 7.5, 13, y + 1, 8.5, "bamboo", "bamboo_end"))
    for x in (6, 10):  # two thin uprights the vine climbs
        cubes.append(box(x, 0, 7.75, x + 0.5, 16, 8.25, "bamboo", "bamboo_end"))
    # vine planes: the crop texture (stage swapped by the block) on two planes just in front of and behind
    # the lattice, so the vine covers it from both sides
    vine = []
    for z in (6.5, 9.5):
        vine.append({"origin": [-8, 0, z - 8], "size": [16, 16, 0],
                     "uv": {"north": {"uv": [0, 0], "uv_size": [16, 16], "material_instance": "vine"},
                            "south": {"uv": [16, 0], "uv_size": [-16, 16], "material_instance": "vine"}}})
    return [("trellis", cubes), ("vine", vine)]


def juicer():
    base = [box(2, 0, 2, 14, 3, 14, "wood", "plank_end"),
            box(3, 3, 3, 13, 4, 13, "wood", "plank_end")]
    # glass jug on the base: four walls, open top, spout on the north
    jug = [dict(c, uv={k: dict(f, material_instance="glass") for k, f in c["uv"].items()})
           for c in ring(8, 4, 12, 5, 4, "glass") + [box(4, 4, 4, 12, 4.5, 12, "glass"), box(7, 10, 2, 9, 11, 3, "glass")]]
    # steel reamer cone sitting on the jug
    reamer = [box(5, 12, 5, 11, 13, 11, "steel"), box(6, 13, 6, 10, 14, 10, "steel"), box(7, 14, 7, 9, 15.5, 9, "steel")]
    # wooden press handle on the east side
    handle = [box(13, 8, 7, 14, 15, 9, "wood", "plank_end"), box(9, 15, 7, 14, 16, 9, "wood", "plank_end")]
    # juice inside the jug: its level (height) and colour change with the block state
    juice = [box(4, 4.5, 4, 12, 9, 12, "glass", material="juice", uv_whole=True)]
    return [("base", base), ("jug", jug), ("reamer", reamer), ("handle", handle), ("juice", juice)]


def pickling_jar():
    body = [box(5, 0, 5, 11, 1, 11, "glaze", "glaze_rim")]
    body += [box(4, 1, 4, 12, 3, 12, "glaze", "glaze_rim"),
             box(3, 3, 3, 13, 9, 13, "glaze", "glaze_rim"),
             box(4, 9, 4, 12, 11, 12, "glaze", "glaze_rim")]
    # neck and the water-seal moat around it (the rim that a 泡菜罈 lid sits in)
    neck = ring(8, 11, 12, 3, 2, "glaze_rim") + ring(8, 11, 12.5, 5, 4, "glaze_rim") + [box(3, 11, 3, 13, 11.5, 13, "glaze_rim")]
    # inverted bowl lid, pushed back so the contents show at the front of the mouth
    lid = [box(5, 12, 9, 11, 13.5, 13, "clay"), box(6, 13.5, 10, 10, 14.5, 12, "clay"), box(7, 14.5, 10.5, 9, 15, 11.5, "clay")]
    # contents seen in the mouth: colour changes with fermentation progress
    contents = [box(6, 11, 6, 10, 11.75, 10, "glaze", material="contents", uv_whole=True)]
    return [("body", body), ("neck", neck), ("lid", lid), ("contents", contents)]


MODELS = {"bamboo_trellis": trellis, "juicer": juicer, "pickling_jar": pickling_jar}

# Textures for the swapped parts: name -> colours (dark, mid, light)
STATE_TEXTURES = {
    "juice_empty": None,
    "juice_orange": ((214, 110, 24), (240, 146, 40), (252, 186, 80)),
    "juice_grape": ((70, 22, 64), (104, 36, 92), (140, 62, 124)),
    "juice_mango": ((220, 150, 20), (244, 184, 40), (252, 214, 96)),
    "contents_fresh": ((150, 186, 92), (186, 214, 120), (226, 236, 176)),
    "contents_fermenting": ((176, 150, 70), (204, 178, 92), (228, 208, 132)),
    "contents_done": ((168, 48, 34), (200, 74, 46), (226, 116, 76)),
}


def paint_atlas():
    col = Image.new("RGBA", (ATLAS, ATLAS), (0, 0, 0, 0))
    mer = Image.new("RGBA", (ATLAS, ATLAS), (0, 0, 255, 255))
    for name, (pal, painter, (rough, metal)) in SWATCHES.items():
        u, v = slot(name)
        for y in range(16):
            for x in range(16):
                i = painter(x, y)
                alpha = 255 if name != "glass" else {1: 70, 2: 150, 3: 230}.get(i, 70)
                col.putpixel((u + x, v + y), pal[i] + (alpha,))
                mer.putpixel((u + x, v + y), (metal, 0, rough, 255))
    return col, mer


def normal_from(col):
    """Relief normal map from brightness, like the Herbal tools: brighter pixels are raised."""
    w, h = col.size
    lum = [[sum(col.getpixel((x, y))[:3]) / 765 if col.getpixel((x, y))[3] else 0 for x in range(w)] for y in range(h)]
    out = Image.new("RGBA", (w, h), (128, 128, 255, 255))
    for y in range(h):
        for x in range(w):
            dx = lum[y][min(x + 1, w - 1)] - lum[y][max(x - 1, 0)]
            dy = lum[min(y + 1, h - 1)][x] - lum[max(y - 1, 0)][x]
            out.putpixel((x, y), (max(0, min(255, round(128 - dx * 90))), max(0, min(255, round(128 - dy * 90))), 255, 255))
    return out


def state_texture(cols):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    if cols is None:
        return im
    dark, mid, light = cols
    for y in range(16):
        for x in range(16):
            c = light if y < 2 else (dark if (x * 3 + y * 5) % 11 == 0 else mid)
            im.putpixel((x, y), c + (255,))
    return im


def write_geo(name, bones):
    geo = {"format_version": "1.21.110", "minecraft:geometry": [{
        "description": {"identifier": "geometry.kaleidoscope_harvest." + name, "texture_width": ATLAS, "texture_height": ATLAS,
                        "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.75, 0]},
        "bones": [{"name": n, "pivot": [0, 0, 0], "cubes": c} for n, c in bones]}]}
    with open(os.path.join(GEO, name + ".geo.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo, f, indent=1)


def main():
    os.makedirs(GEO, exist_ok=True)
    os.makedirs(TEX, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)
    col, mer = paint_atlas()
    nor = normal_from(col)
    for name, build in MODELS.items():
        write_geo(name, build())
        col.save(os.path.join(TEX, name + ".png"))
        nor.save(os.path.join(TEX, name + "_normal.png"))
        mer.save(os.path.join(TEX, name + "_mer.png"))
    for name, cols in STATE_TEXTURES.items():
        im = state_texture(cols)
        im.save(os.path.join(TEX, name + ".png"))
        normal_from(im).save(os.path.join(TEX, name + "_normal.png"))
        Image.new("RGBA", (16, 16), (0, 0, 60 if "juice" in name else 200, 255)).save(os.path.join(TEX, name + "_mer.png"))
    sheet = Image.new("RGB", (ATLAS * 4 + 8, ATLAS * 4 + 8), (58, 58, 64))
    sheet.paste(col.resize((ATLAS * 4, ATLAS * 4), Image.NEAREST), (4, 4), col.resize((ATLAS * 4, ATLAS * 4), Image.NEAREST))
    ImageDraw.Draw(sheet)
    sheet.save(os.path.join(PREVIEW, "station_atlas.png"))
    print("wrote", ", ".join(MODELS), "and", len(STATE_TEXTURES), "state textures")


if __name__ == "__main__":
    main()
