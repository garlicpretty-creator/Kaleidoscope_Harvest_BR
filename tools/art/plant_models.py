"""3D models of the Harvest crops, vines and saplings, in the vanilla / Cookery style.

Usage: python tools/art/plant_models.py   (after tools/art/crop_textures.py)

Two shapes, both sunk one pixel into the farmland like Cookery's crops:
  "#"  four planes at 4 and 12 pixels on both axes (vanilla wheat, carrots, potatoes; Cookery `crop`)
       -> root, bulb and grain crops
  "X"  two crossed planes 20.4 wide (vanilla flowers and sweet berry bush; Cookery `crossedcrop`)
       -> leafy heads and fruiting plants
No extra fruit boxes: like vanilla, a crop is its textures. Vines are the vine texture on two planes in
front of and behind the bamboo trellis. A sapling is one X, like vanilla saplings.

Geometry (packs/RP/models/blocks/):
  <crop>_crop.geo.json           bones stage0..stage3, material instances stage0..stage3
  corn_upper.geo.json            bones stage2, stage3 (the upper block of the 2-tall corn)
  bamboo_trellis_<vine>.geo.json bones trellis, stage0..stage3
  sapling.geo.json               bone sapling (one shared model, texture per sapling block)
A block shows one stage bone per permutation (minecraft:geometry bone_visibility) and maps
material instance stageN to <crop>_stage_N.
"""
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import station_models as sm  # noqa: E402  (trellis boxes)

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CROPS = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "crops")
SAPLINGS = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "saplings")
GEO = os.path.join(ROOT, "packs", "RP", "models", "blocks")
PREVIEW = os.path.join(ROOT, "art", "previews", "plant_models.png")

VINES = ["cucumber", "black_pepper", "grape", "passion_fruit"]
X = (45, -45)


def tex(name):
    return Image.open(os.path.join(CROPS, name + ".png")).convert("RGBA")


def face(mat, u, v, w, h):
    return {"uv": [u, v], "uv_size": [w, h], "material_instance": mat}


def planes(mat, size, yaws, z=0.0):
    """Vertical planes through the block centre (or at depth z), the texture on both sides."""
    return [{"origin": [-size / 2, 0, z], "size": [size, size, 0], "pivot": [0, 0, 0], "rotation": [0, yaw, 0],
             "uv": {"north": face(mat, 0, 0, 16, 16), "south": face(mat, 16, 0, -16, 16)}} for yaw in yaws]


HASH_CROPS = {"onion", "garlic", "scallion", "daikon", "peanut", "sweet_potato", "ginger", "soybean", "sesame", "cumin", "corn"}


def hash_planes(mat):
    """Vanilla crop shape: four planes at 4 and 12 pixels, sunk one pixel, texture on both sides."""
    out = []
    for z in (-4, 4):
        out.append({"origin": [-8, -1, z], "size": [16, 16, 0],
                    "uv": {"north": face(mat, 0, 0, 16, 16), "south": face(mat, 16, 0, -16, 16)}})
    for x in (-4, 4):
        out.append({"origin": [x, -1, -8], "size": [0, 16, 16],
                    "uv": {"east": face(mat, 0, 0, 16, 16), "west": face(mat, 16, 0, -16, 16)}})
    return out


def cross_planes(mat):
    """Cookery crossedcrop: two planes 20.4 wide crossed at 45 degrees, sunk one pixel."""
    return [{"origin": [-10.2, -1, 0], "size": [20.4, 16, 0], "pivot": [0, 7, 0], "rotation": [0, yaw, 0],
             "uv": {"north": face(mat, 0, 0, 16, 16), "south": face(mat, 16, 0, -16, 16)}} for yaw in (-45, 45)]


def stage_cubes(crop, name, n):
    mat = "stage%d" % n
    return hash_planes(mat) if crop in HASH_CROPS else cross_planes(mat)


