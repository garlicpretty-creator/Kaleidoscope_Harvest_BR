"""PBR maps for the textures that are painted without them: item icons, placed foods, stations, display entities.

Usage: python tools/art/pbr_maps.py            write every missing or out-of-date map and texture set
       python tools/art/pbr_maps.py --check    write nothing; exit 1 when something would change

The crop, sapling, tree and fruit textures get their maps from the painters that draw them (crop_textures.py and
friends). Everything else is a finished colour picture (a Retro Diffusion icon, a kit atlas), so its maps are made
from the picture, the way the other Kaleidoscope add-ons do for theirs:

  <name>_normal.png   the picture's brightness read as height (brighter = raised), turned into a normal map;
                      flat where the picture is transparent
  <name>_mer.png      metalness, emissive, roughness, one material for the whole picture, chosen by MATERIALS
                      from its name (glass and glazed things shine, metal is metal, food and plants are matt)
  <name>.texture_set.json

A map is rewritten only when its pixels change, so a rerun leaves the files alone. Run it after repainting or
re-picking any of these textures; tools/validate.mjs fails when a texture is left without its set.
"""
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
TEXTURES = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest")
# Folders whose colour textures get maps here (the rest are the painters' own).
FOLDERS = ["items", "blocks/food", "blocks/stations", "entity"]
FORMAT = "1.16.100"
LAYER = re.compile(r"_(mer|normal)\.png$")
# Textures whose maps their own painter writes (tools/art/station_models.py): only the texture set is added.
PAINTED = {"bamboo_trellis"}

# name pattern -> (metalness, roughness, relief). First match wins; relief scales the normal map.
MATERIALS = [
    (r"juice|wine|bottle|jam|jelly|syrup|honey|sauce|oil|glass", (0, 96, 0.7)),     # glass and what shines through it
    (r"tea|cup|bowl|plate|platter|jar|pot|soup|stew|chowder|contents", (0, 132, 0.8)),  # glazed ware, wet food
    (r"juicer|knife|blade|iron|steel", (170, 120, 0.9)),                           # metal parts
    (r"", (0, 205, 1.0)),                                                          # food, plants, wood: matt
]


def material(name):
    for pattern, m in MATERIALS:
        if re.search(pattern, name):
            return m
    return MATERIALS[-1][1]


def maps(colour, name):
    """(normal, mer) images for a colour image."""
    col = colour.convert("RGBA")
    w, h = col.size
    metal, rough, relief = material(name)
    px = col.load()

    def height(x, y):
        x, y = min(w - 1, max(0, x)), min(h - 1, max(0, y))
        r, g, b, a = px[x, y]
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 if a >= 128 else None

    normal = Image.new("RGBA", (w, h), (128, 128, 255, 255))
    mer = Image.new("RGBA", (w, h), (0, 0, 255, 255))
    for y in range(h):
        for x in range(w):
            here = height(x, y)
            if here is None:
                continue
            # a neighbour outside the drawing counts as level with this pixel, so the rim stays flat
            lx, rx = height(x - 1, y), height(x + 1, y)
            uy, dy = height(x, y - 1), height(x, y + 1)
            dx = ((rx if rx is not None else here) - (lx if lx is not None else here)) * 1.6 * relief
            dz = ((dy if dy is not None else here) - (uy if uy is not None else here)) * 1.6 * relief
            n = (-dx, dz, 1.0)
            ln = (n[0] ** 2 + n[1] ** 2 + 1.0) ** 0.5
            normal.putpixel((x, y), tuple(round((v / ln * 0.5 + 0.5) * 255) for v in n) + (255,))
            mer.putpixel((x, y), (metal, 0, rough, 255))
    return normal, mer


def same_pixels(path, image):
    if not os.path.exists(path):
        return False
    with Image.open(path) as old:
        return old.size == image.size and old.convert("RGBA").tobytes() == image.convert("RGBA").tobytes()


def run(check=False):
    changed = []
    for folder in FOLDERS:
        base = os.path.join(TEXTURES, *folder.split("/"))
        if not os.path.isdir(base):
            continue
        for f in sorted(os.listdir(base)):
            if not f.endswith(".png") or LAYER.search(f):
                continue
            name = f[:-4]
            path = os.path.join(base, f)
            with Image.open(path) as colour:
                normal, mer = maps(colour, name)
            for suffix, image in (("_normal", normal), ("_mer", mer)):
                out = os.path.join(base, name + suffix + ".png")
                if name in PAINTED and os.path.exists(out):
                    continue
                if not same_pixels(out, image):
                    changed.append(os.path.relpath(out, ROOT))
                    if not check:
                        image.save(out)
            ts_path = os.path.join(base, name + ".texture_set.json")
            ts = {"format_version": FORMAT, "minecraft:texture_set": {
                "color": name, "normal": name + "_normal", "metalness_emissive_roughness": name + "_mer"}}
            text = json.dumps(ts, indent=2) + "\n"
            old = open(ts_path, encoding="utf8").read() if os.path.exists(ts_path) else None
            if old is None or json.loads(old) != ts:
                changed.append(os.path.relpath(ts_path, ROOT))
                if not check:
                    with open(ts_path, "w", encoding="utf8", newline="\n") as out:
                        out.write(text)
    return changed


if __name__ == "__main__":
    check = "--check" in sys.argv
    changed = run(check)
    if check and changed:
        print("pbr_maps: out of date, run python tools/art/pbr_maps.py:\n  " + "\n  ".join(changed[:20]))
        sys.exit(1)
    print(f"pbr_maps: {len(changed)} file(s) {'would change' if check else 'written'}")
