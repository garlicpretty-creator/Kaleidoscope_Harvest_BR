"""Item icons for placeable blocks (leaves and logs), drawn as a small isometric cube like a vanilla block item.

Usage: python tools/art/block_icons.py

The cube is 16x16: the top face is a rhombus from the block's top texture, the two sides from its side
texture, the left side at 80 % and the right at 62 % brightness. Writes the icon to art/icons/<id>.png and
packs/RP/textures/kaleidoscope_harvest/items/<id>.png and records the pick as "code" in art/icons/picks.json.
"""
import json
import os

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BLOCKS = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "blocks", "trees")
ITEMS = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "items")
ART = os.path.join(ROOT, "art", "icons")

TREES = ["mandarin", "sweet_orange", "lemon", "peach", "pear", "persimmon", "lychee", "mango", "banana", "star_anise", "cinnamon"]
ICONS = {f"{t}_leaves": (f"{t}_leaves_bare", f"{t}_leaves_bare") for t in TREES}
ICONS["fruitwood_log"] = ("fruitwood_log_top", "fruitwood_log")
ICONS["banana_trunk"] = ("banana_trunk", "banana_trunk")


def shade(c, f):
    return (min(255, round(c[0] * f)), min(255, round(c[1] * f)), min(255, round(c[2] * f)), c[3])


def cube(top, side):
    """Isometric cube: top rhombus rows 0..7, sides rows 4..15; each output pixel samples its face."""
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            # top face: rhombus centred at (8, 4)
            u, v = (x - 8) / 8 + (y - 4) / 4, (y - 4) / 4 - (x - 8) / 8
            if -1 <= u < 1 and -1 <= v < 1 and y < 8:
                c = top.getpixel((int((u + 1) * 8) % 16, int((v + 1) * 8) % 16))
                if c[3] > 0:
                    out.putpixel((x, y), shade(c, 1.0))
                continue
            if x < 8:  # left side: from (0,4)-(8,8) down 8 rows
                top_y = 4 + x / 2
                if top_y <= y < top_y + 8:
                    c = side.getpixel((min(15, x * 2), min(15, int((y - top_y) * 2))))
                    if c[3] > 0:
                        out.putpixel((x, y), shade(c, 0.8))
            else:  # right side: from (8,8)-(16,4)
                top_y = 8 - (x - 8) / 2
                if top_y <= y < top_y + 8:
                    c = side.getpixel((min(15, (x - 8) * 2), min(15, int((y - top_y) * 2))))
                    if c[3] > 0:
                        out.putpixel((x, y), shade(c, 0.62))
    return out


def main():
    picks_path = os.path.join(ART, "picks.json")
    picks = json.load(open(picks_path, encoding="utf8")) if os.path.exists(picks_path) else {}
    for item_id, (top, side) in ICONS.items():
        t = Image.open(os.path.join(BLOCKS, top + ".png")).convert("RGBA")
        s = Image.open(os.path.join(BLOCKS, side + ".png")).convert("RGBA")
        icon = cube(t, s)
        icon.save(os.path.join(ART, item_id + ".png"))
        icon.save(os.path.join(ITEMS, item_id + ".png"))
        picks[item_id] = "code"
    with open(picks_path, "w", encoding="utf8") as f:
        json.dump(dict(sorted(picks.items())), f, indent=1)
        f.write("\n")
    sheet = Image.new("RGBA", (len(ICONS) * 72, 72), (139, 139, 139, 255))
    for i, item_id in enumerate(ICONS):
        big = Image.open(os.path.join(ITEMS, item_id + ".png")).resize((64, 64), Image.NEAREST)
        sheet.paste(big, (i * 72 + 4, 4), big)
    sheet.save(os.path.join(ROOT, "art", "previews", "block_icons.png"))
    print("wrote", len(ICONS), "block icons")


if __name__ == "__main__":
    main()