def write(name, bones, width=16, height=16):
    geo = {"format_version": "1.21.110", "minecraft:geometry": [{
        "description": {"identifier": "geometry.kaleidoscope_harvest." + name, "texture_width": width, "texture_height": height,
                        "visible_bounds_width": 2, "visible_bounds_height": 2.5, "visible_bounds_offset": [0, 1, 0]},
        "bones": [{"name": b, "pivot": [0, 0, 0], "cubes": c} for b, c in bones]}]}
    with open(os.path.join(GEO, name + ".geo.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo, f, separators=(",", ":"))
    return sum(len(c) for _, c in bones)


def vine_model(crop):
    """The trellis with the vine on two planes in front of and behind the lattice, fruit boxes on the outside."""
    trellis = dict(sm.trellis())["trellis"]
    for c in trellis:  # trellis faces use the station atlas through their own material instance
        for f in c["uv"].values():
            f["material_instance"] = "trellis"
    bones = [("trellis", trellis)]
    for n in range(4):
        mat = "stage%d" % n
        cubes = []
        for z in (-1.5, 1.5):
            cubes += planes(mat, 16, (0,), z)
        for c in cubes:  # stage textures are 16x16, the geometry's UV space is the 64x64 trellis atlas
            for f in c["uv"].values():
                f["uv"] = [v * 4 for v in f["uv"]]
                f["uv_size"] = [v * 4 for v in f["uv_size"]]
        bones.append((mat, cubes))
    return bones


def preview(models):
    """Front-and-side sketch of each model: the stage textures as they stand, fruit boxes outlined."""
    cell = 70
    sheet = Image.new("RGB", (190 + 4 * cell, len(models) * cell + 8), (104, 120, 96))
    draw = ImageDraw.Draw(sheet)
    for row, (label, names, nboxes) in enumerate(models):
        y = 4 + row * cell
        draw.text((4, y + 26), "%s (%d cubes)" % (label, nboxes), fill=(240, 240, 230))
        for col, name in enumerate(names):
            if not name:
                continue
            folder = SAPLINGS if label == "sapling" else CROPS
            im = Image.open(os.path.join(folder, name + ".png")).convert("RGBA").resize((64, 64), Image.NEAREST)
            sheet.paste(im, (190 + col * cell, y), im)
    sheet.save(PREVIEW)


def main():
    os.makedirs(GEO, exist_ok=True)
    rows = []
    field = sorted({f.rsplit("_stage_", 1)[0] for f in os.listdir(CROPS) if "_stage_" in f and not f.endswith(("_normal.png", "_mer.png"))})
    for crop in field:
        if crop in VINES or crop == "corn_upper":
            continue
        bones = [("stage%d" % n, stage_cubes(crop, "%s_stage_%d" % (crop, n), n)) for n in range(4)]
        rows.append((crop, ["%s_stage_%d" % (crop, n) for n in range(4)], write(crop + "_crop", bones)))
    upper = [("stage%d" % n, stage_cubes("corn", "corn_upper_stage_%d" % n, n)) for n in (2, 3)]
    rows.append(("corn_upper", [None, None, "corn_upper_stage_2", "corn_upper_stage_3"], write("corn_upper", upper)))
    for vine in VINES:
        rows.append(("trellis+" + vine, ["%s_stage_%d" % (vine, n) for n in range(4)], write("bamboo_trellis_" + vine, vine_model(vine), 64, 64)))
    sap = [("sapling", [{"origin": [-8, 0, 0], "size": [16, 16, 0], "pivot": [0, 0, 0], "rotation": [0, yaw, 0],
                         "uv": {"north": face("sapling", 0, 0, 16, 16), "south": face("sapling", 16, 0, -16, 16)}} for yaw in X])]
    rows.append(("sapling", ["mandarin_sapling"], write("sapling", sap)))
    preview(rows)
    for label, _, n in rows:
        print("%-22s %4d cubes" % (label, n))


if __name__ == "__main__":
    main()
